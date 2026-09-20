-- ============================================================
-- InkNeighbour — Customer Accounts
-- Migration 024: adds real customer accounts (phone/OTP-backed)
--                for the InkNeighbour Mobile app, additive only.
--                Anonymous ordering from the web app is untouched.
-- ============================================================

-- ============================================================
-- customers
-- ============================================================
CREATE TABLE customers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  phone              TEXT NOT NULL UNIQUE,
  name               TEXT,
  country_code       TEXT NOT NULL DEFAULT 'IN' REFERENCES countries(code),
  default_society_id UUID REFERENCES societies(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Deliberately NOT publicly readable (unlike owners) — holds customer PII.
-- Deliberately NO auth.users trigger — that would also fire for web-app
-- owner signups (email-based), which must not gain a customers row as a
-- side effect. Row creation is explicit, client-side, on first OTP login.
CREATE POLICY "customers_select_own" ON customers FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "customers_insert_own" ON customers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "customers_update_own" ON customers FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- No DELETE policy — matches the no-deletes convention (jobs, feedback).

-- ============================================================
-- jobs.customer_id
-- ============================================================
ALTER TABLE jobs ADD COLUMN customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX jobs_customer_id_idx ON jobs (customer_id) WHERE customer_id IS NOT NULL;

-- Scope the existing blanket anon-insert policy to the anon role explicitly.
-- Verified (migration 001): jobs_anon_insert has WITH CHECK (true) with no
-- TO clause, meaning it currently applies to PUBLIC (every role, including
-- authenticated) — not just anon. Without this fix, an authenticated
-- customer could insert a job with any customer_id, bypassing the new
-- jobs_customer_insert guard below entirely, since Postgres OR's multiple
-- permissive policies for the same command together. This scoping is safe
-- for the web app: its anonymous ordering flow uses the anon key, i.e. the
-- anon role, by definition.
ALTER POLICY "jobs_anon_insert" ON jobs TO anon;

CREATE POLICY "jobs_customer_insert" ON jobs FOR INSERT TO authenticated
  WITH CHECK (
    customer_id IS NULL
    OR customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
  );

-- Defense-in-depth: jobs_public_read_by_id (USING true) already grants
-- broad SELECT today, so this doesn't tighten anything yet, but keeps the
-- customer "my orders" query working if that anon policy is ever scoped
-- down later.
CREATE POLICY "jobs_customer_select" ON jobs FOR SELECT TO authenticated
  USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));

-- ============================================================
-- get_nearby_shops — customer shop-discovery RPC
-- ============================================================
-- get_societies_with_availability (012) is for owner registration ("is
-- this society already taken"), not shop discovery — it returns only
-- is_taken/owner_name, no pricing or live status. This is a new, separate,
-- additive function purpose-built for the Mobile Home screen.
CREATE OR REPLACE FUNCTION public.get_nearby_shops(
  p_postal_code TEXT,
  p_country_code TEXT DEFAULT 'IN'
)
RETURNS TABLE (
  society_id          UUID,
  society_name        TEXT,
  society_slug        TEXT,
  owner_id            UUID,
  shop_name           TEXT,
  owner_slug          TEXT,
  provider_type       TEXT,
  bw_rate             INTEGER,
  color_rate          INTEGER,
  delivery_fee        INTEGER,
  free_delivery_above INTEGER,
  effective_state     TEXT,
  avg_star_rating     NUMERIC,
  total_ratings       INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id, s.name, s.slug,
    o.id, o.shop_name, o.slug, o.provider_type,
    o.bw_rate, o.color_rate, o.delivery_fee, o.free_delivery_above,
    get_effective_state(o.id),
    os.avg_star_rating, os.total_ratings
  FROM societies s
  JOIN owners o ON o.society_id = s.id AND o.status = 'active'
  LEFT JOIN owner_stats os ON os.owner_id = o.id
  WHERE s.postal_code = p_postal_code
    AND s.country_code = p_country_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_nearby_shops TO anon, authenticated;
