begin;
do $test$
declare org uuid:=gen_random_uuid(); actor uuid:=gen_random_uuid(); result jsonb;
begin
insert into auth.users(id,email) values(actor,actor::text||'@example.invalid');
insert into public.organizations(id,name) values(org,'Configuration regression test');
insert into public.organization_memberships(organization_id,user_id,role) values(org,actor,'owner');
perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
set local role authenticated;
result:=public.mutate_operational_record_batch(org,
'[{"entityType":"communicationConfigs","entityId":"communication","operation":"upsert","expectedRecordVersion":0,"payload":{"id":"communication","senderName":"Stawy u Sikory","bankAccountNumber":"Numer konta do wpłaty Marcin przekaże bezpośrednio.","copyUserIds":[],"travelGuides":[]}}]'::jsonb,
'test-communication-create',now(),'test-settings-tab');
if result->>'status'<>'committed' then raise exception 'Configuration was not saved: %',result; end if;
end;
$test$;
rollback;
