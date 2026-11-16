-- Jobs waiting in the printer's Windows queue, as last reported by the agent. Null means unknown.
alter table printers
  add column if not exists queued_jobs int check (queued_jobs between 0 and 100000);
