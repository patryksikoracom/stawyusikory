-- PR-8d: update or cancel one booking and reconcile its operational side
-- effects in one versioned transaction. Availability is serialized per unit,
-- while optimistic locks protect the booking and every related record that
-- the command is about to replace.

grant select, insert, update on table public.operational_records to authenticated;
grant select, insert, update on table public.operational_state_versions to authenticated;
grant select, insert on table public.audit_events to authenticated;
grant select, insert, update on table public.scheduled_messages to authenticated;

create or replace function public.update_operational_booking(
  p_organization_id uuid,
  p_booking_id text,
  p_expected_record_version bigint,
  p_booking jsonb,
  p_contact jsonb,
  p_tasks jsonb,
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
  current_booking jsonb;
  current_record_version bigint;
  next_record_version bigint;
  next_state_version bigint;
  current_related_version bigint;
  item jsonb;
  committed_booking jsonb;
  committed_contact jsonb;
  committed_tasks jsonb := '[]'::jsonb;
  committed_messages jsonb := '[]'::jsonb;
  old_unit_id text;
  conflict_type text;
  conflict_id text;
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
    raise exception 'Brak uprawnień do zapisu rezerwacji' using errcode = '42501';
  end if;
  if p_booking_id is null or length(trim(p_booking_id)) < 1 or length(p_booking_id) > 128 then
    raise exception 'Nieprawidłowy identyfikator rezerwacji' using errcode = '22023';
  end if;
  if p_expected_record_version is null or p_expected_record_version < 1 then
    raise exception 'Nieprawidłowa wersja rezerwacji' using errcode = '22023';
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
    or coalesce(p_booking ->> 'platform', '') not in (
      'Bezpośrednio', 'Booking', 'Airbnb', 'Facebook', 'Google', 'AI/czat',
      'Polecenie', 'Telefon', 'E-mail', 'Strona www', 'Agoda', 'Expedia',
      'VRBO', 'Slowhop', 'Aloha Camp', 'Influencer/barter', 'Inne'
    )
    or coalesce(p_booking ->> 'paymentStatus', '') not in (
      'Do uzupełnienia', 'Zaliczka', 'Opłacone', 'Częściowo', 'Do dopłaty',
      'Anulowane', 'Barter'
    )
    or coalesce(p_booking ->> 'workflowStatus', '') not in (
      'Nowa', 'Potwierdzona', 'Przed przyjazdem', 'W trakcie', 'Po pobycie',
      'Zamknięta', 'Anulowana'
    )
    or (case
      when jsonb_typeof(p_booking -> 'version') = 'number'
      then (p_booking ->> 'version')::numeric <> p_expected_record_version + 1
      else true
    end)
    or (case
      when jsonb_typeof(p_booking -> 'adults') = 'number'
      then (p_booking ->> 'adults')::numeric <> trunc((p_booking ->> 'adults')::numeric)
        or (p_booking ->> 'adults')::numeric not between 1 and 100
      else true
    end)
    or (case
      when jsonb_typeof(p_booking -> 'children') = 'number'
      then (p_booking ->> 'children')::numeric <> trunc((p_booking ->> 'children')::numeric)
        or (p_booking ->> 'children')::numeric not between 0 and 100
      else true
    end)
    or coalesce(p_booking ->> 'bookingDate', '') !~ '^\d{4}-\d{2}-\d{2}$'
    or coalesce(p_booking ->> 'checkIn', '') !~ '^\d{4}-\d{2}-\d{2}$'
    or coalesce(p_booking ->> 'checkOut', '') !~ '^\d{4}-\d{2}-\d{2}$'
    or (p_booking ? 'arrivalTime' and coalesce(p_booking ->> 'arrivalTime', '') !~ '^([01]\d|2[0-3]):[0-5]\d$')
    or (p_booking ? 'departureTime' and coalesce(p_booking ->> 'departureTime', '') !~ '^([01]\d|2[0-3]):[0-5]\d$')
  then
    raise exception 'Rezerwacja narusza reguły domenowe' using errcode = '22023';
  end if;
  perform (p_booking ->> 'bookingDate')::date;
  perform (p_booking ->> 'checkIn')::date;
  perform (p_booking ->> 'checkOut')::date;
  if (p_booking ->> 'checkOut')::date <= (p_booking ->> 'checkIn')::date then
    raise exception 'Nieprawidłowy zakres pobytu' using errcode = '22023';
  end if;

  if p_contact is not null and (
    jsonb_typeof(p_contact) <> 'object'
    or p_contact ->> 'bookingId' is distinct from p_booking_id
    or (case
      when jsonb_typeof(p_contact -> 'version') = 'number'
      then (p_contact ->> 'version')::numeric <> trunc((p_contact ->> 'version')::numeric)
        or (p_contact ->> 'version')::numeric < 1
      else true
    end)
  ) then
    raise exception 'Kontakt narusza reguły domenowe' using errcode = '22023';
  end if;

  if jsonb_typeof(p_tasks) <> 'array'
    or jsonb_array_length(p_tasks) > 100
    or jsonb_typeof(p_scheduled_messages) <> 'array'
    or jsonb_array_length(p_scheduled_messages) > 100
  then
    raise exception 'Nieprawidłowy rozmiar skutków rezerwacji' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_tasks) task
    where jsonb_typeof(task) <> 'object'
      or length(trim(coalesce(task ->> 'id', ''))) < 1
      or length(task ->> 'id') > 128
      or task ->> 'bookingId' is distinct from p_booking_id
      or coalesce(task ->> 'type', '') not in (
        'Dane', 'Rezerwacja', 'Płatność', 'Przed przyjazdem', 'Sprzątanie',
        'Content', 'Opinia', 'Follow-up', 'Naprawa', 'Inne'
      )
      or coalesce(task ->> 'priority', '') not in ('Wysoki', 'Średni', 'Niski')
      or coalesce(task ->> 'status', '') not in (
        'Do zrobienia', 'W toku', 'Zrobione', 'Zablokowane', 'Nie dotyczy'
      )
      or length(trim(coalesce(task ->> 'owner', ''))) < 1
      or length(task ->> 'owner') > 200
      or length(trim(coalesce(task ->> 'title', ''))) < 1
      or length(task ->> 'title') > 500
      or (case
        when jsonb_typeof(task -> 'version') = 'number'
        then (task ->> 'version')::numeric <> trunc((task ->> 'version')::numeric)
          or (task ->> 'version')::numeric < 2
        else true
      end)
      or (task ? 'dueDate' and coalesce(task ->> 'dueDate', '') !~ '^\d{4}-\d{2}-\d{2}$')
  ) or (
    select count(*) <> count(distinct task ->> 'id')
    from jsonb_array_elements(p_tasks) task
  ) then
    raise exception 'Zadania naruszają reguły agregatu' using errcode = '22023';
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
      or (case
        when jsonb_typeof(message -> 'templateVersion') = 'number'
        then (message ->> 'templateVersion')::numeric < 1
        else true
      end)
      or length(trim(coalesce(message ->> 'dueAt', ''))) < 1
      or coalesce(message ->> 'channel', '') not in ('SMS', 'E-mail', 'OTA')
      or coalesce(message ->> 'status', '') not in (
        'Wersja robocza', 'Zatwierdzona', 'Wysłana', 'Dostarczona', 'Błąd',
        'Anulowana', 'Wymaga sprawdzenia'
      )
      or jsonb_typeof(message -> 'renderedBody') <> 'string'
      or length(message ->> 'renderedBody') > 20000
      or length(trim(coalesce(message ->> 'idempotencyKey', ''))) < 1
      or length(trim(coalesce(message ->> 'bookingFingerprint', ''))) < 1
      or length(trim(coalesce(message ->> 'createdAt', ''))) < 1
      or (case
        when jsonb_typeof(message -> 'version') = 'number'
        then (message ->> 'version')::numeric <> trunc((message ->> 'version')::numeric)
          or (message ->> 'version')::numeric < 1
        else true
      end)
  ) or (
    select count(*) <> count(distinct message ->> 'id')
    from jsonb_array_elements(p_scheduled_messages) message
  ) then
    raise exception 'Wiadomości naruszają reguły agregatu' using errcode = '22023';
  end if;

  select payload, record_version
  into current_booking, current_record_version
  from public.operational_records
  where organization_id = p_organization_id
    and entity_type = 'bookings'
    and entity_id = p_booking_id
  for update;

  if current_record_version is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  if current_record_version <> p_expected_record_version then
    insert into public.audit_events (
      organization_id, actor_id, entity_type, entity_id, action, payload, created_at
    ) values (
      p_organization_id, actor, 'booking', p_booking_id, 'command_conflict',
      jsonb_build_object(
        'request_id', p_request_id,
        'tab_id', p_tab_id,
        'reason', 'record_version',
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

  if not exists (
    select 1
    from public.operational_records
    where organization_id = p_organization_id
      and entity_type = 'units'
      and entity_id = p_booking ->> 'unitId'
  ) then
    return jsonb_build_object('status', 'unit_not_found');
  end if;

  old_unit_id := current_booking ->> 'unitId';
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_organization_id::text || ':' || unit_id, 0)
  )
  from (
    select distinct candidate as unit_id
    from pg_catalog.unnest(array[old_unit_id, p_booking ->> 'unitId']) candidate
    where candidate is not null
    order by candidate
  ) unit_locks;

  if p_booking ->> 'workflowStatus' <> 'Anulowana' then
    select 'booking', entity_id
    into conflict_type, conflict_id
    from public.operational_records
    where organization_id = p_organization_id
      and entity_type = 'bookings'
      and entity_id <> p_booking_id
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
        'recordVersion', current_record_version,
        'conflictType', conflict_type,
        'conflictId', conflict_id
      );
    end if;
  end if;

  -- Lock and verify every related record before the first write. This makes a
  -- conflict roll back the whole booking command instead of partially moving
  -- tasks or replacing a message approved on another device.
  if p_contact is not null then
    select record_version
    into current_related_version
    from public.operational_records
    where organization_id = p_organization_id
      and entity_type = 'consents'
      and entity_id = p_booking_id
    for update;

    if (
      current_related_version is null
      and (p_contact ->> 'version')::bigint <> 1
    ) or (
      current_related_version is not null
      and (p_contact ->> 'version')::bigint <> current_related_version + 1
    ) then
      insert into public.audit_events (
        organization_id, actor_id, entity_type, entity_id, action, payload, created_at
      ) values (
        p_organization_id, actor, 'booking', p_booking_id, 'command_conflict',
        jsonb_build_object(
          'request_id', p_request_id,
          'tab_id', p_tab_id,
          'reason', 'related_record_conflict',
          'conflict_entity_type', 'contact',
          'conflict_id', p_booking_id,
          'current_record_version', current_related_version,
          'client_sent_at', p_client_sent_at
        ),
        committed_at
      );
      return jsonb_build_object(
        'status', 'related_record_conflict',
        'conflictEntityType', 'contact',
        'conflictId', p_booking_id,
        'conflictRecordVersion', current_related_version
      );
    end if;
  end if;

  for item in select value from jsonb_array_elements(p_tasks)
  loop
    select record_version
    into current_related_version
    from public.operational_records
    where organization_id = p_organization_id
      and entity_type = 'tasks'
      and entity_id = item ->> 'id'
      and payload ->> 'bookingId' = p_booking_id
    for update;

    if current_related_version is null
      or (item ->> 'version')::bigint <> current_related_version + 1
    then
      insert into public.audit_events (
        organization_id, actor_id, entity_type, entity_id, action, payload, created_at
      ) values (
        p_organization_id, actor, 'booking', p_booking_id, 'command_conflict',
        jsonb_build_object(
          'request_id', p_request_id,
          'tab_id', p_tab_id,
          'reason', 'related_record_conflict',
          'conflict_entity_type', 'task',
          'conflict_id', item ->> 'id',
          'current_record_version', current_related_version,
          'client_sent_at', p_client_sent_at
        ),
        committed_at
      );
      return jsonb_build_object(
        'status', 'related_record_conflict',
        'conflictEntityType', 'task',
        'conflictId', item ->> 'id',
        'conflictRecordVersion', current_related_version
      );
    end if;
  end loop;

  for item in select value from jsonb_array_elements(p_scheduled_messages)
  loop
    select record_version
    into current_related_version
    from public.operational_records
    where organization_id = p_organization_id
      and entity_type = 'scheduledMessages'
      and entity_id = item ->> 'id'
      and payload ->> 'bookingId' = p_booking_id
    for update;

    if (
      current_related_version is null
      and (item ->> 'version')::bigint <> 1
    ) or (
      current_related_version is not null
      and (item ->> 'version')::bigint <> current_related_version + 1
    ) then
      insert into public.audit_events (
        organization_id, actor_id, entity_type, entity_id, action, payload, created_at
      ) values (
        p_organization_id, actor, 'booking', p_booking_id, 'command_conflict',
        jsonb_build_object(
          'request_id', p_request_id,
          'tab_id', p_tab_id,
          'reason', 'related_record_conflict',
          'conflict_entity_type', 'scheduled_message',
          'conflict_id', item ->> 'id',
          'current_record_version', current_related_version,
          'client_sent_at', p_client_sent_at
        ),
        committed_at
      );
      return jsonb_build_object(
        'status', 'related_record_conflict',
        'conflictEntityType', 'scheduled_message',
        'conflictId', item ->> 'id',
        'conflictRecordVersion', current_related_version
      );
    end if;
  end loop;

  committed_booking := p_booking || jsonb_build_object(
    'version', p_expected_record_version + 1,
    'updatedAt', committed_at
  );
  update public.operational_records
  set payload = committed_booking,
      record_version = record_version + 1,
      updated_at = committed_at,
      updated_by = actor
  where organization_id = p_organization_id
    and entity_type = 'bookings'
    and entity_id = p_booking_id
    and record_version = p_expected_record_version
  returning record_version into next_record_version;

  if next_record_version is null then
    raise exception 'Wersja rezerwacji zmieniła się po weryfikacji' using errcode = '40001';
  end if;

  if p_contact is not null then
    committed_contact := p_contact || jsonb_build_object('updatedAt', committed_at);
    insert into public.operational_records (
      organization_id, entity_type, entity_id, payload, record_version, updated_at, updated_by
    ) values (
      p_organization_id, 'consents', p_booking_id, committed_contact,
      (p_contact ->> 'version')::bigint, committed_at, actor
    )
    on conflict (organization_id, entity_type, entity_id) do update
    set payload = excluded.payload,
        record_version = excluded.record_version,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;
  end if;

  for item in select value from jsonb_array_elements(p_tasks)
  loop
    item := item || jsonb_build_object('updatedAt', committed_at);
    committed_tasks := committed_tasks || jsonb_build_array(item);
    update public.operational_records
    set payload = item,
        record_version = (item ->> 'version')::bigint,
        updated_at = committed_at,
        updated_by = actor
    where organization_id = p_organization_id
      and entity_type = 'tasks'
      and entity_id = item ->> 'id';
  end loop;

  for item in select value from jsonb_array_elements(p_scheduled_messages)
  loop
    item := item || jsonb_build_object('updatedAt', committed_at);
    committed_messages := committed_messages || jsonb_build_array(item);
    insert into public.operational_records (
      organization_id, entity_type, entity_id, payload, record_version, updated_at, updated_by
    ) values (
      p_organization_id, 'scheduledMessages', item ->> 'id', item,
      (item ->> 'version')::bigint, committed_at, actor
    )
    on conflict (organization_id, entity_type, entity_id) do update
    set payload = excluded.payload,
        record_version = excluded.record_version,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;

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
    )
    on conflict (organization_id, id) do update
    set booking_id = excluded.booking_id,
        rule_id = excluded.rule_id,
        template_id = excluded.template_id,
        template_version = excluded.template_version,
        due_at = excluded.due_at,
        channel = excluded.channel,
        recipient = excluded.recipient,
        subject = excluded.subject,
        rendered_body = excluded.rendered_body,
        status = excluded.status,
        blocked_reason = excluded.blocked_reason,
        approved_at = excluded.approved_at,
        provider_result = excluded.provider_result,
        idempotency_key = excluded.idempotency_key,
        booking_fingerprint = excluded.booking_fingerprint,
        updated_at = excluded.updated_at;
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
      'command_kind', case
        when p_booking ->> 'workflowStatus' = 'Anulowana' then 'cancel'
        else 'update'
      end,
      'expected_record_version', p_expected_record_version,
      'record_version', next_record_version,
      'state_version', next_state_version,
      'task_count', jsonb_array_length(committed_tasks),
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
      'scheduledMessages', committed_messages
    ) || case
      when committed_contact is null then '{}'::jsonb
      else jsonb_build_object('contact', committed_contact)
    end,
    'recordVersion', next_record_version,
    'stateVersion', next_state_version,
    'savedAt', committed_at
  );
end $$;

revoke all on function public.update_operational_booking(
  uuid, text, bigint, jsonb, jsonb, jsonb, jsonb, text, timestamptz, text
) from public, anon;
grant execute on function public.update_operational_booking(
  uuid, text, bigint, jsonb, jsonb, jsonb, jsonb, text, timestamptz, text
) to authenticated;
