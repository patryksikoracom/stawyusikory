-- Avoid doubled backslashes under standard_conforming_strings: they match a
-- literal backslash, so every valid calendar date was rejected.
do $$
declare
  signature regprocedure := 'public.mutate_operational_calendar_block(uuid,text,text,bigint,jsonb,text,timestamptz,text)'::regprocedure;
  definition text;
  old_pattern text := '^' || chr(92) || chr(92) || 'd{4}-' || chr(92) || chr(92) || 'd{2}-' || chr(92) || chr(92) || 'd{2}$';
begin
  select pg_get_functiondef(signature) into definition;
  if strpos(definition, old_pattern) = 0 then
    raise exception 'Expected calendar date pattern not found';
  end if;
  execute replace(definition, old_pattern, '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
end $$;

