-- ============================================================
-- InkNeighbour — Service Menu
-- Migration 015: display-only service list for print shops.
--                No pricing logic — owner enters free text
--                (e.g. "₹10/page", "From ₹20", "Call for price").
-- ============================================================

CREATE TABLE IF NOT EXISTS service_menu (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       UUID    NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  service_code   TEXT    NOT NULL,   -- 'scan' | 'photocopy' | 'binding' | 'lamination' | 'passport_photo'
  is_enabled     BOOLEAN NOT NULL DEFAULT false,
  display_price  TEXT,               -- free text, max 40 chars
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_menu_owner_code_unique UNIQUE (owner_id, service_code),
  CONSTRAINT service_menu_service_code_check
    CHECK (service_code IN ('scan', 'photocopy', 'binding', 'lamination', 'passport_photo')),
  CONSTRAINT service_menu_display_price_length
    CHECK (display_price IS NULL OR char_length(display_price) <= 40)
);

CREATE INDEX IF NOT EXISTS service_menu_owner_idx
  ON service_menu (owner_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE service_menu ENABLE ROW LEVEL SECURITY;

-- Owner full CRUD on own service menu
CREATE POLICY "Owner full CRUD own service menu"
  ON service_menu FOR ALL
  USING (
    owner_id IN (SELECT id FROM owners WHERE user_id = auth.uid())
  )
  WITH CHECK (
    owner_id IN (SELECT id FROM owners WHERE user_id = auth.uid())
  );

-- Public read — customers see services on shop profile
CREATE POLICY "Public read service menu"
  ON service_menu FOR SELECT
  USING (true);

-- ============================================================
-- Function: seed_service_menu(owner_id)
-- Called during print shop registration to pre-populate all
-- service rows as disabled. Owner enables what they offer.
-- ============================================================
CREATE OR REPLACE FUNCTION seed_service_menu(p_owner_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO service_menu (owner_id, service_code, is_enabled)
  VALUES
    (p_owner_id, 'scan',           false),
    (p_owner_id, 'photocopy',      false),
    (p_owner_id, 'binding',        false),
    (p_owner_id, 'lamination',     false),
    (p_owner_id, 'passport_photo', false)
  ON CONFLICT (owner_id, service_code) DO NOTHING;
END;
$$;
