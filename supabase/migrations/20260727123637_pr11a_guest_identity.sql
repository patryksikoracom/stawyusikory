-- PR-11a stores a person independently from each stay while preserving the
-- existing record-versioned mutation path and tenant boundary.
do $migration$
declare
  function_definition text;
  previous_types constant text := '''units'', ''bookings'', ''guests'', ''consents'', ''tasks''';
  next_types constant text := '''units'', ''bookings'', ''people'', ''guests'', ''consents'', ''tasks''';
begin
  select pg_get_functiondef(
    'public.mutate_operational_record_batch(uuid,jsonb,text,timestamptz,text)'::regprocedure
  ) into function_definition;

  if function_definition is null or position(previous_types in function_definition) = 0 then
    raise exception 'Nie znaleziono oczekiwanej wersji komendy batchowej PR-8';
  end if;

  function_definition := replace(function_definition, previous_types, next_types);
  execute function_definition;
end;
$migration$;

revoke execute on function public.mutate_operational_record_batch(
  uuid, jsonb, text, timestamptz, text
) from public, anon;
grant execute on function public.mutate_operational_record_batch(
  uuid, jsonb, text, timestamptz, text
) to authenticated;

comment on function public.mutate_operational_record_batch(
  uuid, jsonb, text, timestamptz, text
) is 'Atomowa komenda rekordowa; od PR-11a obejmuje odrębne tożsamości osób.';
