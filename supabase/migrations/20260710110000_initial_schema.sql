create type user_role as enum ('admin', 'viewer');
create type workflow_status as enum ('Nowa', 'Potwierdzona', 'Przed przyjazdem', 'W trakcie', 'Po pobycie', 'Zamknięta', 'Anulowana');
create type payment_status as enum ('Do uzupełnienia', 'Zaliczka', 'Opłacone', 'Częściowo', 'Do dopłaty', 'Anulowane', 'Barter');
create type task_status as enum ('Do zrobienia', 'W toku', 'Zrobione', 'Zablokowane', 'Nie dotyczy');
create type task_type as enum ('Dane', 'Rezerwacja', 'Płatność', 'Przed przyjazdem', 'Sprzątanie', 'Content', 'Opinia', 'Follow-up', 'Naprawa', 'Inne');
create type priority_level as enum ('Wysoki', 'Średni', 'Niski');
create type yes_no_unknown as enum ('Tak', 'Nie', 'Do dopytania', 'Nie dotyczy');
create type sync_status as enum ('Aktywne', 'Do podłączenia', 'Wymaga sprawdzenia', 'Ręczny backup', 'Błąd');
create type connection_type as enum ('API', 'iCal', 'CSV/email', 'Channel manager', 'Ręcznie');
create type data_quality as enum ('Pełne', 'Częściowe', 'Minimalne');

create table users_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'viewer',
  display_name text not null,
  created_at timestamptz not null default now()
);

create table units (
  id text primary key,
  name text not null,
  max_people integer not null,
  bedrooms integer not null,
  default_cleaning_cost numeric not null default 0,
  notes text
);

create table bookings (
  id text primary key,
  booking_date date,
  source text,
  platform text not null,
  platform_reservation_no text,
  unit_id text not null references units(id),
  check_in date,
  check_out date,
  adults integer not null default 0,
  children integer not null default 0,
  guest_label text not null,
  city_area text,
  gross_price numeric,
  payment_status payment_status not null default 'Do uzupełnienia',
  workflow_status workflow_status not null default 'Nowa',
  special_requests text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_stay_dates check (check_out is null or check_in is null or check_out > check_in)
);

create table guests (
  booking_id text primary key references bookings(id) on delete cascade,
  group_type text,
  segment text,
  decision_maker text,
  motivation text,
  children_ages text,
  jobs_lifestyle text,
  discovery_channel text,
  booking_channel text,
  search_phrase_or_ai_prompt text,
  best_quote text,
  objections text,
  nps integer check (nps between 0 and 10),
  satisfaction integer check (satisfaction between 1 and 5)
);

create table contacts_consents (
  booking_id text primary key references bookings(id) on delete cascade,
  phone text,
  email text,
  marketing_consent yes_no_unknown not null default 'Do dopytania',
  photo_fb_consent yes_no_unknown not null default 'Do dopytania',
  photo_site_ads_consent yes_no_unknown not null default 'Do dopytania',
  consent_scope text,
  consent_source text,
  consent_date date,
  consent_withdrawn_at date
);

create table tasks (
  id text primary key,
  booking_id text not null references bookings(id) on delete cascade,
  type task_type not null,
  priority priority_level not null default 'Średni',
  status task_status not null default 'Do zrobienia',
  due_date date,
  owner_id uuid references auth.users(id),
  title text not null,
  blocker text,
  completed_at date,
  created_at timestamptz not null default now()
);

create table media_assets (
  id text primary key,
  booking_id text not null references bookings(id) on delete cascade,
  type text not null,
  file_url text,
  caption text,
  people_visible text,
  consent_scope text,
  usage_status text not null default 'Do zgody',
  publish_channel text,
  privacy_risk text
);

create table calendar_blocks (
  id text primary key,
  unit_id text not null references units(id),
  date_from date not null,
  date_to date not null,
  block_type text not null,
  reason text not null,
  status text not null default 'Planowana',
  constraint valid_block_dates check (date_to > date_from)
);

create table rate_rules (
  id text primary key,
  unit_id text not null references units(id),
  date_from date,
  date_to date,
  season text not null,
  price_per_night numeric not null,
  min_nights integer not null default 1,
  active boolean not null default true
);

