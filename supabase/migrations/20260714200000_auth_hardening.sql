-- New accounts must never gain access to Stawy u Sikory automatically.
-- Memberships are granted explicitly by an existing owner or an administrator.

drop trigger if exists on_auth_user_created_stawy on auth.users;
revoke all on function public.provision_stawy_owner() from public;
revoke all on function public.provision_stawy_owner() from anon;
revoke all on function public.provision_stawy_owner() from authenticated;

create or replace function public.is_org_owner(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from organization_memberships
    where organization_id = target_org
      and user_id = auth.uid()
      and role = 'owner'
  )
$$;

drop policy if exists "owners create memberships" on organization_memberships;
drop policy if exists "owners update memberships" on organization_memberships;
drop policy if exists "owners delete memberships" on organization_memberships;

create policy "owners create memberships" on organization_memberships
  for insert to authenticated
  with check (is_org_owner(organization_id));

create policy "owners update memberships" on organization_memberships
  for update to authenticated
  using (is_org_owner(organization_id))
  with check (is_org_owner(organization_id));

create policy "owners delete memberships" on organization_memberships
  for delete to authenticated
  using (is_org_owner(organization_id) and user_id <> auth.uid());

