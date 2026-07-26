-- Repair for environments where PR-9c was applied before its operational
-- record entity types were added to the allowlist.

alter table public.operational_records
  drop constraint if exists operational_records_entity_type_check;

alter table public.operational_records
  add constraint operational_records_entity_type_check check (entity_type in (
    'units', 'bookings', 'guests', 'consents', 'tasks', 'media', 'blocks',
    'rates', 'costSettings', 'imports', 'sourceConnections', 'payments', 'invoices',
    'checklistItems', 'issues', 'messages', 'departureDebriefs', 'messageTemplates',
    'automationRules', 'scheduledMessages', 'marketingTouchpoints', 'auditLog', 'settings',
    'minorProtectionStandards', 'minorProtectionExecutions', 'minorProtectionReactions'
  ));
