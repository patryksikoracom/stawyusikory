-- PR-8c: create a booking and all workflow side effects as one atomic aggregate.
-- A per-unit advisory transaction lock serializes availability checks, so two
-- simultaneous requests cannot reserve the same stay before either insert lands.

grant select, insert on table public.operational_records to authenticated;
grant select, insert, update on table public.operational_state_versions to authenticated;
grant select, insert on table public.audit_events to authenticated;
grant select, insert on table public.scheduled_messages to authenticated;

drop policy if exists "editors insert booking command audit" on public.audit_events;
create policy "editors insert booking command audit" on public.audit_events
  for insert to authenticated
  with check (
    private.is_org_editor(organization_id)
    and actor_id = (select auth.uid())
    and entity_type = 'booking'
    and action in ('command_committed', 'command_conflict')
  );

create or replace function public.create_operational_booking(
  p_organization_id uuid,
  p_booking_id text,
  p_booking jsonb,
  p_contact jsonb,
  p_tasks jsonb,
  p_checklist_items jsonb,
  p_scheduled_messages jsonb,
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
  next_state_version bigint;
  item jsonb;
  task_ids text[];
  committed_booking jsonb;
  committed_contact jsonb;
  committed_tasks jsonb := '[]'::jsonb;
  committed_checklist jsonb := '[]'::jsonb;
  committed_messages jsonb := '[]'::jsonb;
  conflict_type text;
  conflict_id text;
  replay_found boolean := false;
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
    raise exception 'Brak uprawnień do tworzenia rezerwacji' using errcode = '42501';
  end if;
  if p_booking_id is null or length(trim(p_booking_id)) < 1 or length(p_booking_id) > 128 then
    raise exception 'Nieprawidłowy identyfikator rezerwacji' using errcode = '22023';
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

  -- A retry with the same request id returns the already committed aggregate.
  select true
  into replay_found
  from public.audit_events
  where organization_id = p_organization_id
    and entity_type = 'booking'
    and entity_id = p_booking_id
    and action = 'command_committed'
    and payload ->> 'request_id' = p_request_id
  limit 1;

  if coalesce(replay_found, false) then
    select payload into committed_booking
    from public.operational_records
    where organization_id = p_organization_id
      and entity_type = 'bookings'
      and entity_id = p_booking_id;

    select payload into committed_contact
    from public.operational_records
    where organization_id = p_organization_id
      and entity_type = 'consents'
      and entity_id = p_booking_id;

    select coalesce(jsonb_agg(payload order by entity_id), '[]'::jsonb)
    into committed_tasks
    from public.operational_records
    where organization_id = p_organization_id
      and entity_type = 'tasks'
      and payload ->> 'bookingId' = p_booking_id;

    select coalesce(jsonb_agg(record.payload order by record.entity_id), '[]'::jsonb)
    into committed_checklist
    from public.operational_records record
    where record.organization_id = p_organization_id
      and record.entity_type = 'checklistItems'
      and record.payload ->> 'taskId' in (
        select task.entity_id
        from public.operational_records task
        where task.organization_id = p_organization_id
          and task.entity_type = 'tasks'
          and task.payload ->> 'bookingId' = p_booking_id
      );

    select coalesce(jsonb_agg(payload order by entity_id), '[]'::jsonb)
    into committed_messages
    from public.operational_records
    where organization_id = p_organization_id
      and entity_type = 'scheduledMessages'
      and payload ->> 'bookingId' = p_booking_id;

    select version into next_state_version
    from public.operational_state_versions
    where organization_id = p_organization_id;

    if committed_booking is null or next_state_version is null then
      raise exception 'Niespójny zapis idempotentny' using errcode = '22023';
    end if;

    return jsonb_build_object(
      'status', 'already_committed',
      'aggregate', jsonb_build_object(
        'booking', committed_booking,
        'tasks', committed_tasks,
        'checklistItems', committed_checklist,
        'scheduledMessages', committed_messages
      ) || case
        when committed_contact is null then '{}'::jsonb
        else jsonb_build_object('contact', committed_contact)
      end,
      'stateVersion', next_state_version,
      'savedAt', committed_booking ->> 'updatedAt'
    );
  end if;

  if p_booking is null
    or jsonb_typeof(p_booking) <> 'object'
    or p_booking ->> 'id' is distinct from p_booking_id
    or length(trim(coalesce(p_booking ->> 'unitId', ''))) < 1
    or length(p_booking ->> 'unitId') > 128
    or length(trim(coalesce(p_booking ->> 'guestLabel', ''))) < 1
    or length(p_booking ->> 'guestLabel') > 500
    or length(trim(coalesce(p_booking ->> 'source', ''))) < 1
    or length(p_booking ->> 'source') > 500
    or length(trim(coalesce(p_booking ->> 'createdBy', ''))) < 1
    or length(p_booking ->> 'createdBy') > 200
    or coalesce(p_booking ->> 'platform', '') <> all(array[
      'Bezpośrednio', 'Booking', 'Airbnb', 'Facebook', 'Google', 'AI/czat',
      'Polecenie', 'Telefon', 'E-mail', 'Strona www', 'Agoda', 'Expedia',
      'VRBO', 'Slowhop', 'Aloha Camp', 'Influencer/barter', 'Inne'
    ]::text[])
    or coalesce(p_booking ->> 'paymentStatus', '') <> all(array[
      'Do uzupełnienia', 'Zaliczka', 'Opłacone', 'Częściowo', 'Do dopłaty',
      'Anulowane', 'Barter'
    ]::text[])
    or coalesce(p_booking ->> 'workflowStatus', '') <> all(array[
      'Nowa', 'Potwierdzona', 'Przed przyjazdem', 'W trakcie', 'Po pobycie',
      'Zamknięta', 'Anulowana'
    ]::text[])
    or case
      when jsonb_typeof(p_booking -> 'adults') = 'number'
      then (p_booking ->> 'adults')::numeric <> trunc((p_booking ->> 'adults')::numeric)
        or (p_booking ->> 'adults')::numeric not between 1 and 100
      else true
    end
    or case
      when jsonb_typeof(p_booking -> 'children') = 'number'
      then (p_booking ->> 'children')::numeric <> trunc((p_booking ->> 'children')::numeric)
        or (p_booking ->> 'children')::numeric not between 0 and 100
      else true
    end
    or coalesce(p_booking ->> 'bookingDate', '') !~ '^\d{4}-\d{2}-\d{2}$'
    or coalesce(p_booking ->> 'checkIn', '') !~ '^\d{4}-\d{2}-\d{2}$'
    or coalesce(p_booking ->> 'checkOut', '') !~ '^\d{4}-\d{2}-\d{2}$'
    or (p_booking ? 'arrivalTime' and coalesce(p_booking ->> 'arrivalTime', '') !~ '^([01]\d|2[0-3]):[0-5]\d$')
    or (p_booking ? 'departureTime' and coalesce(p_booking ->> 'departureTime', '') !~ '^([01]\d|2[0-3]):[0-5]\d$')
    or case
      when coalesce(p_booking ->> 'checkIn', '') ~ '^\d{4}-\d{2}-\d{2}$'
        and coalesce(p_booking ->> 'checkOut', '') ~ '^\d{4}-\d{2}-\d{2}$'
      then (p_booking ->> 'checkOut')::date <= (p_booking ->> 'checkIn')::date
      else false
    end
  then
    raise exception 'Rezerwacja narusza reguły domenowe' using errcode = '22023';
  end if;
  perform (p_booking ->> 'bookingDate')::date;
  if p_contact is not null and (
    jsonb_typeof(p_contact) <> 'object'
    or p_contact ->> 'bookingId' is distinct from p_booking_id
  ) then
    raise exception 'Kontakt nie należy do rezerwacji' using errcode = '22023';
  end if;
  if jsonb_typeof(p_tasks) <> 'array'
    or jsonb_array_length(p_tasks) < 1
    or jsonb_array_length(p_tasks) > 20
    or jsonb_typeof(p_checklist_items) <> 'array'
    or jsonb_array_length(p_checklist_items) > 100
    or jsonb_typeof(p_scheduled_messages) <> 'array'
    or jsonb_array_length(p_scheduled_messages) > 50
  then
    raise exception 'Nieprawidłowy rozmiar agregatu rezerwacji' using errcode = '22023';
  end if;

  select array_agg(value ->> 'id')
  into task_ids
  from jsonb_array_elements(p_tasks);

  if exists (
    select 1
    from jsonb_array_elements(p_tasks) task
    where jsonb_typeof(task) <> 'object'
      or length(trim(coalesce(task ->> 'id', ''))) < 1
      or length(task ->> 'id') > 128
      or task ->> 'bookingId' is distinct from p_booking_id
      or coalesce(task ->> 'unitId', p_booking ->> 'unitId') is distinct from p_booking ->> 'unitId'
      or coalesce(task ->> 'type', '') <> all(array[
        'Dane', 'Rezerwacja', 'Płatność', 'Przed przyjazdem', 'Sprzątanie',
        'Content', 'Opinia', 'Follow-up', 'Naprawa', 'Inne'
      ]::text[])
      or coalesce(task ->> 'priority', '') <> all(array['Wysoki', 'Średni', 'Niski']::text[])
      or coalesce(task ->> 'status', '') <> all(array[
        'Do zrobienia', 'W toku', 'Zrobione', 'Zablokowane', 'Nie dotyczy'
      ]::text[])
      or length(trim(coalesce(task ->> 'owner', ''))) < 1
      or length(task ->> 'owner') > 200
      or length(trim(coalesce(task ->> 'title', ''))) < 1
      or length(task ->> 'title') > 500
      or (task ? 'dueDate' and coalesce(task ->> 'dueDate', '') !~ '^\d{4}-\d{2}-\d{2}$')
  ) or (
    select count(*) <> count(distinct task ->> 'id')
    from jsonb_array_elements(p_tasks) task
  ) then
    raise exception 'Zadania naruszają reguły agregatu' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_checklist_items) checklist
    where jsonb_typeof(checklist) <> 'object'
      or length(trim(coalesce(checklist ->> 'id', ''))) < 1
      or length(checklist ->> 'id') > 128
      or not (checklist ->> 'taskId' = any(task_ids))
      or length(trim(coalesce(checklist ->> 'label', ''))) < 1
      or length(checklist ->> 'label') > 500
      or jsonb_typeof(checklist -> 'done') is distinct from 'boolean'
  ) or (
    select count(*) <> count(distinct checklist ->> 'id')
    from jsonb_array_elements(p_checklist_items) checklist
  ) then
    raise exception 'Checklista narusza reguły agregatu' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_scheduled_messages) message
    where jsonb_typeof(message) <> 'object'
      or length(trim(coalesce(message ->> 'id', ''))) < 1
      or length(message ->> 'id') > 256
      or message ->> 'bookingId' is distinct from p_booking_id
      or length(trim(coalesce(message ->> 'ruleId', ''))) < 1
      or length(trim(coalesce(message ->> 'templateId', ''))) < 1
      or case
        when jsonb_typeof(message -> 'templateVersion') = 'number'
        then (message ->> 'templateVersion')::numeric <> trunc((message ->> 'templateVersion')::numeric)
          or (message ->> 'templateVersion')::numeric < 1
        else true
      end
      or length(trim(coalesce(message ->> 'dueAt', ''))) < 1
      or coalesce(message ->> 'channel', '') <> all(array['SMS', 'E-mail', 'OTA']::text[])
      or coalesce(message ->> 'status', '') <> all(array[
        'Wersja robocza', 'Zatwierdzona', 'Wysłana', 'Dostarczona', 'Błąd',
        'Anulowana', 'Wymaga sprawdzenia'
      ]::text[])
      or jsonb_typeof(message -> 'renderedBody') is distinct from 'string'
      or length(message ->> 'renderedBody') > 20000
      or length(trim(coalesce(message ->> 'idempotencyKey', ''))) < 1
      or length(trim(coalesce(message ->> 'bookingFingerprint', ''))) < 1
      or length(trim(coalesce(message ->> 'createdAt', ''))) < 1
  ) or (
    select count(*) <> count(distinct message ->> 'id')
    from jsonb_array_elements(p_scheduled_messages) message
  ) then
    raise exception 'Wiadomości naruszają reguły agregatu' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.operational_records
    where organization_id = p_organization_id
      and entity_type = 'units'
      and entity_id = p_booking ->> 'unitId'
  ) then
    return jsonb_build_object('status', 'unit_not_found');
  end if;

  -- Serialize the availability decision for one organization and unit.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_organization_id::text || ':' || (p_booking ->> 'unitId'),
      0
    )
  );

  if exists (
    select 1
    from public.operational_records
    where organization_id = p_organization_id
      and entity_type = 'bookings'
      and entity_id = p_booking_id
  ) then
    insert into public.audit_events (
      organization_id, actor_id, entity_type, entity_id, action, payload, created_at
    ) values (
      p_organization_id, actor, 'booking', p_booking_id, 'command_conflict',
      jsonb_build_object(
        'request_id', p_request_id,
        'tab_id', p_tab_id,
        'reason', 'booking_id_exists',
        'client_sent_at', p_client_sent_at
      ),
      committed_at
    );
    return jsonb_build_object('status', 'exists');
  end if;

  select 'booking', entity_id
  into conflict_type, conflict_id
  from public.operational_records
  where organization_id = p_organization_id
    and entity_type = 'bookings'
    and payload ->> 'unitId' = p_booking ->> 'unitId'
    and coalesce(payload ->> 'workflowStatus', '') <> 'Anulowana'
    and not (payload ? 'deletedAt')
    and case
      when coalesce(payload ->> 'checkIn', '') ~ '^\d{4}-\d{2}-\d{2}$'
        and coalesce(payload ->> 'checkOut', '') ~ '^\d{4}-\d{2}-\d{2}$'
      then (
        (
          (payload ->> 'checkIn')::date < (p_booking ->> 'checkOut')::date
          and (payload ->> 'checkOut')::date > (p_booking ->> 'checkIn')::date
        )
        or case
          when p_booking ? 'arrivalTime'
            and payload ? 'departureTime'
            and (payload ->> 'departureTime') ~ '^([01]\d|2[0-3]):[0-5]\d$'
          then (p_booking ->> 'checkIn')::date = (payload ->> 'checkOut')::date
            and (p_booking ->> 'arrivalTime')::time < (payload ->> 'departureTime')::time
          else false
        end
        or case
          when p_booking ? 'departureTime'
            and payload ? 'arrivalTime'
            and (payload ->> 'arrivalTime') ~ '^([01]\d|2[0-3]):[0-5]\d$'
          then (p_booking ->> 'checkOut')::date = (payload ->> 'checkIn')::date
            and (payload ->> 'arrivalTime')::time < (p_booking ->> 'departureTime')::time
          else false
        end
      )
      else false
    end
  limit 1;

  if conflict_id is null then
    select 'block', entity_id
    into conflict_type, conflict_id
    from public.operational_records
    where organization_id = p_organization_id
      and entity_type = 'blocks'
      and payload ->> 'unitId' = p_booking ->> 'unitId'
      and coalesce(payload ->> 'status', '') not in ('Anulowana', 'Zakończona')
      and case
        when coalesce(payload ->> 'dateFrom', '') ~ '^\d{4}-\d{2}-\d{2}$'
          and coalesce(payload ->> 'dateTo', '') ~ '^\d{4}-\d{2}-\d{2}$'
        then (payload ->> 'dateFrom')::date < (p_booking ->> 'checkOut')::date
          and (payload ->> 'dateTo')::date > (p_booking ->> 'checkIn')::date
        else false
      end
    limit 1;
  end if;

  if conflict_id is not null then
    insert into public.audit_events (
      organization_id, actor_id, entity_type, entity_id, action, payload, created_at
    ) values (
      p_organization_id, actor, 'booking', p_booking_id, 'command_conflict',
      jsonb_build_object(
        'request_id', p_request_id,
        'tab_id', p_tab_id,
        'reason', 'availability_conflict',
        'conflict_type', conflict_type,
        'conflict_id', conflict_id,
        'client_sent_at', p_client_sent_at
      ),
      committed_at
    );
    return jsonb_build_object(
      'status', 'availability_conflict',
      'conflictType', conflict_type,
      'conflictId', conflict_id
    );
  end if;

  committed_booking := p_booking || jsonb_build_object(
    'version', 1,
    'updatedAt', committed_at
  );
  insert into public.operational_records (
    organization_id, entity_type, entity_id, payload, record_version, updated_at, updated_by
  ) values (
    p_organization_id, 'bookings', p_booking_id, committed_booking, 1, committed_at, actor
  );

  if p_contact is not null then
    committed_contact := p_contact;
    insert into public.operational_records (
      organization_id, entity_type, entity_id, payload, record_version, updated_at, updated_by
    ) values (
      p_organization_id, 'consents', p_booking_id, committed_contact, 1, committed_at, actor
    );
  end if;

  for item in select value from jsonb_array_elements(p_tasks)
  loop
    item := item || jsonb_build_object('version', 1, 'updatedAt', committed_at);
    committed_tasks := committed_tasks || jsonb_build_array(item);
    insert into public.operational_records (
      organization_id, entity_type, entity_id, payload, record_version, updated_at, updated_by
    ) values (
      p_organization_id, 'tasks', item ->> 'id', item, 1, committed_at, actor
    );
  end loop;

  for item in select value from jsonb_array_elements(p_checklist_items)
  loop
    item := item || jsonb_build_object('version', 1, 'updatedAt', committed_at);
    committed_checklist := committed_checklist || jsonb_build_array(item);
    insert into public.operational_records (
      organization_id, entity_type, entity_id, payload, record_version, updated_at, updated_by
    ) values (
      p_organization_id, 'checklistItems', item ->> 'id', item, 1, committed_at, actor
    );
  end loop;

  for item in select value from jsonb_array_elements(p_scheduled_messages)
  loop
    committed_messages := committed_messages || jsonb_build_array(item);
    insert into public.operational_records (
      organization_id, entity_type, entity_id, payload, record_version, updated_at, updated_by
    ) values (
      p_organization_id, 'scheduledMessages', item ->> 'id', item, 1, committed_at, actor
    );
    insert into public.scheduled_messages (
      organization_id, id, booking_id, rule_id, template_id, template_version,
      due_at, channel, recipient, subject, rendered_body, status, blocked_reason,
      approved_at, provider_result, idempotency_key, booking_fingerprint,
      created_at, updated_at
    ) values (
      p_organization_id,
      item ->> 'id',
      item ->> 'bookingId',
      item ->> 'ruleId',
      item ->> 'templateId',
      (item ->> 'templateVersion')::integer,
      (item ->> 'dueAt')::timestamptz,
      item ->> 'channel',
      item ->> 'recipient',
      item ->> 'subject',
      item ->> 'renderedBody',
      item ->> 'status',
      item ->> 'blockedReason',
      nullif(item ->> 'approvedAt', '')::timestamptz,
      case when item ? 'providerResult'
        then jsonb_build_object('result', item ->> 'providerResult')
        else null
      end,
      item ->> 'idempotencyKey',
      item ->> 'bookingFingerprint',
      (item ->> 'createdAt')::timestamptz,
      committed_at
    );
  end loop;

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
    'booking',
    p_booking_id,
    'command_committed',
    jsonb_build_object(
      'request_id', p_request_id,
      'tab_id', p_tab_id,
      'state_version', next_state_version,
      'task_count', jsonb_array_length(committed_tasks),
      'checklist_count', jsonb_array_length(committed_checklist),
      'scheduled_message_count', jsonb_array_length(committed_messages),
      'client_sent_at', p_client_sent_at
    ),
    committed_at
  );

  return jsonb_build_object(
    'status', 'committed',
    'aggregate', jsonb_build_object(
      'booking', committed_booking,
      'tasks', committed_tasks,
      'checklistItems', committed_checklist,
      'scheduledMessages', committed_messages
    ) || case
      when committed_contact is null then '{}'::jsonb
      else jsonb_build_object('contact', committed_contact)
    end,
    'stateVersion', next_state_version,
    'savedAt', committed_at
  );
end $$;

revoke all on function public.create_operational_booking(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, text, timestamptz, text
) from public, anon;
grant execute on function public.create_operational_booking(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, text, timestamptz, text
) to authenticated;
