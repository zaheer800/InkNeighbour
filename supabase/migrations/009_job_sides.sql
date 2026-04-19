-- Add sides (single/double) and ensure notes column exists on jobs
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS sides TEXT NOT NULL DEFAULT 'single'
    CHECK (sides IN ('single', 'double'));
