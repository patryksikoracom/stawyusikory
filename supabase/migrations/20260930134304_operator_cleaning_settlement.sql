-- A narrow operator command: no generic task editing or access to the ledger.
create or replace function private.update_operator_cleaning(
  p_organization_id uuid, p_task_id text, p_expected_record_version bigint,
  p_complete boolean, p_settlement jsonb, p_request_id text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  task_row public.operational_records%rowtype;
  next_payload jsonb;
  next_state bigint;
  saved_at timestamptz := clock_timestamp();
  amount numeric;
begin
  if actor is null or not exists (
    select 1 from public.organization_memberships
    where organization_id = p_organization_id and user_id = actor
      and role in ('owner', 'admin', 'manager')
  ) then raise exception 'Brak uprawnień' using errcode = '42501'; end if;
  if p_expected_record_version is null or p_expected_record_version < 1
    or p_request_id is null or length(p_request_id) not between 8 and 128 then
    raise exception 'Nieprawidłowa komenda' using errcode = '22023';
  end if;
  -- Use the same organization fence as other record commands.
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text, 0));
  select * into task_row from public.operational_records
    where organization_id = p_organization_id and entity_type = 'tasks' and entity_id = p_task_id for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if task_row.record_version <> p_expected_record_version then
    return jsonb_build_object('status', 'conflict', 'recordVersion', task_row.record_version);
  end if;
  if task_row.payload->>'type' <> 'Sprzątanie' or task_row.payload->>'status' = 'Nie dotyczy' then
    raise exception 'Niedozwolone zadanie' using errcode = '42501';
  end if;
  next_payload := task_row.payload;
  if p_complete and task_row.payload->>'status' <> 'Zrobione' then
    if task_row.payload->>'status' = 'Zablokowane' or not exists (
      select 1 from public.operational_records b where b.organization_id = p_organization_id
        and b.entity_type = 'bookings' and b.entity_id = task_row.payload->>'bookingId'
        and b.payload->>'deletedAt' is null and b.payload->>'workflowStatus' <> 'Anulowana'
    ) then raise exception 'Sprzątanie jest zablokowane' using errcode = '22023'; end if;
    next_payload := next_payload || jsonb_build_object('status', 'Zrobione', 'completedAt', saved_at,
      'readyAt', saved_at, 'readinessEvidence', jsonb_build_object(
        'source', 'operator-confirmation', 'completedItems', 0, 'totalItems', 0));
  end if;
  if p_settlement is not null then
    if jsonb_typeof(p_settlement) <> 'object'
      or jsonb_typeof(p_settlement->'amount') is distinct from 'number'
      or p_settlement->>'currency' is distinct from 'PLN'
      or p_settlement - array['amount', 'currency', 'paidAt'] <> '{}'::jsonb then
      raise exception 'Nieprawidłowe rozliczenie' using errcode = '22023';
    end if;
    amount := (p_settlement->>'amount')::numeric;
    if amount < 0 or amount > 100000 or round(amount, 2) <> amount then
      raise exception 'Nieprawidłowa kwota' using errcode = '22023';
    end if;
    if p_settlement->>'paidAt' is not null and next_payload->>'status' <> 'Zrobione' then
      raise exception 'Najpierw potwierdź wykonanie' using errcode = '22023';
    end if;
    if task_row.payload#>>'{cleaningSettlement,paidAt}' is not null
      and amount is distinct from (task_row.payload#>>'{cleaningSettlement,amount}')::numeric then
      raise exception 'Najpierw cofnij płatność' using errcode = '22023';
    end if;
    next_payload := jsonb_set(next_payload, '{cleaningSettlement}',
      jsonb_build_object('amount', amount, 'currency', 'PLN') ||
      case when p_settlement->>'paidAt' is not null then
        jsonb_build_object('paidAt', coalesce(task_row.payload#>>'{cleaningSettlement,paidAt}', saved_at::text))
      else '{}'::jsonb end);
  end if;
  next_payload := next_payload || jsonb_build_object('version', task_row.record_version + 1, 'updatedAt', saved_at);
  update public.operational_records set payload = next_payload, record_version = record_version + 1,
    updated_at = saved_at, updated_by = actor
    where organization_id = p_organization_id and entity_type = 'tasks' and entity_id = p_task_id;
  insert into public.operational_state_versions(organization_id, version, updated_at, updated_by)
    values(p_organization_id, 1, saved_at, actor)
    on conflict(organization_id) do update set version = public.operational_state_versions.version + 1,
      updated_at = saved_at, updated_by = actor returning version into next_state;
  insert into public.audit_events(organization_id, actor_id, entity_type, entity_id, action, payload, created_at)
    values(p_organization_id, actor, 'task', p_task_id, 'operator_cleaning_updated',
      jsonb_build_object('request_id', p_request_id, 'before', task_row.payload->'cleaningSettlement',
        'after', next_payload->'cleaningSettlement', 'status', next_payload->>'status'), saved_at);
  return jsonb_build_object('status', 'committed', 'task', next_payload,
    'recordVersion', task_row.record_version + 1, 'stateVersion', next_state, 'savedAt', saved_at);
end;
$$;
revoke all on function private.update_operator_cleaning(uuid,text,bigint,boolean,jsonb,text) from public, anon;
grant execute on function private.update_operator_cleaning(uuid,text,bigint,boolean,jsonb,text) to authenticated;

create or replace function public.update_operator_cleaning(
  p_organization_id uuid, p_task_id text, p_expected_record_version bigint,
  p_complete boolean, p_settlement jsonb, p_request_id text
) returns jsonb language sql security invoker set search_path = '' as $$
  select private.update_operator_cleaning(p_organization_id,p_task_id,p_expected_record_version,p_complete,p_settlement,p_request_id);
$$;
revoke all on function public.update_operator_cleaning(uuid,text,bigint,boolean,jsonb,text) from public, anon;
grant execute on function public.update_operator_cleaning(uuid,text,bigint,boolean,jsonb,text) to authenticated;
