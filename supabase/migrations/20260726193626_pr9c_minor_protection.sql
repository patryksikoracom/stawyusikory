-- PR-9c: organization-scoped Standards for the Protection of Minors.
-- The application stores only approved SOP metadata, executable steps and the
-- minimum proof of execution. It deliberately has no child identity/document
-- fields and no free-text incident description.

create or replace function public.mutate_minor_protection(
  p_organization_id uuid,
  p_actor uuid,
  p_action text,
  p_booking_id text default null,
  p_details jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
  next_version bigint;
  standard_id text;
  standard_payload jsonb;
  booking_payload jsonb;
  execution_payload jsonb;
  reaction_payload jsonb;
  standard_version text;
  outcome text;
  resolution_reference text;
begin
  if p_actor is null or p_organization_id is null then
    raise exception 'Brak kontekstu organizacji' using errcode = '42501';
  end if;

  select membership.role into actor_role
  from public.organization_memberships membership
  where membership.organization_id = p_organization_id
    and membership.user_id = p_actor;

  if actor_role is null then
    raise exception 'Brak członkostwa w organizacji' using errcode = '42501';
  end if;

  insert into public.operational_state_versions (organization_id, version, updated_by)
  values (p_organization_id, 0, p_actor)
  on conflict (organization_id) do nothing;

  select state.version + 1 into next_version
  from public.operational_state_versions state
  where state.organization_id = p_organization_id
  for update;

  if p_action = 'activate_standard' then
    if actor_role not in ('owner', 'admin') then
      raise exception 'Tylko właściciel lub administrator może aktywować SOP'
        using errcode = '42501';
    end if;
    if coalesce(length(btrim(p_details ->> 'version')), 0) < 1
      or coalesce(length(btrim(p_details ->> 'reviewOwner')), 0) < 2
      or coalesce(length(btrim(p_details ->> 'staffPreparationReference')), 0) < 2
      or coalesce(p_details ->> 'fullDocumentUrl', '') !~ '^https://'
      or coalesce(p_details ->> 'childFriendlyDocumentUrl', '') !~ '^https://'
      or coalesce((p_details ->> 'publicationConfirmed')::boolean, false) is not true
      or coalesce((p_details ->> 'premisesDisplayConfirmed')::boolean, false) is not true
      or jsonb_typeof(p_details -> 'steps') <> 'array'
      or jsonb_array_length(p_details -> 'steps') = 0
    then
      raise exception 'SOP wymaga zatwierdzonej wersji, publikacji, szkolenia i kroków'
        using errcode = '22023';
    end if;
    if (p_details ->> 'approvedAt')::date > (p_details ->> 'effectiveFrom')::date
      or (p_details ->> 'reviewDueAt')::date <= (p_details ->> 'effectiveFrom')::date
      or (p_details ->> 'reviewDueAt')::date > (p_details ->> 'effectiveFrom')::date + interval '2 years'
    then
      raise exception 'Termin przeglądu SOP musi przypadać najpóźniej za dwa lata'
        using errcode = '22007';
    end if;

    update public.operational_records
    set payload = jsonb_set(payload, '{active}', 'false'::jsonb, true),
        record_version = next_version,
        updated_at = now(),
        updated_by = p_actor
    where organization_id = p_organization_id
      and entity_type = 'minorProtectionStandards'
      and payload ->> 'active' = 'true';

    standard_id := 'SOP-' || replace(gen_random_uuid()::text, '-', '');
    standard_payload := jsonb_build_object(
      'id', standard_id,
      'version', btrim(p_details ->> 'version'),
      'approvedAt', p_details ->> 'approvedAt',
      'effectiveFrom', p_details ->> 'effectiveFrom',
      'reviewDueAt', p_details ->> 'reviewDueAt',
      'fullDocumentUrl', p_details ->> 'fullDocumentUrl',
      'childFriendlyDocumentUrl', p_details ->> 'childFriendlyDocumentUrl',
      'reviewOwner', btrim(p_details ->> 'reviewOwner'),
      'staffPreparationReference', btrim(p_details ->> 'staffPreparationReference'),
      'publicationConfirmed', true,
      'premisesDisplayConfirmed', true,
      'steps', p_details -> 'steps',
      'active', true,
      'activatedAt', now()::text,
      'activatedBy', p_actor
    );
    insert into public.operational_records (
      organization_id, entity_type, entity_id, payload, record_version, updated_by
    ) values (
      p_organization_id, 'minorProtectionStandards', standard_id,
      standard_payload, next_version, p_actor
    );

  elsif p_action = 'complete' then
    if actor_role not in ('owner', 'admin', 'manager') then
      raise exception 'Brak uprawnień do wykonania procedury' using errcode = '42501';
    end if;
    outcome := p_details ->> 'outcome';
    if outcome not in ('Bez uwag', 'Wymaga reakcji') then
      raise exception 'Nieprawidłowy wynik procedury' using errcode = '22023';
    end if;

    select record.payload into booking_payload
    from public.operational_records record
    where record.organization_id = p_organization_id
      and record.entity_type = 'bookings'
      and record.entity_id = p_booking_id
    for update;
    if booking_payload is null
      or coalesce((booking_payload ->> 'children')::integer, 0) <= 0
      or booking_payload ->> 'workflowStatus' = 'Anulowana'
      or booking_payload ? 'deletedAt'
      or (booking_payload ->> 'checkOut')::date
        < (clock_timestamp() at time zone 'Europe/Warsaw')::date
    then
      raise exception 'Procedura nie dotyczy tego pobytu' using errcode = '22023';
    end if;

    select record.entity_id, record.payload
      into standard_id, standard_payload
    from public.operational_records record
    where record.organization_id = p_organization_id
      and record.entity_type = 'minorProtectionStandards'
      and record.payload ->> 'active' = 'true'
      and (record.payload ->> 'effectiveFrom')::date <= (booking_payload ->> 'checkIn')::date
    order by (record.payload ->> 'effectiveFrom')::date desc, record.updated_at desc
    limit 1;
    if standard_payload is null then
      raise exception 'Brak aktywnego zatwierdzonego SOP' using errcode = '22023';
    end if;

    standard_version := standard_payload ->> 'version';
    execution_payload := jsonb_build_object(
      'bookingId', p_booking_id,
      'required', true,
      'performed', true,
      'performedAt', now()::text,
      'performedBy', p_actor,
      'standardId', standard_id,
      'standardVersion', standard_version,
      'outcome', outcome
    );
    insert into public.operational_records (
      organization_id, entity_type, entity_id, payload, record_version, updated_by
    ) values (
      p_organization_id, 'minorProtectionExecutions', p_booking_id,
      execution_payload, next_version, p_actor
    );

    update public.operational_records
    set payload = jsonb_set(
          jsonb_set(payload, '{status}', to_jsonb(
            case when outcome = 'Bez uwag' then 'Zrobione' else 'Zablokowane' end
          ), true),
          '{completedAt}', to_jsonb(now()::text), true
        ),
        record_version = next_version,
        updated_at = now(),
        updated_by = p_actor
    where organization_id = p_organization_id
      and entity_type = 'tasks'
      and payload ->> 'bookingId' = p_booking_id
      and payload ->> 'complianceKind' = 'minor-protection'
      and payload ->> 'status' not in ('Zrobione', 'Nie dotyczy');

    if outcome = 'Wymaga reakcji' then
      reaction_payload := jsonb_build_object(
        'bookingId', p_booking_id,
        'status', 'Otwarte',
        'openedAt', now()::text,
        'openedBy', p_actor,
        'standardId', standard_id,
        'standardVersion', standard_version
      );
      insert into public.operational_records (
        organization_id, entity_type, entity_id, payload, record_version, updated_by
      ) values (
        p_organization_id, 'minorProtectionReactions', p_booking_id,
        reaction_payload, next_version, p_actor
      );
    end if;

  elsif p_action in ('acknowledge_reaction', 'close_reaction') then
    if actor_role not in ('owner', 'admin') then
      raise exception 'Tylko właściciel lub administrator obsługuje reakcję'
        using errcode = '42501';
    end if;
    select record.payload into reaction_payload
    from public.operational_records record
    where record.organization_id = p_organization_id
      and record.entity_type = 'minorProtectionReactions'
      and record.entity_id = p_booking_id
    for update;
    if reaction_payload is null or reaction_payload ->> 'status' = 'Zamknięte' then
      raise exception 'Brak otwartej reakcji' using errcode = '22023';
    end if;

    if p_action = 'acknowledge_reaction' then
      reaction_payload := jsonb_set(reaction_payload, '{status}', '"Przyjęte"'::jsonb, true);
      reaction_payload := jsonb_set(reaction_payload, '{acknowledgedAt}', to_jsonb(now()::text), true);
      reaction_payload := jsonb_set(reaction_payload, '{acknowledgedBy}', to_jsonb(p_actor::text), true);
    else
      resolution_reference := left(btrim(coalesce(p_details ->> 'resolutionReference', '')), 200);
      if length(resolution_reference) < 2 then
        raise exception 'Wymagane jest odwołanie do zapisu reakcji' using errcode = '22023';
      end if;
      reaction_payload := jsonb_set(reaction_payload, '{status}', '"Zamknięte"'::jsonb, true);
      reaction_payload := jsonb_set(reaction_payload, '{closedAt}', to_jsonb(now()::text), true);
      reaction_payload := jsonb_set(reaction_payload, '{closedBy}', to_jsonb(p_actor::text), true);
      reaction_payload := jsonb_set(
        reaction_payload, '{resolutionReference}', to_jsonb(resolution_reference), true
      );
      update public.operational_records
      set payload = (jsonb_set(payload, '{status}', '"Zrobione"'::jsonb, true) - 'blocker'),
          record_version = next_version,
          updated_at = now(),
          updated_by = p_actor
      where organization_id = p_organization_id
        and entity_type = 'tasks'
        and payload ->> 'bookingId' = p_booking_id
        and payload ->> 'complianceKind' = 'minor-protection';
    end if;
    update public.operational_records
    set payload = reaction_payload,
        record_version = next_version,
        updated_at = now(),
        updated_by = p_actor
    where organization_id = p_organization_id
      and entity_type = 'minorProtectionReactions'
      and entity_id = p_booking_id;
  else
    raise exception 'Nieobsługiwana akcja' using errcode = '22023';
  end if;

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
    'minor_protection',
    coalesce(p_booking_id, standard_id),
    p_action,
    jsonb_strip_nulls(jsonb_build_object(
      'version', next_version,
      'standard_id', standard_id,
      'standard_version', standard_version,
      'outcome', outcome
    ))
  );

  return next_version;
