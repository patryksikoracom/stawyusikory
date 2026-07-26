-- PR-8 final: one atomic, record-versioned command for the remaining
-- operational mutations. Dedicated booking, payment, block and settings
-- commands remain authoritative for their normal interactive flows.

grant select, insert, update, delete on table public.operational_records to authenticated;
grant select, insert, update on table public.operational_state_versions to authenticated;
grant select, insert on table public.audit_events to authenticated;
grant select, insert, update, delete on table public.scheduled_messages to authenticated;
grant select, insert, update, delete on table public.departure_debriefs to authenticated;
grant select, insert, update, delete on table public.marketing_touchpoints to authenticated;

drop policy if exists "editors insert task command audit" on public.audit_events;
drop policy if exists "editors insert checklist command audit" on public.audit_events;
drop policy if exists "editors insert booking command audit" on public.audit_events;
drop policy if exists "editors insert payment command audit" on public.audit_events;
drop policy if exists "editors insert settings command audit" on public.audit_events;
drop policy if exists "editors insert calendar block command audit" on public.audit_events;
drop policy if exists "editors insert record batch audit" on public.audit_events;
drop policy if exists "editors insert operational command audit" on public.audit_events;
create policy "editors insert operational command audit" on public.audit_events
  for insert to authenticated
  with check (
    private.is_org_editor(organization_id)
    and actor_id = (select auth.uid())
    and (
      (entity_type = 'task' and action in ('command_committed', 'command_conflict'))
      or (
        entity_type = 'checklist_item'
        and action in ('command_committed', 'command_conflict')
      )
      or (
        entity_type = 'booking'
        and action in ('command_committed', 'command_conflict', 'lifecycle_committed')
      )
      or (entity_type = 'state_write' and action in ('committed', 'conflict'))
      or (
        entity_type = 'payment'
        and action in ('command_committed', 'command_conflict')
      )
      or (
        entity_type = 'settings'
        and entity_id = 'organization'
        and action in ('command_committed', 'command_conflict')
      )
      or (
        entity_type = 'block'
        and action in ('command_committed', 'command_conflict')
      )
      or (
        entity_type = 'record_batch'
        and action in ('command_committed', 'command_conflict')
      )
    )
  );

-- The application no longer exposes or calls the whole-state writers.
revoke execute on function public.replace_operational_state(bigint, jsonb)
  from public, anon, authenticated;
revoke execute on function public.replace_operational_state_v2(
  bigint, jsonb, text, timestamptz, text
) from public, anon, authenticated;

