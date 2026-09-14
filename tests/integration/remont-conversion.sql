begin;
insert into auth.users(id,email) values('61439ca5-176c-4a74-8106-209b9d9b0168','remont-test@example.invalid');
insert into public.organizations(id,name) values('11111111-1111-4111-8111-111111111111','Conversion test') on conflict (id) do nothing;
insert into public.organization_memberships(organization_id,user_id,role) values('11111111-1111-4111-8111-111111111111','61439ca5-176c-4a74-8106-209b9d9b0168','owner');
insert into public.operational_records(organization_id,entity_type,entity_id,payload,record_version) values
('11111111-1111-4111-8111-111111111111','bookings','SUS-cb269ff8-961d-4c6e-a5fa-cebb478c633f','{"id":"SUS-cb269ff8-961d-4c6e-a5fa-cebb478c633f","guestLabel":"remont","unitId":"domek-4","checkIn":"2026-09-09","checkOut":"2026-09-16","workflowStatus":"Nowa","grossPrice":3850}',1),
('11111111-1111-4111-8111-111111111111','tasks','test-clean','{"id":"test-clean","bookingId":"SUS-cb269ff8-961d-4c6e-a5fa-cebb478c633f","unitId":"domek-4","type":"Sprzątanie","status":"Do zrobienia"}',1),
('11111111-1111-4111-8111-111111111111','tasks','test-payment','{"id":"test-payment","bookingId":"SUS-cb269ff8-961d-4c6e-a5fa-cebb478c633f","type":"Płatność","status":"Do zrobienia"}',1),
('11111111-1111-4111-8111-111111111111','scheduledMessages','test-message','{"id":"test-message","bookingId":"SUS-cb269ff8-961d-4c6e-a5fa-cebb478c633f","status":"Wersja robocza"}',1);
-- One explicitly identified correction, not name-based classification.
-- Caller must wrap this in BEGIN/COMMIT (or ROLLBACK for rehearsal).
set local lock_timeout = '5s';
set local statement_timeout = '20s';
do $$
declare
  target text := 'SUS-cb269ff8-961d-4c6e-a5fa-cebb478c633f';
  block_id text := 'BLOCK-REMONT-SUS-cb269ff8-961d-4c6e-a5fa-cebb478c633f';
  org uuid := '11111111-1111-4111-8111-111111111111';
  actor uuid := '61439ca5-176c-4a74-8106-209b9d9b0168';
  original jsonb;
  original_rows jsonb;
  original_messages jsonb;
  stamp timestamptz := clock_timestamp();
  new_version bigint;
