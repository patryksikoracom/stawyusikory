-- PR-8b: record-level command for a single cleaning checklist item.
-- The organization state version remains a fence for legacy whole-state writes,
-- while conflicts are scoped to one checklist record.

grant select, update on table public.operational_records to authenticated;
grant select, insert, update on table public.operational_state_versions to authenticated;
grant select, insert on table public.audit_events to authenticated;

drop policy if exists "editors insert checklist command audit" on public.audit_events;
create policy "editors insert checklist command audit" on public.audit_events
  for insert to authenticated
  with check (
    private.is_org_editor(organization_id)
    and actor_id = (select auth.uid())
    and entity_type = 'checklist_item'
    and action in ('command_committed', 'command_conflict')
  );

create or replace function public.update_operational_checklist_item(
  p_organization_id uuid,
  p_item_id text,
  p_expected_record_version bigint,
  p_item jsonb,
  p_request_id text,
  p_client_sent_at timestamptz,
  p_tab_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  current_record_version bigint;
  next_record_version bigint;
  next_state_version bigint;
  committed_at timestamptz := clock_timestamp();
  committed_item jsonb;
begin
  if actor is null then
    raise exception 'Wymagane logowanie' using errcode = '42501';
  end if;
  if p_organization_id is null or not exists (
    select 1
    from public.organization_memberships
    where organization_id = p_organization_id
      and user_id = actor
      and role in ('owner', 'admin')
  ) then
    raise exception 'Brak uprawnień do zapisu checklisty' using errcode = '42501';
  end if;
  if p_item_id is null or length(trim(p_item_id)) < 1 or length(p_item_id) > 128 then
    raise exception 'Nieprawidłowy identyfikator punktu checklisty' using errcode = '22023';
  end if;
  if p_expected_record_version is null or p_expected_record_version < 1 then
    raise exception 'Nieprawidłowa wersja punktu checklisty' using errcode = '22023';
  end if;
  if p_request_id is null or length(trim(p_request_id)) < 8 or length(p_request_id) > 128 then
    raise exception 'Nieprawidłowy identyfikator żądania' using errcode = '22023';
  end if;
  if p_tab_id is null or length(trim(p_tab_id)) < 8 or length(p_tab_id) > 128 then
    raise exception 'Nieprawidłowy identyfikator karty' using errcode = '22023';
  end if;
  if p_client_sent_at is null then
    raise exception 'Brak czasu wysłania komendy' using errcode = '22023';
  end if;
  if p_item is null
    or jsonb_typeof(p_item) <> 'object'
    or p_item ->> 'id' is distinct from p_item_id
    or length(trim(coalesce(p_item ->> 'taskId', ''))) < 1
    or length(p_item ->> 'taskId') > 128
    or length(trim(coalesce(p_item ->> 'label', ''))) < 1
    or length(p_item ->> 'label') > 500
    or jsonb_typeof(p_item -> 'done') <> 'boolean'
  then
    raise exception 'Punkt checklisty narusza reguły domenowe' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.operational_records
    where organization_id = p_organization_id
      and entity_type = 'tasks'
      and entity_id = p_item ->> 'taskId'
  ) then
    return jsonb_build_object('status', 'task_not_found');
  end if;

  committed_item := p_item || jsonb_build_object(
    'version', p_expected_record_version + 1,
    'updatedAt', committed_at
  );
  if (p_item ->> 'done')::boolean then
    committed_item := committed_item || jsonb_build_object('completedAt', committed_at);
  else
    committed_item := committed_item - 'completedAt';
  end if;

  update public.operational_records
  set payload = committed_item,
      record_version = record_version + 1,
      updated_at = committed_at,
      updated_by = actor
  where organization_id = p_organization_id
    and entity_type = 'checklistItems'
    and entity_id = p_item_id
    and record_version = p_expected_record_version
  returning record_version into next_record_version;

  if next_record_version is null then
    select record_version
    into current_record_version
    from public.operational_records
    where organization_id = p_organization_id
      and entity_type = 'checklistItems'
      and entity_id = p_item_id;

    if current_record_version is null then
      return jsonb_build_object('status', 'not_found');
    end if;

    insert into public.audit_events (
      organization_id, actor_id, entity_type, entity_id, action, payload, created_at
    ) values (
      p_organization_id,
      actor,
      'checklist_item',
      p_item_id,
      'command_conflict',
      jsonb_build_object(
        'request_id', p_request_id,
        'tab_id', p_tab_id,
        'expected_record_version', p_expected_record_version,
        'current_record_version', current_record_version,
        'client_sent_at', p_client_sent_at
      ),
      committed_at
    );

    return jsonb_build_object(
      'status', 'conflict',
      'recordVersion', current_record_version
    );
  end if;

  insert into public.operational_state_versions (
    organization_id, version, updated_at, updated_by
  ) values (
    p_organization_id, 0, committed_at, actor
  )
  on conflict (organization_id) do nothing;

  update public.operational_state_versions
  set version = version + 1,
      updated_at = committed_at,
      updated_by = actor
  where organization_id = p_organization_id
  returning version into next_state_version;

  insert into public.audit_events (
    organization_id, actor_id, entity_type, entity_id, action, payload, created_at
  ) values (
    p_organization_id,
    actor,
    'checklist_item',
    p_item_id,
    'command_committed',
    jsonb_build_object(
      'request_id', p_request_id,
      'tab_id', p_tab_id,
      'expected_record_version', p_expected_record_version,
      'record_version', next_record_version,
      'state_version', next_state_version,
      'client_sent_at', p_client_sent_at
    ),
    committed_at
  );

  return jsonb_build_object(
    'status', 'committed',
    'item', committed_item,
    'recordVersion', next_record_version,
    'stateVersion', next_state_version,
    'savedAt', committed_at
  );
end $$;

revoke all on function public.update_operational_checklist_item(uuid, text, bigint, jsonb, text, timestamptz, text)
  from public, anon;
grant execute on function public.update_operational_checklist_item(uuid, text, bigint, jsonb, text, timestamptz, text)
  to authenticated;
