-- Stage 2: the manager works through validated booking commands and receives
-- a server projection. Raw financial records and raw booking JSON stay behind
-- the server boundary.

do $$
declare
  function_sql text;
  function_signature regprocedure :=
    'public.update_operational_booking(uuid,text,bigint,jsonb,jsonb,jsonb,jsonb,text,timestamptz,text)'::regprocedure;
begin
  select pg_get_functiondef(function_signature) into function_sql;

  if strpos(function_sql, 'actor_role text := private.organization_role(p_organization_id);') = 0 then
    function_sql := replace(
      function_sql,
      'actor uuid := auth.uid();',
      E'actor uuid := auth.uid();\n  actor_role text := private.organization_role(p_organization_id);'
    );
  end if;

  if strpos(function_sql, 'committed_booking := current_booking || (') = 0 then
    function_sql := replace(
      function_sql,
      $needle$committed_booking := p_booking || jsonb_build_object(
    'version', p_expected_record_version + 1,
    'updatedAt', committed_at
  );$needle$,
      $replacement$if actor_role = 'manager' then
    committed_booking := current_booking || (
      p_booking - array[
        'commission', 'payout', 'guestPaidTotal', 'guestServiceFee',
        'priceAdjustment', 'openingPaidAmount', 'openingPaidCurrency',
        'openingPaidSource', 'importWarnings'
      ]
    ) || jsonb_build_object(
      'version', p_expected_record_version + 1,
      'updatedAt', committed_at
    );
  else
    committed_booking := p_booking || jsonb_build_object(
      'version', p_expected_record_version + 1,
      'updatedAt', committed_at
    );
  end if;$replacement$
    );
  end if;

  if strpos(function_sql, 'committed_booking := current_booking || (') = 0 then
    raise exception 'Nie udało się dodać ochrony pól finansowych do %', function_signature;
  end if;
  execute function_sql;
end
$$;

do $$
declare
  function_sql text;
  function_signature regprocedure :=
    'public.create_operational_booking(uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,text,timestamptz,text)'::regprocedure;
begin
  select pg_get_functiondef(function_signature) into function_sql;

  if strpos(function_sql, 'actor_role text := private.organization_role(p_organization_id);') = 0 then
    function_sql := replace(
      function_sql,
      'actor uuid := auth.uid();',
      E'actor uuid := auth.uid();\n  actor_role text := private.organization_role(p_organization_id);'
    );
  end if;

  if strpos(function_sql, 'p_booking := p_booking - array[') = 0 then
    function_sql := replace(
      function_sql,
      E'begin\n  if actor is null then',
      E'begin\n  if actor_role = ''manager'' then\n    p_booking := p_booking - array[\n      ''commission'', ''payout'', ''guestPaidTotal'', ''guestServiceFee'',\n      ''priceAdjustment'', ''openingPaidAmount'', ''openingPaidCurrency'',\n      ''openingPaidSource'', ''importWarnings''\n    ];\n  end if;\n\n  if actor is null then'
    );
  end if;

  if strpos(function_sql, 'p_booking := p_booking - array[') = 0 then
    raise exception 'Nie udało się dodać kontraktu pól do %', function_signature;
  end if;
  execute function_sql;
end
$$;

do $$
declare
  function_sql text;
  function_signature regprocedure :=
    'public.mutate_operational_booking(uuid,text,bigint,jsonb,jsonb,jsonb,jsonb,text,text,timestamptz,text)'::regprocedure;
begin
  select pg_get_functiondef(function_signature) into function_sql;

  if strpos(function_sql, 'actor_role text := private.organization_role(p_organization_id);') = 0 then
    function_sql := replace(
      function_sql,
      'actor uuid := auth.uid();',
      E'actor uuid := auth.uid();\n  actor_role text := private.organization_role(p_organization_id);'
    );
  end if;

  if strpos(function_sql, '#- ''{aggregate,booking,commission}''') = 0 then
    function_sql := replace(
      function_sql,
      E'  return result;\nend',
      E'  if actor_role = ''manager'' and result ->> ''status'' = ''committed'' then\n    result := result\n      #- ''{aggregate,booking,commission}''\n      #- ''{aggregate,booking,payout}''\n      #- ''{aggregate,booking,guestPaidTotal}''\n      #- ''{aggregate,booking,guestServiceFee}''\n      #- ''{aggregate,booking,priceAdjustment}''\n      #- ''{aggregate,booking,openingPaidAmount}''\n      #- ''{aggregate,booking,openingPaidCurrency}''\n      #- ''{aggregate,booking,openingPaidSource}''\n      #- ''{aggregate,booking,importWarnings}'';\n  end if;\n\n  return result;\nend'
    );
  end if;

  if strpos(function_sql, '#- ''{aggregate,booking,commission}''') = 0 then
    raise exception 'Nie udało się dodać redakcji odpowiedzi do %', function_signature;
  end if;
  execute function_sql;
end
$$;

-- These two reviewed entry points perform their own auth, domain validation,
-- optimistic locking and audit. SECURITY DEFINER is required only so the
-- manager can no longer write the underlying JSON row directly.
alter function public.create_operational_booking(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, text, timestamptz, text
) security definer;
alter function public.mutate_operational_booking(
  uuid, text, bigint, jsonb, jsonb, jsonb, jsonb, text, text, timestamptz, text
) security definer;

revoke all on function public.update_operational_booking(
  uuid, text, bigint, jsonb, jsonb, jsonb, jsonb, text, timestamptz, text
) from public, anon, authenticated;

revoke all on function public.create_operational_booking(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, text, timestamptz, text
) from public, anon;
grant execute on function public.create_operational_booking(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, text, timestamptz, text
) to authenticated;

revoke all on function public.mutate_operational_booking(
  uuid, text, bigint, jsonb, jsonb, jsonb, jsonb, text, text, timestamptz, text
) from public, anon;
grant execute on function public.mutate_operational_booking(
  uuid, text, bigint, jsonb, jsonb, jsonb, jsonb, text, text, timestamptz, text
) to authenticated;

drop policy if exists "manager cannot read raw booking finance" on public.operational_records;
create policy "manager cannot read raw booking finance"
  on public.operational_records
  as restrictive
  for select
  to authenticated
  using (
    private.organization_role(organization_id) <> 'manager'
    or entity_type not in (
      'bookings', 'payments', 'invoices', 'costSettings',
      'investmentModels', 'imports'
    )
  );

drop policy if exists "manager booking inserts require command" on public.operational_records;
create policy "manager booking inserts require command"
  on public.operational_records
  as restrictive
  for insert
  to authenticated
  with check (
    private.organization_role(organization_id) <> 'manager'
    or entity_type <> 'bookings'
  );

drop policy if exists "manager booking updates require command" on public.operational_records;
create policy "manager booking updates require command"
  on public.operational_records
  as restrictive
  for update
  to authenticated
  using (
    private.organization_role(organization_id) <> 'manager'
    or entity_type <> 'bookings'
  )
  with check (
    private.organization_role(organization_id) <> 'manager'
    or entity_type <> 'bookings'
  );

drop policy if exists "manager booking deletes require command" on public.operational_records;
create policy "manager booking deletes require command"
  on public.operational_records
  as restrictive
  for delete
  to authenticated
  using (
    private.organization_role(organization_id) <> 'manager'
    or entity_type <> 'bookings'
  );