begin
  if not exists(select 1 from public.organization_memberships where organization_id=org and user_id=actor and role='owner') then
    raise exception 'Expected owner missing';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(org::text || ':domek-4',0));
  lock table public.operational_records, public.payment_transactions, public.outbound_messages, public.scheduled_messages in share row exclusive mode;
  if exists(select 1 from public.operational_records where organization_id=org and entity_type='blocks' and entity_id=block_id) then
    raise exception 'Conversion block already exists: inspect before retry';
  end if;
  select payload into original from public.operational_records where organization_id=org and entity_type='bookings' and entity_id=target and record_version=1 for update;
  if original is null or original->>'guestLabel' <> 'remont' or original->>'unitId' <> 'domek-4'
    or original->>'checkIn' <> '2026-09-09' or original->>'checkOut' <> '2026-09-16'
    or original->>'workflowStatus' <> 'Nowa' or original->>'deletedAt' is not null then
    raise exception 'Booking changed; correction aborted';
  end if;
  if exists(select 1 from public.payment_transactions where organization_id=org and booking_id=target)
    or exists(select 1 from public.outbound_messages where organization_id=org and booking_id=target)
    or exists(select 1 from public.bookings where organization_id=org and id=target)
    or exists(select 1 from public.operational_records where organization_id=org and entity_type in ('payments','invoices') and payload->>'bookingId'=target)
    or exists(select 1 from public.scheduled_messages where organization_id=org and booking_id=target and status <> 'Wersja robocza') then
    raise exception 'Financial or delivery evidence requires manual reconciliation';
  end if;
  select jsonb_agg(to_jsonb(r)) into original_rows from public.operational_records r
    where organization_id=org and (entity_id=target or payload->>'bookingId'=target);
  select jsonb_agg(to_jsonb(m)) into original_messages from public.scheduled_messages m where organization_id=org and booking_id=target;
  insert into public.operational_state_versions(organization_id,version) values(org,0) on conflict do nothing;
  select version+1 into new_version from public.operational_state_versions where organization_id=org for update;

  insert into public.operational_records(organization_id,entity_type,entity_id,payload,record_version,updated_at,updated_by)
    values(org,'blocks',block_id,jsonb_build_object('id',block_id,'unitId','domek-4','dateFrom','2026-09-09','dateTo','2026-09-16','blockType','Remont','reason','Remont — przeniesiony z wpisu zastępczego ' || target,'status','Aktywna','version',1,'updatedAt',stamp),1,stamp,actor);
  update public.operational_records set payload=payload || jsonb_build_object('workflowStatus','Anulowana','deletedAt',stamp,'updatedAt',stamp,'version',record_version+1),record_version=record_version+1,updated_at=stamp,updated_by=actor
    where organization_id=org and entity_type='bookings' and entity_id=target;
  update public.operational_records set payload=(case when payload->>'type'='Sprzątanie'
      then (payload-'bookingId') || jsonb_build_object('title','Sprzątanie po remoncie')
      else payload || jsonb_build_object('status','Nie dotyczy') end) || jsonb_build_object('updatedAt',stamp,'version',record_version+1),
    record_version=record_version+1,updated_at=stamp,updated_by=actor
    where organization_id=org and entity_type='tasks' and payload->>'bookingId'=target and payload->>'type' in ('Sprzątanie','Płatność','Przed przyjazdem','Opinia') and payload->>'status' not in ('Zrobione','Nie dotyczy');
  update public.operational_records set payload=payload || jsonb_build_object('status','Anulowana','blockedReason','Wpis zastępczy przeniesiony do blokady remontowej','updatedAt',stamp,'version',record_version+1),record_version=record_version+1,updated_at=stamp,updated_by=actor
    where organization_id=org and entity_type='scheduledMessages' and payload->>'bookingId'=target and payload->>'status'='Wersja robocza';
  update public.scheduled_messages set status='Anulowana',blocked_reason='Wpis zastępczy przeniesiony do blokady remontowej',updated_at=stamp where organization_id=org and booking_id=target;
  update public.operational_state_versions set version=new_version,updated_at=stamp,updated_by=actor where organization_id=org;
  insert into public.audit_events(organization_id,actor_id,entity_type,entity_id,action,payload)
    values(org,actor,'booking',target,'converted_to_maintenance_block',jsonb_build_object('blockId',block_id,'reason','User confirmed this booking was a maintenance placeholder','originalRecords',original_rows,'originalScheduledMessages',original_messages,'stateVersion',new_version));
end $$;
do $$ begin
if not exists(select 1 from public.operational_records where entity_type='blocks' and payload->>'blockType'='Remont' and payload->>'dateFrom'='2026-09-09' and payload->>'dateTo'='2026-09-16') then raise exception 'Lost blocked period'; end if;
if not exists(select 1 from public.operational_records where entity_type='bookings' and payload->>'workflowStatus'='Anulowana' and payload->>'deletedAt' is not null and payload->>'grossPrice'='3850') then raise exception 'Lost original history'; end if;
if not exists(select 1 from public.operational_records where entity_id='test-clean' and payload->>'bookingId' is null and payload->>'status'='Do zrobienia') then raise exception 'Lost post-repair cleaning'; end if;
if not exists(select 1 from public.operational_records where entity_id='test-payment' and payload->>'status'='Nie dotyczy') then raise exception 'Payment task remains'; end if;
if not exists(select 1 from public.operational_records where entity_id='test-message' and payload->>'status'='Anulowana') then raise exception 'Message remains'; end if;
if not exists(select 1 from public.audit_events where action='converted_to_maintenance_block' and jsonb_array_length(payload->'originalRecords')=4) then raise exception 'Missing recovery evidence'; end if;
end $$;
rollback; select 'PASS: period preserved, original archived, cleaning retained, false payment/message cancelled, audit snapshot stored; rolled back' as result;