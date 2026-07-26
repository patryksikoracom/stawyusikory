-- PR-8e4a: create and update one calendar block without replacing the full
-- operational snapshot. Availability decisions share the same per-unit
-- advisory lock as booking commands, so a booking and a block cannot both win.

grant select, insert, update on table public.operational_records to authenticated;
grant select, insert, update on table public.operational_state_versions to authenticated;
grant select, insert on table public.audit_events to authenticated;

drop policy if exists "editors insert calendar block command audit" on public.audit_events;
create policy "editors insert calendar block command audit" on public.audit_events
  for insert to authenticated
  with check (
    private.is_org_editor(organization_id)
    and actor_id = (select auth.uid())
    and entity_type = 'block'
    and action in ('command_committed', 'command_conflict')
  );

create or replace function public.mutate_operational_calendar_block(
  p_organization_id uuid,
  p_operation text,
  p_block_id text,
  p_expected_record_version bigint,
  p_block jsonb,
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
  current_block jsonb;
  current_record_version bigint;
  current_updated_at timestamptz;
  committed_block jsonb;
  next_record_version bigint;
  next_state_version bigint;
  old_unit_id text;
  conflict_type text;
  conflict_id text;
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
    raise exception 'Brak uprawnień do zmiany blokad kalendarza' using errcode = '42501';
  end if;
  if p_operation is null or p_operation not in ('create', 'update') then
    raise exception 'Nieprawidłowa operacja blokady' using errcode = '22023';
  end if;
  if p_block_id is null or length(trim(p_block_id)) < 1 or length(p_block_id) > 128 then
    raise exception 'Nieprawidłowy identyfikator blokady' using errcode = '22023';
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
  if p_expected_record_version is null
    or (p_operation = 'create' and p_expected_record_version <> 0)
    or (p_operation = 'update' and p_expected_record_version < 1)
  then
    raise exception 'Nieprawidłowa wersja blokady' using errcode = '22023';
  end if;

  if p_block is null
    or jsonb_typeof(p_block) <> 'object'
    or jsonb_typeof(p_block -> 'id') <> 'string'
    or p_block ->> 'id' is distinct from p_block_id
    or jsonb_typeof(p_block -> 'unitId') <> 'string'
    or length(trim(coalesce(p_block ->> 'unitId', ''))) < 1
    or length(p_block ->> 'unitId') > 128
    or jsonb_typeof(p_block -> 'dateFrom') <> 'string'
    or coalesce(p_block ->> 'dateFrom', '') !~ '^\\d{4}-\\d{2}-\\d{2}$'
    or jsonb_typeof(p_block -> 'dateTo') <> 'string'
    or coalesce(p_block ->> 'dateTo', '') !~ '^\\d{4}-\\d{2}-\\d{2}$'
    or jsonb_typeof(p_block -> 'blockType') <> 'string'
    or coalesce(p_block ->> 'blockType', '') not in (
      'Właściciel', 'Serwis', 'Remont', 'Bufor sprzątania',
      'Influencer/barter', 'Inne'
    )
    or jsonb_typeof(p_block -> 'reason') <> 'string'
    or length(trim(coalesce(p_block ->> 'reason', ''))) < 1
    or length(p_block ->> 'reason') > 1000
    or jsonb_typeof(p_block -> 'status') <> 'string'
    or coalesce(p_block ->> 'status', '') not in (
      'Planowana', 'Aktywna', 'Zakończona', 'Anulowana'
    )
    or jsonb_typeof(p_block -> 'version') <> 'number'
    or (p_block ->> 'version')::numeric <> trunc((p_block ->> 'version')::numeric)
    or (p_block ->> 'version')::numeric <> p_expected_record_version + 1
    or (
      p_block ? 'updatedAt'
      and p_block -> 'updatedAt' is not null
      and jsonb_typeof(p_block -> 'updatedAt') <> 'string'
    )
    or exists (
      select 1
      from jsonb_object_keys(p_block) as keys(key)
      where key not in (
        'id', 'unitId', 'dateFrom', 'dateTo', 'blockType', 'reason',
        'status', 'version', 'updatedAt'
      )
    )
  then
    raise exception 'Blokada narusza reguły kalendarza' using errcode = '22023';
  end if;

  perform (p_block ->> 'dateFrom')::date;
  perform (p_block ->> 'dateTo')::date;
  if (p_block ->> 'dateTo')::date <= (p_block ->> 'dateFrom')::date then
    raise exception 'Nieprawidłowy zakres blokady' using errcode = '22023';
  end if;
  if p_block ? 'updatedAt' and p_block ->> 'updatedAt' is not null then
    perform (p_block ->> 'updatedAt')::timestamptz;
  end if;

  -- The record lock prevents the same client-generated id from being created
  -- concurrently for two different units, which would otherwise use two
  -- different availability lock keys.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_organization_id::text || ':calendar-block:' || p_block_id,
      0
    )
  );

  if p_operation = 'update' then
    select payload ->> 'unitId'
    into old_unit_id
    from public.operational_records
    where organization_id = p_organization_id
      and entity_type = 'blocks'
      and entity_id = p_block_id;

    if old_unit_id is null then
      return jsonb_build_object('status', 'not_found');
    end if;
  end if;

  -- Booking mutations use the same lock key. Ordering the old and new unit
  -- identifiers prevents deadlocks when a block is moved between units.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_organization_id::text || ':' || unit_id, 0)
  )
  from (
    select distinct candidate as unit_id
    from pg_catalog.unnest(array[old_unit_id, p_block ->> 'unitId']) candidate
    where candidate is not null
    order by candidate
  ) unit_locks;

  select payload, record_version, updated_at
  into current_block, current_record_version, current_updated_at
  from public.operational_records
  where organization_id = p_organization_id
    and entity_type = 'blocks'
    and entity_id = p_block_id
  for update;

  if p_operation = 'create' and current_record_version is not null then
    select version into next_state_version
    from public.operational_state_versions
    where organization_id = p_organization_id;

    if (current_block - 'version' - 'updatedAt') = (p_block - 'version' - 'updatedAt') then
      return jsonb_build_object(
        'status', 'already_committed',
        'block', current_block,
        'recordVersion', current_record_version,
        'stateVersion', coalesce(next_state_version, 0),
        'savedAt', current_updated_at
      );
    end if;

    insert into public.audit_events (
      organization_id, actor_id, entity_type, entity_id, action, payload, created_at
    ) values (
      p_organization_id, actor, 'block', p_block_id, 'command_conflict',
      jsonb_build_object(
        'request_id', p_request_id,
        'tab_id', p_tab_id,
        'reason', 'block_id_exists',
        'record_version', current_record_version,
        'client_sent_at', p_client_sent_at
      ),
      committed_at
    );
    return jsonb_build_object(
      'status', 'exists',
      'recordVersion', current_record_version
    );
  end if;

  if p_operation = 'update' then
    if current_record_version is null then
      return jsonb_build_object('status', 'not_found');
    end if;
    if current_record_version <> p_expected_record_version then
      insert into public.audit_events (
        organization_id, actor_id, entity_type, entity_id, action, payload, created_at
      ) values (
        p_organization_id, actor, 'block', p_block_id, 'command_conflict',
        jsonb_build_object(
          'request_id', p_request_id,
          'tab_id', p_tab_id,
          'reason', 'record_version',
          'expected_record_version', p_expected_record_version,
          'current_record_version', current_record_version,
          'client_sent_at', p_client_sent_at
        ),
        committed_at
      );
      return jsonb_build_object(
        'status', 'conflict',
        'recordVersion', current_record_version
      );
    end if;
  end if;

  if not exists (
    select 1
    from public.operational_records
    where organization_id = p_organization_id
      and entity_type = 'units'
      and entity_id = p_block ->> 'unitId'
  ) then
    return jsonb_build_object('status', 'unit_not_found');
  end if;

  if p_block ->> 'status' not in ('Anulowana', 'Zakończona') then
    select 'booking', entity_id
    into conflict_type, conflict_id
    from public.operational_records
    where organization_id = p_organization_id
      and entity_type = 'bookings'
      and payload ->> 'unitId' = p_block ->> 'unitId'
      and coalesce(payload ->> 'workflowStatus', '') <> 'Anulowana'
      and not (payload ? 'deletedAt')
      and case
        when coalesce(payload ->> 'checkIn', '') ~ '^\\d{4}-\\d{2}-\\d{2}$'
          and coalesce(payload ->> 'checkOut', '') ~ '^\\d{4}-\\d{2}-\\d{2}$'
        then (payload ->> 'checkIn')::date < (p_block ->> 'dateTo')::date
          and (payload ->> 'checkOut')::date > (p_block ->> 'dateFrom')::date
        else false
      end
    limit 1;

    if conflict_id is null then
      select 'block', entity_id
      into conflict_type, conflict_id
      from public.operational_records
      where organization_id = p_organization_id
        and entity_type = 'blocks'
        and entity_id <> p_block_id
        and payload ->> 'unitId' = p_block ->> 'unitId'
        and coalesce(payload ->> 'status', '') not in ('Anulowana', 'Zakończona')
        and case
          when coalesce(payload ->> 'dateFrom', '') ~ '^\\d{4}-\\d{2}-\\d{2}$'
            and coalesce(payload ->> 'dateTo', '') ~ '^\\d{4}-\\d{2}-\\d{2}$'
          then (payload ->> 'dateFrom')::date < (p_block ->> 'dateTo')::date
            and (payload ->> 'dateTo')::date > (p_block ->> 'dateFrom')::date
          else false
        end
      limit 1;
    end if;

    if conflict_id is not null then
      insert into public.audit_events (
        organization_id, actor_id, entity_type, entity_id, action, payload, created_at
      ) values (
        p_organization_id, actor, 'block', p_block_id, 'command_conflict',
        jsonb_build_object(
          'request_id', p_request_id,
          'tab_id', p_tab_id,
          'reason', 'availability_conflict',
          'conflict_type', conflict_type,
          'conflict_id', conflict_id,
          'client_sent_at', p_client_sent_at
        ),
        committed_at
      );
      return jsonb_build_object(
        'status', 'availability_conflict',
        'recordVersion', current_record_version,
        'conflictType', conflict_type,
        'conflictId', conflict_id
      );
    end if;
  end if;

  committed_block := p_block || jsonb_build_object(
    'version', p_expected_record_version + 1,
    'updatedAt', committed_at
  );

  if p_operation = 'create' then
    insert into public.operational_records (
      organization_id, entity_type, entity_id, payload,
      record_version, updated_at, updated_by
    ) values (
      p_organization_id, 'blocks', p_block_id, committed_block,
      1, committed_at, actor
    )
    returning record_version into next_record_version;
  else
    update public.operational_records
    set payload = committed_block,
        record_version = record_version + 1,
        updated_at = committed_at,
        updated_by = actor
    where organization_id = p_organization_id
      and entity_type = 'blocks'
      and entity_id = p_block_id
      and record_version = p_expected_record_version
    returning record_version into next_record_version;

    if next_record_version is null then
      raise exception 'Wersja blokady zmieniła się po weryfikacji' using errcode = '40001';
    end if;
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
    p_organization_id, actor, 'block', p_block_id, 'command_committed',
    jsonb_build_object(
      'request_id', p_request_id,
      'tab_id', p_tab_id,
      'operation', p_operation,
      'unit_id', p_block ->> 'unitId',
      'record_version', next_record_version,
      'state_version', next_state_version,
      'client_sent_at', p_client_sent_at
    ),
    committed_at
  );

  return jsonb_build_object(
    'status', 'committed',
    'block', committed_block,
    'recordVersion', next_record_version,
    'stateVersion', next_state_version,
    'savedAt', committed_at
  );
end $$;

revoke all on function public.mutate_operational_calendar_block(
  uuid, text, text, bigint, jsonb, text, timestamptz, text
) from public, anon;
grant execute on function public.mutate_operational_calendar_block(
  uuid, text, text, bigint, jsonb, text, timestamptz, text
) to authenticated;
