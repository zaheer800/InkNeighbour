-- ============================================================
-- InkNeighbour — Platform Config Public Read
-- Migration 019: Allow anon to read the 3 default rate keys
--                so registration form can pre-fill rates
--                without requiring auth.
-- ============================================================

-- Public (anon) can read only the 3 default rate keys
CREATE POLICY "platform_config_public_defaults_select"
  ON platform_config FOR SELECT
  TO public
  USING (key = ANY (ARRAY['default_bw_rate', 'default_color_rate', 'default_delivery_fee']));

-- Admin full access (SELECT / INSERT / UPDATE)
CREATE POLICY "platform_config_admin_select"
  ON platform_config FOR SELECT
  TO public
  USING (auth.email() = 'info@zakapedia.in');

CREATE POLICY "platform_config_admin_insert"
  ON platform_config FOR INSERT
  TO public
  WITH CHECK (auth.email() = 'info@zakapedia.in');

CREATE POLICY "platform_config_admin_update"
  ON platform_config FOR UPDATE
  TO public
  USING  (auth.email() = 'info@zakapedia.in')
  WITH CHECK (true);
