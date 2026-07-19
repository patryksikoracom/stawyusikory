-- Least-privilege housekeeping role. Cleaning accounts never receive raw
-- operational records; the application exposes a deliberately redacted view.

alter table public.organization_memberships
  drop constraint if exists organization_memberships_role_check;
alter table public.organization_memberships
  add constraint organization_memberships_role_check
  check (role in ('owner', 'admin', 'viewer', 'cleaning'));

create or replace function private.is_org_standard_reader(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_memberships
    where organization_id = target_org
      and user_id = (select auth.uid())
      and role in ('owner', 'admin', 'viewer')
  )
$$;

revoke all on function private.is_org_standard_reader(uuid) from public, anon;
grant execute on function private.is_org_standard_reader(uuid) to authenticated, service_role;

-- A cleaning account may see only its own membership row. Owners/admins keep
-- the team-management view.
drop policy if exists "members read memberships" on public.organization_memberships;
drop policy if exists "members read own membership" on public.organization_memberships;
drop policy if exists "editors read organization memberships" on public.organization_memberships;
create policy "members read own membership" on public.organization_memberships
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "editors read organization memberships" on public.organization_memberships
  for select to authenticated
  using (private.is_org_editor(organization_id));

drop policy if exists "owners create memberships" on public.organization_memberships;
create policy "owners create memberships" on public.organization_memberships
  for insert to authenticated
  with check (
    private.is_org_owner(organization_id)
    and role in ('admin', 'viewer', 'cleaning')
  );

drop policy if exists "owners update memberships" on public.organization_memberships;
create policy "owners update memberships" on public.organization_memberships
  for update to authenticated
  using (private.is_org_owner(organization_id))
  with check (
    private.is_org_owner(organization_id)
    and role in ('admin', 'viewer', 'cleaning')
  );

-- Raw JSON records contain prices, guest PII and marketing data. The cleaning
-- role is intentionally excluded even from rows that later become a redacted
-- cleaning job in the server API.
drop policy if exists "members read state versions" on public.operational_state_versions;
create policy "standard members read state versions" on public.operational_state_versions
  for select to authenticated
  using (private.is_org_standard_reader(organization_id));

drop policy if exists "members read operational records" on public.operational_records;
create policy "standard members read operational records" on public.operational_records
  for select to authenticated
  using (private.is_org_standard_reader(organization_id));

-- The typed operational tables can also contain names and free-form notes.
-- Keep their existing owner/admin/viewer behavior, but do not expose them to
-- cleaning accounts; the dedicated API is the only cleaning data boundary.
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'units','bookings','tasks','calendar_blocks','rate_rules','cost_settings',
    'channel_settings','task_checklist_items','issue_reports'
  ] loop
    execute format('drop policy if exists %I on public.%I', 'members read ' || target_table, target_table);
    execute format('drop policy if exists %I on public.%I', 'standard members read ' || target_table, target_table);
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.is_org_standard_reader(organization_id))',
      'standard members read ' || target_table,
      target_table
    );
  end loop;
end $$;

