-- Forward each new signup to the production's Zapier catch hook, which passes it
-- on to Dotdigital. Supabase stays the system of record; this only sends a copy.
--
-- The hook's URL is a secret. It is held in Supabase Vault as
-- 'zapier_signups_webhook_url' and read by that name as each row is inserted, so it
-- appears nowhere in this file or the repo. To point at another hook, run both
-- lines together; a statement that fails is otherwise logged in full, URL and all:
--
--   set log_min_error_statement = panic;
--   select vault.update_secret(id, '<new hook URL>') from vault.secrets where name = 'zapier_signups_webhook_url';
--
-- pg_net queues the request inside the inserting transaction and sends it once that
-- transaction commits, so a slow or failing Zapier never slows or fails a signup,
-- and an insert that rolls back sends nothing. Rows inserted before this migration
-- are not sent: a trigger only sees inserts made after it exists.

-- Fail rather than queue live signups behind this migration's table lock.
set lock_timeout = '5s';

create extension if not exists pg_net with schema extensions;

-- pg_net keeps its responses for six hours, and that setting is not ours to change,
-- so a job (at the end) copies each send's outcome onto its row.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

alter table public.signups
  add column forward_request_id bigint,
  add column forward_status smallint;
-- Added without a default so that rows predating forwarding stay null, which is
-- how the unforwarded-signups query leaves them out; rows from now on start at -1.
alter table public.signups alter column forward_status set default -1;

comment on column public.signups.forward_request_id is
  'pg_net request id of the copy sent to Zapier. Null when the row predates forwarding or the send could not be queued.';
comment on column public.signups.forward_status is
  'Outcome of the copy sent to Zapier: the HTTP status it returned; 0 when nothing came back within 30 minutes (a timeout, a connection error, a send that was never queued or was lost in a restart); -1 while waiting; null for rows that predate forwarding.';

create function public.forward_signup_to_zapier()
returns trigger
language plpgsql
security definer
set search_path = ''
-- A lock wait could otherwise run into the statement timeout, which the handler
-- below cannot catch, and fail the signup.
set lock_timeout = '2s'
as $$
declare
  hook_url text;
  request_id bigint;
begin
  select decrypted_secret into hook_url
  from vault.decrypted_secrets
  where name = 'zapier_signups_webhook_url';

  -- pg_net follows redirects, and turns a redirected POST into a GET without the
  -- body, so only a Zapier catch hook is accepted.
  if hook_url is null or hook_url !~ '^https://hooks\.zapier\.com/hooks/catch/' then
    raise exception 'Vault secret zapier_signups_webhook_url is missing or not a Zapier catch hook' using errcode = 'P0002';
  end if;

  -- Flat, and named so that whoever maps it in Zapier can tell what each value is.
  request_id := net.http_post(
    url := hook_url,
    body := jsonb_build_object(
      'signup_id', new.id,
      'signed_up_at', to_char(new.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'email', new.email,
      'first_name', new.first_name,
      'last_name', new.last_name,
      'postcode', new.postcode,
      'country_or_region', new.country,
      'favourite_musical', new.favourite_musical,
      'date_of_birth', to_char(new.date_of_birth, 'YYYY-MM-DD'),
      'marketing_consent', new.marketing_consent,
      'marketing_consent_text', new.consent_text,
      'download_requested', new.download,
      'signup_source', new.source
    ),
    timeout_milliseconds := 10000
  );

  update public.signups set forward_request_id = request_id where id = new.id;
  return null;

exception when others then
  -- The signup matters more than its copy, so the insert stands and the row keeps
  -- forward_status -1 with no request id, which the job turns into 0. Only the error
  -- code is logged, since pg_net's messages quote the URL: P0002 means the secret is
  -- missing or wrong, XX000 usually that pg_net refused the URL.
  raise warning 'Signup % was not queued for Zapier (SQLSTATE %)', new.id, sqlstate;
  return null;
end;
$$;

-- Functions created here are executable by the API roles by default. This one only
-- ever runs as a trigger.
revoke execute on function public.forward_signup_to_zapier() from public, anon, authenticated;

create trigger forward_to_zapier
after insert on public.signups
for each row execute function public.forward_signup_to_zapier();

-- Every 15 minutes, well inside pg_net's six hours: records the outcome of each send
-- still waiting. A response only counts if it arrived within 30 minutes of the
-- signup, because pg_net's request ids start again from 1 after a crash or restore
-- and an old id could otherwise match a new response; a send with none by then is
-- recorded as 0. The wake-up nudges pg_net's worker, which can otherwise sit on a
-- queued request until the next signup arrives.
select cron.schedule(
  'record-signup-forward-status',
  '*/15 * * * *',
  $job$
    update public.signups s
    set forward_status = coalesce(r.status_code, 0)
    from public.signups t
    left join net._http_response r
      on r.id = t.forward_request_id
      and r.created >= t.created_at
      and r.created < t.created_at + interval '30 minutes'
    where t.id = s.id
      and s.forward_status = -1
      and (r.created is not null or s.created_at < now() - interval '30 minutes');
    select net.wake();
  $job$
);
