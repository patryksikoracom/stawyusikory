-- Production foundation for Stawy OS. Apply after the initial schema.
create extension if not exists btree_gist;
create extension if not exists pgcrypto;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Europe/Warsaw',
  created_at timestamptz not null default now()
);

insert into organizations (id, name)
values ('11111111-1111-4111-8111-111111111111', 'Stawy u Sikory')
on conflict (id) do update set name = excluded.name;

create table if not exists organization_memberships (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create or replace function public.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from organization_memberships where organization_id = target_org and user_id = auth.uid()) $$;

create or replace function public.provision_stawy_owner()
returns trigger language plpgsql security definer set search_path = public
as $$
declare stawy_org uuid := '11111111-1111-4111-8111-111111111111';
begin
  insert into organizations (id, name)
    values (stawy_org, 'Stawy u Sikory')
    on conflict (id) do update set name = excluded.name;
  insert into organization_memberships (organization_id, user_id, role)
    values (stawy_org, new.id, 'owner')
    on conflict (organization_id, user_id) do update set role = excluded.role;
  insert into users_profiles (user_id, role, display_name)
    values (new.id, 'admin', coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
    on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created_stawy on auth.users;
create trigger on_auth_user_created_stawy after insert on auth.users
for each row execute procedure public.provision_stawy_owner();

do $$
declare user_record record; stawy_org uuid := '11111111-1111-4111-8111-111111111111';
begin
  insert into organizations (id, name)
    values (stawy_org, 'Stawy u Sikory')
    on conflict (id) do update set name = excluded.name;
  for user_record in select id, email from auth.users u where not exists (select 1 from organization_memberships m where m.user_id = u.id)
  loop
    insert into organization_memberships (organization_id, user_id, role)
      values (stawy_org, user_record.id, 'owner')
      on conflict (organization_id, user_id) do update set role = excluded.role;
    insert into users_profiles (user_id, role, display_name)
      values (user_record.id, 'admin', coalesce(split_part(user_record.email, '@', 1), 'Właściciel'))
      on conflict (user_id) do nothing;
  end loop;
end $$;

alter table units add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table bookings add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table guests add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table contacts_consents add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table tasks add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table media_assets add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table calendar_blocks add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table rate_rules add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table platform_imports add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table source_connections add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table cost_settings add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table channel_settings add column if not exists organization_id uuid references organizations(id) on delete cascade;

update units set organization_id = '11111111-1111-4111-8111-111111111111' where organization_id is null;
update bookings set organization_id = '11111111-1111-4111-8111-111111111111' where organization_id is null;
update guests set organization_id = '11111111-1111-4111-8111-111111111111' where organization_id is null;
update contacts_consents set organization_id = '11111111-1111-4111-8111-111111111111' where organization_id is null;
update tasks set organization_id = '11111111-1111-4111-8111-111111111111' where organization_id is null;
update media_assets set organization_id = '11111111-1111-4111-8111-111111111111' where organization_id is null;
update calendar_blocks set organization_id = '11111111-1111-4111-8111-111111111111' where organization_id is null;
update rate_rules set organization_id = '11111111-1111-4111-8111-111111111111' where organization_id is null;
update platform_imports set organization_id = '11111111-1111-4111-8111-111111111111' where organization_id is null;
update source_connections set organization_id = '11111111-1111-4111-8111-111111111111' where organization_id is null;
update cost_settings set organization_id = '11111111-1111-4111-8111-111111111111' where organization_id is null;
update channel_settings set organization_id = '11111111-1111-4111-8111-111111111111' where organization_id is null;

alter table bookings add column if not exists arrival_time time;
alter table bookings add column if not exists departure_time time;
alter table bookings add column if not exists gross_amount_cents bigint;
alter table bookings add column if not exists price_per_night_cents bigint;
alter table bookings add column if not exists deposit_amount_cents bigint;
alter table bookings add column if not exists deposit_due_date date;
alter table bookings add column if not exists payment_method text;
alter table bookings add column if not exists currency text not null default 'PLN';
alter table bookings add column if not exists version integer not null default 1;
alter table bookings add column if not exists needs_review boolean not null default false;
alter table tasks add column if not exists owner_label text;
alter table tasks add column if not exists comment text;

create table if not exists operational_snapshots (
  organization_id uuid primary key references organizations(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists calendar_feed_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  unit_id text not null,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, unit_id)
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  actor_id uuid references auth.users(id),
  entity_type text not null,
  entity_id text not null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists integration_sync_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  connection_id text not null,
  status text not null check (status in ('running', 'success', 'error')),
  imported_count integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists outbound_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  booking_id text,
  task_id text,
  channel text not null,
  recipient text not null,
  body text not null,
  status text not null default 'queued',
  idempotency_key text not null,
  provider_response jsonb,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table if not exists payment_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  booking_id text not null,
  occurred_at date not null,
  type text not null,
  amount_cents bigint not null,
  status text not null,
  method text,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists invoice_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  booking_id text,
  number text not null,
  issued_at date not null,
  amount_cents bigint not null,
  status text not null,
  note text,
  created_at timestamptz not null default now(),
  unique (organization_id, number)
);

create table if not exists task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  task_id text not null,
  label text not null,
  done boolean not null default false,
  completed_at timestamptz
);

