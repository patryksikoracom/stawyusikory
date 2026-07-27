-- PR-12: durable evidence for OTA shadow mode, cutover gates and provider delivery.
-- This migration does not enable any provider or switch the source of truth.

alter table public.outbound_messages
  add column if not exists scheduled_message_id text,
  add column if not exists provider_message_id text,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists last_error text,
  add column if not exists important boolean not null default false;

create index if not exists outbound_messages_retry_idx
  on public.outbound_messages (status, next_attempt_at)
  where status in ('queued', 'error');

create table if not exists public.integration_contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('ota_gateway', 'sms', 'email', 'ota_message', 'ads_api', 'meter_api')),
  provider text not null,
  contract_version text not null,
  field_contract jsonb not null default '{}'::jsonb,
  source_of_truth text not null,
  retention_policy text not null,
  rto_minutes integer check (rto_minutes > 0),
  rpo_minutes integer check (rpo_minutes > 0),
  signed_at timestamptz,
  signed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, kind, provider, contract_version)
);

create table if not exists public.integration_shadow_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.integration_contracts(id) on delete cascade,
  report_date date not null,
  compared_count integer not null check (compared_count >= 0),
  differences jsonb not null default '[]'::jsonb check (jsonb_typeof(differences) = 'array'),
  unresolved_count integer not null check (unresolved_count >= 0),
  generated_at timestamptz not null default now(),
  unique (contract_id, report_date)
);

create table if not exists public.integration_cutover_gates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.integration_contracts(id) on delete cascade,
  active_records_reconciled_at timestamptz,
  rollback_tested_at timestamptz,
  rollback_evidence text,
  monitoring_confirmed_at timestamptz,
  owner_approved_at timestamptz,
  owner_approved_by uuid references auth.users(id),
  write_through_enabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_id)
);

create table if not exists public.integration_webhook_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.integration_contracts(id) on delete cascade,
  provider_event_id text not null,
  payload_hash text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'rejected', 'error')),
  unique (contract_id, provider_event_id)
);

alter table public.integration_contracts enable row level security;
alter table public.integration_shadow_reports enable row level security;
alter table public.integration_cutover_gates enable row level security;
alter table public.integration_webhook_receipts enable row level security;

grant select, insert, update on table
  public.integration_contracts,
  public.integration_shadow_reports,
  public.integration_cutover_gates,
  public.integration_webhook_receipts
to authenticated;

create policy "members read integration contracts"
  on public.integration_contracts for select to authenticated
  using (public.is_org_member(organization_id));
create policy "members read shadow reports"
  on public.integration_shadow_reports for select to authenticated
  using (public.is_org_member(organization_id));
create policy "members read cutover gates"
  on public.integration_cutover_gates for select to authenticated
  using (public.is_org_member(organization_id));
create policy "members read webhook receipts"
  on public.integration_webhook_receipts for select to authenticated
  using (public.is_org_member(organization_id));

-- Writes are deliberately limited to service-role paths. Production enablement
-- must therefore pass a server-side gate and cannot be toggled from the browser.
revoke insert, update on table
  public.integration_contracts,
  public.integration_shadow_reports,
  public.integration_cutover_gates,
  public.integration_webhook_receipts
from authenticated;
