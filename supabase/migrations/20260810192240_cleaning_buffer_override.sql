-- Allow a booking operator to replace only a verified cleaning buffer with an
-- explicit cleaning plan. Real reservations and every other block remain hard
-- availability conflicts in create_operational_booking.

create or replace function private.create_operational_booking_with_cleaning_buffer_override_impl(
  p_organization_id uuid,
  p_booking_id text,
  p_booking jsonb,
  p_contact jsonb,
  p_tasks jsonb,
  p_checklist_items jsonb,
  p_scheduled_messages jsonb,
  p_request_id text,
  p_client_sent_at timestamptz,
  p_tab_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  override_payload jsonb := p_booking -> 'availabilityOverride';
  buffer_ids text[];
  expected_count integer;
  verified_count integer;
  saved_buffers jsonb;
  saved_buffer jsonb;
  result jsonb;
begin
  if actor is null then
    raise exception 'Wymagane logowanie' using errcode = '42501';
  end if;
  if p_organization_id is null or not exists (
    select 1
    from public.organization_memberships
    where organization_id = p_organization_id
      and user_id = actor
      and role in ('owner', 'admin', 'manager')
  ) then
    raise exception 'Brak uprawnień do tworzenia rezerwacji' using errcode = '42501';
  end if;
  if jsonb_typeof(override_payload) <> 'object'
    or override_payload ->> 'kind' is distinct from 'cleaning-buffer'
    or override_payload ->> 'plan' not in ('self-cleaning', 'arranged-cleaning')
    or coalesce(override_payload ->> 'confirmedAt', '') = ''
    or jsonb_typeof(override_payload -> 'blockIds') <> 'array'
    or jsonb_array_length(override_payload -> 'blockIds') not between 1 and 10
    or p_booking -> 'importRef' ->> 'source' = 'ical'
  then
    raise exception 'Nieprawidłowe potwierdzenie buforu sprzątania' using errcode = '22023';
  end if;

  begin
    perform (override_payload ->> 'confirmedAt')::timestamptz;
  exception when others then
    raise exception 'Nieprawidłowy czas potwierdzenia buforu' using errcode = '22023';
  end;

  select array_agg(value order by value), count(distinct value)
  into buffer_ids, expected_count
  from jsonb_array_elements_text(override_payload -> 'blockIds');
  if expected_count <> jsonb_array_length(override_payload -> 'blockIds') then
    raise exception 'Lista buforów zawiera duplikaty' using errcode = '22023';
  end if;

  -- Use the same per-unit lock as the base booking command before temporarily
  -- suppressing verified buffers for its availability check.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_organization_id::text || ':' || (p_booking ->> 'unitId'),
      0
    )
  );

  select count(*), coalesce(jsonb_agg(jsonb_build_object(
    'entityId', entity_id,
    'payload', payload
  )), '[]'::jsonb)
  into verified_count, saved_buffers
  from public.operational_records
  where organization_id = p_organization_id
    and entity_type = 'blocks'
    and entity_id = any(buffer_ids)
    and payload ->> 'unitId' = p_booking ->> 'unitId'
    and coalesce(payload ->> 'status', '') not in ('Anulowana', 'Zakończona')
    and coalesce(payload ->> 'dateFrom', '') ~ '^\d{4}-\d{2}-\d{2}$'
    and coalesce(payload ->> 'dateTo', '') ~ '^\d{4}-\d{2}-\d{2}$'
    and (payload ->> 'dateFrom')::date < (p_booking ->> 'checkOut')::date
    and (payload ->> 'dateTo')::date > (p_booking ->> 'checkIn')::date
    and (
      payload ->> 'blockType' = 'Bufor sprzątania'
      or (
        entity_id like 'ICAL-%'
        and coalesce(payload ->> 'reason', '') ~* '^\[(Booking|Airbnb)\]'
        and coalesce(payload ->> 'reason', '') !~* '(reserved|reservation|booked|rezerw)'
        and (payload ->> 'dateTo')::date - (payload ->> 'dateFrom')::date between 1 and 2
      )
    );

  if verified_count <> expected_count then
    raise exception 'Wskazana blokada nie jest aktywnym buforem sprzątania' using errcode = '22023';
  end if;

  update public.operational_records
  set payload = jsonb_set(payload, '{status}', '"Anulowana"'::jsonb, true)
  where organization_id = p_organization_id
    and entity_type = 'blocks'
    and entity_id = any(buffer_ids);

  result := public.create_operational_booking(
    p_organization_id, p_booking_id, p_booking, p_contact, p_tasks,
    p_checklist_items, p_scheduled_messages, p_request_id,
    p_client_sent_at, p_tab_id
  );

  for saved_buffer in select value from jsonb_array_elements(saved_buffers)
  loop
    update public.operational_records
    set payload = saved_buffer -> 'payload'
    where organization_id = p_organization_id
      and entity_type = 'blocks'
      and entity_id = saved_buffer ->> 'entityId';
  end loop;

  return result;
end;
$$;

revoke all on function private.create_operational_booking_with_cleaning_buffer_override_impl(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, text, timestamptz, text
) from public, anon;
grant execute on function private.create_operational_booking_with_cleaning_buffer_override_impl(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, text, timestamptz, text
) to authenticated;

create or replace function public.create_operational_booking_with_cleaning_buffer_override(
  p_organization_id uuid,
  p_booking_id text,
  p_booking jsonb,
  p_contact jsonb,
  p_tasks jsonb,
  p_checklist_items jsonb,
  p_scheduled_messages jsonb,
  p_request_id text,
  p_client_sent_at timestamptz,
  p_tab_id text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.create_operational_booking_with_cleaning_buffer_override_impl(
    p_organization_id, p_booking_id, p_booking, p_contact, p_tasks,
    p_checklist_items, p_scheduled_messages, p_request_id,
    p_client_sent_at, p_tab_id
  )
$$;

revoke all on function public.create_operational_booking_with_cleaning_buffer_override(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, text, timestamptz, text
) from public, anon;
grant execute on function public.create_operational_booking_with_cleaning_buffer_override(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, text, timestamptz, text
) to authenticated;

update public.app_release_manifest
set schema_version = '2026-08-10.7',
    required_migration = '20260810192240_cleaning_buffer_override.sql',
    applied_at = now()
where singleton = true;
