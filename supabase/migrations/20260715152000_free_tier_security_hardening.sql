-- Security hardening for the free-tier production deployment.
-- Keeps MFA optional, but enforces organization roles at the database boundary.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

alter function public.is_org_member(uuid) set schema private;
alter function public.is_org_owner(uuid) set schema private;
revoke all on function private.is_org_member(uuid) from public, anon;
revoke all on function private.is_org_owner(uuid) from public, anon;
grant execute on function private.is_org_member(uuid) to authenticated, service_role;
grant execute on function private.is_org_owner(uuid) to authenticated, service_role;

create or replace function private.is_org_editor(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from organization_memberships
    where organization_id = target_org
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  )
$$;

revoke all on function private.is_org_editor(uuid) from public, anon;
grant execute on function private.is_org_editor(uuid) to authenticated, service_role;

alter function public.touch_updated_at() set search_path = public;

-- Membership access remains owner-managed. Moving the helper to the private
-- schema keeps it outside the Data API while preserving the existing policies.
drop policy if exists "members read organizations" on organizations;
create policy "members read organizations" on organizations
  for select to authenticated using (private.is_org_member(id));

drop policy if exists "members read memberships" on organization_memberships;
create policy "members read memberships" on organization_memberships
  for select to authenticated using (user_id = auth.uid() or private.is_org_member(organization_id));

drop policy if exists "owners create memberships" on organization_memberships;
drop policy if exists "owners update memberships" on organization_memberships;
drop policy if exists "owners delete memberships" on organization_memberships;
create policy "owners create memberships" on organization_memberships
  for insert to authenticated with check (private.is_org_owner(organization_id));
create policy "owners update memberships" on organization_memberships
  for update to authenticated using (private.is_org_owner(organization_id)) with check (private.is_org_owner(organization_id));
create policy "owners delete memberships" on organization_memberships
  for delete to authenticated using (private.is_org_owner(organization_id) and user_id <> auth.uid());

-- Operational JSON records are still the current application model. Members
-- can read them, but only owners/admins can create, modify, or remove them.
drop policy if exists "members manage state versions" on operational_state_versions;
create policy "members read state versions" on operational_state_versions
  for select to authenticated using (private.is_org_member(organization_id));
create policy "editors insert state versions" on operational_state_versions
  for insert to authenticated with check (private.is_org_editor(organization_id));
create policy "editors update state versions" on operational_state_versions
  for update to authenticated using (private.is_org_editor(organization_id)) with check (private.is_org_editor(organization_id));

drop policy if exists "members manage operational records" on operational_records;
create policy "members read operational records" on operational_records
  for select to authenticated using (private.is_org_member(organization_id));
create policy "editors insert operational records" on operational_records
  for insert to authenticated with check (private.is_org_editor(organization_id));
create policy "editors update operational records" on operational_records
  for update to authenticated using (private.is_org_editor(organization_id)) with check (private.is_org_editor(organization_id));
create policy "editors delete operational records" on operational_records
  for delete to authenticated using (private.is_org_editor(organization_id));

drop policy if exists "members manage snapshot" on operational_snapshots;
create policy "editors manage snapshot" on operational_snapshots
  for all to authenticated using (private.is_org_editor(organization_id)) with check (private.is_org_editor(organization_id));

-- Capability URLs and communication/financial records are not exposed to viewers.
drop policy if exists "members manage feed tokens" on calendar_feed_tokens;
create policy "editors manage feed tokens" on calendar_feed_tokens
  for all to authenticated using (private.is_org_editor(organization_id)) with check (private.is_org_editor(organization_id));

drop policy if exists "members read audit" on audit_events;
create policy "editors read audit" on audit_events
  for select to authenticated using (private.is_org_editor(organization_id));

drop policy if exists "members manage sync runs" on integration_sync_runs;
create policy "editors read sync runs" on integration_sync_runs
  for select to authenticated using (private.is_org_editor(organization_id));

drop policy if exists "members manage messages" on outbound_messages;
create policy "editors manage messages" on outbound_messages
  for all to authenticated using (private.is_org_editor(organization_id)) with check (private.is_org_editor(organization_id));

drop policy if exists "members manage payments" on payment_transactions;
create policy "editors manage payments" on payment_transactions
  for all to authenticated using (private.is_org_editor(organization_id)) with check (private.is_org_editor(organization_id));

drop policy if exists "members manage invoices" on invoice_records;
create policy "editors manage invoices" on invoice_records
  for all to authenticated using (private.is_org_editor(organization_id)) with check (private.is_org_editor(organization_id));

-- Viewer-safe operational tables: member read, editor write.
do $$
declare
  target_table text;
  old_policy text;