-- Narrow, transactional mutations for checklist progress, task state and
-- issue reporting. Every action re-checks the membership from the database;
-- no user-editable metadata participates in authorization.
create or replace function public.mutate_cleaning_task(
  p_actor uuid,
  p_task_id text,
  p_action text,
  p_item_id text default null,
  p_details jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, private
as $$
declare
  target_org uuid;
  actor uuid := p_actor;
  task_payload jsonb;
  item_payload jsonb;
  next_version bigint;
  all_checked boolean;
  checklist_count integer;
  issue_id text;
  issue_title text;
  issue_description text;
  issue_category text;
  desired_done boolean;
begin
  select organization_id into target_org
  from public.organization_memberships
  where user_id = actor and role = 'cleaning'
  order by created_at
  limit 1;

  if actor is null or target_org is null then
    raise exception 'Brak uprawnień do panelu sprzątania' using errcode = '42501';
  end if;

  select payload into task_payload
  from public.operational_records
  where organization_id = target_org
    and entity_type = 'tasks'
    and entity_id = p_task_id
  for update;

  if task_payload is null or task_payload ->> 'type' <> 'Sprzątanie' then
    raise exception 'Nie znaleziono zadania sprzątania' using errcode = '42501';
  end if;

  insert into public.operational_state_versions (organization_id, version, updated_by)
  values (target_org, 0, actor)
  on conflict (organization_id) do nothing;
  select version + 1 into next_version
  from public.operational_state_versions
  where organization_id = target_org
  for update;

  if p_action = 'start' then
    if task_payload ->> 'status' not in ('Do zrobienia', 'W toku') then
      raise exception 'Nieprawidłowy status zadania';
    end if;
    task_payload := jsonb_set(task_payload, '{status}', '"W toku"'::jsonb, true);
    update public.operational_records
    set payload = task_payload, record_version = next_version, updated_at = now(), updated_by = actor
    where organization_id = target_org and entity_type = 'tasks' and entity_id = p_task_id;

  elsif p_action = 'checklist' then
    select payload into item_payload
    from public.operational_records
    where organization_id = target_org
      and entity_type = 'checklistItems'
      and entity_id = p_item_id
    for update;
    if item_payload is null or item_payload ->> 'taskId' <> p_task_id then
      raise exception 'Nie znaleziono punktu checklisty' using errcode = '42501';
    end if;
    if jsonb_typeof(p_details -> 'done') <> 'boolean' then
      raise exception 'Nieprawidłowa wartość checklisty' using errcode = '22023';
    end if;
    desired_done := (p_details ->> 'done')::boolean;
    item_payload := jsonb_set(item_payload, '{done}', to_jsonb(desired_done), true);
    if desired_done then
      item_payload := jsonb_set(item_payload, '{completedAt}', to_jsonb(now()::text), true);
    else
      item_payload := item_payload - 'completedAt';
    end if;
    update public.operational_records
    set payload = item_payload, record_version = next_version, updated_at = now(), updated_by = actor
    where organization_id = target_org and entity_type = 'checklistItems' and entity_id = p_item_id;

  elsif p_action = 'complete' then
    if task_payload ->> 'status' not in ('W toku', 'Zrobione') then
      raise exception 'Nieprawidłowy status zadania';
    end if;
    select count(*), coalesce(bool_and((payload ->> 'done')::boolean), false)
      into checklist_count, all_checked
    from public.operational_records
    where organization_id = target_org
      and entity_type = 'checklistItems'
      and payload ->> 'taskId' = p_task_id;
    if checklist_count = 0 or not all_checked then
      raise exception 'Najpierw ukończ checklistę';
    end if;
    task_payload := jsonb_set(task_payload, '{status}', '"Zrobione"'::jsonb, true);
    task_payload := jsonb_set(task_payload, '{completedAt}', to_jsonb(now()::text), true);
    update public.operational_records
    set payload = task_payload, record_version = next_version, updated_at = now(), updated_by = actor
    where organization_id = target_org and entity_type = 'tasks' and entity_id = p_task_id;

  elsif p_action = 'report' then
    issue_title := btrim(coalesce(p_details ->> 'title', ''));
    issue_description := left(btrim(coalesce(p_details ->> 'description', '')), 500);
    issue_category := coalesce(p_details ->> 'category', 'Inne');
    if length(issue_title) < 2 or length(issue_title) > 120 then
      raise exception 'Nieprawidłowy tytuł zgłoszenia' using errcode = '22023';
    end if;
    if issue_category not in ('Bezpieczeństwo', 'Dostęp/drzwi', 'Woda', 'Prąd', 'Wyposażenie', 'Komfort', 'Inne') then
      issue_category := 'Inne';
    end if;
    issue_id := 'ISS-' || replace(gen_random_uuid()::text, '-', '');
    insert into public.operational_records (
      organization_id, entity_type, entity_id, payload, record_version, updated_by
    ) values (
      target_org,
      'issues',
      issue_id,
      jsonb_strip_nulls(jsonb_build_object(
        'id', issue_id,
        'taskId', p_task_id,
        'bookingId', task_payload ->> 'bookingId',
        'unitId', task_payload ->> 'unitId',
        'title', issue_title,
        'description', nullif(issue_description, ''),
        'status', 'Otwarte',
        'createdAt', now()::text,
        'category', issue_category,
        'source', 'Sprzątanie',
        'severity', case when issue_category in ('Bezpieczeństwo', 'Woda', 'Prąd', 'Dostęp/drzwi') then 'Wysoka' else 'Średnia' end
      )),
      next_version,
      actor
    );
    task_payload := jsonb_set(task_payload, '{status}', '"Zablokowane"'::jsonb, true);
    task_payload := jsonb_set(task_payload, '{blocker}', to_jsonb(issue_title), true);
    update public.operational_records
    set payload = task_payload, record_version = next_version, updated_at = now(), updated_by = actor
    where organization_id = target_org and entity_type = 'tasks' and entity_id = p_task_id;
  else
    raise exception 'Nieobsługiwana akcja' using errcode = '22023';
  end if;

  update public.operational_state_versions
  set version = next_version, updated_at = now(), updated_by = actor
  where organization_id = target_org;

  insert into public.audit_events (organization_id, actor_id, entity_type, entity_id, action, payload)
  values (target_org, actor, 'cleaning_task', p_task_id, p_action, jsonb_build_object('version', next_version));

  return next_version;
end $$;

revoke all on function public.mutate_cleaning_task(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.mutate_cleaning_task(uuid, text, text, text, jsonb) to service_role;
