-- Removing a computer now also removes the printers that came from it (with their readings and alerts),
-- instead of leaving them behind as "disconnected".
create or replace function revoke_printer_agent(p_agent uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_account uuid;
begin
  select account_id into v_account from printer_agents where id = p_agent;
  if v_account is null or not is_printer_admin(v_account) then raise exception 'not allowed'; end if;
  update printer_agents set status = 'revoked', revoked_at = now() where id = p_agent;
  update printer_alerts set status = 'resolved', resolved_at = now()
    where agent_id = p_agent and status in ('open','acknowledged');
  delete from printers where agent_id = p_agent and account_id = v_account;
end $$;
