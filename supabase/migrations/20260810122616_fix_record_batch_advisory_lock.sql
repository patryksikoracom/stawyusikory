-- Fix the deterministic advisory-lock ordering in the generic record command.
-- PostgreSQL treats a bare SRF alias as its scalar text value in this query,
-- so the previous `item ->>` expression failed at runtime with SQLSTATE 42883.

do $migration$
declare
  function_definition text;
  previous_fragment constant text := $old$
  perform pg_advisory_xact_lock(
    hashtextextended(
      p_organization_id::text || ':record:' || item ->> 'entityType' || ':' || item ->> 'entityId',
      0
    )
  )
  from jsonb_array_elements(p_changes) item
  order by item ->> 'entityType', item ->> 'entityId';
$old$;
  next_fragment constant text := $new$
  perform pg_advisory_xact_lock(
    hashtextextended(
      p_organization_id::text || ':record:' || batch_change.value ->> 'entityType' || ':' || batch_change.value ->> 'entityId',
      0
    )
  )
  from jsonb_array_elements(p_changes) as batch_change(value)
  order by batch_change.value ->> 'entityType', batch_change.value ->> 'entityId';
$new$;
begin
  select pg_catalog.pg_get_functiondef(
    'public.mutate_operational_record_batch(uuid,jsonb,text,timestamptz,text)'::regprocedure
  ) into function_definition;

  if function_definition is null or pg_catalog.strpos(function_definition, previous_fragment) = 0 then
    raise exception 'Nie znaleziono oczekiwanej wersji komendy batchowej z błędnym aliasem';
  end if;

  execute pg_catalog.replace(function_definition, previous_fragment, next_fragment);
end;
$migration$;

revoke execute on function public.mutate_operational_record_batch(
  uuid, jsonb, text, timestamptz, text
) from public, anon;
grant execute on function public.mutate_operational_record_batch(
  uuid, jsonb, text, timestamptz, text
) to authenticated;

insert into public.app_release_manifest (
  singleton,
  schema_version,
  required_migration,
  applied_at
)
values (
  true,
  '2026-08-10.3',
  '20260810122616_fix_record_batch_advisory_lock.sql',
  pg_catalog.now()
)
on conflict (singleton) do update
set schema_version = excluded.schema_version,
    required_migration = excluded.required_migration,
    applied_at = excluded.applied_at;
