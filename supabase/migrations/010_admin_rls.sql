-- ============================================================
-- InkNeighbour — Admin RLS + Email Verification Visibility
-- Migration 010
-- ============================================================
-- Fixes: admin could not approve shops (RLS blocked UPDATE on owners
-- where user_id != auth.uid()), and could not read/write platform_config.
-- Uses auth.email() instead of querying auth.users directly — the latter
-- requires elevated privileges unavailable to the authenticated role.

-- ── owners: allow admin to update any row ────────────────────
CREATE POLICY "owners_admin_update" ON owners
  FOR UPDATE
  USING (auth.email() = 'info@zakapedia.in')
  WITH CHECK (true);

-- ── platform_config: allow admin to read and write ───────────
CREATE POLICY "platform_config_admin_select" ON platform_config
  FOR SELECT
  USING (auth.email() = 'info@zakapedia.in');

CREATE POLICY "platform_config_admin_insert" ON platform_config
  FOR INSERT
  WITH CHECK (auth.email() = 'info@zakapedia.in');

CREATE POLICY "platform_config_admin_update" ON platform_config
  FOR UPDATE
  USING (auth.email() = 'info@zakapedia.in')
  WITH CHECK (true);

-- ── Email confirmation status (admin only) ───────────────────
-- SECURITY DEFINER runs as postgres so it can access auth.users.
-- auth.email() check ensures only the admin can invoke it.
CREATE OR REPLACE FUNCTION admin_get_owner_email_status()
RETURNS TABLE(user_id UUID, email_confirmed BOOLEAN)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    au.id                               AS user_id,
    (au.email_confirmed_at IS NOT NULL) AS email_confirmed
  FROM auth.users au
  WHERE EXISTS (SELECT 1 FROM owners o WHERE o.user_id = au.id)
    AND auth.email() = 'info@zakapedia.in';
$$;
