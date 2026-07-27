-- PR-10i: the manager is the day-to-day booking operator.
-- Keep generic writes closed while allowing only the records touched by the
-- atomic booking aggregate commands.

create policy "manager reads booking command records"
  on public.operational_records for select to authenticated
  using (
    private.organization_role(organization_id) = 'manager'
    and entity_type in (
      'units', 'bookings', 'consents', 'tasks', 'checklistItems',
      'scheduledMessages', 'blocks'
    )
  );

create policy "manager inserts booking command records"
  on public.operational_records for insert to authenticated
  with check (
    private.organization_role(organization_id) = 'manager'
    and entity_type in (
      'bookings', 'consents', 'tasks', 'checklistItems', 'scheduledMessages'
    )
  );

create policy "manager updates booking command records"
  on public.operational_records for update to authenticated
  using (
    private.organization_role(organization_id) = 'manager'
    and entity_type in ('bookings', 'consents', 'tasks', 'scheduledMessages')
  )
  with check (
    private.organization_role(organization_id) = 'manager'
    and entity_type in ('bookings', 'consents', 'tasks', 'scheduledMessages')
  );

create policy "manager inserts booking state version"
  on public.operational_state_versions for insert to authenticated
  with check (private.organization_role(organization_id) = 'manager');

create policy "manager updates booking state version"
  on public.operational_state_versions for update to authenticated
  using (private.organization_role(organization_id) = 'manager')
  with check (private.organization_role(organization_id) = 'manager');

create policy "manager inserts booking command audit"
  on public.audit_events for insert to authenticated
  with check (
    private.organization_role(organization_id) = 'manager'
    and actor_id = (select auth.uid())
    and entity_type = 'booking'
    and action in (
      'command_committed',
      'command_conflict',
      'related_record_conflict',
      'lifecycle_committed'
    )
  );

create policy "manager reads booking scheduled messages"
  on public.scheduled_messages for select to authenticated
  using (private.organization_role(organization_id) = 'manager');

create policy "manager inserts booking scheduled messages"
  on public.scheduled_messages for insert to authenticated
  with check (private.organization_role(organization_id) = 'manager');

create policy "manager updates booking scheduled messages"
  on public.scheduled_messages for update to authenticated
  using (private.organization_role(organization_id) = 'manager')
  with check (private.organization_role(organization_id) = 'manager');

do $$
declare
  function_sql text;
  function_signature regprocedure;
begin
  foreach function_signature in array array[
    'public.create_operational_booking(uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,text,timestamptz,text)'::regprocedure,
    'public.update_operational_booking(uuid,text,bigint,jsonb,jsonb,jsonb,jsonb,text,timestamptz,text)'::regprocedure
  ] loop
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
  end loop;
end
$$;
