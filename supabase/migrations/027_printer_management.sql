-- 027: printer management foundation (see docs/printer-management-spec.md).
-- Additive only. Printer data is scoped to a printer account (a Supabase user's personal or business
-- context), NOT to `owners`, so personal users need no marketplace record.
-- Agents hold no Supabase session: every agent write goes through the `printer-agent` edge function
-- using the service role. Browser users only ever read, plus a few narrow RPCs below.

create extension if not exists pgcrypto with schema extensions;

-- ── 1. Accounts and membership ──────────────────────────────────────────────────────────
create table if not exists printer_accounts (
  id           uuid primary key default gen_random_uuid(),
  account_type text not null default 'personal' check (account_type in ('personal','business')),
  name         text not null check (char_length(name) between 1 and 80),
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);
create unique index if not exists printer_accounts_one_personal
  on printer_accounts (created_by) where account_type = 'personal';

create table if not exists printer_account_members (
  account_id uuid not null references printer_accounts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (account_id, user_id)
);
create index if not exists printer_account_members_user on printer_account_members (user_id);

create or replace function is_printer_member(p_account uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from printer_account_members
                 where account_id = p_account and user_id = auth.uid());
$$;

create or replace function is_printer_admin(p_account uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from printer_account_members
                 where account_id = p_account and user_id = auth.uid() and role in ('owner','admin'));
$$;

-- ── 2. Agents, pairing codes, rate limits ───────────────────────────────────────────────
create table if not exists printer_agents (
  id                uuid primary key default gen_random_uuid(),
  account_id        uuid not null references printer_accounts(id) on delete cascade,
  device_name       text not null check (char_length(device_name) between 1 and 120),
  agent_version     text check (char_length(agent_version) <= 40),
  status            text not null default 'offline' check (status in ('online','offline','revoked')),
  secret_hash       text not null,
  last_heartbeat_at timestamptz,
  online_since timestamptz,
  paired_at         timestamptz not null default now(),
  revoked_at        timestamptz
);
create index if not exists printer_agents_account on printer_agents (account_id);

create table if not exists printer_pairing_codes (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references printer_accounts(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  code_hash  text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists printer_rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  hits         int not null default 0
);

-- ── 3. Printers and readings ────────────────────────────────────────────────────────────
create table if not exists printers (
  id                   uuid primary key default gen_random_uuid(),
  account_id           uuid not null references printer_accounts(id) on delete cascade,
  agent_id             uuid references printer_agents(id) on delete set null,
  marketplace_owner_id uuid references owners(id) on delete set null,
  name                 text not null check (char_length(name) between 1 and 120),
  manufacturer         text check (char_length(manufacturer) <= 80),
  model                text check (char_length(model) <= 120),
  connection_type      text not null default 'other' check (connection_type in ('usb','network','other')),
  device_identifier    text not null check (char_length(device_identifier) between 1 and 200),
  ip_address           text check (char_length(ip_address) <= 64),
  driver_info          text check (char_length(driver_info) <= 200),
  capabilities         jsonb not null default '{}'::jsonb,
  status               text not null default 'unknown' check (status in ('ready','busy','error','offline','unknown')),
  status_detail        text check (char_length(status_detail) <= 300),
  last_seen_at         timestamptz,
  low_supply_threshold int not null default 15 check (low_supply_threshold between 1 and 90),
  created_at           timestamptz not null default now(),
  unique (account_id, device_identifier)
);
create index if not exists printers_account on printers (account_id);

create table if not exists printer_metrics (
  id           bigint generated always as identity primary key,
  printer_id   uuid not null references printers(id) on delete cascade,
  metric_type  text not null check (metric_type in ('status','page_count')),
  value_text   text,
  value_num    numeric,
  source       text not null check (source in ('actual','estimated','manual')),
  recorded_at  timestamptz not null
);
create index if not exists printer_metrics_printer_time on printer_metrics (printer_id, recorded_at desc);

-- level_percentage is null exactly when the printer does not expose the reading.
create table if not exists printer_consumables (
  id               bigint generated always as identity primary key,
  printer_id       uuid not null references printers(id) on delete cascade,
  consumable_type  text not null check (consumable_type in ('ink','toner','drum','other')),
  colour           text not null check (colour in ('black','cyan','magenta','yellow','colour','other')),
  level_percentage int check (level_percentage between 0 and 100),
  source           text not null check (source in ('actual','estimated','manual','unsupported')),
  observed_at      timestamptz not null,
  check ((source = 'unsupported') = (level_percentage is null))
);
create index if not exists printer_consumables_printer_time on printer_consumables (printer_id, observed_at desc);

create or replace view printer_current_consumables with (security_invoker = true) as
  select distinct on (printer_id, consumable_type, colour)
         printer_id, consumable_type, colour, level_percentage, source, observed_at
  from printer_consumables
  order by printer_id, consumable_type, colour, observed_at desc;

create table if not exists printer_alerts (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references printer_accounts(id) on delete cascade,
  printer_id      uuid references printers(id) on delete cascade,
  agent_id        uuid references printer_agents(id) on delete cascade,
  alert_type      text not null check (alert_type in ('printer_offline','printer_error','low_supply','agent_offline')),
  severity        text not null check (severity in ('info','warning','critical')),
  message         text not null check (char_length(message) <= 300),
  status          text not null default 'open' check (status in ('open','acknowledged','resolved')),
  dedupe_key      text not null,
  created_at      timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id) on delete set null,
  resolved_at     timestamptz
);
create unique index if not exists printer_alerts_one_active
  on printer_alerts (dedupe_key) where status in ('open','acknowledged');
