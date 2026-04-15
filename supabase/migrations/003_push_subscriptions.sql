-- ============================================================
-- InkNeighbour — Push Subscriptions
-- Migration 003: Browser push notification subscriptions
-- ============================================================

CREATE TABLE push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,   -- Full PushSubscription JSON from browser
  device       TEXT,             -- User agent string for debugging
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX push_subscriptions_owner_id_idx ON push_subscriptions(owner_id);

-- ============================================================
-- RLS for push_subscriptions
-- ============================================================
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Owners can manage their own subscriptions
CREATE POLICY "push_owner_insert" ON push_subscriptions
  FOR INSERT WITH CHECK (owner_id IN (SELECT id FROM owners WHERE user_id = auth.uid()));

CREATE POLICY "push_owner_delete" ON push_subscriptions
  FOR DELETE USING (owner_id IN (SELECT id FROM owners WHERE user_id = auth.uid()));

-- No public read — Edge Functions use service role key to read and send pushes
-- Owners can read their own (for display/debug purposes)
CREATE POLICY "push_owner_read" ON push_subscriptions
  FOR SELECT USING (owner_id IN (SELECT id FROM owners WHERE user_id = auth.uid()));

-- ============================================================
-- Storage bucket policy: job-files
-- NOTE: Create the bucket manually in Supabase Dashboard first.
-- Bucket name: job-files
-- Public: false (private — signed URLs only)
-- ============================================================

-- Storage RLS (applied to storage.objects table):
-- Owners can download files for their own jobs
-- Customers can upload files for new jobs (INSERT, unauthenticated)
-- Service role handles deletions via Edge Functions or storage.js utility
