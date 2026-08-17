-- PR-11c: versioned sender/bank/travel-guide configuration. Templates and
-- drafts remain operational records; provider delivery is still disabled.
do $migration$
declare
  function_definition text;
  previous_types constant text := '''reviewRequests'', ''tasks''';
  next_types constant text := '''reviewRequests'', ''communicationConfigs'', ''tasks''';
begin
  select pg_get_functiondef(
    'public.mutate_operational_record_batch(uuid,jsonb,text,timestamptz,text)'::regprocedure
  ) into function_definition;
  if function_definition is null or position(previous_types in function_definition) = 0 then
    raise exception 'Nie znaleziono oczekiwanej wersji komendy batchowej PR-11b';
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
