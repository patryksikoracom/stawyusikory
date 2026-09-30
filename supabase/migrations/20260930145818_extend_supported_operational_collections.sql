-- The batch command and state API support these collections, but the older
-- table constraint was never extended alongside the command migrations.
-- Preserve every existing type and add the missing application collections.
DO $migration$
DECLARE existing_check text;
BEGIN
  SELECT pg_get_expr(conbin, conrelid) INTO STRICT existing_check
  FROM pg_constraint
  WHERE conrelid = 'public.operational_records'::regclass
    AND conname = 'operational_records_entity_type_check';
  ALTER TABLE public.operational_records DROP CONSTRAINT operational_records_entity_type_check;
  EXECUTE 'ALTER TABLE public.operational_records ADD CONSTRAINT operational_records_entity_type_check CHECK (('
    || existing_check || ') OR entity_type IN (''people'', ''consentLedger'', ''reviewRequests'', ''communicationConfigs'', ''adSpend'', ''growthExperiments'', ''investmentModels'', ''meterReadings''))';
END;
$migration$;