end
$$;

revoke all on function public.mutate_minor_protection(uuid, uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.mutate_minor_protection(uuid, uuid, text, text, jsonb)
  to service_role;

-- Existing child stays receive a first-class internal task. The same invariant
-- is maintained when an existing booking changes from zero to one-or-more
-- children. New booking aggregates already contain the task at creation time.
insert into public.operational_records (
  organization_id, entity_type, entity_id, payload, record_version, updated_at
)
select
  booking.organization_id,
  'tasks',
  'MP-' || md5(booking.organization_id::text || ':' || booking.entity_id),
  jsonb_build_object(
    'id', 'MP-' || md5(booking.organization_id::text || ':' || booking.entity_id),
    'bookingId', booking.entity_id,
    'type', 'Przed przyjazdem',
    'complianceKind', 'minor-protection',
    'priority', 'Wysoki',
    'status', 'Do zrobienia',
    'dueDate', booking.payload ->> 'checkIn',
    'owner', 'Operacje',
    'assigneeRole', 'manager',
    'unitId', booking.payload ->> 'unitId',
    'title', 'Wykonać zatwierdzoną procedurę ochrony małoletnich przed wydaniem kluczy.'
  ),
  1,
  now()
from public.operational_records booking
where booking.entity_type = 'bookings'
  and coalesce((booking.payload ->> 'children')::integer, 0) > 0
  and booking.payload ->> 'workflowStatus' <> 'Anulowana'
  and not (booking.payload ? 'deletedAt')
  and (booking.payload ->> 'checkOut')::date
    >= (clock_timestamp() at time zone 'Europe/Warsaw')::date
  and not exists (
    select 1
    from public.operational_records task
    where task.organization_id = booking.organization_id
      and task.entity_type = 'tasks'
      and task.payload ->> 'bookingId' = booking.entity_id
      and task.payload ->> 'complianceKind' = 'minor-protection'
  );

create or replace function private.reconcile_minor_protection_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  task_id text := 'MP-' || md5(new.organization_id::text || ':' || new.entity_id);
  procedure_required boolean :=
    coalesce((new.payload ->> 'children')::integer, 0) > 0
    and new.payload ->> 'workflowStatus' <> 'Anulowana'
    and not (new.payload ? 'deletedAt')
    and (new.payload ->> 'checkOut')::date
      >= (clock_timestamp() at time zone 'Europe/Warsaw')::date;
begin
  if procedure_required then
    insert into public.operational_records (
      organization_id, entity_type, entity_id, payload, record_version, updated_at, updated_by
    ) values (
      new.organization_id,
      'tasks',
      task_id,
      jsonb_build_object(
        'id', task_id,
        'bookingId', new.entity_id,
        'type', 'Przed przyjazdem',
        'complianceKind', 'minor-protection',
        'priority', 'Wysoki',
        'status', 'Do zrobienia',
        'dueDate', new.payload ->> 'checkIn',
        'owner', 'Operacje',
        'assigneeRole', 'manager',
        'unitId', new.payload ->> 'unitId',
        'title', 'Wykonać zatwierdzoną procedurę ochrony małoletnich przed wydaniem kluczy.'
      ),
      1,
      now(),
      new.updated_by
    )
    on conflict (organization_id, entity_type, entity_id) do nothing;

    update public.operational_records
    set payload = jsonb_set(
          jsonb_set(
            jsonb_set(
              payload,
              '{status}',
              case when payload ->> 'status' = 'Nie dotyczy'
                then '"Do zrobienia"'::jsonb else payload -> 'status' end,
              true
            ),
            '{dueDate}', to_jsonb(new.payload ->> 'checkIn'), true
          ),
          '{unitId}', to_jsonb(new.payload ->> 'unitId'), true
        ),
        record_version = record_version + 1,
        updated_at = now(),
        updated_by = new.updated_by
    where organization_id = new.organization_id
      and entity_type = 'tasks'
      and payload ->> 'bookingId' = new.entity_id
      and payload ->> 'complianceKind' = 'minor-protection'
      and payload ->> 'status' <> 'Zrobione';
  else
    update public.operational_records
    set payload = jsonb_set(payload, '{status}', '"Nie dotyczy"'::jsonb, true),
        record_version = record_version + 1,
        updated_at = now(),
        updated_by = new.updated_by
    where organization_id = new.organization_id
      and entity_type = 'tasks'
      and payload ->> 'bookingId' = new.entity_id
      and payload ->> 'complianceKind' = 'minor-protection'
      and payload ->> 'status' <> 'Zrobione';
  end if;
  return new;
end
$$;

revoke all on function private.reconcile_minor_protection_task() from public, anon, authenticated;

drop trigger if exists reconcile_minor_protection_task on public.operational_records;
create trigger reconcile_minor_protection_task
after update of payload on public.operational_records
for each row
when (new.entity_type = 'bookings')
execute function private.reconcile_minor_protection_task();
