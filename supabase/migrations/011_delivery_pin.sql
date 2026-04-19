-- ============================================================
-- InkNeighbour — Delivery PIN
-- Migration 011
-- ============================================================
-- Adds a 4-digit delivery_pin to jobs, generated at order placement.
-- The customer sees it on their confirmation page; the owner must
-- enter it before marking the job as delivered — proof of in-person handoff.

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS delivery_pin TEXT;
