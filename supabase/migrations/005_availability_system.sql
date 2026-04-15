-- ============================================================
-- InkNeighbour — Availability System
-- Migration 005: manual state, schedules, missed jobs,
--                SLA fields, get_effective_state() function
-- ============================================================

-- ============================================================
-- owners: add availability system columns
-- ============================================================
ALTER TABLE owners
  ADD COLUMN IF NOT EXISTS manual_state        TEXT NOT NULL DEFAULT 'OFF',
  ADD COLUMN IF NOT EXISTS system_override     TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS override_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_toggle_at      TIMESTAMPTZ;

-- Phase-1 defaults for active job tracking (max_active_jobs already added
-- by 004_behaviour_system; these are additive only)
-- Columns added in 004: max_active_jobs, soft_lock_until, streak, avg_response_minutes
-- No conflict: 005 adds only the new availability columns.

-- Constrain valid values
ALTER TABLE owners
  ADD CONSTRAINT owners_manual_state_check
    CHECK (manual_state IN ('ON', 'OFF')),
  ADD CONSTRAINT owners_system_override_check
    CHECK (system_override IN ('NONE', 'FORCED_OFF'));

-- ============================================================
-- jobs: add SLA + locked state columns
-- ============================================================
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS sla_breached             BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_effective_state   TEXT;
  -- sla_deadline and accepted_at already added by 004_behaviour_system

-- ============================================================
-- availability_schedules
-- Owner-defined time slots per day of week
-- ============================================================
CREATE TABLE IF NOT EXISTS availability_schedules (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID        NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  day_of_week  INTEGER     NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   TIME        NOT NULL,
  end_time     TIME        NOT NULL,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT availability_schedules_time_order CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS availability_schedules_owner_idx
  ON availability_schedules(owner_id);

-- ============================================================
-- missed_jobs
-- Log of jobs that expired without owner acceptance (SLA breach)
-- INSERT only via service role; owners can read their own rows
-- ============================================================
CREATE TABLE IF NOT EXISTS missed_jobs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     UUID        REFERENCES jobs(id),
  owner_id   UUID        NOT NULL REFERENCES owners(id),
  missed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason     TEXT        NOT NULL  -- 'sla_expired' | 'manual_cancel'
);

CREATE INDEX IF NOT EXISTS missed_jobs_owner_idx
  ON missed_jobs(owner_id);

-- ============================================================
-- Postgres function: get_effective_state(owner_id)
-- Mirrors the client-side getEffectiveState() in availability.js
-- Priority: system_override > manual_state > schedule_state
-- ============================================================
CREATE OR REPLACE FUNCTION get_effective_state(p_owner_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner          owners%ROWTYPE;
  v_in_schedule    BOOLEAN;
BEGIN
  SELECT * INTO v_owner FROM owners WHERE id = p_owner_id;

  IF NOT FOUND THEN
    RETURN 'UNAVAILABLE';
  END IF;

  -- 1. System override (highest priority)
  IF v_owner.system_override = 'FORCED_OFF'
     AND v_owner.override_expires_at IS NOT NULL
     AND v_owner.override_expires_at > now() THEN
    RETURN 'UNAVAILABLE';
  END IF;

  -- Clear expired override (side-effect, acceptable in SECURITY DEFINER)
  IF v_owner.system_override = 'FORCED_OFF'
     AND (v_owner.override_expires_at IS NULL OR v_owner.override_expires_at <= now()) THEN
    UPDATE owners SET system_override = 'NONE' WHERE id = p_owner_id;
  END IF;

  -- 2. Manual state
  IF v_owner.manual_state = 'OFF' THEN RETURN 'UNAVAILABLE'; END IF;
  IF v_owner.manual_state = 'ON'  THEN RETURN 'AVAILABLE';   END IF;

  -- 3. Schedule state
  SELECT EXISTS (
    SELECT 1
    FROM availability_schedules
    WHERE owner_id   = p_owner_id
      AND day_of_week = EXTRACT(DOW FROM now())::INTEGER
      AND start_time <= now()::TIME
      AND end_time   >  now()::TIME
      AND is_active  = true
  ) INTO v_in_schedule;

  RETURN CASE WHEN v_in_schedule THEN 'AVAILABLE' ELSE 'UNAVAILABLE' END;
END;
$$;

-- ============================================================
-- Trigger: stamp locked_effective_state on job INSERT
-- Captures the effective state at job creation time so SLA
-- logic can use it even if state changes later
-- ============================================================
CREATE OR REPLACE FUNCTION set_locked_effective_state()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.locked_effective_state IS NULL AND NEW.owner_id IS NOT NULL THEN
    NEW.locked_effective_state := get_effective_state(NEW.owner_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS jobs_set_locked_state ON jobs;
CREATE TRIGGER jobs_set_locked_state
  BEFORE INSERT ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_locked_effective_state();

-- ============================================================
-- Trigger: mark sla_breached on job status → cancelled
-- when job was never accepted (sla_expired cancel path)
-- ============================================================
CREATE OR REPLACE FUNCTION mark_sla_breached()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled'
     AND OLD.status = 'submitted'
     AND OLD.sla_deadline IS NOT NULL
     AND now() > OLD.sla_deadline
     AND OLD.accepted_at IS NULL THEN
    NEW.sla_breached := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS jobs_mark_sla_breached ON jobs;
CREATE TRIGGER jobs_mark_sla_breached
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION mark_sla_breached();

-- ============================================================
-- Function: apply_system_override(owner_id, cooldown_hours)
-- Called by Edge Function when reliability drops or missed
-- jobs threshold is hit. Sets FORCED_OFF for N hours.
-- ============================================================
CREATE OR REPLACE FUNCTION apply_system_override(
  p_owner_id       UUID,
  p_cooldown_hours INTEGER DEFAULT 2
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE owners
  SET
    system_override     = 'FORCED_OFF',
    override_expires_at = now() + (p_cooldown_hours || ' hours')::INTERVAL,
    manual_state        = 'OFF'   -- force manual off too so toggle is blocked
  WHERE id = p_owner_id;
END;
$$;

-- ============================================================
-- RLS policies
-- ============================================================

-- availability_schedules: owner full CRUD on own rows
ALTER TABLE availability_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner full CRUD own schedules" ON availability_schedules;
CREATE POLICY "Owner full CRUD own schedules" ON availability_schedules
  FOR ALL
  USING (
    owner_id IN (SELECT id FROM owners WHERE user_id = auth.uid())
  )
  WITH CHECK (
    owner_id IN (SELECT id FROM owners WHERE user_id = auth.uid())
  );

-- missed_jobs: owners read own rows; INSERT via service role only
ALTER TABLE missed_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner read own missed jobs" ON missed_jobs;
CREATE POLICY "Owner read own missed jobs" ON missed_jobs
  FOR SELECT
  USING (
    owner_id IN (SELECT id FROM owners WHERE user_id = auth.uid())
  );

-- ============================================================
-- platform_config: add availability system defaults
-- ============================================================
INSERT INTO platform_config (key, value) VALUES
  ('sla_acceptance_minutes',          '15'),
  ('override_cooldown_minutes',        '120'),
  ('override_missed_job_threshold',    '2'),
  ('reliability_override_threshold',   '70'),
  ('max_active_jobs_default',          '2')
ON CONFLICT (key) DO NOTHING;
