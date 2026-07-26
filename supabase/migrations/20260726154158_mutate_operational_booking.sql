-- PR-8e: give booking updates an explicit operation so trash/restore keep the
-- existing atomic aggregate write while producing truthful transactional
-- audit. The underlying PR-8d function remains the single implementation of
-- optimistic locking, availability checks and related-record reconciliation.

drop policy if exists "editors insert booking command audit" on public.audit_events;
create policy "editors insert booking command audit" on public.audit_events
  for insert to authenticated
  with check (
    private.is_org_editor(organization_id)
    and actor_id = (select auth.uid())
    and entity_type = 'booking'
    and action in (
      'command_committed',
      'command_conflict',
      'related_record_conflict',
      'lifecycle_committed'
    )
  );

create or replace function public.mutate_operational_booking(
  p_organization_id uuid,
  p_booking_id text,
  p_expected_record_version bigint,
  p_booking jsonb,
  p_contact jsonb,
  p_tasks jsonb,
  p_scheduled_messages jsonb,
  p_operation text,
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
  current_booking jsonb;
  result jsonb;
begin
  if p_operation not in ('update', 'cancel', 'trash', 'restore') then
    raise exception 'Nieprawidłowy rodzaj zmiany rezerwacji' using errcode = '22023';
  end if;

  select payload
  into current_booking
  from public.operational_records
  where organization_id = p_organization_id
    and entity_type = 'bookings'
    and entity_id = p_booking_id;

  if p_operation = 'trash' and (
    current_booking is null
    or current_booking ? 'deletedAt'
    or coalesce(p_booking ->> 'workflowStatus', '') <> 'Anulowana'
    or not (p_booking ? 'deletedAt')
    or not (p_booking ? 'purgeAfter')
    or p_booking ->> 'workflowStatusBeforeDeletion'
      is distinct from current_booking ->> 'workflowStatus'
    or coalesce(p_booking ->> 'deletedAt', '') !~
      '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}'
    or coalesce(p_booking ->> 'purgeAfter', '') !~ '^\d{4}-\d{2}-\d{2}$'
    or (p_booking ->> 'purgeAfter')::date
      <> substring(p_booking ->> 'deletedAt' from 1 for 10)::date + 30
  ) then
    raise exception 'Nieprawidłowy stan przeniesienia do kosza' using errcode = '22023';
  end if;

  if p_operation = 'restore' and (
    current_booking is null
    or not (current_booking ? 'deletedAt')
    or p_booking ? 'deletedAt'
    or p_booking ? 'purgeAfter'
    or p_booking ? 'workflowStatusBeforeDeletion'
    or p_booking ->> 'workflowStatus' is distinct from
      coalesce(current_booking ->> 'workflowStatusBeforeDeletion', 'Nowa')
    or coalesce(current_booking ->> 'purgeAfter', '0001-01-01')::date
      < (clock_timestamp() at time zone 'Europe/Warsaw')::date
  ) then
    raise exception 'Nieprawidłowy stan przywrócenia z kosza' using errcode = '22023';
  end if;

  if p_operation = 'cancel' and (
    coalesce(p_booking ->> 'workflowStatus', '') <> 'Anulowana'
    or p_booking ? 'deletedAt'
  ) then
    raise exception 'Nieprawidłowy stan anulowania rezerwacji' using errcode = '22023';
  end if;

  if p_operation = 'update' and (
    current_booking ? 'deletedAt'
    or p_booking ? 'deletedAt'
  ) then
    raise exception 'Rezerwację w koszu można tylko przywrócić' using errcode = '22023';
  end if;

  result := public.update_operational_booking(
    p_organization_id,
    p_booking_id,
    p_expected_record_version,
    p_booking,
    p_contact,
    p_tasks,
    p_scheduled_messages,
    p_request_id,
    p_client_sent_at,
    p_tab_id
  );

  if result ->> 'status' = 'committed'
    and p_operation in ('trash', 'restore')
  then
    insert into public.audit_events (
      organization_id, actor_id, entity_type, entity_id, action, payload, created_at
    ) values (
      p_organization_id,
      actor,
      'booking',
      p_booking_id,
      'lifecycle_committed',
      jsonb_build_object(
        'request_id', p_request_id,
        'tab_id', p_tab_id,
        'command_kind', p_operation,
        'record_version', result -> 'recordVersion',
        'state_version', result -> 'stateVersion',
        'client_sent_at', p_client_sent_at
      ),
      coalesce((result ->> 'savedAt')::timestamptz, clock_timestamp())
    );
  end if;

  return result;
end $$;

revoke all on function public.mutate_operational_booking(
  uuid, text, bigint, jsonb, jsonb, jsonb, jsonb, text, text, timestamptz, text
) from public, anon;
grant execute on function public.mutate_operational_booking(
  uuid, text, bigint, jsonb, jsonb, jsonb, jsonb, text, text, timestamptz, text
) to authenticated;
