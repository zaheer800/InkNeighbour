-- ============================================================
-- InkNeighbour — Admin Approval Flow
-- Migration 007: Add 'pending' owner status for admin gating
-- ============================================================
-- New owners start as 'pending' and go live only after admin approval.
-- This replaces the email-verification approach with a human review gate.

ALTER TABLE owners DROP CONSTRAINT owners_status_check;

ALTER TABLE owners ADD CONSTRAINT owners_status_check
  CHECK (status IN ('pending', 'active', 'paused', 'inactive'));

-- Default new owners to pending
ALTER TABLE owners ALTER COLUMN status SET DEFAULT 'pending';
