-- ============================================================
-- InkNeighbour — Fix RLS for Registration Flow
-- Migration 006: Allow anon society inserts
-- ============================================================
-- Societies are community metadata (name, location) with no sensitive data.
-- Allowing anon inserts lets the registration flow create a new society
-- before the auth user is confirmed (email confirmation enabled).

DROP POLICY IF EXISTS "societies_auth_insert" ON societies;

CREATE POLICY "societies_anon_insert" ON societies
  FOR INSERT WITH CHECK (true);
