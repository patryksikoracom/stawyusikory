-- PR-7: make whole-state writes observable while the application is being
-- migrated to record-level domain commands. Optimistic-lock conflicts remain
-- expected outcomes and are recorded without raising database errors.

create or replace function public.replace_operational_state_v2(
  p_expected_version bigint,
  p_state jsonb,
  p_request_id text,
  p_client_sent_at timestamptz,
  p_tab_id text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_org uuid;
  actor uuid := auth.uid();
  result_version bigint;
  current_version bigint;
  started_at timestamptz := clock_timestamp();
  finished_at timestamptz;
begin
  if p_request_id is null or length(trim(p_request_id)) < 8 or length(p_request_id) > 128 then
    raise exception 'Nieprawidłowy identyfikator żądania' using errcode = '22023';
  end if;
  if p_tab_id is null or length(trim(p_tab_id)) < 8 or length(p_tab_id) > 128 then
    raise exception 'Nieprawidłowy identyfikator karty' using errcode = '22023';
  end if;

  select organization_id into target_org
  from public.organization_memberships
  where user_id = actor and role in ('owner', 'admin')
  order by created_at
  limit 1;

  if target_org is null then
    raise exception 'Brak uprawnień do zapisu' using errcode = '42501';
  end if;

  result_version := public.replace_operational_state(p_expected_version, p_state);
  finished_at := clock_timestamp();
  current_version := case
    when result_version < 0 then -result_version - 1
    else result_version
  end;

  insert into public.audit_events (
    organization_id,
    actor_id,
    entity_type,
    entity_id,
    action,
    payload,
    created_at
  ) values (
    target_org,
    actor,
    'state_write',
    p_request_id,
    case when result_version < 0 then 'conflict' else 'committed' end,
    jsonb_build_object(
      'request_id', p_request_id,
      'tab_id', p_tab_id,
      'expected_version', p_expected_version,
      'current_version', current_version,
      'client_sent_at', p_client_sent_at,
      'server_started_at', started_at,
      'server_finished_at', finished_at,
      'duration_ms', round(extract(epoch from (finished_at - started_at)) * 1000, 3)
    ),
    finished_at
  );

  return result_version;
end $$;

revoke all on function public.replace_operational_state_v2(bigint, jsonb, text, timestamptz, text) from public, anon;
grant execute on function public.replace_operational_state_v2(bigint, jsonb, text, timestamptz, text) to authenticated;
