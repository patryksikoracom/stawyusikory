-- PR-11d: evidence-backed growth inputs. These records never execute an ad,
-- publish content, send a message, or change a price.
do $migration$
declare
  function_definition text;
  previous_types constant text := '''communicationConfigs'', ''tasks''';
  next_types constant text := '''communicationConfigs'', ''adSpend'', ''growthExperiments'', ''investmentModels'', ''meterReadings'', ''tasks''';
begin
  select pg_get_functiondef(
    'public.mutate_operational_record_batch(uuid,jsonb,text,timestamptz,text)'::regprocedure
  ) into function_definition;
  if function_definition is null or position(previous_types in function_definition) = 0 then
    raise exception 'Nie znaleziono oczekiwanej wersji komendy batchowej PR-11c';
  end if;
  execute replace(function_definition, previous_types, next_types);
end;
$migration$;

revoke execute on function public.mutate_operational_record_batch(
  uuid, jsonb, text, timestamptz, text
) from public, anon;
grant execute on function public.mutate_operational_record_batch(
  uuid, jsonb, text, timestamptz, text
) to authenticated;
