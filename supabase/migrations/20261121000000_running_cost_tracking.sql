-- ============================================================
-- InkNeighbour — Real running-cost estimate for Earnings
-- The Earnings "cartridge cost (estimate)" field was a bare manual
-- number the owner had to retype every visit, with no connection to
-- actual pages printed, and covered ink only — not paper or other
-- recurring costs. Replace it with:
--   1. Owner-configured cartridge price + page yield (B&W / colour)
--   2. Owner-configured paper price + sheets per ream
--   3. A free-form list of other recurring monthly expenses
--      (rent, electricity, staff, maintenance, ...)
-- so Earnings can compute a true per-period estimate instead of
-- asking the owner to do the maths themselves. Additive only — no
-- existing columns touched.
-- ============================================================

-- ── 1 & 2. owners: cartridge + paper cost inputs ─────────────────
ALTER TABLE owners ADD COLUMN IF NOT EXISTS bw_cartridge_price integer;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS bw_cartridge_yield integer;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS color_cartridge_price integer;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS color_cartridge_yield integer;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS paper_price integer;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS paper_sheets_per_ream integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'owners_cartridge_values_nonnegative'
  ) THEN
    ALTER TABLE owners ADD CONSTRAINT owners_cartridge_values_nonnegative
      CHECK (
        (bw_cartridge_price     IS NULL OR bw_cartridge_price     >= 0) AND
        (bw_cartridge_yield     IS NULL OR bw_cartridge_yield     > 0) AND
        (color_cartridge_price  IS NULL OR color_cartridge_price  >= 0) AND
        (color_cartridge_yield  IS NULL OR color_cartridge_yield  > 0) AND
        (paper_price            IS NULL OR paper_price            >= 0) AND
        (paper_sheets_per_ream  IS NULL OR paper_sheets_per_ream  > 0)
      );
  END IF;
END $$;

-- Owners already have UPDATE on their own row and these are private
-- financial figures, not shown on public shop pages — no RLS/policy
-- change needed (same row-level policy covers the new columns).

-- ── 3. owner_expenses: other recurring monthly costs ─────────────
-- Private to the owner — unlike service_menu/delivery_fee_tiers, this
-- is never read by customers or public pages, so no public SELECT policy.
CREATE TABLE IF NOT EXISTS owner_expenses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  name           text NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 60),
  monthly_amount integer NOT NULL DEFAULT 0 CHECK (monthly_amount >= 0),
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE owner_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner full CRUD own expenses" ON owner_expenses;
CREATE POLICY "Owner full CRUD own expenses"
  ON owner_expenses FOR ALL
  USING (owner_id IN (SELECT id FROM owners WHERE user_id = auth.uid()))
  WITH CHECK (owner_id IN (SELECT id FROM owners WHERE user_id = auth.uid()));