create index if not exists printer_alerts_account_status on printer_alerts (account_id, status);

-- ── 4. Row Level Security and grants ────────────────────────────────────────────────────
alter table printer_accounts        enable row level security;
alter table printer_account_members enable row level security;
alter table printer_agents          enable row level security;
alter table printer_pairing_codes   enable row level security;
alter table printer_rate_limits     enable row level security;
alter table printers                enable row level security;
alter table printer_metrics         enable row level security;
alter table printer_consumables     enable row level security;
alter table printer_alerts          enable row level security;

revoke all on printer_accounts, printer_account_members, printer_agents, printer_pairing_codes,
              printer_rate_limits, printers, printer_metrics, printer_consumables, printer_alerts,
              printer_current_consumables
  from anon, authenticated;

-- Browser users: read their own accounts' data. The agent secret hash is never selectable.
grant select on printer_accounts, printer_account_members, printer_metrics,
                printer_consumables, printer_alerts, printer_current_consumables to authenticated;
grant select (id, account_id, device_name, agent_version, status, last_heartbeat_at, paired_at, revoked_at)
  on printer_agents to authenticated;
grant select on printers to authenticated;
grant update (name, low_supply_threshold) on printers to authenticated;
grant delete on printers to authenticated;

drop policy if exists printer_accounts_select on printer_accounts;
create policy printer_accounts_select on printer_accounts
  for select to authenticated using (is_printer_member(id));

drop policy if exists printer_members_select on printer_account_members;
create policy printer_members_select on printer_account_members
  for select to authenticated using (is_printer_member(account_id));

drop policy if exists printer_agents_select on printer_agents;
create policy printer_agents_select on printer_agents
  for select to authenticated using (is_printer_member(account_id));

drop policy if exists printers_select on printers;
create policy printers_select on printers
  for select to authenticated using (is_printer_member(account_id));
drop policy if exists printers_update on printers;
create policy printers_update on printers
  for update to authenticated using (is_printer_admin(account_id)) with check (is_printer_admin(account_id));
drop policy if exists printers_delete on printers;
create policy printers_delete on printers
  for delete to authenticated using (is_printer_admin(account_id));

drop policy if exists printer_metrics_select on printer_metrics;
create policy printer_metrics_select on printer_metrics
  for select to authenticated using (exists (
    select 1 from printers p where p.id = printer_id and is_printer_member(p.account_id)));

drop policy if exists printer_consumables_select on printer_consumables;
create policy printer_consumables_select on printer_consumables
  for select to authenticated using (exists (
    select 1 from printers p where p.id = printer_id and is_printer_member(p.account_id)));

