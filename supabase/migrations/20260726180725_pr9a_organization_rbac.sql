-- PR-9a: explicit organization context, role matrix and tenant-safe RLS.

alter table public.organization_memberships
  drop constraint if exists organization_memberships_role_check;
alter table public.organization_memberships
  add constraint organization_memberships_role_check
  check (role in ('owner', 'admin', 'manager', 'cleaning', 'marketing', 'accounting', 'viewer'));

create index if not exists organization_memberships_user_id_idx
  on public.organization_memberships (user_id, organization_id);
create index if not exists audit_events_actor_id_idx
  on public.audit_events (actor_id);
create index if not exists integration_sync_runs_organization_id_idx
  on public.integration_sync_runs (organization_id);
create index if not exists bookings_created_by_idx on public.bookings (created_by);
create index if not exists bookings_unit_id_idx on public.bookings (unit_id);
create index if not exists calendar_blocks_organization_id_idx on public.calendar_blocks (organization_id);
create index if not exists calendar_blocks_unit_id_idx on public.calendar_blocks (unit_id);
create index if not exists channel_settings_organization_id_idx on public.channel_settings (organization_id);
create index if not exists contacts_consents_organization_id_idx on public.contacts_consents (organization_id);
create index if not exists cost_settings_organization_id_idx on public.cost_settings (organization_id);
create index if not exists cost_settings_unit_id_idx on public.cost_settings (unit_id);
create index if not exists guests_organization_id_idx on public.guests (organization_id);
create index if not exists issue_reports_organization_id_idx on public.issue_reports (organization_id);
create index if not exists media_assets_booking_id_idx on public.media_assets (booking_id);
create index if not exists media_assets_organization_id_idx on public.media_assets (organization_id);
create index if not exists operational_records_updated_by_idx on public.operational_records (updated_by);
create index if not exists operational_state_versions_updated_by_idx on public.operational_state_versions (updated_by);
create index if not exists payment_transactions_organization_id_idx on public.payment_transactions (organization_id);
create index if not exists platform_imports_matched_booking_id_idx on public.platform_imports (matched_booking_id);
create index if not exists platform_imports_organization_id_idx on public.platform_imports (organization_id);
create index if not exists rate_rules_organization_id_idx on public.rate_rules (organization_id);
create index if not exists rate_rules_unit_id_idx on public.rate_rules (unit_id);
create index if not exists source_connections_organization_id_idx on public.source_connections (organization_id);
create index if not exists task_checklist_items_organization_id_idx on public.task_checklist_items (organization_id);
create index if not exists tasks_booking_id_idx on public.tasks (booking_id);
create index if not exists tasks_owner_id_idx on public.tasks (owner_id);
create index if not exists units_organization_id_idx on public.units (organization_id);

do $$
begin
  if exists (
    select 1
    from pg_extension
    where extname = 'btree_gist'
      and extnamespace = 'public'::regnamespace
  ) then
    create schema if not exists extensions;
    alter extension btree_gist set schema extensions;
  end if;
end
$$;

create or replace function private.organization_role(target_org uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select membership.role
  from public.organization_memberships as membership
  where membership.organization_id = target_org
    and membership.user_id = (select auth.uid())
$$;

create or replace function private.has_org_permission(target_org uuid, requested_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case private.organization_role(target_org)
    when 'owner' then requested_permission = any (array['read', 'write', 'pii', 'finance', 'send', 'export'])
    when 'admin' then requested_permission = any (array['read', 'write', 'pii', 'finance', 'send', 'export'])
    when 'manager' then requested_permission = any (array['read', 'pii'])
    when 'cleaning' then requested_permission = 'read'
    when 'marketing' then requested_permission = 'read'
    when 'accounting' then requested_permission = any (array['read', 'pii', 'finance', 'export'])
    when 'viewer' then requested_permission = 'read'
    else false
  end
$$;

revoke all on function private.organization_role(uuid) from public, anon;
revoke all on function private.has_org_permission(uuid, text) from public, anon;
grant execute on function private.organization_role(uuid) to authenticated, service_role;
grant execute on function private.has_org_permission(uuid, text) to authenticated, service_role;

drop policy if exists "members read organizations" on public.organizations;
create policy "members read organizations"
  on public.organizations for select to authenticated
  using (private.has_org_permission(id, 'read'));

drop policy if exists "users read own profile" on public.users_profiles;
create policy "users read own profile"
  on public.users_profiles for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "members read own membership" on public.organization_memberships;
drop policy if exists "editors read organization memberships" on public.organization_memberships;
create policy "members read own membership"
  on public.organization_memberships for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.organization_role(organization_id) in ('owner', 'admin')
  );

drop policy if exists "owners create memberships" on public.organization_memberships;
drop policy if exists "owners update memberships" on public.organization_memberships;
drop policy if exists "owners delete memberships" on public.organization_memberships;
create policy "owners and admins create memberships"
  on public.organization_memberships for insert to authenticated
  with check (
    private.organization_role(organization_id) = 'owner'
    or (
      private.organization_role(organization_id) = 'admin'
      and role = 'viewer'
    )
  );
create policy "owners update memberships"
  on public.organization_memberships for update to authenticated
  using (private.organization_role(organization_id) = 'owner')
  with check (private.organization_role(organization_id) = 'owner');
create policy "owners delete memberships"
  on public.organization_memberships for delete to authenticated
  using (
    private.organization_role(organization_id) = 'owner'
    and user_id <> (select auth.uid())
  );

-- Replace FOR ALL editor policies plus separate SELECT policies with one policy
-- per action. This removes the Advisor's multiple-permissive-policy warnings.
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'units', 'bookings', 'tasks', 'calendar_blocks', 'rate_rules',
    'cost_settings', 'channel_settings', 'task_checklist_items', 'issue_reports'
  ] loop
    execute format('drop policy if exists %I on public.%I', 'members read ' || target_table, target_table);
    execute format('drop policy if exists %I on public.%I', 'standard members read ' || target_table, target_table);
    execute format('drop policy if exists %I on public.%I', 'editors write ' || target_table, target_table);
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.organization_role(organization_id) in (''owner'', ''admin''))',
      'unrestricted roles read ' || target_table,
      target_table
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (private.has_org_permission(organization_id, ''write''))',
      'unrestricted roles insert ' || target_table,
      target_table
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (private.has_org_permission(organization_id, ''write'')) with check (private.has_org_permission(organization_id, ''write''))',
      'unrestricted roles update ' || target_table,
      target_table
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (private.has_org_permission(organization_id, ''write''))',
      'unrestricted roles delete ' || target_table,
      target_table
    );
  end loop;
