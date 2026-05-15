-- ============================================================
-- InkNeighbour — Print Shop Provider Type
-- Migration 013: Add provider_type + print shop columns to owners.
--                Replace blanket UNIQUE on society_id with a
--                partial index scoped to home owners only.
-- ============================================================

-- ============================================================
-- owners: add provider_type
-- ============================================================
ALTER TABLE owners
  ADD COLUMN IF NOT EXISTS provider_type TEXT NOT NULL DEFAULT 'home';

ALTER TABLE owners
  DROP CONSTRAINT IF EXISTS owners_provider_type_check;

ALTER TABLE owners
  ADD CONSTRAINT owners_provider_type_check
    CHECK (provider_type IN ('home', 'shop'));

-- ============================================================
-- owners: add print shop fields (NULL for home owners)
-- ============================================================
ALTER TABLE owners
  ADD COLUMN IF NOT EXISTS shop_address   TEXT,          -- full street address
  ADD COLUMN IF NOT EXISTS locality       TEXT,          -- neighbourhood e.g. 'Tarnaka'
  ADD COLUMN IF NOT EXISTS landmark       TEXT,          -- display hint e.g. 'Near Metro Station'
  ADD COLUMN IF NOT EXISTS lat            NUMERIC(10,7), -- map pin latitude
  ADD COLUMN IF NOT EXISTS lng            NUMERIC(10,7), -- map pin longitude
  ADD COLUMN IF NOT EXISTS delivery_radius INTEGER,      -- metres (Phase 2 distance filter)
  ADD COLUMN IF NOT EXISTS delivery_by    TEXT,          -- 'self' | 'staff' | 'thirdparty'
  ADD COLUMN IF NOT EXISTS gst_number     TEXT;          -- optional GST registration

ALTER TABLE owners
  DROP CONSTRAINT IF EXISTS owners_delivery_by_check;

ALTER TABLE owners
  ADD CONSTRAINT owners_delivery_by_check
    CHECK (delivery_by IS NULL OR delivery_by IN ('self', 'staff', 'thirdparty'));

-- ============================================================
-- Drop blanket UNIQUE on society_id.
-- Replace with partial index: one home owner per society only.
-- Print shops do not use society_id so they are exempt.
-- ============================================================

-- Remove the constraint added inline in 001_initial_schema.sql
ALTER TABLE owners
  DROP CONSTRAINT IF EXISTS owners_society_id_key;

-- Partial unique index: one active home owner per society
CREATE UNIQUE INDEX IF NOT EXISTS unique_home_owner_per_society
  ON owners (society_id)
  WHERE provider_type = 'home'
    AND status != 'inactive'
    AND society_id IS NOT NULL;

-- ============================================================
-- Update owner_reliability view to include provider_type
-- (needed by admin panel filter in a later migration)
-- ============================================================
CREATE OR REPLACE VIEW owner_reliability AS
SELECT
  o.id                                                   AS owner_id,
  o.provider_type,
  o.streak,
  o.avg_response_minutes,
  o.max_active_jobs,
  o.soft_lock_until,

  COUNT(j.id)                                            AS total_jobs,

  COUNT(j.id) FILTER (
    WHERE j.accepted_at IS NOT NULL
      AND j.sla_deadline IS NOT NULL
      AND j.accepted_at <= j.sla_deadline
  )                                                      AS on_time_accepted,

  COUNT(j.id) FILTER (
    WHERE j.status = 'cancelled'
      AND j.accepted_at IS NULL
  )                                                      AS missed_jobs,

  COUNT(j.id) FILTER (
    WHERE j.status IN ('delivered', 'feedback_pending', 'feedback_done')
  )                                                      AS completed_jobs,

  COUNT(j.id) FILTER (
    WHERE j.accepted_at IS NOT NULL
  )                                                      AS accepted_jobs,

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

  CASE
    WHEN COUNT(j.id) FILTER (WHERE j.accepted_at IS NOT NULL) = 0 THEN NULL
    ELSE ROUND(
      100.0 * COUNT(j.id) FILTER (
        WHERE j.status IN ('delivered', 'feedback_pending', 'feedback_done')
      ) / COUNT(j.id) FILTER (WHERE j.accepted_at IS NOT NULL),
      1
    )
  END                                                    AS completion_rate,

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

  (
    SELECT COUNT(*) FROM jobs
    WHERE owner_id = o.id AND status IN ('submitted', 'accepted', 'printing')
  )                                                      AS active_jobs_count

FROM owners o
LEFT JOIN jobs j ON j.owner_id = o.id
GROUP BY
  o.id, o.provider_type, o.streak, o.avg_response_minutes,
  o.max_active_jobs, o.soft_lock_until;

GRANT SELECT ON owner_reliability TO authenticated;
GRANT SELECT ON owner_reliability TO anon;

-- ============================================================
-- platform_config: add print shop rate defaults
-- ============================================================
INSERT INTO platform_config (key, value) VALUES
  ('default_bw_rate_home',    '200'),   -- ₹2.00 in paise
  ('default_color_rate_home', '500'),   -- ₹5.00 in paise
  ('default_bw_rate_shop',    '300'),   -- ₹3.00 in paise
  ('default_color_rate_shop', '800'),   -- ₹8.00 in paise
  ('default_max_jobs_home',   '3'),
  ('default_max_jobs_shop',   '10')
ON CONFLICT (key) DO NOTHING;
