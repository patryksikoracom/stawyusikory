-- Invitation-only membership provisioning.
-- A missing role must fail closed instead of silently creating another owner.

drop trigger if exists on_auth_user_created_stawy on auth.users;
drop function if exists public.provision_stawy_owner();

alter table public.organization_memberships
  alter column role drop default;

drop policy if exists "owners create memberships" on public.organization_memberships;
create policy "owners create memberships" on public.organization_memberships
  for insert to authenticated
  with check (
    private.is_org_owner(organization_id)
    and role in ('admin', 'viewer')
  );

drop policy if exists "owners update memberships" on public.organization_memberships;
create policy "owners update memberships" on public.organization_memberships
  for update to authenticated
  using (private.is_org_owner(organization_id))
  with check (
    private.is_org_owner(organization_id)
    and role in ('admin', 'viewer')
  );
