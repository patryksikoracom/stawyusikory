-- Run only against an isolated test project. All fixtures are rolled back.
begin;
do $$
declare
  org uuid := gen_random_uuid();
  outsider_org uuid := gen_random_uuid();
  actor uuid := gen_random_uuid();
  refused boolean;
  result jsonb;
begin
  insert into auth.users(id,email) values(actor, actor::text || '@example.invalid');
  insert into public.organizations(id,name) values(org,'Cleaning integration'),(outsider_org,'Other tenant');
  insert into public.organization_memberships(organization_id,user_id,role) values(org,actor,'cleaning');
  insert into public.operational_records(organization_id,entity_type,entity_id,payload,record_version)
  values
    (org,'tasks','clean-test','{"id":"clean-test","type":"Sprzątanie","status":"Do zrobienia","assignmentStatus":"Do przyjęcia","unitId":"unit-test"}',1),
    (org,'tasks','issue-test','{"id":"issue-test","type":"Sprzątanie","status":"Do zrobienia","unitId":"unit-test"}',1),
    (org,'checklistItems','item-test','{"id":"item-test","taskId":"clean-test","done":false}',1);

  refused := false;
  begin
    perform public.mutate_cleaning_task(org,actor,'clean-test','start');
  exception when others then refused := true;
  end;
  if not refused then raise exception 'Start before acceptance was allowed'; end if;

  perform public.mutate_cleaning_task(org,actor,'clean-test','accept',null,'{"proposedStartTime":"12:30"}');
  perform public.mutate_cleaning_task(org,actor,'clean-test','start');
  refused := false;
  begin
    perform public.mutate_cleaning_task(org,actor,'clean-test','complete');
  exception when others then refused := true;
  end;
  if not refused then raise exception 'Incomplete checklist was accepted'; end if;

  perform public.mutate_cleaning_task(org,actor,'clean-test','checklist','item-test','{"done":true}');
  perform public.mutate_cleaning_task(org,actor,'clean-test','complete');
  select payload into result from public.operational_records where organization_id=org and entity_type='tasks' and entity_id='clean-test';
  if result->>'status' <> 'Zrobione' or result->>'readyAt' is null or result#>>'{readinessEvidence,completedItems}' <> '1' then
    raise exception 'Completion evidence missing';
  end if;

  perform public.mutate_cleaning_task(org,actor,'issue-test','report',null,'{"title":"Test leak","category":"Woda"}');
  if not exists(select 1 from public.operational_records where organization_id=org and entity_type='tasks' and entity_id='issue-test' and payload->>'status'='Zablokowane')
    or not exists(select 1 from public.operational_records where organization_id=org and entity_type='issues' and payload->>'taskId'='issue-test' and payload->>'severity'='Wysoka') then
    raise exception 'Issue and blocked task not committed together';
  end if;

  refused := false;
  begin
    perform public.mutate_cleaning_task(outsider_org,actor,'issue-test','accept');
  exception when insufficient_privilege then refused := true;
  end;
  if not refused then raise exception 'Cross-tenant mutation allowed'; end if;
  if (select count(*) from public.audit_events where organization_id=org and entity_type='cleaning_task') <> 5 then
    raise exception 'Unexpected committed audit event count';
  end if;
end $$;
rollback;
select 'PASS: acceptance, start, checklist gate, completion evidence, atomic issue, tenant isolation, audit; fixtures rolled back' as result;
