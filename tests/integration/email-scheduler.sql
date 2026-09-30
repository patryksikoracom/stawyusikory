-- Run on the test project. HTTP requests start only on COMMIT; this entire
-- test is rolled back, so the fake credential never reaches the application.
begin;
do $$
begin
  if has_schema_privilege('anon', 'automation_private', 'USAGE')
     or has_schema_privilege('authenticated', 'automation_private', 'USAGE')
     or has_function_privilege('anon', 'automation_private.process_email_queue()', 'EXECUTE')
     or has_function_privilege('authenticated', 'automation_private.process_email_queue()', 'EXECUTE') then
    raise exception 'Public roles can invoke scheduler';
  end if;
  if exists(select 1 from cron.job where jobname='stawy-email-queue' and active) then
    raise exception 'Migration activated scheduler before configuration';
  end if;
  begin
    perform automation_private.process_email_queue();
    raise exception 'Missing credential was accepted';
  exception when raise_exception then
    if sqlerrm <> 'Email scheduler credential is not configured' then raise; end if;
  end;
end $$;
select vault.create_secret(repeat('x', 64), 'stawy_email_cron_secret');
do $$
declare request_id bigint;
begin
  request_id := automation_private.process_email_queue();
  if not exists(select 1 from net.http_request_queue where id=request_id
    and url='https://stawyusikory.vercel.app/api/automations/process'
    and headers->>'Authorization'='Bearer ' || repeat('x',64)
    and timeout_milliseconds=60000) then
    raise exception 'Scheduler did not enqueue the expected authenticated request';
  end if;
end $$;
rollback;
