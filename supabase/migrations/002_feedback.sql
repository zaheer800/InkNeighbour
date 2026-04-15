-- ============================================================
-- InkNeighbour — Feedback Schema
-- Migration 002: Feedback table + Owner aggregate view
-- ============================================================

-- ============================================================
-- feedback
-- ============================================================
CREATE TABLE feedback (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       UUID UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,  -- UNIQUE: one feedback per job
  owner_id     UUID REFERENCES owners(id) ON DELETE CASCADE,
  society_id   UUID REFERENCES societies(id) ON DELETE SET NULL,
  on_time      BOOLEAN,                        -- true = on time, false = late
  quality_good BOOLEAN,                        -- true = good quality, false = quality issue
  star_rating  INTEGER NOT NULL CHECK (star_rating BETWEEN 1 AND 5),
  comment      TEXT CHECK (char_length(comment) <= 200),  -- max 200 chars
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ                     -- 7 days after job delivered_at
);

CREATE INDEX feedback_owner_id_idx ON feedback(owner_id);
CREATE INDEX feedback_job_id_idx ON feedback(job_id);
CREATE INDEX feedback_created_at_idx ON feedback(created_at DESC);

-- ============================================================
-- RLS for feedback
-- ============================================================
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Customers can INSERT feedback (no auth required)
CREATE POLICY "feedback_anon_insert" ON feedback FOR INSERT WITH CHECK (true);

-- Owners can read their own feedback
CREATE POLICY "feedback_owner_read" ON feedback FOR SELECT USING (
  owner_id IN (SELECT id FROM owners WHERE user_id = auth.uid())
);

-- NO update or delete policies — feedback is immutable after submission

-- ============================================================
-- Owner aggregate stats view
-- Computed from feedback table — no denormalisation needed
-- ============================================================
CREATE OR REPLACE VIEW owner_stats AS
SELECT
  o.id AS owner_id,
  o.name,
  o.shop_name,
  o.status,
  o.society_id,
  COUNT(f.id)                                            AS total_ratings,
  ROUND(AVG(f.star_rating)::NUMERIC, 1)                 AS avg_star_rating,
  ROUND((AVG(f.on_time::INT) * 100)::NUMERIC, 0)        AS on_time_pct,
  ROUND((AVG(f.quality_good::INT) * 100)::NUMERIC, 0)   AS quality_pct
FROM owners o
LEFT JOIN feedback f ON f.owner_id = o.id
GROUP BY o.id, o.name, o.shop_name, o.status, o.society_id;

-- ============================================================
-- Feedback trigger: auto-set expires_at to 7 days after delivery
-- This is called when feedback is inserted (job should already be delivered)
-- ============================================================
CREATE OR REPLACE FUNCTION set_feedback_expiry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expires_at IS NULL THEN
    -- Use the job's updated_at as the delivery timestamp
    SELECT updated_at + INTERVAL '7 days' INTO NEW.expires_at
    FROM jobs
    WHERE id = NEW.job_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER feedback_set_expiry
  BEFORE INSERT ON feedback
  FOR EACH ROW EXECUTE FUNCTION set_feedback_expiry();
