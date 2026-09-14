-- One transaction owns event deduplication, delivery status and the UI projection.
-- Invoker permissions and explicit grants keep this endpoint service-only.
create or replace function public.apply_resend_webhook(
  p_event_id text,
  p_provider_message_id text,
  p_event_type text,
  p_occurred_at timestamptz,
  p_reason text default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  outbound public.outbound_messages%rowtype;
  inserted_id text;
  next_status text;
  is_failure boolean := p_event_type in ('email.bounced', 'email.complained', 'email.failed', 'email.suppressed');
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Brak uprawnień usługi' using errcode = '42501';
  end if;
  if nullif(p_event_id, '') is null or nullif(p_provider_message_id, '') is null
    or p_occurred_at is null or nullif(p_event_type, '') is null then
    raise exception 'Niepełne zdarzenie dostawy' using errcode = '22023';
  end if;

  select * into outbound from public.outbound_messages
  where provider_message_id = p_provider_message_id and channel = 'E-mail'
  for update;
  if not found then
    -- Resend can call back before the sender has persisted the provider ID.
    return jsonb_build_object('ok', false, 'unmatched', true);
  end if;

  insert into public.email_webhook_events
    (id, organization_id, provider_message_id, event_type, occurred_at, reason)
  values (p_event_id, outbound.organization_id, p_provider_message_id, p_event_type, p_occurred_at, p_reason)
  on conflict (id) do nothing returning id into inserted_id;
  if inserted_id is null then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  if not is_failure and p_event_type not in ('email.delivered', 'email.sent') then
    return jsonb_build_object('ok', true, 'recorded', true);
  end if;
  if (outbound.status = 'delivered' and p_event_type = 'email.sent')
    or (outbound.status = 'error' and not is_failure) then
    return jsonb_build_object('ok', true, 'recorded', true, 'status', outbound.status);
  end if;

  next_status := case when is_failure then 'error'
    when p_event_type = 'email.delivered' then 'delivered' else 'sent' end;
  update public.outbound_messages set
    status = next_status,
    delivered_at = case when p_event_type = 'email.delivered' then p_occurred_at else delivered_at end,
    next_attempt_at = null,
    last_error = case when is_failure then p_event_type else null end,
    provider_response = jsonb_build_object('provider', 'resend', 'event', p_event_type, 'reason', p_reason),
    updated_at = now()
  where id = outbound.id;

  if outbound.scheduled_message_id is not null then
    perform public.record_email_delivery_event(
      outbound.organization_id, outbound.scheduled_message_id,
      case when is_failure then 'Błąd' when next_status = 'delivered' then 'Dostarczona' else 'Wysłana' end,
      left(p_event_type || ':' || p_provider_message_id || coalesce(':' || p_reason, ''), 5000),
      replace(p_event_type, '.', '_')
    );
  end if;
  return jsonb_build_object('ok', true, 'status', next_status);
end;
$$;
revoke all on function public.apply_resend_webhook(text, text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.apply_resend_webhook(text, text, text, timestamptz, text) to service_role;
