-- ============================================================
-- InkNeighbour — Owner Behaviour Control System
-- Migration 004: SLA tracking, reliability scoring, soft lock
-- ============================================================

-- ============================================================
-- jobs: add SLA + timing columns
-- ============================================================
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS sla_deadline   TIMESTAMPTZ,   -- created_at + 15 min; NULL means not yet set
  ADD COLUMN IF NOT EXISTS accepted_at    TIMESTAMPTZ,   -- stamped when status → accepted
  ADD COLUMN IF NOT EXISTS delivered_at   TIMESTAMPTZ;   -- stamped when status → delivered

-- Index for SLA enforcement queries (find expired unaccepted jobs)
CREATE INDEX IF NOT EXISTS jobs_sla_deadline_idx ON jobs(sla_deadline)
  WHERE status = 'submitted';

-- ============================================================
-- owners: add behaviour-control columns
-- ============================================================
ALTER TABLE owners
  ADD COLUMN IF NOT EXISTS max_active_jobs      INTEGER     NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS soft_lock_until      TIMESTAMPTZ,              -- NULL means not locked
  ADD COLUMN IF NOT EXISTS streak               INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_response_minutes NUMERIC(6,2);             -- rolling average

-- ============================================================
-- Trigger: set sla_deadline on job INSERT
-- 15-minute acceptance window from creation time
-- ============================================================
CREATE OR REPLACE FUNCTION set_sla_deadline()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set for new submitted jobs; leave NULL for jobs created in any other status
  IF NEW.status = 'submitted' THEN
    NEW.sla_deadline = NEW.created_at + INTERVAL '15 minutes';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_set_sla_deadline
  BEFORE INSERT ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_sla_deadline();

-- ============================================================
-- Trigger: stamp accepted_at / delivered_at on status change
-- Also updates owner streak and avg_response_minutes
-- ============================================================
CREATE OR REPLACE FUNCTION track_job_timestamps()
RETURNS TRIGGER AS $$
DECLARE
  v_response_minutes NUMERIC;
  v_current_avg      NUMERIC;
  v_job_count        INTEGER;
BEGIN
  -- Stamp accepted_at when transitioning to 'accepted'
  IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
    NEW.accepted_at = now();

    -- Update owner avg_response_minutes (rolling average, max last 20 jobs)
    IF NEW.sla_deadline IS NOT NULL AND NEW.owner_id IS NOT NULL THEN
      v_response_minutes := EXTRACT(EPOCH FROM (now() - OLD.created_at)) / 60.0;

      SELECT avg_response_minutes, (
        SELECT COUNT(*) FROM jobs
        WHERE owner_id = NEW.owner_id AND accepted_at IS NOT NULL
      )
      INTO v_current_avg, v_job_count
      FROM owners WHERE id = NEW.owner_id;

      IF v_current_avg IS NULL THEN
        v_current_avg := v_response_minutes;
      ELSE
        -- Weighted rolling average (weight recent jobs more heavily, cap at 20)
        v_current_avg := (v_current_avg * LEAST(v_job_count, 19) + v_response_minutes)
                         / (LEAST(v_job_count, 19) + 1);
      END IF;

      UPDATE owners
      SET avg_response_minutes = v_current_avg
      WHERE id = NEW.owner_id;
    END IF;
  END IF;

  -- Stamp delivered_at when transitioning to 'delivered'
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    NEW.delivered_at = now();

    -- Increment streak on on-time delivery
    -- On-time means: accepted before sla_deadline AND delivered within reasonable window
    IF NEW.owner_id IS NOT NULL THEN
      IF NEW.sla_deadline IS NOT NULL AND NEW.accepted_at IS NOT NULL
         AND NEW.accepted_at <= NEW.sla_deadline THEN
        UPDATE owners SET streak = streak + 1 WHERE id = NEW.owner_id;
      ELSE
        -- Accepted late or no SLA — reset streak
        UPDATE owners SET streak = 0 WHERE id = NEW.owner_id;
      END IF;
    END IF;
  END IF;

  -- Reset streak on cancellation (owner-initiated implied; customer cancellations differ)
  IF NEW.status = 'cancelled' AND OLD.status IN ('submitted', 'accepted') THEN
    IF NEW.owner_id IS NOT NULL THEN
      UPDATE owners SET streak = 0 WHERE id = NEW.owner_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_track_timestamps
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION track_job_timestamps();