create table if not exists issue_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  task_id text,
  booking_id text,
  unit_id text,
  title text not null,
  description text,
  status text not null default 'Otwarte',
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); new.version = old.version + 1; return new; end $$;
drop trigger if exists touch_operational_snapshot on operational_snapshots;
create trigger touch_operational_snapshot before update on operational_snapshots for each row execute procedure public.touch_updated_at();

alter table organizations enable row level security;
alter table organization_memberships enable row level security;
alter table operational_snapshots enable row level security;
alter table calendar_feed_tokens enable row level security;
alter table audit_events enable row level security;
alter table integration_sync_runs enable row level security;
alter table outbound_messages enable row level security;
alter table payment_transactions enable row level security;
alter table invoice_records enable row level security;
alter table task_checklist_items enable row level security;
alter table issue_reports enable row level security;

drop policy if exists "authenticated read all app data" on units;
drop policy if exists "authenticated read bookings" on bookings;
drop policy if exists "authenticated insert bookings" on bookings;
drop policy if exists "authenticated update bookings" on bookings;
drop policy if exists "authenticated read tasks" on tasks;
drop policy if exists "authenticated write tasks" on tasks;
drop policy if exists "authenticated read imports" on platform_imports;
drop policy if exists "authenticated write imports" on platform_imports;
drop policy if exists "authenticated read source connections" on source_connections;
drop policy if exists "members read organizations" on organizations;
drop policy if exists "members read memberships" on organization_memberships;
drop policy if exists "members manage snapshot" on operational_snapshots;
drop policy if exists "members manage feed tokens" on calendar_feed_tokens;
drop policy if exists "members read audit" on audit_events;
drop policy if exists "members manage sync runs" on integration_sync_runs;
drop policy if exists "members manage messages" on outbound_messages;
drop policy if exists "members manage payments" on payment_transactions;
drop policy if exists "members manage invoices" on invoice_records;
drop policy if exists "members manage checklists" on task_checklist_items;
drop policy if exists "members manage issues" on issue_reports;
drop policy if exists "org units" on units;
drop policy if exists "org bookings" on bookings;
drop policy if exists "org guests" on guests;
drop policy if exists "org consents" on contacts_consents;
drop policy if exists "org tasks" on tasks;
drop policy if exists "org media" on media_assets;
drop policy if exists "org blocks" on calendar_blocks;
drop policy if exists "org rates" on rate_rules;
drop policy if exists "org imports" on platform_imports;
drop policy if exists "org connections" on source_connections;
drop policy if exists "org costs" on cost_settings;
drop policy if exists "org channels" on channel_settings;

create policy "members read organizations" on organizations for select to authenticated using (is_org_member(id));
create policy "members read memberships" on organization_memberships for select to authenticated using (user_id = auth.uid() or is_org_member(organization_id));
create policy "members manage snapshot" on operational_snapshots for all to authenticated using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "members manage feed tokens" on calendar_feed_tokens for all to authenticated using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "members read audit" on audit_events for select to authenticated using (is_org_member(organization_id));
create policy "members manage sync runs" on integration_sync_runs for all to authenticated using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "members manage messages" on outbound_messages for all to authenticated using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "members manage payments" on payment_transactions for all to authenticated using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "members manage invoices" on invoice_records for all to authenticated using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "members manage checklists" on task_checklist_items for all to authenticated using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "members manage issues" on issue_reports for all to authenticated using (is_org_member(organization_id)) with check (is_org_member(organization_id));

create policy "org units" on units for all to authenticated using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "org bookings" on bookings for all to authenticated using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "org guests" on guests for all to authenticated using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "org consents" on contacts_consents for all to authenticated using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "org tasks" on tasks for all to authenticated using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "org media" on media_assets for all to authenticated using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "org blocks" on calendar_blocks for all to authenticated using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "org rates" on rate_rules for all to authenticated using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "org imports" on platform_imports for all to authenticated using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "org connections" on source_connections for all to authenticated using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "org costs" on cost_settings for all to authenticated using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "org channels" on channel_settings for all to authenticated using (is_org_member(organization_id)) with check (is_org_member(organization_id));

create index if not exists idx_bookings_org_dates on bookings (organization_id, unit_id, check_in, check_out);
create index if not exists idx_tasks_org_due on tasks (organization_id, due_date, status);
create index if not exists idx_audit_org_created on audit_events (organization_id, created_at desc);

alter table bookings drop constraint if exists no_overlapping_active_bookings;
alter table bookings add constraint no_overlapping_active_bookings exclude using gist (
  organization_id with =,
  unit_id with =,
  daterange(check_in, check_out, '[)') with &&
) where (workflow_status <> 'Anulowana' and check_in is not null and check_out is not null);
