-- Serialize sender completion with delivery webhooks under the outbound row lock.
create or replace function public.complete_email_send(
  p_outbound_id uuid, p_provider_message_id text, p_attempts integer
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare outbound public.outbound_messages%rowtype;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Brak uprawnień usługi' using errcode = '42501';
  end if;
  if nullif(p_provider_message_id, '') is null or p_attempts < 1 then
    raise exception 'Niepełny wynik wysyłki' using errcode = '22023';
  end if;
  select * into strict outbound from public.outbound_messages where id = p_outbound_id for update;
  if outbound.provider_message_id is not null and outbound.provider_message_id <> p_provider_message_id then
    raise exception 'Niezgodny identyfikator dostawcy' using errcode = '22023';
  end if;
  if outbound.status in ('sent', 'delivered') or
    (outbound.status = 'error' and outbound.provider_message_id is not null) then
    return jsonb_build_object('ok', true, 'status', outbound.status);
  end if;
  update public.outbound_messages set status = 'sent', provider_message_id = p_provider_message_id,
    provider_response = jsonb_build_object('provider', 'resend', 'id', p_provider_message_id),
    attempts = greatest(attempts, p_attempts), next_attempt_at = null, last_error = null, updated_at = now()
  where id = p_outbound_id;
  if outbound.scheduled_message_id is not null then
    perform public.record_email_delivery_event(outbound.organization_id, outbound.scheduled_message_id,
      'Wysłana', p_provider_message_id, 'email_sent');
  end if;
  return jsonb_build_object('ok', true, 'status', 'sent');
end;
$$;
revoke all on function public.complete_email_send(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.complete_email_send(uuid, text, integer) to service_role;