create or replace function public.mutate_operational_record_batch(
  p_organization_id uuid,
  p_changes jsonb,
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
  committed_at timestamptz := clock_timestamp();
  change jsonb;
  v_entity_type text;
  v_entity_id text;
  v_operation text;
  v_payload jsonb;
  expected_version bigint;
  current_version bigint;
  next_version bigint;
  next_state_version bigint;
  committed_changes jsonb := '[]'::jsonb;
  replay_result jsonb;
  allowed_types constant text[] := array[
    'units', 'bookings', 'guests', 'consents', 'tasks', 'media', 'rates',
    'costSettings', 'imports', 'sourceConnections', 'invoices',
    'checklistItems', 'issues', 'messages', 'departureDebriefs',
    'scheduledMessages', 'marketingTouchpoints'
  ];
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
    raise exception 'Brak uprawnień do zapisu rekordów' using errcode = '42501';
  end if;
  if p_request_id is null or length(trim(p_request_id)) < 8 or length(p_request_id) > 128
    or p_tab_id is null or length(trim(p_tab_id)) < 8 or length(p_tab_id) > 128
    or p_client_sent_at is null
  then
    raise exception 'Nieprawidłowe metadane komendy' using errcode = '22023';
  end if;
  if p_changes is null
    or jsonb_typeof(p_changes) is distinct from 'array'
    or jsonb_array_length(p_changes) < 1
    or jsonb_array_length(p_changes) > 5000
  then
    raise exception 'Nieprawidłowa paczka zmian' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':record-batch-request:' || p_request_id, 0)
  );

  select payload -> 'result'
  into replay_result
  from public.audit_events
  where organization_id = p_organization_id
    and entity_type = 'record_batch'
    and entity_id = p_request_id
    and action = 'command_committed'
  order by created_at desc
  limit 1;
  if replay_result is not null then
    return replay_result || jsonb_build_object('status', 'already_committed');
  end if;

  for change in select value from jsonb_array_elements(p_changes)
  loop
    v_entity_type := change ->> 'entityType';
    v_entity_id := change ->> 'entityId';
    v_operation := change ->> 'operation';
    expected_version := nullif(change ->> 'expectedRecordVersion', '')::bigint;
    v_payload := change -> 'payload';
    if jsonb_typeof(change) is distinct from 'object'
      or (change - array['entityType', 'entityId', 'operation', 'expectedRecordVersion', 'payload']::text[]) <> '{}'::jsonb
      or not (v_entity_type = any(allowed_types))
      or v_entity_id is null or length(trim(v_entity_id)) < 1 or length(v_entity_id) > 256
      or v_operation not in ('upsert', 'delete')
      or expected_version is null or expected_version < 0
      or (v_operation = 'delete' and (expected_version < 1 or v_payload is not null))
      or (v_operation = 'upsert' and jsonb_typeof(v_payload) is distinct from 'object')
      or (
        v_operation = 'upsert'
        and coalesce(
          case when v_entity_type in ('guests', 'consents') then v_payload ->> 'bookingId' else v_payload ->> 'id' end,
          ''
        ) is distinct from v_entity_id
      )
    then
      raise exception 'Zmiana rekordu narusza kontrakt' using errcode = '22023';
    end if;
  end loop;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_organization_id::text || ':record:' || item ->> 'entityType' || ':' || item ->> 'entityId',
      0
    )
  )
  from jsonb_array_elements(p_changes) item
  order by item ->> 'entityType', item ->> 'entityId';

  for change in select value from jsonb_array_elements(p_changes)
  loop
    v_entity_type := change ->> 'entityType';
    v_entity_id := change ->> 'entityId';
    expected_version := (change ->> 'expectedRecordVersion')::bigint;
    select record_version
    into current_version
    from public.operational_records
    where organization_id = p_organization_id
      and operational_records.entity_type = v_entity_type
      and operational_records.entity_id = v_entity_id;

    if (expected_version = 0 and current_version is not null)
      or (expected_version > 0 and current_version is distinct from expected_version)
    then
      insert into public.audit_events (
        organization_id, actor_id, entity_type, entity_id, action, payload, created_at
      ) values (
        p_organization_id, actor, 'record_batch', p_request_id, 'command_conflict',
        jsonb_build_object(
          'request_id', p_request_id,
          'tab_id', p_tab_id,
          'client_sent_at', p_client_sent_at,
          'conflict_entity_type', v_entity_type,
          'conflict_entity_id', v_entity_id,
          'expected_record_version', expected_version,
          'current_record_version', coalesce(current_version, 0)
        ),
        committed_at
      );
      return jsonb_build_object(
        'status', 'conflict',
        'conflict', jsonb_build_object(
          'entityType', v_entity_type,
          'entityId', v_entity_id,
          'expectedRecordVersion', expected_version,
          'currentRecordVersion', coalesce(current_version, 0)
        )
      );
    end if;
  end loop;

  for change in select value from jsonb_array_elements(p_changes)
  loop
    v_entity_type := change ->> 'entityType';
    v_entity_id := change ->> 'entityId';
    v_operation := change ->> 'operation';
    expected_version := (change ->> 'expectedRecordVersion')::bigint;
    v_payload := change -> 'payload';

    if v_operation = 'delete' then
      delete from public.operational_records
      where organization_id = p_organization_id
        and operational_records.entity_type = v_entity_type
        and operational_records.entity_id = v_entity_id;
      next_version := 0;
      if v_entity_type = 'scheduledMessages' then
        delete from public.scheduled_messages where organization_id = p_organization_id and id = v_entity_id;
      elsif v_entity_type = 'departureDebriefs' then
        delete from public.departure_debriefs where organization_id = p_organization_id and id = v_entity_id;
      elsif v_entity_type = 'marketingTouchpoints' then
        delete from public.marketing_touchpoints where organization_id = p_organization_id and id = v_entity_id;
      end if;
    else
      next_version := expected_version + 1;
      v_payload := (v_payload - 'version' - 'updatedAt') || jsonb_build_object(
        'version', next_version,
        'updatedAt', committed_at
      );
      insert into public.operational_records (
        organization_id, entity_type, entity_id, payload, record_version, updated_at, updated_by
      ) values (
        p_organization_id, v_entity_type, v_entity_id, v_payload, next_version, committed_at, actor
      )
      on conflict (organization_id, entity_type, entity_id) do update
      set payload = excluded.payload,
          record_version = excluded.record_version,
          updated_at = excluded.updated_at,
          updated_by = excluded.updated_by;

      if v_entity_type = 'scheduledMessages' then
        insert into public.scheduled_messages (
          organization_id, id, booking_id, rule_id, template_id, template_version,
          due_at, channel, recipient, subject, rendered_body, status, blocked_reason,
          approved_at, provider_result, idempotency_key, booking_fingerprint, created_at, updated_at
        ) values (
          p_organization_id, v_entity_id, v_payload ->> 'bookingId', v_payload ->> 'ruleId',
          v_payload ->> 'templateId', (v_payload ->> 'templateVersion')::integer,
          (v_payload ->> 'dueAt')::timestamptz, v_payload ->> 'channel',
          v_payload ->> 'recipient', v_payload ->> 'subject', v_payload ->> 'renderedBody',
          v_payload ->> 'status', v_payload ->> 'blockedReason',
          nullif(v_payload ->> 'approvedAt', '')::timestamptz,
          case when v_payload ? 'providerResult' then jsonb_build_object('result', v_payload ->> 'providerResult') else null end,
          v_payload ->> 'idempotencyKey', v_payload ->> 'bookingFingerprint',
          (v_payload ->> 'createdAt')::timestamptz, committed_at
        )
        on conflict (organization_id, id) do update set
          due_at = excluded.due_at,
          recipient = excluded.recipient,
          subject = excluded.subject,
          rendered_body = excluded.rendered_body,
          status = excluded.status,
          blocked_reason = excluded.blocked_reason,
          approved_at = excluded.approved_at,
          provider_result = excluded.provider_result,
          booking_fingerprint = excluded.booking_fingerprint,
          updated_at = excluded.updated_at;
      elsif v_entity_type = 'departureDebriefs' then
        insert into public.departure_debriefs (
          organization_id, id, booking_id, status, payload, last_prompted_at,
          snoozed_until, completed_at, updated_at
        ) values (
          p_organization_id, v_entity_id, v_payload ->> 'bookingId', v_payload ->> 'status',
          v_payload, nullif(v_payload ->> 'lastPromptedAt', '')::timestamptz,
          nullif(v_payload ->> 'snoozedUntil', '')::timestamptz,
          nullif(v_payload ->> 'completedAt', '')::timestamptz, committed_at
        )
        on conflict (organization_id, id) do update set
          status = excluded.status,
          payload = excluded.payload,
          last_prompted_at = excluded.last_prompted_at,
          snoozed_until = excluded.snoozed_until,
          completed_at = excluded.completed_at,
          updated_at = excluded.updated_at;
      elsif v_entity_type = 'marketingTouchpoints' then
        insert into public.marketing_touchpoints (
          organization_id, id, booking_id, recorded_at, source, method,
          utm_source, utm_medium, utm_campaign, utm_content, landing_page, note
        ) values (
          p_organization_id, v_entity_id, v_payload ->> 'bookingId',
          (v_payload ->> 'recordedAt')::timestamptz, v_payload ->> 'source',
          v_payload ->> 'method', v_payload ->> 'utmSource', v_payload ->> 'utmMedium',
          v_payload ->> 'utmCampaign', v_payload ->> 'utmContent',
          v_payload ->> 'landingPage', v_payload ->> 'note'
        )
        on conflict (organization_id, id) do update set
          booking_id = excluded.booking_id,
          recorded_at = excluded.recorded_at,
          source = excluded.source,
          method = excluded.method,
          utm_source = excluded.utm_source,
          utm_medium = excluded.utm_medium,
          utm_campaign = excluded.utm_campaign,
          utm_content = excluded.utm_content,
          landing_page = excluded.landing_page,
          note = excluded.note;
      end if;
    end if;

    committed_changes := committed_changes || jsonb_build_array(jsonb_build_object(
      'entityType', v_entity_type,
      'entityId', v_entity_id,
      'operation', v_operation,
      'recordVersion', next_version
    ));
  end loop;

  insert into public.operational_state_versions (
    organization_id, version, updated_at, updated_by
  ) values (p_organization_id, 0, committed_at, actor)
  on conflict (organization_id) do nothing;
  update public.operational_state_versions
  set version = version + 1, updated_at = committed_at, updated_by = actor
  where organization_id = p_organization_id
  returning version into next_state_version;

  replay_result := jsonb_build_object(
    'status', 'committed',
    'stateVersion', next_state_version,
    'savedAt', committed_at,
    'changes', committed_changes
  );
  insert into public.audit_events (
    organization_id, actor_id, entity_type, entity_id, action, payload, created_at
  ) values (
    p_organization_id, actor, 'record_batch', p_request_id, 'command_committed',
    jsonb_build_object(
      'request_id', p_request_id,
      'tab_id', p_tab_id,
      'client_sent_at', p_client_sent_at,
      'change_count', jsonb_array_length(p_changes),
      'result', replay_result
    ),
    committed_at
  );
  return replay_result;
end $$;

revoke all on function public.mutate_operational_record_batch(
  uuid, jsonb, text, timestamptz, text
) from public, anon;
grant execute on function public.mutate_operational_record_batch(
  uuid, jsonb, text, timestamptz, text
) to authenticated;
