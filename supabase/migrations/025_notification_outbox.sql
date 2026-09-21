-- 025: notification outbox, safe job numbers, WhatsApp opt-in, cron/net extensions.
-- See docs/order-alerts-design.md.

-- ── 1. Job numbers come from a sequence, not from the browser ───────────────────────────
-- The order form used count(*)+1, which anonymous customers cannot compute (RLS hides other rows).
create sequence if not exists job_number_seq;
select setval('job_number_seq', greatest(
  coalesce((select max(substring(job_number from '[0-9]+$')::int) from jobs), 0), 0) + 1, false);

create or replace function set_job_number() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.job_number := 'INK-' || lpad(nextval('job_number_seq')::text, 4, '0');
  return new;
end $$;

drop trigger if exists jobs_set_job_number on jobs;
create trigger jobs_set_job_number before insert on jobs
  for each row execute function set_job_number();

-- ── 2. Customer consent for WhatsApp updates ────────────────────────────────────────────
alter table jobs add column if not exists customer_whatsapp_optin boolean not null default false;

-- ── 3. The outbox ───────────────────────────────────────────────────────────────────────
create table if not exists notification_outbox (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in
                ('order_new','order_reminder_10','order_reminder_5','order_cancelled_customer')),
  job_id      uuid not null references jobs(id) on delete cascade,
  owner_id    uuid references owners(id) on delete set null,
  status      text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  attempts    int  not null default 0,
  error       text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  unique (kind, job_id)
);
create index if not exists notification_outbox_pending on notification_outbox (created_at) where status = 'pending';

-- Service role only: no policies on purpose.
alter table notification_outbox enable row level security;
revoke all on notification_outbox from anon, authenticated;

-- ── 4. New order -> queue an owner alert and wake the sender straight away ─────────────
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create or replace function queue_new_order_alert() returns trigger
language plpgsql security definer set search_path = public, extensions, vault as $$
declare v_secret text;
begin
  if new.status <> 'submitted' or new.owner_id is null then return new; end if;
  insert into notification_outbox (kind, job_id, owner_id) values ('order_new', new.id, new.owner_id)
    on conflict do nothing;
  -- Best effort: never let a notification problem block an order. The minute cron is the backstop.
  begin
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'sla_secret';
    if v_secret is not null then
      perform net.http_post(
        url := 'https://xgjaagaqtzknvsinbklr.supabase.co/functions/v1/check-sla?mode=drain',
        headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
        body := '{}'::jsonb);
    end if;
  exception when others then
    raise warning 'order alert wake-up failed: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists jobs_queue_new_order_alert on jobs;
create trigger jobs_queue_new_order_alert after insert on jobs
  for each row execute function queue_new_order_alert();

-- The minute schedule is created separately, AFTER the function is deployed and tested:
--   select cron.schedule('check-sla', '* * * * *', $$ select net.http_post(...) $$);
