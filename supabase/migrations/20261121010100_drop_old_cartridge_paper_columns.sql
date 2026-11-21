-- ============================================================
-- InkNeighbour — Simplify running-cost inputs to plain ₹/page (2/2)
-- Companion to 20261121010000_add_ink_paper_cost_per_page.sql. That
-- migration already added bw_ink_cost_per_page / color_ink_cost_per_page
-- / paper_cost_per_page and backfilled them from these old columns.
-- This drops the now-unused old price+yield columns.
--
-- NOT YET APPLIED to the live project as of 2026-11-21 — dropping
-- columns is blocked from automatic execution on this VM regardless of
-- in-chat approval, so this needs to be run by hand (Supabase SQL
-- editor, or `supabase db push` / psql) once someone is ready.
-- Nothing is broken by leaving it unapplied: the app no longer reads
-- or writes these columns, they're just inert leftover data meanwhile.
-- ============================================================

ALTER TABLE owners DROP CONSTRAINT IF EXISTS owners_cartridge_values_nonnegative;
ALTER TABLE owners DROP COLUMN IF EXISTS bw_cartridge_price;
ALTER TABLE owners DROP COLUMN IF EXISTS bw_cartridge_yield;
ALTER TABLE owners DROP COLUMN IF EXISTS color_cartridge_price;
ALTER TABLE owners DROP COLUMN IF EXISTS color_cartridge_yield;
ALTER TABLE owners DROP COLUMN IF EXISTS paper_price;
ALTER TABLE owners DROP COLUMN IF EXISTS paper_sheets_per_ream;
