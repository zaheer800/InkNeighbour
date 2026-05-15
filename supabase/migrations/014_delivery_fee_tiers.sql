-- ============================================================
-- InkNeighbour — Delivery Fee Tiers
-- Migration 014: distance-based delivery fee tiers for print shops.
--                Home owners use the flat delivery_fee on owners row.
-- ============================================================

CREATE TABLE IF NOT EXISTS delivery_fee_tiers (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID        NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  max_km     NUMERIC(4,1) NOT NULL CHECK (max_km > 0),  -- upper bound e.g. 1.0, 2.0, 3.0
  fee        INTEGER     NOT NULL CHECK (fee >= 0),      -- paise
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per distance band per owner
CREATE UNIQUE INDEX IF NOT EXISTS delivery_fee_tiers_owner_km_idx
  ON delivery_fee_tiers (owner_id, max_km);

CREATE INDEX IF NOT EXISTS delivery_fee_tiers_owner_idx
  ON delivery_fee_tiers (owner_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE delivery_fee_tiers ENABLE ROW LEVEL SECURITY;

-- Owner full CRUD on own tiers
CREATE POLICY "Owner full CRUD own delivery tiers"
  ON delivery_fee_tiers FOR ALL
  USING (
    owner_id IN (SELECT id FROM owners WHERE user_id = auth.uid())
  )
  WITH CHECK (
    owner_id IN (SELECT id FROM owners WHERE user_id = auth.uid())
  );

-- Public read — customers see delivery cost on shop profile
CREATE POLICY "Public read delivery tiers"
  ON delivery_fee_tiers FOR SELECT
  USING (true);
