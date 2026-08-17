-- Parenthesize JSON extraction before concatenating the advisory-lock key.
-- Without the parentheses PostgreSQL evaluates the text concatenation first
-- and then fails with `operator does not exist: text ->> unknown`.

do $migration$
declare
  function_definition text;
  previous_fragment constant text := $old$
      p_organization_id::text || ':record:' || batch_change.value ->> 'entityType' || ':' || batch_change.value ->> 'entityId',
$old$;
  next_fragment constant text := $new$
      p_organization_id::text || ':record:' || (batch_change.value ->> 'entityType') || ':' || (batch_change.value ->> 'entityId'),
$new$;
begin
  select pg_catalog.pg_get_functiondef(
    'public.mutate_operational_record_batch(uuid,jsonb,text,timestamptz,text)'::regprocedure
  ) into function_definition;

  if function_definition is null or pg_catalog.strpos(function_definition, previous_fragment) = 0 then
    raise exception 'Nie znaleziono oczekiwanej wersji klucza blokady batchowej';
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
  '2026-08-10.4',
  '20260810123338_fix_record_batch_lock_operator_precedence.sql',
  pg_catalog.now()
)
on conflict (singleton) do update
set schema_version = excluded.schema_version,
    required_migration = excluded.required_migration,
    applied_at = excluded.applied_at;
