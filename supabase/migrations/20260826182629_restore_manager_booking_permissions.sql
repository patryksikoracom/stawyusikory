-- Restore the day-to-day booking permissions that were narrowed accidentally
-- when update_operational_booking was replaced on 2026-08-19. Manager access
-- remains command-scoped: no general organization write permission is added.

do $$
declare
  function_sql text;
  function_signature regprocedure :=
    'public.update_operational_booking(uuid,text,bigint,jsonb,jsonb,jsonb,jsonb,text,timestamptz,text)'::regprocedure;
begin
  select pg_get_functiondef(function_signature) into function_sql;
  if strpos(function_sql, 'and role in (''owner'', ''admin'')') = 0 then
    raise exception 'Nie znaleziono bramki roli w funkcji %', function_signature;
  end if;
  function_sql := replace(
    function_sql,
    'and role in (''owner'', ''admin'')',
    'and role in (''owner'', ''admin'', ''manager'')'
  );
  execute function_sql;
end
$$;

-- A manager may cancel an existing calendar block from its explicit dialog,
-- but the create endpoint stays restricted to owner/admin.
drop policy if exists "manager updates booking command records" on public.operational_records;
create policy "manager updates booking command records"
  on public.operational_records for update to authenticated
  using (
    private.organization_role(organization_id) = 'manager'
    and entity_type in ('bookings', 'consents', 'tasks', 'scheduledMessages', 'blocks')
  )
  with check (
    private.organization_role(organization_id) = 'manager'
    and entity_type in ('bookings', 'consents', 'tasks', 'scheduledMessages', 'blocks')
  );

create policy "manager inserts calendar block command audit"
  on public.audit_events for insert to authenticated
  with check (
    private.organization_role(organization_id) = 'manager'
    and actor_id = (select auth.uid())
    and entity_type = 'block'
    and action in ('command_committed', 'command_conflict')
  );

-- Materializing an imported availability item is atomic: the source block is
-- deleted and replaced by the booking in one transaction. Permit only those
-- narrow deletes needed by the two reviewed override flows.
create policy "manager deletes booking override blocks"
  on public.operational_records for delete to authenticated
  using (
    private.organization_role(organization_id) = 'manager'
    and entity_type = 'blocks'
    and (
      entity_id like 'ICAL-%'
      or payload ->> 'blockType' = 'Bufor sprzątania'
    )
  );

-- The API still blocks manager creation. Database update access is required
-- for cancellation and is protected by the same validated command payload.
do $$
declare
  function_sql text;
  function_signature regprocedure :=
    'public.mutate_operational_calendar_block(uuid,text,text,bigint,jsonb,text,timestamptz,text)'::regprocedure;
begin
  select pg_get_functiondef(function_signature) into function_sql;
  if strpos(function_sql, 'and role in (''owner'', ''admin'')') = 0 then
    raise exception 'Nie znaleziono bramki roli w funkcji %', function_signature;
  end if;
  function_sql := replace(
    function_sql,
    'and role in (''owner'', ''admin'')',
    'and role in (''owner'', ''admin'', ''manager'')'
  );
  execute function_sql;
end
$$;

insert into public.app_release_manifest (
  singleton,
  schema_version,
  required_migration,
  applied_at
)
values (
  true,
  '2026-08-26.1',
  '20260826182629_restore_manager_booking_permissions.sql',
  now()
)
on conflict (singleton) do update
set schema_version = excluded.schema_version,
    required_migration = excluded.required_migration,
    applied_at = excluded.applied_at;
