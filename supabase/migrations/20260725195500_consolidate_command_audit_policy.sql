-- Keep command audit inserts on one permissive policy so Postgres evaluates
-- organization membership once per row. The state-write wrapper can use
-- invoker rights because the legacy writer performs its own authorization.

drop policy if exists "editors insert task command audit" on public.audit_events;
drop policy if exists "editors insert checklist command audit" on public.audit_events;
drop policy if exists "editors insert booking command audit" on public.audit_events;
drop policy if exists "editors insert operational command audit" on public.audit_events;

create policy "editors insert operational command audit" on public.audit_events
  for insert to authenticated
  with check (
    private.is_org_editor(organization_id)
    and actor_id = (select auth.uid())
    and (
      (entity_type = 'task' and action in ('command_committed', 'command_conflict'))
      or (
        entity_type = 'checklist_item'
        and action in ('command_committed', 'command_conflict')
      )
      or (entity_type = 'booking' and action in ('command_committed', 'command_conflict'))
      or (entity_type = 'state_write' and action in ('committed', 'conflict'))
    )
  );

alter function public.replace_operational_state_v2(
  bigint, jsonb, text, timestamptz, text
) security invoker;
