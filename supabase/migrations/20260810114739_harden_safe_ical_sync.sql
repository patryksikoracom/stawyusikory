-- Preserve last-known-good feed blocks in the application layer and harden the
-- single atomic commit path used by the service role.

create or replace function public.apply_ical_sync(
  p_organization_id uuid,
  p_connections jsonb,
  p_blocks jsonb,
  p_summary jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  item_id text;
  next_version bigint;
begin
  if coalesce(pg_catalog.current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Wymagana rola systemowa' using errcode = '42501';
  end if;

  insert into public.operational_state_versions (organization_id, version)
  values (p_organization_id, 0)
  on conflict (organization_id) do nothing;

  select version + 1 into next_version
  from public.operational_state_versions
  where organization_id = p_organization_id
  for update;

  for item in select value from pg_catalog.jsonb_array_elements(coalesce(p_connections, '[]'::jsonb)) loop
    item_id := item ->> 'id';
    insert into public.operational_records (organization_id, entity_type, entity_id, payload, record_version)
    values (p_organization_id, 'sourceConnections', item_id, item, next_version)
    on conflict (organization_id, entity_type, entity_id) do update
    set payload = excluded.payload,
        record_version = excluded.record_version,
        updated_at = pg_catalog.now(),
        updated_by = null;
  end loop;

  delete from public.operational_records
  where organization_id = p_organization_id
    and entity_type = 'blocks'
    and entity_id like 'ICAL-%';

  for item in select value from pg_catalog.jsonb_array_elements(coalesce(p_blocks, '[]'::jsonb)) loop
    item_id := item ->> 'id';
    insert into public.operational_records (organization_id, entity_type, entity_id, payload, record_version)
    values (p_organization_id, 'blocks', item_id, item, next_version)
    on conflict (organization_id, entity_type, entity_id) do update
    set payload = excluded.payload,
        record_version = excluded.record_version,
        updated_at = pg_catalog.now(),
        updated_by = null;
  end loop;

  update public.operational_state_versions
  set version = next_version, updated_at = pg_catalog.now(), updated_by = null
  where organization_id = p_organization_id;

  insert into public.audit_events (organization_id, entity_type, entity_id, action, payload)
  values (
    p_organization_id,
    'integration',
    'ical',
    'sync',
    p_summary || pg_catalog.jsonb_build_object('version', next_version)
  );

  return next_version;
end $$;

revoke all on function public.apply_ical_sync(uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.apply_ical_sync(uuid, jsonb, jsonb, jsonb) to service_role;

insert into public.app_release_manifest (
  singleton,
  schema_version,
  required_migration,
  applied_at
)
values (
  true,
  '2026-08-10.2',
  '20260810114739_harden_safe_ical_sync.sql',
  pg_catalog.now()
)
on conflict (singleton) do update
set schema_version = excluded.schema_version,
    required_migration = excluded.required_migration,
    applied_at = excluded.applied_at;
