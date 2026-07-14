-- System-only commit path for iCal synchronization and initial feed tokens.

insert into calendar_feed_tokens (organization_id, unit_id)
select organization_id, id
from units
where organization_id is not null
on conflict (organization_id, unit_id) do nothing;

create or replace function public.apply_ical_sync(
  p_organization_id uuid,
  p_connections jsonb,
  p_blocks jsonb,
  p_summary jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  item_id text;
  next_version bigint;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Wymagana rola systemowa' using errcode = '42501';
  end if;

  insert into operational_state_versions (organization_id, version)
  values (p_organization_id, 0)
  on conflict (organization_id) do nothing;

  select version + 1 into next_version
  from operational_state_versions
  where organization_id = p_organization_id
  for update;

  for item in select value from jsonb_array_elements(coalesce(p_connections, '[]'::jsonb)) loop
    item_id := item ->> 'id';
    insert into operational_records (organization_id, entity_type, entity_id, payload, record_version)
    values (p_organization_id, 'sourceConnections', item_id, item, next_version)
    on conflict (organization_id, entity_type, entity_id) do update
    set payload = excluded.payload,
        record_version = excluded.record_version,
        updated_at = now(),
        updated_by = null;
  end loop;

  delete from operational_records
  where organization_id = p_organization_id
    and entity_type = 'blocks'
    and entity_id like 'ICAL-%';

  for item in select value from jsonb_array_elements(coalesce(p_blocks, '[]'::jsonb)) loop
    item_id := item ->> 'id';
    insert into operational_records (organization_id, entity_type, entity_id, payload, record_version)
    values (p_organization_id, 'blocks', item_id, item, next_version)
    on conflict (organization_id, entity_type, entity_id) do update
    set payload = excluded.payload,
        record_version = excluded.record_version,
        updated_at = now(),
        updated_by = null;
  end loop;

  update operational_state_versions
  set version = next_version, updated_at = now(), updated_by = null
  where organization_id = p_organization_id;

  insert into audit_events (organization_id, entity_type, entity_id, action, payload)
  values (p_organization_id, 'integration', 'ical', 'sync', p_summary || jsonb_build_object('version', next_version));

  return next_version;
end $$;

revoke all on function public.apply_ical_sync(uuid, jsonb, jsonb, jsonb) from public;
revoke all on function public.apply_ical_sync(uuid, jsonb, jsonb, jsonb) from anon;
revoke all on function public.apply_ical_sync(uuid, jsonb, jsonb, jsonb) from authenticated;
grant execute on function public.apply_ical_sync(uuid, jsonb, jsonb, jsonb) to service_role;

