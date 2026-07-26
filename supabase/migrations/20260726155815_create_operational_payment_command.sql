-- PR-8e2: append one validated payment transaction without replacing the
-- operational snapshot. The text payment ID is the idempotency boundary;
-- operational_records remains the authoritative ledger used by /api/state.

grant select, insert on table public.operational_records to authenticated;
grant select, insert, update on table public.operational_state_versions to authenticated;
grant select, insert on table public.audit_events to authenticated;

drop policy if exists "editors insert payment command audit" on public.audit_events;
create policy "editors insert payment command audit" on public.audit_events
  for insert to authenticated
  with check (
    private.is_org_editor(organization_id)
    and actor_id = (select auth.uid())
    and entity_type = 'payment'
    and action in ('command_committed', 'command_conflict')
  );

create or replace function public.create_operational_payment(
  p_organization_id uuid,
  p_payment_id text,
  p_payment jsonb,
  p_request_id text,
  p_client_sent_at timestamptz,
  p_tab_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  committed_at timestamptz := clock_timestamp();
  committed_payment jsonb;
  existing_payment jsonb;
  existing_updated_at timestamptz;
  booking jsonb;
  payment_type text;
  payment_amount numeric;
  payment_currency text;
  next_state_version bigint;
  inserted_record_version bigint;
  existing_record_version bigint;
begin
  if actor is null then
    raise exception 'Wymagane logowanie' using errcode = '42501';
  end if;
  if p_organization_id is null or not exists (
    select 1
    from public.organization_memberships
    where organization_id = p_organization_id
      and user_id = actor
      and role in ('owner', 'admin')
  ) then
    raise exception 'Brak uprawnień do księgowania płatności' using errcode = '42501';
  end if;
  if p_payment_id is null or length(trim(p_payment_id)) < 1 or length(p_payment_id) > 128 then
    raise exception 'Nieprawidłowy identyfikator transakcji' using errcode = '22023';
  end if;
  if p_request_id is null or length(trim(p_request_id)) < 8 or length(p_request_id) > 128 then
    raise exception 'Nieprawidłowy identyfikator żądania' using errcode = '22023';
  end if;
  if p_tab_id is null or length(trim(p_tab_id)) < 8 or length(p_tab_id) > 128 then
    raise exception 'Nieprawidłowy identyfikator karty' using errcode = '22023';
  end if;
  if p_client_sent_at is null then
    raise exception 'Brak czasu wysłania komendy' using errcode = '22023';
  end if;
  if p_payment is null
    or jsonb_typeof(p_payment) is distinct from 'object'
    or jsonb_typeof(p_payment -> 'id') is distinct from 'string'
    or p_payment ->> 'id' is distinct from p_payment_id
    or jsonb_typeof(p_payment -> 'bookingId') is distinct from 'string'
    or length(trim(coalesce(p_payment ->> 'bookingId', ''))) < 1
    or length(p_payment ->> 'bookingId') > 128
    or jsonb_typeof(p_payment -> 'occurredAt') is distinct from 'string'
    or length(trim(coalesce(p_payment ->> 'occurredAt', ''))) < 1
    or jsonb_typeof(p_payment -> 'type') is distinct from 'string'
    or jsonb_typeof(p_payment -> 'amount') is distinct from 'number'
    or jsonb_typeof(p_payment -> 'currency') is distinct from 'string'
    or jsonb_typeof(p_payment -> 'status') is distinct from 'string'
    or coalesce(p_payment ->> 'type', '') not in (
      'Wpłata', 'Zaliczka', 'Zwrot', 'Prowizja', 'Wypłata OTA', 'Koszt'
    )
    or coalesce(p_payment ->> 'currency', '') not in ('PLN', 'EUR')
    or p_payment ->> 'status' is distinct from 'Zaksięgowana'
    or (
      p_payment ? 'method'
      and p_payment ->> 'method' is not null
      and p_payment ->> 'method' not in ('Brak', 'Przelew', 'Gotówka', 'Karta', 'Online')
    )
  then
    raise exception 'Transakcja narusza reguły finansowe' using errcode = '22023';
  end if;

  perform (p_payment ->> 'occurredAt')::date;
  payment_type := p_payment ->> 'type';
  payment_amount := (p_payment ->> 'amount')::numeric;
  payment_currency := p_payment ->> 'currency';

  if payment_amount <= 0
    or payment_amount is null
    or payment_amount > 100000000
    or payment_amount <> round(payment_amount, 2)
  then
    raise exception 'Nieprawidłowa kwota transakcji' using errcode = '22003';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_payment) as keys(key)
    where key in ('note', 'source', 'sourceRef', 'costCategory', 'costSettingId', 'unitId')
      and p_payment -> key is not null
      and jsonb_typeof(p_payment -> key) <> 'string'
  ) or length(coalesce(p_payment ->> 'note', '')) > 2000
    or length(coalesce(p_payment ->> 'source', '')) > 2000
    or length(coalesce(p_payment ->> 'sourceRef', '')) > 2000
    or length(coalesce(p_payment ->> 'costSettingId', '')) > 128
    or length(coalesce(p_payment ->> 'unitId', '')) > 128
  then
    raise exception 'Nieprawidłowe pola opisowe transakcji' using errcode = '22023';
  end if;

  if payment_type in ('Koszt', 'Prowizja') then
    if length(trim(coalesce(p_payment ->> 'source', ''))) < 1
      or length(trim(coalesce(p_payment ->> 'unitId', ''))) < 1
    then
      raise exception 'Koszt lub prowizja wymaga źródła i domku' using errcode = '22023';
    end if;
    if payment_type = 'Prowizja'
      and p_payment ->> 'costCategory' is distinct from 'Prowizja OTA'
    then
      raise exception 'Nieprawidłowa kategoria prowizji' using errcode = '22023';
    end if;
    if payment_type = 'Koszt'
      and coalesce(p_payment ->> 'costCategory', '') not in (
        'Sprzątanie', 'Energia', 'Woda', 'Szambo', 'Serwis i naprawy',
        'Marketing', 'Podatki i opłaty', 'Inne'
      )
    then
      raise exception 'Nieprawidłowa kategoria kosztu' using errcode = '22023';
    end if;
  elsif p_payment ? 'costCategory'
    or p_payment ? 'costSettingId'
    or p_payment ? 'unitId'
  then
    raise exception 'Pola kosztowe nie pasują do rodzaju transakcji' using errcode = '22023';
  end if;

  select payload
  into booking
  from public.operational_records
  where organization_id = p_organization_id
    and entity_type = 'bookings'
    and entity_id = p_payment ->> 'bookingId';

  if booking is null then
    return jsonb_build_object('status', 'booking_not_found');
  end if;
  if coalesce(booking ->> 'currency', '') <> ''
    and booking ->> 'currency' is distinct from payment_currency
  then
    raise exception 'Waluta transakcji nie zgadza się z rezerwacją' using errcode = '22023';
  end if;
  if payment_type in ('Koszt', 'Prowizja')
    and booking ->> 'unitId' is distinct from p_payment ->> 'unitId'
  then
    raise exception 'Domek transakcji nie zgadza się z rezerwacją' using errcode = '22023';
  end if;
  if p_payment ? 'costSettingId' and not exists (
    select 1
    from public.operational_records
    where organization_id = p_organization_id
      and entity_type = 'costSettings'
      and entity_id = p_payment ->> 'costSettingId'
  ) then
    return jsonb_build_object('status', 'cost_setting_not_found');
  end if;

  committed_payment := (p_payment - 'version' - 'updatedAt') || jsonb_build_object(
    'version', 1,
    'updatedAt', committed_at
  );

  insert into public.operational_records (
    organization_id,
    entity_type,
    entity_id,
    payload,
    record_version,
    updated_at,
    updated_by
  ) values (
    p_organization_id,
    'payments',
    p_payment_id,
    committed_payment,
    1,
    committed_at,
    actor
  )
  on conflict (organization_id, entity_type, entity_id) do nothing
  returning record_version into inserted_record_version;

  if inserted_record_version is null then
    select payload, record_version, updated_at
    into existing_payment, existing_record_version, existing_updated_at
    from public.operational_records
    where organization_id = p_organization_id
      and entity_type = 'payments'
      and entity_id = p_payment_id;

    select version
    into next_state_version
    from public.operational_state_versions
    where organization_id = p_organization_id;

    if (existing_payment - 'version' - 'updatedAt') = (p_payment - 'version' - 'updatedAt') then
      return jsonb_build_object(
        'status', 'already_committed',
        'payment', existing_payment,
        'recordVersion', existing_record_version,
        'stateVersion', coalesce(next_state_version, 0),
        'savedAt', existing_updated_at
      );
    end if;

    insert into public.audit_events (
      organization_id, actor_id, entity_type, entity_id, action, payload, created_at
    ) values (
      p_organization_id,
      actor,
      'payment',
      p_payment_id,
      'command_conflict',
      jsonb_build_object(
        'request_id', p_request_id,
        'tab_id', p_tab_id,
        'record_version', existing_record_version,
        'client_sent_at', p_client_sent_at
      ),
      committed_at
    );

    return jsonb_build_object(
      'status', 'conflict',
      'recordVersion', existing_record_version
    );
  end if;

  insert into public.operational_state_versions (
    organization_id, version, updated_at, updated_by
  ) values (
    p_organization_id, 0, committed_at, actor
  )
  on conflict (organization_id) do nothing;

  update public.operational_state_versions
  set version = version + 1,
      updated_at = committed_at,
      updated_by = actor
  where organization_id = p_organization_id
  returning version into next_state_version;

  insert into public.audit_events (
    organization_id, actor_id, entity_type, entity_id, action, payload, created_at
  ) values (
    p_organization_id,
    actor,
    'payment',
    p_payment_id,
    'command_committed',
    jsonb_build_object(
      'request_id', p_request_id,
      'tab_id', p_tab_id,
      'booking_id', p_payment ->> 'bookingId',
      'payment_type', payment_type,
      'amount', payment_amount,
      'currency', payment_currency,
      'record_version', inserted_record_version,
      'state_version', next_state_version,
      'client_sent_at', p_client_sent_at
    ),
    committed_at
  );

  return jsonb_build_object(
    'status', 'committed',
    'payment', committed_payment,
    'recordVersion', inserted_record_version,
    'stateVersion', next_state_version,
    'savedAt', committed_at
  );
end $$;

revoke all on function public.create_operational_payment(
  uuid, text, jsonb, text, timestamptz, text
) from public, anon;
grant execute on function public.create_operational_payment(
  uuid, text, jsonb, text, timestamptz, text
) to authenticated;