begin
  foreach target_table in array array['units','bookings','tasks','calendar_blocks','rate_rules','cost_settings','channel_settings','task_checklist_items','issue_reports'] loop
    foreach old_policy in array array[
      'org units','org bookings','org tasks','org blocks','org rates','org costs','org channels',
      'members manage checklists','members manage issues'
    ] loop
      execute format('drop policy if exists %I on public.%I', old_policy, target_table);
    end loop;
    execute format('create policy %I on public.%I for select to authenticated using (private.is_org_member(organization_id))', 'members read ' || target_table, target_table);
    execute format('create policy %I on public.%I for all to authenticated using (private.is_org_editor(organization_id)) with check (private.is_org_editor(organization_id))', 'editors write ' || target_table, target_table);
  end loop;
end $$;

-- Sensitive/profile tables are owner/admin only.
do $$
declare
  target_table text;
  old_policy text;
begin
  foreach target_table in array array[
    'guests','contacts_consents','media_assets','platform_imports','source_connections',
    'departure_debriefs','message_templates','automation_rules','scheduled_messages','marketing_touchpoints'
  ] loop
    foreach old_policy in array array[
      'org guests','org consents','org media','org imports','org connections',
      'members manage departure debriefs','members manage message templates',
      'members manage automation rules','members manage scheduled messages','members manage marketing touchpoints'
    ] loop
      execute format('drop policy if exists %I on public.%I', old_policy, target_table);
    end loop;
    execute format('create policy %I on public.%I for all to authenticated using (private.is_org_editor(organization_id)) with check (private.is_org_editor(organization_id))', 'editors manage ' || target_table, target_table);
  end loop;
end $$;

-- The application commit RPC runs with elevated rights, so the role check must
-- live inside the function and cannot rely on table RLS alone.
create or replace function public.replace_operational_state(p_expected_version bigint, p_state jsonb)
returns bigint language plpgsql security definer set search_path = public, private as $$
declare
  target_org uuid; current_version bigint; next_version bigint; kind text; item jsonb; item_id text;
  kinds constant text[] := array[
    'units', 'bookings', 'guests', 'consents', 'tasks', 'media', 'blocks',
    'rates', 'costSettings', 'imports', 'sourceConnections', 'payments', 'invoices',
    'checklistItems', 'issues', 'messages', 'departureDebriefs', 'messageTemplates',
    'automationRules', 'scheduledMessages', 'marketingTouchpoints', 'auditLog', 'settings'
  ];
begin
  select organization_id into target_org
  from organization_memberships
  where user_id = auth.uid() and role in ('owner', 'admin')
  order by created_at limit 1;
  if target_org is null then raise exception 'Brak uprawnień do zapisu' using errcode = '42501'; end if;
  if pg_column_size(p_state) > 5000000 then raise exception 'Stan aplikacji jest zbyt duży' using errcode = '22023'; end if;
  insert into operational_state_versions (organization_id, version, updated_by) values (target_org, 0, auth.uid()) on conflict (organization_id) do nothing;
  select version into current_version from operational_state_versions where organization_id = target_org for update;
  if current_version <> p_expected_version then raise exception 'Wersja danych uległa zmianie. Odśwież aplikację.' using errcode = '40001', detail = current_version::text; end if;
  next_version := current_version + 1;
  foreach kind in array kinds loop
    delete from operational_records where organization_id = target_org and entity_type = kind;
    if kind = 'settings' then
      if jsonb_typeof(p_state -> kind) = 'object' then
        insert into operational_records (organization_id, entity_type, entity_id, payload, record_version, updated_by)
        values (target_org, kind, 'organization', p_state -> kind, next_version, auth.uid());
      end if;
    elsif jsonb_typeof(p_state -> kind) = 'array' then
      if jsonb_array_length(p_state -> kind) > 20000 then raise exception 'Za dużo rekordów typu %', kind using errcode = '22023'; end if;
      for item in select value from jsonb_array_elements(p_state -> kind) loop
        item_id := coalesce(item ->> 'id', case when kind in ('guests', 'consents') then item ->> 'bookingId' end);
        if item_id is null or item_id = '' then raise exception 'Brak identyfikatora rekordu typu %', kind using errcode = '22023'; end if;
        insert into operational_records (organization_id, entity_type, entity_id, payload, record_version, updated_by)
        values (target_org, kind, item_id, item, next_version, auth.uid());
      end loop;
    end if;
  end loop;
  update operational_state_versions set version = next_version, updated_at = now(), updated_by = auth.uid() where organization_id = target_org;
  insert into operational_snapshots (organization_id, state, version, updated_at) values (target_org, p_state, next_version, now())
  on conflict (organization_id) do update set state = excluded.state, version = excluded.version, updated_at = excluded.updated_at;
  insert into audit_events (organization_id, actor_id, entity_type, entity_id, action, payload)
  values (target_org, auth.uid(), 'state', target_org::text, 'committed', jsonb_build_object('version', next_version));
  return next_version;
end $$;

revoke all on function public.replace_operational_state(bigint, jsonb) from public, anon;
grant execute on function public.replace_operational_state(bigint, jsonb) to authenticated;