drop policy if exists printer_alerts_select on printer_alerts;
create policy printer_alerts_select on printer_alerts
  for select to authenticated using (is_printer_member(account_id));

-- printer_pairing_codes and printer_rate_limits: no policies, no grants (service role only).

-- ── 5. RPCs for signed-in users ─────────────────────────────────────────────────────────
create or replace function ensure_personal_printer_account() returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select m.account_id into v_id from printer_account_members m
    join printer_accounts a on a.id = m.account_id
    where m.user_id = v_uid order by a.created_at limit 1;
  if v_id is not null then return v_id; end if;
  insert into printer_accounts (account_type, name, created_by)
    values ('personal', 'My printers', v_uid)
    on conflict (created_by) where account_type = 'personal' do nothing
    returning id into v_id;
  if v_id is null then
    select id into v_id from printer_accounts where created_by = v_uid and account_type = 'personal';
  end if;
  insert into printer_account_members (account_id, user_id, role) values (v_id, v_uid, 'owner')
    on conflict do nothing;
  return v_id;
end $$;

-- Returns a one-time code (shown once, stored only as a hash). Valid 15 minutes.
create or replace function create_printer_pairing_code(p_account uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_code text; v_open int;
begin
  if not is_printer_admin(p_account) then raise exception 'not allowed'; end if;
  delete from printer_pairing_codes
    where account_id = p_account and (expires_at < now() or used_at is not null)
      and created_at < now() - interval '1 day';
  select count(*) into v_open from printer_pairing_codes
    where account_id = p_account and used_at is null and expires_at > now();
  if v_open >= 5 then raise exception 'too many open codes'; end if;
  v_code := upper(encode(gen_random_bytes(5), 'hex'));
  insert into printer_pairing_codes (account_id, created_by, code_hash, expires_at)
    values (p_account, auth.uid(), encode(digest(v_code, 'sha256'), 'hex'), now() + interval '15 minutes');
  return v_code;
end $$;

create or replace function revoke_printer_agent(p_agent uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_account uuid;
begin
  select account_id into v_account from printer_agents where id = p_agent;
  if v_account is null or not is_printer_admin(v_account) then raise exception 'not allowed'; end if;
  update printer_agents set status = 'revoked', revoked_at = now() where id = p_agent;
  update printer_alerts set status = 'resolved', resolved_at = now()
    where (agent_id = p_agent or printer_id in (select id from printers where agent_id = p_agent))
      and status in ('open','acknowledged');
end $$;

create or replace function acknowledge_printer_alert(p_alert uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_account uuid;
begin
  select account_id into v_account from printer_alerts where id = p_alert;
  if v_account is null or not is_printer_member(v_account) then raise exception 'not allowed'; end if;
  update printer_alerts set status = 'acknowledged', acknowledged_at = now(), acknowledged_by = auth.uid()
    where id = p_alert and status = 'open';
end $$;

-- ── 6. Service-role helpers used by the printer-agent edge function ─────────────────────
create or replace function printer_rate_check(p_key text, p_limit int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_hits int;
begin
  insert into printer_rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_limit;
end $$;

-- Atomically consumes a pairing code and creates the agent. Null = invalid, expired or used code.
create or replace function printer_pair_agent(p_code_hash text, p_secret_hash text, p_device_name text, p_version text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_account uuid; v_agent uuid;
begin
  update printer_pairing_codes set used_at = now()
    where code_hash = p_code_hash and used_at is null and expires_at > now()
    returning account_id into v_account;
  if v_account is null then return null; end if;
  if (select count(*) from printer_agents where account_id = v_account and status <> 'revoked') >= 10 then
    raise exception 'agent limit reached';
  end if;
  insert into printer_agents (account_id, device_name, agent_version, secret_hash)
    values (v_account, p_device_name, p_version, p_secret_hash) returning id into v_agent;
  return v_agent;
end $$;

create or replace function printer_raise_alert(p_account uuid, p_printer uuid, p_agent uuid,
  p_type text, p_severity text, p_message text, p_dedupe text) returns void
language sql security definer set search_path = public as $$
  insert into printer_alerts (account_id, printer_id, agent_id, alert_type, severity, message, dedupe_key)
  values (p_account, p_printer, p_agent, p_type, p_severity, p_message, p_dedupe)
  on conflict (dedupe_key) where status in ('open','acknowledged') do nothing;
$$;

-- Resolves this printer's active alerts that are no longer true (dedupe key not in p_keep).
create or replace function printer_resolve_alerts(p_printer uuid, p_keep text[]) returns void
language sql security definer set search_path = public as $$
  update printer_alerts set status = 'resolved', resolved_at = now()
  where printer_id = p_printer and status in ('open','acknowledged')
    and alert_type in ('printer_offline','printer_error','low_supply')
    and not (dedupe_key = any (coalesce(p_keep, '{}')));
$$;

-- ── 7. Sweep: offline detection and retention (runs every minute via pg_cron) ───────────
-- Heartbeat is every 60 s; an agent silent for 3 minutes is treated as offline. When the AGENT is
-- silent, only the agent alert is raised (its printers are unknown, not broken).
create or replace function printer_sweep() returns void
language plpgsql security definer set search_path = public as $$
begin
  update printer_agents set status = 'offline'
    where status = 'online' and last_heartbeat_at < now() - interval '3 minutes';

  insert into printer_alerts (account_id, agent_id, alert_type, severity, message, dedupe_key)
  select a.account_id, a.id, 'agent_offline', 'warning',
         'InkNeighbour Connect on ' || a.device_name || ' has not reported for a few minutes. Check that the computer is on and online.',
         'agent_offline:' || a.id
  from printer_agents a
  where a.status = 'offline' and a.last_heartbeat_at is not null
  on conflict (dedupe_key) where status in ('open','acknowledged') do nothing;

  insert into printer_alerts (account_id, printer_id, alert_type, severity, message, dedupe_key)
  select p.account_id, p.id, 'printer_offline', 'warning',
         p.name || ' has not been seen for a few minutes. Possible causes: printer switched off, network lost, or USB cable unplugged.',
         'printer_offline:' || p.id
  from printers p join printer_agents a on a.id = p.agent_id
  where a.status = 'online' and a.online_since < now() - interval '3 minutes'
    and p.last_seen_at < now() - interval '3 minutes'
  on conflict (dedupe_key) where status in ('open','acknowledged') do nothing;

  delete from printer_rate_limits where window_start < now() - interval '1 hour';

  -- Retention (hourly): metrics 180 days, supply readings 365 days, resolved alerts 365 days.
  if extract(minute from now()) = 0 then
    delete from printer_metrics where recorded_at < now() - interval '180 days';
    delete from printer_consumables where observed_at < now() - interval '365 days';
    delete from printer_alerts where status = 'resolved' and resolved_at < now() - interval '365 days';
  end if;
end $$;

-- ── 8. Lock down function execution ─────────────────────────────────────────────────────
revoke execute on function
  is_printer_member(uuid), is_printer_admin(uuid), ensure_personal_printer_account(),
  create_printer_pairing_code(uuid), revoke_printer_agent(uuid), acknowledge_printer_alert(uuid),
  printer_rate_check(text,int,int), printer_pair_agent(text,text,text,text),
  printer_raise_alert(uuid,uuid,uuid,text,text,text,text), printer_resolve_alerts(uuid,text[]), printer_sweep()
  from public, anon, authenticated;

grant execute on function is_printer_member(uuid), is_printer_admin(uuid), ensure_personal_printer_account(),
  create_printer_pairing_code(uuid), revoke_printer_agent(uuid), acknowledge_printer_alert(uuid)
  to authenticated;
grant execute on function printer_rate_check(text,int,int), printer_pair_agent(text,text,text,text),
  printer_raise_alert(uuid,uuid,uuid,text,text,text,text), printer_resolve_alerts(uuid,text[])
  to service_role;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('printer-sweep', '* * * * *', 'select public.printer_sweep()');
  else
    raise warning 'pg_cron is not installed: printer_sweep() will not run, so offline alerts and retention are inactive. Enable pg_cron and schedule it.';
  end if;
end $$;
