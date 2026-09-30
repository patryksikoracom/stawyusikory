-- Dedicated test project only. Every fixture is rolled back.
begin;
do $$
declare
  org uuid := gen_random_uuid();
  other_org uuid := gen_random_uuid();
  actor uuid := gen_random_uuid();
  result jsonb;
  refused boolean;
begin
  insert into auth.users(id,email) values(actor, actor::text || '@example.invalid');
  insert into public.organizations(id,name) values(org,'Operator cleaning test'),(other_org,'Other tenant');
  insert into public.organization_memberships(organization_id,user_id,role) values(org,actor,'manager');
  insert into public.operational_records(organization_id,entity_type,entity_id,payload,record_version)
  values
    (org,'bookings','booking-test','{"id":"booking-test","workflowStatus":"Po pobycie"}',1),
    (org,'tasks','clean-test','{"id":"clean-test","bookingId":"booking-test","type":"Sprzątanie","status":"Do zrobienia","owner":"Jadzia","title":"Sprzątanie"}',1),
    (org,'tasks','blocked-test','{"id":"blocked-test","bookingId":"booking-test","type":"Sprzątanie","status":"Zablokowane"}',1),
    (org,'tasks','other-test','{"id":"other-test","type":"Płatność","status":"Do zrobienia"}',1);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',actor,'role','authenticated')::text,true);

  refused := false;
  begin
    perform public.update_operator_cleaning(org,'clean-test',1,false,'{"amount":150,"currency":"PLN","paidAt":"2026-09-30T10:00:00Z"}','test-pay-first');
  exception when sqlstate '22023' then refused := true; end;
  if not refused then raise exception 'Paid before completion'; end if;

  result := public.update_operator_cleaning(org,'clean-test',1,true,'{"amount":150,"currency":"PLN"}','test-complete');
  if result->>'status' <> 'committed' or result#>>'{task,status}' <> 'Zrobione'
    or result#>>'{task,readinessEvidence,source}' <> 'operator-confirmation' then
    raise exception 'Completion failed';
  end if;
  result := public.update_operator_cleaning(org,'clean-test',2,true,'{"amount":150,"currency":"PLN","paidAt":"2026-09-30T10:00:00Z"}','test-pay-later');
  if result#>>'{task,cleaningSettlement,paidAt}' is null then raise exception 'Payment missing'; end if;
  result := public.update_operator_cleaning(org,'clean-test',2,true,'{"amount":150,"currency":"PLN"}','test-stale-tab');
  if result->>'status' <> 'conflict' then raise exception 'Stale write accepted'; end if;
  refused := false;
  begin
    perform public.update_operator_cleaning(org,'clean-test',3,true,'{"amount":200,"currency":"PLN"}','test-change-paid');
  exception when sqlstate '22023' then refused := true; end;
  if not refused then raise exception 'Paid amount changed'; end if;
  result := public.update_operator_cleaning(org,'clean-test',3,true,'{"amount":150,"currency":"PLN"}','test-undo-paid');
  if result#>>'{task,cleaningSettlement,paidAt}' is not null then raise exception 'Undo failed'; end if;

  refused := false;
  begin perform public.update_operator_cleaning(org,'blocked-test',1,true,null,'test-blocked');
  exception when sqlstate '22023' then refused := true; end;
  if not refused then raise exception 'Blocked cleaning marked ready'; end if;
  refused := false;
  begin perform public.update_operator_cleaning(org,'other-test',1,true,null,'test-other-task');
  exception when insufficient_privilege then refused := true; end;
  if not refused then raise exception 'Non-cleaning task edited'; end if;
  refused := false;
  begin perform public.update_operator_cleaning(other_org,'clean-test',1,true,null,'test-other-org');
  exception when insufficient_privilege then refused := true; end;
  if not refused then raise exception 'Cross-tenant access allowed'; end if;
  update public.organization_memberships set role='viewer' where organization_id=org and user_id=actor;
  refused := false;
  begin perform public.update_operator_cleaning(org,'clean-test',4,true,null,'test-viewer');
  exception when insufficient_privilege then refused := true; end;
  if not refused then raise exception 'Viewer mutation allowed'; end if;
  if has_function_privilege('anon','public.update_operator_cleaning(uuid,text,bigint,boolean,jsonb,text)','EXECUTE') then
    raise exception 'Anonymous execute allowed';
  end if;
  if (select count(*) from public.audit_events where organization_id=org and action='operator_cleaning_updated') <> 3 then
    raise exception 'Unexpected audit count';
  end if;
end $$;
rollback;
select 'PASS: completion, payment, undo, version conflict, amount lock, blocked task, roles, tenant isolation and audit' as result;
