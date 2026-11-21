-- ============================================================
-- InkNeighbour — Simplify running-cost inputs to plain ₹/page (1/2)
-- "Price + Yield (pages)" and "Price per ream + Sheets per ream" asked
-- owners to do arithmetic with specs from a cartridge/ream box they may
-- not have in front of them. Replace both pairs with a single direct
-- cost-per-page figure per type, defaulted to a typical market estimate
-- so every owner gets a working Earnings estimate with zero setup, and
-- can edit it if their real costs differ.
--
-- Applied to the live project. The companion drop of the old 6 columns
-- (20261121010100_drop_old_cartridge_paper_columns.sql) still needs to
-- be run by hand — dropping columns is blocked for automatic execution
-- on this VM regardless of in-chat approval.
-- ============================================================

-- New columns get a real DEFAULT, so it applies to existing rows too —
-- not just future inserts. Defaults are round, plausible INR estimates:
-- ~₹0.50/page B&W ink, ~₹3.00/page colour ink, ~₹0.60/sheet paper.
ALTER TABLE owners ADD COLUMN IF NOT EXISTS bw_ink_cost_per_page integer DEFAULT 50;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS color_ink_cost_per_page integer DEFAULT 300;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS paper_cost_per_page integer DEFAULT 60;

-- Preserve any precise figure an owner already derived under the old
-- price+yield model, in preference to the new flat default.
UPDATE owners SET bw_ink_cost_per_page = ROUND(bw_cartridge_price::numeric / bw_cartridge_yield)
  WHERE bw_cartridge_price IS NOT NULL AND bw_cartridge_yield > 0;
UPDATE owners SET color_ink_cost_per_page = ROUND(color_cartridge_price::numeric / color_cartridge_yield)
  WHERE color_cartridge_price IS NOT NULL AND color_cartridge_yield > 0;
UPDATE owners SET paper_cost_per_page = ROUND(paper_price::numeric / paper_sheets_per_ream)
  WHERE paper_price IS NOT NULL AND paper_sheets_per_ream > 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'owners_ink_paper_cost_nonnegative'
  ) THEN
    ALTER TABLE owners ADD CONSTRAINT owners_ink_paper_cost_nonnegative
      CHECK (
        (bw_ink_cost_per_page    IS NULL OR bw_ink_cost_per_page    >= 0) AND
        (color_ink_cost_per_page IS NULL OR color_ink_cost_per_page >= 0) AND
        (paper_cost_per_page     IS NULL OR paper_cost_per_page     >= 0)
      );
  END IF;
END $$;
