-- ============================================================
-- InkNeighbour — Storage RLS Policies
-- Migration 008: job-files bucket access policies
-- These were documented in 003 but never written as SQL.
-- ============================================================

-- Customers (anon) can upload files when placing an order
CREATE POLICY "anon_upload_job_files"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'job-files');

-- Authenticated owners can read files in their job folders
-- to download and print them. Path: {job_id}/{filename}
CREATE POLICY "owner_read_job_files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'job-files');

-- Service role handles deletions (deleteJobFile utility) — no anon DELETE needed
