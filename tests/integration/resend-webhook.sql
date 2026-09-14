begin;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
insert into public.scheduled_messages
 (id, organization_id, booking_id, rule_id, template_id, template_version, due_at, channel, rendered_body, status, idempotency_key, booking_fingerprint)
values ('test-atomic-email', '11111111-1111-4111-8111-111111111111', 'test-booking', 'arrival', 'test', 1, now(), 'E-mail', 'test', 'Wysłana', 'test-atomic-email', 'test');
insert into public.operational_records (organization_id, entity_type, entity_id, payload)
values ('11111111-1111-4111-8111-111111111111', 'scheduledMessages', 'test-atomic-email', '{"status":"Wysłana"}');
insert into public.outbound_messages
 (organization_id, channel, recipient, body, status, idempotency_key, provider_message_id, scheduled_message_id)
values ('11111111-1111-4111-8111-111111111111', 'E-mail', 'test@example.invalid', 'test', 'sent', 'test-atomic-email', 'test-provider-atomic', 'test-atomic-email');

-- Deliberately fail the final projection update; earlier writes must roll back.
create function pg_temp.reject_email_projection() returns trigger language plpgsql as $$
begin raise exception 'injected projection failure'; end; $$;
create trigger test_reject_email_projection before update on public.operational_records
for each row when (old.entity_id = 'test-atomic-email') execute function pg_temp.reject_email_projection();
do $$
begin
  begin
    perform public.apply_resend_webhook('test-event-delivered', 'test-provider-atomic', 'email.delivered', now());
    raise exception 'Expected failure';
  exception when others then
    if sqlerrm <> 'injected projection failure' then raise; end if;
  end;
  if exists (select 1 from public.email_webhook_events where id = 'test-event-delivered')
    or (select status from public.outbound_messages where provider_message_id = 'test-provider-atomic') <> 'sent' then
    raise exception 'Partial transaction survived';
  end if;
end $$;
drop trigger test_reject_email_projection on public.operational_records;
set local role service_role;

do $$
declare result jsonb; revision bigint;
begin
  result := public.apply_resend_webhook('test-event-delivered', 'test-provider-atomic', 'email.delivered', now());
  if result->>'status' <> 'delivered' then raise exception 'Delivery failed'; end if;
  select record_version into revision from public.operational_records where entity_id = 'test-atomic-email';
  result := public.apply_resend_webhook('test-event-delivered', 'test-provider-atomic', 'email.delivered', now());
  if result->>'duplicate' <> 'true' then raise exception 'Deduplication failed'; end if;
  if (select record_version from public.operational_records where entity_id = 'test-atomic-email') <> revision then raise exception 'Duplicate changed revision'; end if;
  perform public.apply_resend_webhook('test-event-late', 'test-provider-atomic', 'email.sent', now() - interval '1 minute');
  if (select status from public.outbound_messages where provider_message_id = 'test-provider-atomic') <> 'delivered' then raise exception 'Delivery downgraded'; end if;
  perform public.apply_resend_webhook('test-event-failed', 'test-provider-atomic', 'email.failed', now(), 'test failure');
  perform public.apply_resend_webhook('test-event-positive', 'test-provider-atomic', 'email.delivered', now());
  if (select payload->>'status' from public.operational_records where entity_id = 'test-atomic-email') <> 'Błąd' then raise exception 'Failure evidence lost'; end if;
  result := public.apply_resend_webhook('test-event-early', 'not-yet-saved', 'email.sent', now());
  if result->>'unmatched' <> 'true' then raise exception 'Early callback lost'; end if;
  if has_function_privilege('authenticated', 'public.apply_resend_webhook(text,text,text,timestamptz,text)', 'execute')
    or has_function_privilege('anon', 'public.apply_resend_webhook(text,text,text,timestamptz,text)', 'execute') then raise exception 'Public execution granted'; end if;
end $$;
rollback;
