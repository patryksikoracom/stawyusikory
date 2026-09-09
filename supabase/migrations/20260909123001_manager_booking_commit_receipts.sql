-- Booking RPCs use SECURITY INVOKER and find retries through audit_events.
-- Only the manager's own booking commit receipts are needed for replay.
create policy "manager reads own booking commit receipts"
on public.audit_events
for select
to authenticated
using (
  private.organization_role(organization_id) = 'manager'
  and actor_id = (select auth.uid())
  and entity_type = 'booking'
  and action = 'command_committed'
);
