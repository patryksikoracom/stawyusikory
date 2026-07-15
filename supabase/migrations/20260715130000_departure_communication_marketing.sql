-- Departure workflow, repair triage, draft-first communication and attribution.

alter table operational_records drop constraint if exists operational_records_entity_type_check;
alter table operational_records add constraint operational_records_entity_type_check check (entity_type in (
  'units', 'bookings', 'guests', 'consents', 'tasks', 'media', 'blocks',
  'rates', 'costSettings', 'imports', 'sourceConnections', 'payments', 'invoices',
  'checklistItems', 'issues', 'messages', 'departureDebriefs', 'messageTemplates',
  'automationRules', 'scheduledMessages', 'marketingTouchpoints', 'auditLog', 'settings'
));

create table if not exists departure_debriefs (
  id text not null,
  organization_id uuid not null references organizations(id) on delete cascade,
  booking_id text not null,
  status text not null default 'Oczekuje',
  payload jsonb not null default '{}'::jsonb,
  last_prompted_at timestamptz,
  snoozed_until timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, id),
  unique (organization_id, booking_id)
);

create table if not exists message_templates (
  id text not null,
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  purpose text not null,
  channel text not null,
  language text not null default 'pl',
  subject text,
  body text not null,
  allowed_variables text[] not null default '{}',
  version integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, id),
  unique (organization_id, name, language, version)
);

create table if not exists automation_rules (
  id text not null,
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  template_id text not null,
  trigger_event text not null,
  offset_days integer not null default 0,
  send_time time not null default '10:00',
  mode text not null default 'Wersja robocza',
  conditions jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, id)
);

create table if not exists scheduled_messages (
  id text not null,
  organization_id uuid not null references organizations(id) on delete cascade,
  booking_id text not null,
  rule_id text not null,
  template_id text not null,
  template_version integer not null,
  due_at timestamptz not null,
  channel text not null,
  recipient text,
  subject text,
  rendered_body text not null,
  status text not null default 'Wersja robocza',
  blocked_reason text,
  approved_at timestamptz,
  provider_result jsonb,
  idempotency_key text not null,
  booking_fingerprint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, id),
  unique (organization_id, idempotency_key)
);

create table if not exists marketing_touchpoints (
  id text not null,
  organization_id uuid not null references organizations(id) on delete cascade,
  booking_id text not null,
  recorded_at timestamptz not null default now(),
  source text,
  method text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  landing_page text,
  note text,
  primary key (organization_id, id)
);

alter table tasks add column if not exists issue_id text;
alter table tasks add column if not exists planning_horizon text;
alter table units add column if not exists default_price_per_night numeric not null default 0;
alter table cost_settings add column if not exists active boolean not null default true;
alter table issue_reports add column if not exists category text;
alter table issue_reports add column if not exists location text;
alter table issue_reports add column if not exists severity text;
alter table issue_reports add column if not exists source text;
alter table issue_reports add column if not exists debrief_id text;
alter table issue_reports add column if not exists photo_urls text[] not null default '{}';
alter table issue_reports add column if not exists owner_label text;
alter table issue_reports add column if not exists next_arrival_risk boolean not null default false;
alter table issue_reports add column if not exists planning_horizon text;
alter table issue_reports add column if not exists resolution_notes text;
alter table issue_reports add column if not exists resolved_at timestamptz;

create index if not exists idx_departure_debriefs_org_status on departure_debriefs (organization_id, status);
create index if not exists idx_scheduled_messages_due on scheduled_messages (organization_id, status, due_at);
create index if not exists idx_marketing_touchpoints_source on marketing_touchpoints (organization_id, source, method);

alter table departure_debriefs enable row level security;
alter table message_templates enable row level security;
alter table automation_rules enable row level security;
alter table scheduled_messages enable row level security;
alter table marketing_touchpoints enable row level security;

create policy "members manage departure debriefs" on departure_debriefs for all to authenticated using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "members manage message templates" on message_templates for all to authenticated using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "members manage automation rules" on automation_rules for all to authenticated using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "members manage scheduled messages" on scheduled_messages for all to authenticated using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "members manage marketing touchpoints" on marketing_touchpoints for all to authenticated using (is_org_member(organization_id)) with check (is_org_member(organization_id));

create or replace function public.replace_operational_state(p_expected_version bigint, p_state jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  target_org uuid; current_version bigint; next_version bigint; kind text; item jsonb; item_id text;
  kinds constant text[] := array[
    'units', 'bookings', 'guests', 'consents', 'tasks', 'media', 'blocks',
    'rates', 'costSettings', 'imports', 'sourceConnections', 'payments', 'invoices',
    'checklistItems', 'issues', 'messages', 'departureDebriefs', 'messageTemplates',
    'automationRules', 'scheduledMessages', 'marketingTouchpoints', 'auditLog', 'settings'
  ];
begin
  select organization_id into target_org from organization_memberships where user_id = auth.uid() order by created_at limit 1;
  if target_org is null then raise exception 'Brak organizacji użytkownika' using errcode = '42501'; end if;
  insert into operational_state_versions (organization_id, version, updated_by) values (target_org, 0, auth.uid()) on conflict (organization_id) do nothing;
  select version into current_version from operational_state_versions where organization_id = target_org for update;
  if current_version <> p_expected_version then raise exception 'Wersja danych uległa zmianie. Odśwież aplikację.' using errcode = '40001', detail = current_version::text; end if;
  next_version := current_version + 1;
  foreach kind in array kinds loop
    delete from operational_records where organization_id = target_org and entity_type = kind;
    if kind = 'settings' then
      if jsonb_typeof(p_state -> kind) = 'object' then
        insert into operational_records (organization_id, entity_type, entity_id, payload, record_version, updated_by)
        values (target_org, kind, 'organization', p_state -> kind, next_version, auth.uid());
      end if;
    elsif jsonb_typeof(p_state -> kind) = 'array' then
      for item in select value from jsonb_array_elements(p_state -> kind) loop
        item_id := coalesce(item ->> 'id', case when kind in ('guests', 'consents') then item ->> 'bookingId' end);
        if item_id is null or item_id = '' then raise exception 'Brak identyfikatora rekordu typu %', kind using errcode = '22023'; end if;
        insert into operational_records (organization_id, entity_type, entity_id, payload, record_version, updated_by)
        values (target_org, kind, item_id, item, next_version, auth.uid());
      end loop;
    end if;
  end loop;
  update operational_state_versions set version = next_version, updated_at = now(), updated_by = auth.uid() where organization_id = target_org;
  insert into operational_snapshots (organization_id, state, version, updated_at) values (target_org, p_state, next_version, now())
  on conflict (organization_id) do update set state = excluded.state, version = excluded.version, updated_at = excluded.updated_at;
  insert into audit_events (organization_id, actor_id, entity_type, entity_id, action, payload)
  values (target_org, auth.uid(), 'state', target_org::text, 'committed', jsonb_build_object('version', next_version));
  return next_version;
end $$;

revoke all on function public.replace_operational_state(bigint, jsonb) from public;
grant execute on function public.replace_operational_state(bigint, jsonb) to authenticated;
