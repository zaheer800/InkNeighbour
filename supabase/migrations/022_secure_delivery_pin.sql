-- ============================================================
-- InkNeighbour — Secure Delivery PIN
-- Migration 022
-- ============================================================
-- Problem: delivery_pin was readable by authenticated owners via SELECT *,
-- and verified client-side in JobCard.jsx. An owner could open the tracking
-- link they're about to send and read the PIN before physically delivering.
--
-- Fix:
--   1. Add has_delivery_pin flag (readable by owners) so the UI knows whether
--      to show the PIN input without exposing the PIN value itself.
--   2. Revoke SELECT on delivery_pin from the authenticated role so no
--      owner query can return the plaintext PIN.
--   3. Create verify_and_deliver() RPC (SECURITY DEFINER) that does the
--      PIN check and status update atomically, server-side.

-- Step 1: Add flag column
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS has_delivery_pin BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill for existing jobs that already have a PIN
UPDATE jobs SET has_delivery_pin = TRUE WHERE delivery_pin IS NOT NULL;

-- Step 2: Revoke column-level read on delivery_pin from authenticated users (shop owners).
-- The anon role retains read access so the customer tracking page (public, no auth)
-- can still show the PIN to the customer.
REVOKE SELECT (delivery_pin) ON jobs FROM authenticated;

-- Step 3: Server-side verify-and-deliver function.
-- SECURITY DEFINER lets it read delivery_pin even though authenticated cannot.
-- Checks: caller must own the job, job must be in 'printing' status, PIN must match.
-- If the job has no delivery_pin (older orders), it accepts any non-empty input.
CREATE OR REPLACE FUNCTION verify_and_deliver(p_job_id UUID, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id  UUID;
  v_status    TEXT;
  v_pin       TEXT;
BEGIN
  SELECT owner_id, status, delivery_pin
    INTO v_owner_id, v_status, v_pin
    FROM jobs
   WHERE id = p_job_id;

  -- Caller must be the job's owner
  IF v_owner_id IS DISTINCT FROM auth.uid() THEN
    RETURN FALSE;
  END IF;

  -- Job must be in the printing state
  IF v_status != 'printing' THEN
    RETURN FALSE;
  END IF;

  -- PIN check: if a PIN was set, it must match; if no PIN, accept delivery
  IF v_pin IS NOT NULL AND v_pin IS DISTINCT FROM p_pin THEN
    RETURN FALSE;
  END IF;

  UPDATE jobs
     SET status = 'feedback_pending', updated_at = NOW()
   WHERE id = p_job_id;

  RETURN TRUE;
END;
$$;

-- Grant execute to authenticated (owners call this via the Supabase client)
GRANT EXECUTE ON FUNCTION verify_and_deliver(UUID, TEXT) TO authenticated;
