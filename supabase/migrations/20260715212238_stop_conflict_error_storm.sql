-- Optimistic-lock conflicts are expected application outcomes, not database
-- failures. Return -(current_version + 1), preserving the bigint signature,
-- so Postgres logs are not flooded with SQLSTATE 40001 exceptions.
create or replace function public.replace_operational_state(p_expected_version bigint, p_state jsonb)
returns bigint language plpgsql security definer set search_path = public, private as $$
declare
  target_org uuid; current_version bigint; next_version bigint; kind text; item jsonb; item_id text;
  kinds constant text[] := array[
    'units', 'bookings', 'guests', 'consents', 'tasks', 'media', 'blocks',
    'rates', 'costSettings', 'imports', 'sourceConnections', 'payments', 'invoices',
    'checklistItems', 'issues', 'messages', 'departureDebriefs', 'messageTemplates',
    'automationRules', 'scheduledMessages', 'marketingTouchpoints', 'auditLog', 'settings'
  ];
begin
  select organization_id into target_org
  from organization_memberships
  where user_id = auth.uid() and role in ('owner', 'admin')
  order by created_at limit 1;
  if target_org is null then raise exception 'Brak uprawnień do zapisu' using errcode = '42501'; end if;
  if pg_column_size(p_state) > 5000000 then raise exception 'Stan aplikacji jest zbyt duży' using errcode = '22023'; end if;
  insert into operational_state_versions (organization_id, version, updated_by)
  values (target_org, 0, auth.uid()) on conflict (organization_id) do nothing;
  select version into current_version
  from operational_state_versions where organization_id = target_org for update;
  if current_version <> p_expected_version then
    return -(current_version + 1);
  end if;
  next_version := current_version + 1;
  foreach kind in array kinds loop
    delete from operational_records where organization_id = target_org and entity_type = kind;
    if kind = 'settings' then
      if jsonb_typeof(p_state -> kind) = 'object' then
        insert into operational_records (organization_id, entity_type, entity_id, payload, record_version, updated_by)
        values (target_org, kind, 'organization', p_state -> kind, next_version, auth.uid());
      end if;
    elsif jsonb_typeof(p_state -> kind) = 'array' then
      if jsonb_array_length(p_state -> kind) > 20000 then raise exception 'Za dużo rekordów typu %', kind using errcode = '22023'; end if;
      for item in select value from jsonb_array_elements(p_state -> kind) loop
        item_id := coalesce(item ->> 'id', case when kind in ('guests', 'consents') then item ->> 'bookingId' end);
        if item_id is null or item_id = '' then raise exception 'Brak identyfikatora rekordu typu %', kind using errcode = '22023'; end if;
        insert into operational_records (organization_id, entity_type, entity_id, payload, record_version, updated_by)
        values (target_org, kind, item_id, item, next_version, auth.uid());
      end loop;
    end if;
  end loop;
  update operational_state_versions
  set version = next_version, updated_at = now(), updated_by = auth.uid()
  where organization_id = target_org;
  insert into operational_snapshots (organization_id, state, version, updated_at)
  values (target_org, p_state, next_version, now())
  on conflict (organization_id) do update
  set state = excluded.state, version = excluded.version, updated_at = excluded.updated_at;
  insert into audit_events (organization_id, actor_id, entity_type, entity_id, action, payload)
  values (target_org, auth.uid(), 'state', target_org::text, 'committed', jsonb_build_object('version', next_version));
  return next_version;
end $$;

revoke all on function public.replace_operational_state(bigint, jsonb) from public, anon;
grant execute on function public.replace_operational_state(bigint, jsonb) to authenticated;
