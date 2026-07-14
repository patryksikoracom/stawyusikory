-- Versioned, record-level persistence for the production application.
-- The legacy snapshot is retained as a rollback copy, but is no longer the
-- authoritative write model once records have been bootstrapped.

create table if not exists operational_state_versions (
  organization_id uuid primary key references organizations(id) on delete cascade,
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists operational_records (
  organization_id uuid not null references organizations(id) on delete cascade,
  entity_type text not null check (entity_type in (
    'units', 'bookings', 'guests', 'consents', 'tasks', 'media', 'blocks',
    'rates', 'imports', 'sourceConnections', 'payments', 'invoices',
    'checklistItems', 'issues', 'messages', 'settings'
  )),
  entity_id text not null,
  payload jsonb not null,
  record_version bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  primary key (organization_id, entity_type, entity_id)
);

create index if not exists idx_operational_records_org_type
  on operational_records (organization_id, entity_type);

alter table operational_state_versions enable row level security;
alter table operational_records enable row level security;

drop policy if exists "members manage state versions" on operational_state_versions;
create policy "members manage state versions" on operational_state_versions
  for all to authenticated
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));

drop policy if exists "members manage operational records" on operational_records;
create policy "members manage operational records" on operational_records
  for all to authenticated
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));

create or replace function public.replace_operational_state(
  p_expected_version bigint,
  p_state jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  target_org uuid;
  current_version bigint;
  next_version bigint;
  kind text;
  item jsonb;
  item_id text;
  kinds constant text[] := array[
    'units', 'bookings', 'guests', 'consents', 'tasks', 'media', 'blocks',
    'rates', 'imports', 'sourceConnections', 'payments', 'invoices',
    'checklistItems', 'issues', 'messages', 'settings'
  ];
begin
  select organization_id into target_org
  from organization_memberships
  where user_id = auth.uid()
  order by created_at
  limit 1;

  if target_org is null then
    raise exception 'Brak organizacji użytkownika' using errcode = '42501';
  end if;

  insert into operational_state_versions (organization_id, version, updated_by)
  values (target_org, 0, auth.uid())
  on conflict (organization_id) do nothing;

  select version into current_version
  from operational_state_versions
  where organization_id = target_org
  for update;

  if current_version <> p_expected_version then
    raise exception 'Wersja danych uległa zmianie. Odśwież aplikację.'
      using errcode = '40001', detail = current_version::text;
  end if;

  next_version := current_version + 1;

  foreach kind in array kinds loop
    delete from operational_records
    where organization_id = target_org and entity_type = kind;

    if kind = 'settings' then
      if jsonb_typeof(p_state -> kind) = 'object' then
        insert into operational_records (
          organization_id, entity_type, entity_id, payload,
          record_version, updated_by
        ) values (
          target_org, kind, 'organization', p_state -> kind,
          next_version, auth.uid()
        );
      end if;
    elsif jsonb_typeof(p_state -> kind) = 'array' then
      for item in select value from jsonb_array_elements(p_state -> kind) loop
        item_id := coalesce(
          item ->> 'id',
          case when kind in ('guests', 'consents') then item ->> 'bookingId' end
        );
        if item_id is null or item_id = '' then
          raise exception 'Brak identyfikatora rekordu typu %', kind using errcode = '22023';
        end if;
        insert into operational_records (
          organization_id, entity_type, entity_id, payload,
          record_version, updated_by
        ) values (
          target_org, kind, item_id, item,
          next_version, auth.uid()
        );
      end loop;
    end if;
  end loop;

  update operational_state_versions
  set version = next_version, updated_at = now(), updated_by = auth.uid()
  where organization_id = target_org;

  insert into operational_snapshots (organization_id, state, version, updated_at)
  values (target_org, p_state, next_version, now())
  on conflict (organization_id) do update
  set state = excluded.state, updated_at = excluded.updated_at;

  insert into audit_events (
    organization_id, actor_id, entity_type, entity_id, action, payload
  ) values (
    target_org, auth.uid(), 'state', target_org::text, 'committed',
    jsonb_build_object('version', next_version)
  );

  return next_version;
end $$;

revoke all on function public.replace_operational_state(bigint, jsonb) from public;
grant execute on function public.replace_operational_state(bigint, jsonb) to authenticated;

