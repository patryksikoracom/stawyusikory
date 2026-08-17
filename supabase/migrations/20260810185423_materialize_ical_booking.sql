-- Turn one deterministic iCal availability record into an editable operational
-- booking without opening a general bypass around availability checks.

create or replace function public.create_operational_booking_from_ical(
  p_organization_id uuid,
  p_booking_id text,
  p_booking jsonb,
  p_contact jsonb,
  p_tasks jsonb,
  p_checklist_items jsonb,
  p_scheduled_messages jsonb,
  p_request_id text,
  p_client_sent_at timestamptz,
  p_tab_id text,
  p_ical_block_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  block_record public.operational_records%rowtype;
  result jsonb;
begin
  if p_booking -> 'importRef' ->> 'source' is distinct from 'ical'
    or p_booking -> 'importRef' ->> 'key' is distinct from p_ical_block_id
    or p_ical_block_id not like 'ICAL-%'
  then
    raise exception 'Nieprawidłowe powiązanie rezerwacji iCal' using errcode = '22023';
  end if;

  select * into block_record
  from public.operational_records
  where organization_id = p_organization_id
    and entity_type = 'blocks'
    and entity_id = p_ical_block_id
  for update;

  if block_record.entity_id is null then
    if exists (
      select 1 from public.operational_records
      where organization_id = p_organization_id
        and entity_type = 'bookings'
        and entity_id = p_booking_id
        and payload -> 'importRef' ->> 'source' = 'ical'
        and payload -> 'importRef' ->> 'key' = p_ical_block_id
    ) then
      return public.create_operational_booking(
        p_organization_id, p_booking_id, p_booking, p_contact, p_tasks,
        p_checklist_items, p_scheduled_messages, p_request_id,
        p_client_sent_at, p_tab_id
      );
    end if;
    raise exception 'Blokada iCal nie istnieje' using errcode = '22023';
  end if;

  if block_record.payload ->> 'unitId' is distinct from p_booking ->> 'unitId'
    or coalesce(block_record.payload ->> 'status', '') in ('Anulowana', 'Zakończona')
    or coalesce(block_record.payload ->> 'reason', '')
      not like ('[' || (p_booking ->> 'platform') || ']%')
    or coalesce(block_record.payload ->> 'dateFrom', '') !~ '^\d{4}-\d{2}-\d{2}$'
    or coalesce(block_record.payload ->> 'dateTo', '') !~ '^\d{4}-\d{2}-\d{2}$'
    or (block_record.payload ->> 'dateFrom')::date >= (p_booking ->> 'checkOut')::date
    or (block_record.payload ->> 'dateTo')::date <= (p_booking ->> 'checkIn')::date
    or abs((p_booking ->> 'checkIn')::date - (block_record.payload ->> 'dateFrom')::date) > 1
    or abs((p_booking ->> 'checkOut')::date - (block_record.payload ->> 'dateTo')::date) > 1
  then
    raise exception 'Rezerwacja nie odpowiada wybranej blokadzie iCal' using errcode = '22023';
  end if;

  delete from public.operational_records
  where organization_id = p_organization_id
    and entity_type = 'blocks'
    and entity_id = p_ical_block_id;

  result := public.create_operational_booking(
    p_organization_id, p_booking_id, p_booking, p_contact, p_tasks,
    p_checklist_items, p_scheduled_messages, p_request_id,
    p_client_sent_at, p_tab_id
  );

  if coalesce(result ->> 'status', '') not in ('committed', 'already_committed') then
    insert into public.operational_records (
      organization_id, entity_type, entity_id, payload,
      record_version, updated_at, updated_by
    ) values (
      block_record.organization_id, block_record.entity_type,
      block_record.entity_id, block_record.payload,
      block_record.record_version, block_record.updated_at,
      block_record.updated_by
    );
  end if;

  return result;
end;
$$;

revoke all on function public.create_operational_booking_from_ical(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, text, timestamptz, text, text
) from public, anon;
grant execute on function public.create_operational_booking_from_ical(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, text, timestamptz, text, text
) to authenticated;

update public.app_release_manifest
set schema_version = '2026-08-10.6',
    required_migration = '20260810185423_materialize_ical_booking.sql',
    applied_at = now()
where singleton = true;
