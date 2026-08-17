-- PostgREST exposes the JWT role through auth.jwt(). The legacy singular
-- claim setting is not populated for service-role requests,
-- which caused valid Resend webhooks to fail after the outbound status update.

create or replace function public.record_email_delivery_event(
  p_organization_id uuid,
  p_scheduled_message_id text,
  p_status text,
  p_provider_result text,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  claim_role text := coalesce(auth.jwt() ->> 'role', '');
  next_record_version bigint;
begin
  if claim_role <> 'service_role' then
    raise exception 'Brak uprawnień usługi' using errcode = '42501';
  end if;
  if p_status not in ('Zatwierdzona', 'Wysłana', 'Dostarczona', 'Błąd') then
    raise exception 'Nieprawidłowy status dostawy' using errcode = '22023';
  end if;

  update public.scheduled_messages
  set status = p_status,
      provider_result = jsonb_build_object('result', p_provider_result),
      updated_at = now()
  where organization_id = p_organization_id
    and id = p_scheduled_message_id;

  update public.operational_records
  set payload = jsonb_set(
        jsonb_set(payload, '{status}', to_jsonb(p_status), true),
        '{providerResult}', to_jsonb(p_provider_result), true
      ),
      record_version = record_version + 1,
      updated_at = now()
  where organization_id = p_organization_id
    and entity_type = 'scheduledMessages'
    and entity_id = p_scheduled_message_id
  returning record_version into next_record_version;

  if next_record_version is not null then
    update public.operational_state_versions
    set version = version + 1,
        updated_at = now()
    where organization_id = p_organization_id;
  end if;

  insert into public.audit_events (
    organization_id, entity_type, entity_id, action, payload
  ) values (
    p_organization_id, 'scheduled_message', p_scheduled_message_id,
    p_action, jsonb_build_object('status', p_status, 'providerResult', p_provider_result)
  );
end;
$$;

revoke all on function public.record_email_delivery_event(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_email_delivery_event(uuid, text, text, text, text)
  to service_role;

insert into public.app_release_manifest (
  singleton, schema_version, required_migration, applied_at
)
values (
  true, '2026-08-17.1', '20260817164427_fix_resend_webhook_service_role_auth.sql', now()
)
on conflict (singleton) do update
set schema_version = excluded.schema_version,
    required_migration = excluded.required_migration,
    applied_at = excluded.applied_at;