end
$$;

-- Raw JSON records contain mixed PII and finance fields. Only unrestricted roles
-- may read them through the Data API. Other roles use the server-side projection.
drop policy if exists "members read operational records" on public.operational_records;
drop policy if exists "standard members read operational records" on public.operational_records;
create policy "unrestricted roles read raw operational records"
  on public.operational_records for select to authenticated
  using (private.organization_role(organization_id) in ('owner', 'admin'));

drop policy if exists "members read state versions" on public.operational_state_versions;
drop policy if exists "standard members read state versions" on public.operational_state_versions;
create policy "members read state version"
  on public.operational_state_versions for select to authenticated
  using (private.has_org_permission(organization_id, 'read'));

-- Keep all writes fail-closed. Specialized cleaning writes continue through the
-- service-only mutate_cleaning_task RPC and never gain generic table write access.
drop policy if exists "editors insert operational records" on public.operational_records;
drop policy if exists "editors update operational records" on public.operational_records;
drop policy if exists "editors delete operational records" on public.operational_records;
create policy "unrestricted roles insert operational records"
  on public.operational_records for insert to authenticated
  with check (private.has_org_permission(organization_id, 'write'));
create policy "unrestricted roles update operational records"
  on public.operational_records for update to authenticated
  using (private.has_org_permission(organization_id, 'write'))
  with check (private.has_org_permission(organization_id, 'write'));
create policy "unrestricted roles delete operational records"
  on public.operational_records for delete to authenticated
  using (private.has_org_permission(organization_id, 'write'));

drop policy if exists "editors insert state versions" on public.operational_state_versions;
drop policy if exists "editors update state versions" on public.operational_state_versions;
create policy "unrestricted roles insert state versions"
  on public.operational_state_versions for insert to authenticated
  with check (private.has_org_permission(organization_id, 'write'));
create policy "unrestricted roles update state versions"
  on public.operational_state_versions for update to authenticated
  using (private.has_org_permission(organization_id, 'write'))
  with check (private.has_org_permission(organization_id, 'write'));

drop policy if exists "editors manage messages" on public.outbound_messages;
create policy "senders manage outbound messages"
  on public.outbound_messages for all to authenticated
  using (private.has_org_permission(organization_id, 'send'))
  with check (private.has_org_permission(organization_id, 'send'));

drop policy if exists "editors manage payments" on public.payment_transactions;
create policy "finance roles read payment transactions"
  on public.payment_transactions for select to authenticated
  using (private.has_org_permission(organization_id, 'finance'));
create policy "unrestricted roles insert payment transactions"
  on public.payment_transactions for insert to authenticated
  with check (private.has_org_permission(organization_id, 'write'));
create policy "unrestricted roles update payment transactions"
  on public.payment_transactions for update to authenticated
  using (private.has_org_permission(organization_id, 'write'))
  with check (private.has_org_permission(organization_id, 'write'));
create policy "unrestricted roles delete payment transactions"
  on public.payment_transactions for delete to authenticated
  using (private.has_org_permission(organization_id, 'write'));

drop policy if exists "editors manage invoices" on public.invoice_records;
create policy "finance roles read invoices"
  on public.invoice_records for select to authenticated
  using (private.has_org_permission(organization_id, 'finance'));
create policy "unrestricted roles insert invoices"
  on public.invoice_records for insert to authenticated
  with check (private.has_org_permission(organization_id, 'write'));
create policy "unrestricted roles update invoices"
  on public.invoice_records for update to authenticated
  using (private.has_org_permission(organization_id, 'write'))
  with check (private.has_org_permission(organization_id, 'write'));
create policy "unrestricted roles delete invoices"
  on public.invoice_records for delete to authenticated
  using (private.has_org_permission(organization_id, 'write'));

-- Prevent the obsolete snapshot from becoming a bypass around projected records.
drop policy if exists "editors manage snapshot" on public.operational_snapshots;
create policy "unrestricted roles manage snapshot"
  on public.operational_snapshots for all to authenticated
  using (private.organization_role(organization_id) in ('owner', 'admin'))
  with check (private.organization_role(organization_id) in ('owner', 'admin'));
