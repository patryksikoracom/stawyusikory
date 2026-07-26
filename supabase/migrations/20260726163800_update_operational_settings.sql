-- PR-8e3: versioned organization settings without replacing the operational
-- snapshot. The singleton record is settings/organization and can be created
-- from expected version zero for a new organization.

grant select, insert, update on table public.operational_records to authenticated;
grant select, insert, update on table public.operational_state_versions to authenticated;
grant select, insert on table public.audit_events to authenticated;

drop policy if exists "editors insert settings command audit" on public.audit_events;
create policy "editors insert settings command audit" on public.audit_events
  for insert to authenticated
  with check (
    private.is_org_editor(organization_id)
    and actor_id = (select auth.uid())
    and entity_type = 'settings'
    and entity_id = 'organization'
    and action in ('command_committed', 'command_conflict')
  );

create or replace function public.update_operational_settings(
  p_organization_id uuid,
  p_expected_record_version bigint,
  p_settings jsonb,
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
  committed_settings jsonb;
  current_record_version bigint;
  next_record_version bigint;
  next_state_version bigint;
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
    raise exception 'Brak uprawnień do zapisu ustawień' using errcode = '42501';
  end if;
  if p_expected_record_version is null or p_expected_record_version < 0 then
    raise exception 'Nieprawidłowa wersja ustawień' using errcode = '22023';
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

  if p_settings is null
    or jsonb_typeof(p_settings) is distinct from 'object'
    or jsonb_typeof(p_settings -> 'organizationName') is distinct from 'string'
    or length(trim(coalesce(p_settings ->> 'organizationName', ''))) < 1
    or length(p_settings ->> 'organizationName') > 200
    or p_settings ->> 'timezone' is distinct from 'Europe/Warsaw'
    or jsonb_typeof(p_settings -> 'cleaningContactName') is distinct from 'string'
    or length(p_settings ->> 'cleaningContactName') > 200
    or jsonb_typeof(p_settings -> 'cleaningPhone') is distinct from 'string'
    or length(p_settings ->> 'cleaningPhone') > 32
    or jsonb_typeof(p_settings -> 'defaultCheckIn') is distinct from 'string'
    or (p_settings ->> 'defaultCheckIn') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or jsonb_typeof(p_settings -> 'defaultCheckOut') is distinct from 'string'
    or (p_settings ->> 'defaultCheckOut') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or jsonb_typeof(p_settings -> 'aiApprovalRequired') is distinct from 'boolean'
    or (
      p_settings - array[
        'organizationName',
        'timezone',
        'cleaningContactName',
        'cleaningPhone',
        'defaultCheckIn',
        'defaultCheckOut',
        'aiApprovalRequired',
        'version',
        'updatedAt'
      ]::text[]
    ) <> '{}'::jsonb
  then
    raise exception 'Ustawienia naruszają reguły operacyjne' using errcode = '22023';
  end if;

  committed_settings := (p_settings - 'version' - 'updatedAt') || jsonb_build_object(
    'version', p_expected_record_version + 1,
    'updatedAt', committed_at
  );

  if p_expected_record_version = 0 then
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
      'settings',
      'organization',
      committed_settings,
      1,
      committed_at,
      actor
    )
    on conflict (organization_id, entity_type, entity_id) do nothing
    returning record_version into next_record_version;
  else
    update public.operational_records
    set payload = committed_settings,
        record_version = record_version + 1,
        updated_at = committed_at,
        updated_by = actor
    where organization_id = p_organization_id
      and entity_type = 'settings'
      and entity_id = 'organization'
      and record_version = p_expected_record_version
    returning record_version into next_record_version;
  end if;

  if next_record_version is null then
    select record_version
    into current_record_version
    from public.operational_records
    where organization_id = p_organization_id
      and entity_type = 'settings'
      and entity_id = 'organization';

    insert into public.audit_events (
      organization_id, actor_id, entity_type, entity_id, action, payload, created_at
    ) values (
      p_organization_id,
      actor,
      'settings',
      'organization',
      'command_conflict',
      jsonb_build_object(
        'request_id', p_request_id,
        'tab_id', p_tab_id,
        'expected_record_version', p_expected_record_version,
        'current_record_version', coalesce(current_record_version, 0),
        'client_sent_at', p_client_sent_at
      ),
      committed_at
    );

    return jsonb_build_object(
      'status', 'conflict',
      'recordVersion', coalesce(current_record_version, 0)
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
    'settings',
    'organization',
    'command_committed',
    jsonb_build_object(
      'request_id', p_request_id,
      'tab_id', p_tab_id,
      'expected_record_version', p_expected_record_version,
      'record_version', next_record_version,
      'state_version', next_state_version,
      'client_sent_at', p_client_sent_at
    ),
    committed_at
  );

  return jsonb_build_object(
    'status', 'committed',
    'settings', committed_settings,
    'recordVersion', next_record_version,
    'stateVersion', next_state_version,
    'savedAt', committed_at
  );
end $$;

revoke all on function public.update_operational_settings(
  uuid, bigint, jsonb, text, timestamptz, text
) from public, anon;
grant execute on function public.update_operational_settings(
  uuid, bigint, jsonb, text, timestamptz, text
) to authenticated;