create table platform_imports (
  id text primary key,
  platform text not null,
  imported_at timestamptz,
  sync_source connection_type,
  reservation_no text,
  reservation_link text,
  booking_date date,
  status text,
  listing text,
  guest_name text,
  city text,
  check_in date,
  check_out date,
  adults integer,
  children integer,
  children_ages text,
  gross_price numeric,
  currency text,
  commission numeric,
  payout numeric,
  payment_status payment_status,
  cancellation_policy text,
  arrival_time text,
  special_requests text,
  first_message text,
  raw_source text,
  missing_fields text[],
  data_quality data_quality,
  matched_booking_id text references bookings(id),
  transfer_status text not null default 'Do przeniesienia'
);

create table source_connections (
  id text primary key,
  platform text not null,
  connection_type connection_type not null,
  status sync_status not null default 'Do podłączenia',
  last_sync_at timestamptz,
  coverage numeric not null default 0,
  next_step text not null,
  notes text,
  priority text not null default 'Teraz'
);

create table cost_settings (
  id text primary key,
  unit_id text references units(id),
  label text not null,
  value numeric not null default 0,
  unit text not null,
  notes text
);

create table channel_settings (
  id text primary key,
  channel text not null,
  commission_rate numeric not null default 0,
  payment_fee_rate numeric not null default 0,
  notes text
);

alter table users_profiles enable row level security;
alter table units enable row level security;
alter table bookings enable row level security;
alter table guests enable row level security;
alter table contacts_consents enable row level security;
alter table tasks enable row level security;
alter table media_assets enable row level security;
alter table calendar_blocks enable row level security;
alter table rate_rules enable row level security;
alter table platform_imports enable row level security;
alter table source_connections enable row level security;
alter table cost_settings enable row level security;
alter table channel_settings enable row level security;

create policy "authenticated read all app data" on units for select to authenticated using (true);
create policy "authenticated read bookings" on bookings for select to authenticated using (true);
create policy "authenticated insert bookings" on bookings for insert to authenticated with check (true);
create policy "authenticated update bookings" on bookings for update to authenticated using (true);
create policy "authenticated read tasks" on tasks for select to authenticated using (true);
create policy "authenticated write tasks" on tasks for all to authenticated using (true) with check (true);
create policy "authenticated read imports" on platform_imports for select to authenticated using (true);
create policy "authenticated write imports" on platform_imports for all to authenticated using (true) with check (true);
create policy "authenticated read source connections" on source_connections for select to authenticated using (true);

insert into units (id, name, max_people, bedrooms, default_cleaning_cost, notes) values
  ('domek-rybaka', 'Domek Rybaka', 6, 3, 250, 'Większy domek, mocny dla rodzin i wędkarzy.'),
  ('domek-4', 'Domek 4-osobowy', 4, 2, 220, 'Mniejszy domek, para albo rodzina 2+2.');

insert into channel_settings (id, channel, commission_rate, payment_fee_rate, notes) values
  ('direct', 'Bezpośrednio', 0, 0.02, 'Najlepsza marża.'),
  ('booking', 'Booking', 0.15, 0, 'Zweryfikować realną prowizję.'),
  ('airbnb', 'Airbnb', 0.16, 0, 'Zweryfikować realny model opłat.');

insert into source_connections (id, platform, connection_type, status, coverage, next_step, notes, priority) values
  ('SRC-BOOKING', 'Booking', 'API', 'Do podłączenia', 82, 'Podpiąć oficjalny eksport/API lub cykliczny CSV z panelu Booking.', 'Najważniejsze pola: data rezerwacji, kwota, prowizja, wiadomość, status płatności.', 'Teraz'),
  ('SRC-AIRBNB', 'Airbnb', 'iCal', 'Wymaga sprawdzenia', 48, 'Użyć iCal do dat, a szczegóły uzupełniać z CSV/email/channel managera.', 'iCal zwykle daje terminy, ale nie pełny profil marketingowy, cenę i zgody.', 'Teraz');
