-- Provision only. Activation is an explicit deployment step after the
-- matching EMAIL_CRON_SECRET is installed in Vercel and Vault.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create schema if not exists automation_private;
revoke all on schema automation_private from public, anon, authenticated;

create or replace function automation_private.process_email_queue()
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  scheduler_secret text;
  request_id bigint;
begin
  select decrypted_secret into scheduler_secret
  from vault.decrypted_secrets where name = 'stawy_email_cron_secret';
  if scheduler_secret is null or length(scheduler_secret) < 32 then
    raise exception 'Email scheduler credential is not configured';
  end if;

  -- Only this application's fixed HTTPS endpoint receives the credential.
  select net.http_post(
    url := 'https://stawyusikory.vercel.app/api/automations/process',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || scheduler_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) into request_id;

  -- Retain two weeks of this job's SQL history, without touching other jobs.
  delete from cron.job_run_details
  where jobid in (select jobid from cron.job where jobname = 'stawy-email-queue')
    and end_time < now() - interval '14 days';
  return request_id;
end;
$$;
revoke all on function automation_private.process_email_queue() from public, anon, authenticated;

select cron.schedule('stawy-email-queue', '*/5 * * * *',
  'select automation_private.process_email_queue();');
select cron.alter_job(job_id := jobid, active := false)
from cron.job where jobname = 'stawy-email-queue';
