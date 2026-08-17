-- PR-11b: append-only consent decisions and review-request lifecycle records.
do $migration$
declare
  function_definition text;
  previous_types constant text := '''people'', ''guests'', ''consents'', ''tasks''';
  next_types constant text := '''people'', ''guests'', ''consents'', ''consentLedger'', ''reviewRequests'', ''tasks''';
begin
  select pg_get_functiondef(
    'public.mutate_operational_record_batch(uuid,jsonb,text,timestamptz,text)'::regprocedure
  ) into function_definition;
  if function_definition is null or position(previous_types in function_definition) = 0 then
    raise exception 'Nie znaleziono oczekiwanej wersji komendy batchowej PR-11a';
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
