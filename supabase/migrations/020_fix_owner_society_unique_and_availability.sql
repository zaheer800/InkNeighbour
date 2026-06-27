-- ============================================================
-- InkNeighbour — Fix Owner Society Unique + Availability
-- Migration 020: Replace hard UNIQUE on society_id with
--                partial indexes that allow inactive owners
--                to be superseded. Adds home-owner-specific
--                partial index and user_id active-unique guard.
-- ============================================================

-- Drop the blanket UNIQUE constraint from migration 001
-- (society_id was UNIQUE — prevented a new owner registering
--  in a society whose previous owner went inactive)
ALTER TABLE owners DROP CONSTRAINT IF EXISTS owners_society_id_key;

-- One active/pending/paused owner per society (any type)
CREATE UNIQUE INDEX IF NOT EXISTS owners_society_id_active_unique
  ON owners (society_id)
  WHERE status <> 'inactive';

-- One active home owner per society (stricter — home type only)
CREATE UNIQUE INDEX IF NOT EXISTS unique_home_owner_per_society
  ON owners (society_id)
  WHERE provider_type = 'home'
    AND status <> 'inactive'
    AND society_id IS NOT NULL;

-- One active account per auth user
CREATE UNIQUE INDEX IF NOT EXISTS owners_user_id_active_unique
  ON owners (user_id)
  WHERE status <> 'inactive';