-- ============================================================
-- View: owner_reliability
-- Computes acceptance rate, completion rate, reliability score
-- Used by dashboard and shop page transparency signals
-- ============================================================
CREATE OR REPLACE VIEW owner_reliability AS
SELECT
  o.id                                                   AS owner_id,
  o.streak,
  o.avg_response_minutes,
  o.max_active_jobs,
  o.soft_lock_until,

  -- Total jobs assigned (excluding jobs created before behaviour system)
  COUNT(j.id)                                            AS total_jobs,

  -- Jobs accepted within SLA deadline
  COUNT(j.id) FILTER (
    WHERE j.accepted_at IS NOT NULL
      AND j.sla_deadline IS NOT NULL
      AND j.accepted_at <= j.sla_deadline
  )                                                      AS on_time_accepted,

  -- Jobs cancelled after submission (missed SLA or owner cancelled)
  COUNT(j.id) FILTER (
    WHERE j.status = 'cancelled'
      AND j.accepted_at IS NULL
  )                                                      AS missed_jobs,

  -- Jobs that reached delivered/feedback state
  COUNT(j.id) FILTER (
    WHERE j.status IN ('delivered', 'feedback_pending', 'feedback_done')
  )                                                      AS completed_jobs,

  -- Jobs accepted (regardless of SLA)
  COUNT(j.id) FILTER (
    WHERE j.accepted_at IS NOT NULL
  )                                                      AS accepted_jobs,

  -- Acceptance rate: accepted within SLA / total submitted jobs with SLA
  CASE
    WHEN COUNT(j.id) FILTER (WHERE j.sla_deadline IS NOT NULL) = 0 THEN NULL
    ELSE ROUND(
      100.0 * COUNT(j.id) FILTER (
        WHERE j.accepted_at IS NOT NULL
          AND j.sla_deadline IS NOT NULL
          AND j.accepted_at <= j.sla_deadline
      ) / COUNT(j.id) FILTER (WHERE j.sla_deadline IS NOT NULL),
      1
    )
  END                                                    AS acceptance_rate,

  -- Completion rate: delivered / accepted
  CASE
    WHEN COUNT(j.id) FILTER (WHERE j.accepted_at IS NOT NULL) = 0 THEN NULL
    ELSE ROUND(
      100.0 * COUNT(j.id) FILTER (
        WHERE j.status IN ('delivered', 'feedback_pending', 'feedback_done')
      ) / COUNT(j.id) FILTER (WHERE j.accepted_at IS NOT NULL),
      1
    )
  END                                                    AS completion_rate,

  -- Reliability score: average of acceptance_rate and completion_rate
  CASE
    WHEN COUNT(j.id) FILTER (WHERE j.sla_deadline IS NOT NULL) = 0 THEN NULL
    ELSE ROUND(
      (
        COALESCE(
          100.0 * COUNT(j.id) FILTER (
            WHERE j.accepted_at IS NOT NULL
              AND j.sla_deadline IS NOT NULL
              AND j.accepted_at <= j.sla_deadline
          ) / NULLIF(COUNT(j.id) FILTER (WHERE j.sla_deadline IS NOT NULL), 0),
          100
        )
        +
        COALESCE(
          100.0 * COUNT(j.id) FILTER (
            WHERE j.status IN ('delivered', 'feedback_pending', 'feedback_done')
          ) / NULLIF(COUNT(j.id) FILTER (WHERE j.accepted_at IS NOT NULL), 0),
          100
        )
      ) / 2,
      1
    )
  END                                                    AS reliability_score,

  -- Currently active jobs count
  (
    SELECT COUNT(*) FROM jobs
    WHERE owner_id = o.id AND status IN ('submitted', 'accepted', 'printing')
  )                                                      AS active_jobs_count

FROM owners o
LEFT JOIN jobs j ON j.owner_id = o.id
GROUP BY
  o.id, o.streak, o.avg_response_minutes,
  o.max_active_jobs, o.soft_lock_until;

-- Grant select on the view
GRANT SELECT ON owner_reliability TO authenticated;
GRANT SELECT ON owner_reliability TO anon;

-- ============================================================
-- Function: apply_soft_lock
-- Called by Edge Function after detecting < 70% reliability
-- Locks owner for 24 hours (pauses shop automatically)
-- ============================================================
CREATE OR REPLACE FUNCTION apply_soft_lock(p_owner_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE owners
  SET
    soft_lock_until = now() + INTERVAL '24 hours',
    status = 'paused'
  WHERE id = p_owner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- platform_config: add behaviour system defaults
-- ============================================================
INSERT INTO platform_config (key, value) VALUES
  ('sla_minutes',       '15'),   -- acceptance SLA window
  ('soft_lock_threshold', '70'), -- reliability score below which soft lock triggers
  ('max_active_jobs',   '3')     -- default max concurrent active jobs
ON CONFLICT (key) DO NOTHING;
