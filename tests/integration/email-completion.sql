begin;
do $$
declare org uuid := gen_random_uuid(); outbound uuid; state text; refused boolean := false;
begin
  insert into public.organizations(id,name) values(org,'Email completion test');
  insert into public.outbound_messages(organization_id,channel,recipient,body,status,idempotency_key)
  values(org,'E-mail','test@example.invalid','Test','processing','test-completion') returning id into outbound;
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  perform public.complete_email_send(outbound,'provider-test',1);
  select status into state from public.outbound_messages where id=outbound;
  if state <> 'sent' then raise exception 'Missing sent state'; end if;
  perform public.apply_resend_webhook('event-test-delivered','provider-test','email.delivered',now(),null);
  perform public.complete_email_send(outbound,'provider-test',1);
  select status into state from public.outbound_messages where id=outbound;
  if state <> 'delivered' then raise exception 'Delivered regressed'; end if;
  perform public.apply_resend_webhook('event-test-bounce','provider-test','email.bounced',now(),'Test bounce');
  perform public.complete_email_send(outbound,'provider-test',1);
  select status into state from public.outbound_messages where id=outbound;
  if state <> 'error' then raise exception 'Bounce regressed'; end if;
  perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
  begin perform public.complete_email_send(outbound,'provider-test',1);
  exception when insufficient_privilege then refused := true; end;
  if not refused then raise exception 'Non-service access'; end if;
end $$;
rollback;
select 'PASS: accepted send, delivery, bounce, late completion and service role guard' as result;
