-- Runtime release/schema handshake. The application refuses to load cloud data
-- when this marker does not match the manifest bundled with the build.

create table if not exists public.app_release_manifest (
  singleton boolean primary key default true check (singleton),
  schema_version text not null,
  required_migration text not null,
  applied_at timestamptz not null default now()
);

alter table public.app_release_manifest enable row level security;
revoke all on table public.app_release_manifest from public, anon, authenticated;
grant select on table public.app_release_manifest to service_role;

insert into public.app_release_manifest (
  singleton,
  schema_version,
  required_migration,
  applied_at
)
values (
  true,
  '2026-08-10.1',
  '20260810113519_release_manifest.sql',
  now()
)
on conflict (singleton) do update
set schema_version = excluded.schema_version,
    required_migration = excluded.required_migration,
    applied_at = excluded.applied_at;
