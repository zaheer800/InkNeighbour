-- ============================================================
-- InkNeighbour — Owner Phone Unique (Active)
-- Migration 021: Prevent duplicate phone numbers across
--                active/pending/paused owners.
--                Inactive owners are excluded so a deactivated
--                owner can re-register with the same phone.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS owners_phone_active_unique
  ON owners (phone)
  WHERE status <> 'inactive';
