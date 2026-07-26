-- PR-9b: explicit organization-scoped turnover workflow.
-- The function remains service-role only because operational_records contains
-- mixed JSON. Authorization is re-checked against the exact active tenant.

create or replace function public.mutate_cleaning_task(
  p_organization_id uuid,
  p_actor uuid,
  p_task_id text,
  p_action text,
  p_item_id text default null,
  p_details jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  task_payload jsonb;
  item_payload jsonb;
  next_version bigint;
  all_checked boolean;
  checklist_count integer;
  completed_count integer;
  issue_id text;
  issue_title text;
  issue_description text;
  issue_category text;
  desired_done boolean;
  proposed_start_time text;
  rejection_reason text;
  assignment_status text;
begin
  if p_actor is null
    or p_organization_id is null
    or not exists (
      select 1
      from public.organization_memberships membership
      where membership.organization_id = p_organization_id
        and membership.user_id = p_actor
        and membership.role = 'cleaning'
    )
  then
    raise exception 'Brak uprawnień do panelu sprzątania' using errcode = '42501';
  end if;

  select record.payload into task_payload
  from public.operational_records record
  where record.organization_id = p_organization_id
    and record.entity_type = 'tasks'
    and record.entity_id = p_task_id
  for update;

  if task_payload is null or task_payload ->> 'type' <> 'Sprzątanie' then
    raise exception 'Nie znaleziono zadania sprzątania' using errcode = '42501';
  end if;

  insert into public.operational_state_versions (organization_id, version, updated_by)
  values (p_organization_id, 0, p_actor)
  on conflict (organization_id) do nothing;

  select state.version + 1 into next_version
  from public.operational_state_versions state
  where state.organization_id = p_organization_id
  for update;

  assignment_status := coalesce(task_payload ->> 'assignmentStatus', 'Do przyjęcia');

  if p_action = 'accept' then
    if task_payload ->> 'status' <> 'Do zrobienia' or assignment_status <> 'Do przyjęcia' then
      raise exception 'Nieprawidłowy status zadania';
    end if;
    proposed_start_time := nullif(btrim(coalesce(p_details ->> 'proposedStartTime', '')), '');
    if proposed_start_time is not null and proposed_start_time !~ '^([01]\d|2[0-3]):[0-5]\d$' then
      raise exception 'Nieprawidłowa godzina rozpoczęcia' using errcode = '22023';
    end if;
    task_payload := jsonb_set(task_payload, '{assignmentStatus}', '"Przyjęte"'::jsonb, true);
    task_payload := jsonb_set(task_payload, '{acceptedAt}', to_jsonb(now()::text), true);
    task_payload := task_payload - 'rejectedAt' - 'blocker';
    if proposed_start_time is not null then
      task_payload := jsonb_set(task_payload, '{proposedStartTime}', to_jsonb(proposed_start_time), true);
    else
      task_payload := task_payload - 'proposedStartTime';
    end if;

  elsif p_action = 'reject' then
    if task_payload ->> 'status' <> 'Do zrobienia' or assignment_status <> 'Do przyjęcia' then
      raise exception 'Nieprawidłowy status zadania';
    end if;
    rejection_reason := left(btrim(coalesce(p_details ->> 'reason', '')), 500);
    if length(rejection_reason) < 2 then
      raise exception 'Powód odrzucenia jest wymagany' using errcode = '22023';
    end if;
    task_payload := jsonb_set(task_payload, '{assignmentStatus}', '"Odrzucone"'::jsonb, true);
    task_payload := jsonb_set(task_payload, '{status}', '"Zablokowane"'::jsonb, true);
    task_payload := jsonb_set(task_payload, '{rejectedAt}', to_jsonb(now()::text), true);
    task_payload := jsonb_set(task_payload, '{blocker}', to_jsonb(rejection_reason), true);

  elsif p_action = 'start' then
    if task_payload ->> 'status' <> 'Do zrobienia' or assignment_status <> 'Przyjęte' then
      raise exception 'Najpierw przyjmij zlecenie';
    end if;
    task_payload := jsonb_set(task_payload, '{status}', '"W toku"'::jsonb, true);
    task_payload := jsonb_set(task_payload, '{startedAt}', to_jsonb(now()::text), true);

  elsif p_action = 'checklist' then
    if task_payload ->> 'status' <> 'W toku' then
      raise exception 'Checklista wymaga rozpoczętego zadania';
    end if;
    select record.payload into item_payload
    from public.operational_records record
    where record.organization_id = p_organization_id
      and record.entity_type = 'checklistItems'
      and record.entity_id = p_item_id
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
    set payload = item_payload,
        record_version = next_version,
        updated_at = now(),
        updated_by = p_actor
    where organization_id = p_organization_id
      and entity_type = 'checklistItems'
      and entity_id = p_item_id;

  elsif p_action = 'complete' then
    if task_payload ->> 'status' <> 'W toku' then
      raise exception 'Nieprawidłowy status zadania';
    end if;
    select
      count(*),
      count(*) filter (where (record.payload ->> 'done')::boolean),
      coalesce(bool_and((record.payload ->> 'done')::boolean), false)
    into checklist_count, completed_count, all_checked
    from public.operational_records record
    where record.organization_id = p_organization_id
      and record.entity_type = 'checklistItems'
      and record.payload ->> 'taskId' = p_task_id;
    if checklist_count = 0 or not all_checked then
      raise exception 'Najpierw ukończ checklistę';
    end if;
    task_payload := jsonb_set(task_payload, '{status}', '"Zrobione"'::jsonb, true);
    task_payload := jsonb_set(task_payload, '{completedAt}', to_jsonb(now()::text), true);
    task_payload := jsonb_set(task_payload, '{readyAt}', to_jsonb(now()::text), true);
    task_payload := jsonb_set(
      task_payload,
      '{readinessEvidence}',
      jsonb_build_object(
        'source', 'checklist',
        'completedItems', completed_count,
        'totalItems', checklist_count
      ),
      true
    );

  elsif p_action = 'report' then
    if task_payload ->> 'status' = 'Zrobione' then
      raise exception 'Gotowego zadania nie można zablokować';
    end if;
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
      p_organization_id,
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
        'nextArrivalRisk', true,
        'severity', case
          when issue_category in ('Bezpieczeństwo', 'Woda', 'Prąd', 'Dostęp/drzwi') then 'Wysoka'
          else 'Średnia'
        end
      )),
      next_version,
      p_actor
    );
    task_payload := jsonb_set(task_payload, '{status}', '"Zablokowane"'::jsonb, true);
    task_payload := jsonb_set(task_payload, '{blocker}', to_jsonb(issue_title), true);

  else
    raise exception 'Nieobsługiwana akcja' using errcode = '22023';
  end if;

  update public.operational_records
  set payload = task_payload,
      record_version = next_version,
      updated_at = now(),
      updated_by = p_actor
  where organization_id = p_organization_id
    and entity_type = 'tasks'
    and entity_id = p_task_id;

  update public.operational_state_versions
  set version = next_version,
      updated_at = now(),
      updated_by = p_actor
  where organization_id = p_organization_id;

  insert into public.audit_events (
    organization_id, actor_id, entity_type, entity_id, action, payload
  ) values (
    p_organization_id,
    p_actor,
    'cleaning_task',
    p_task_id,
    p_action,
    jsonb_build_object(
      'version', next_version,
      'assignment_status', task_payload ->> 'assignmentStatus',
      'task_status', task_payload ->> 'status'
    )
  );

  return next_version;
end
$$;

revoke all on function public.mutate_cleaning_task(uuid, uuid, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.mutate_cleaning_task(uuid, uuid, text, text, text, jsonb)
  to service_role;
