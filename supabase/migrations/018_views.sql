-- ============================================================
-- InkNeighbour — Computed Views
-- Migration 018: owner_reliability and owner_stats views.
--                Created on remote; captured here for local sync.
-- ============================================================

-- ── owner_reliability ─────────────────────────────────────────
-- Computes per-owner reliability metrics from jobs history.
-- Used by Dashboard (reliability score, soft-lock indicator)
-- and Admin directory.
CREATE OR REPLACE VIEW owner_reliability AS
SELECT
  o.id                  AS owner_id,
  o.provider_type,
  o.streak,
  o.avg_response_minutes,
  o.max_active_jobs,
  o.soft_lock_until,
  count(j.id)           AS total_jobs,

  -- Accepted within SLA
  count(j.id) FILTER (
    WHERE j.accepted_at IS NOT NULL
      AND j.sla_deadline IS NOT NULL
      AND j.accepted_at <= j.sla_deadline
  ) AS on_time_accepted,

  -- Missed (cancelled before owner accepted)
  count(j.id) FILTER (
    WHERE j.status = 'cancelled'
      AND j.accepted_at IS NULL
  ) AS missed_jobs,

  -- Completed
  count(j.id) FILTER (
    WHERE j.status = ANY (ARRAY['delivered', 'feedback_pending', 'feedback_done'])
  ) AS completed_jobs,

  -- Accepted (any time)
  count(j.id) FILTER (
    WHERE j.accepted_at IS NOT NULL
  ) AS accepted_jobs,

  -- Acceptance rate  = on_time_accepted / jobs_with_sla × 100
  CASE
    WHEN count(j.id) FILTER (WHERE j.sla_deadline IS NOT NULL) = 0 THEN NULL
    ELSE round(
      (100.0 * count(j.id) FILTER (
        WHERE j.accepted_at IS NOT NULL
          AND j.sla_deadline IS NOT NULL
          AND j.accepted_at <= j.sla_deadline
      )::numeric)
      / count(j.id) FILTER (WHERE j.sla_deadline IS NOT NULL)::numeric,
      1
    )
  END AS acceptance_rate,

  -- Completion rate = completed / accepted × 100
  CASE
    WHEN count(j.id) FILTER (WHERE j.accepted_at IS NOT NULL) = 0 THEN NULL
    ELSE round(
      (100.0 * count(j.id) FILTER (
        WHERE j.status = ANY (ARRAY['delivered', 'feedback_pending', 'feedback_done'])
      )::numeric)
      / count(j.id) FILTER (WHERE j.accepted_at IS NOT NULL)::numeric,
      1
    )
  END AS completion_rate,

  -- Reliability score = avg(acceptance_rate, completion_rate)
  CASE
    WHEN count(j.id) FILTER (WHERE j.sla_deadline IS NOT NULL) = 0 THEN NULL
    ELSE round(
      (
        COALESCE(
          (100.0 * count(j.id) FILTER (
            WHERE j.accepted_at IS NOT NULL
              AND j.sla_deadline IS NOT NULL
              AND j.accepted_at <= j.sla_deadline
          )::numeric)
          / NULLIF(count(j.id) FILTER (WHERE j.sla_deadline IS NOT NULL), 0)::numeric,
          100
        )
        +
        COALESCE(
          (100.0 * count(j.id) FILTER (
            WHERE j.status = ANY (ARRAY['delivered', 'feedback_pending', 'feedback_done'])
          )::numeric)
          / NULLIF(count(j.id) FILTER (WHERE j.accepted_at IS NOT NULL), 0)::numeric,
          100
        )
      ) / 2,
      1
    )
  END AS reliability_score,

  -- Currently active jobs
  (
    SELECT count(*)
    FROM jobs
    WHERE jobs.owner_id = o.id
      AND jobs.status = ANY (ARRAY['submitted', 'accepted', 'printing'])
  ) AS active_jobs_count

FROM owners o
LEFT JOIN jobs j ON j.owner_id = o.id
GROUP BY o.id, o.provider_type, o.streak, o.avg_response_minutes, o.max_active_jobs, o.soft_lock_until;


-- ── owner_stats ───────────────────────────────────────────────
-- Aggregates feedback ratings per owner.
-- Used on shop profile page and search results.
CREATE OR REPLACE VIEW owner_stats AS
SELECT
  o.id          AS owner_id,
  o.name,
  o.shop_name,
  o.status,
  o.society_id,
  count(f.id)                                           AS total_ratings,
  round(avg(f.star_rating), 1)                          AS avg_star_rating,
  round(avg(f.on_time::integer)    * 100, 0)            AS on_time_pct,
  round(avg(f.quality_good::integer) * 100, 0)          AS quality_pct
FROM owners o
LEFT JOIN feedback f ON f.owner_id = o.id
GROUP BY o.id, o.name, o.shop_name, o.status, o.society_id;
