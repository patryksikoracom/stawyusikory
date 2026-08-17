-- Modern Supabase secret keys authorize the PostgREST request as service_role
-- without exposing the legacy `request.jwt.claim.role` setting. Authorization
-- therefore relies on the function ACL, which is the actual database boundary.

do $migration$
declare
  function_definition text;
  legacy_claim_gate constant text := $old$
  if coalesce(pg_catalog.current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Wymagana rola systemowa' using errcode = '42501';
  end if;

$old$;
begin
  select pg_catalog.pg_get_functiondef(
    'public.apply_ical_sync(uuid,jsonb,jsonb,jsonb)'::regprocedure
  ) into function_definition;

  if function_definition is null or pg_catalog.strpos(function_definition, legacy_claim_gate) = 0 then
    raise exception 'Nie znaleziono oczekiwanej bramki legacy service_role';
  end if;

  execute pg_catalog.replace(function_definition, legacy_claim_gate, '');
end;
$migration$;

revoke all on function public.apply_ical_sync(
  uuid, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.apply_ical_sync(
  uuid, jsonb, jsonb, jsonb
) to service_role;

insert into public.app_release_manifest (
  singleton,
  schema_version,
  required_migration,
  applied_at
)
values (
  true,
  '2026-08-10.5',
  '20260810123732_allow_service_key_ical_sync.sql',
  pg_catalog.now()
)
on conflict (singleton) do update
set schema_version = excluded.schema_version,
    required_migration = excluded.required_migration,
    applied_at = excluded.applied_at;
