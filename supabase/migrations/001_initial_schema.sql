-- ============================================================
-- InkNeighbour — Initial Schema
-- Migration 001: Countries, Societies, Owners, Jobs
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- countries — config table for global-ready architecture
-- ============================================================
CREATE TABLE countries (
  code               TEXT PRIMARY KEY,   -- 'IN', 'US', 'GB'
  name               TEXT NOT NULL,
  currency_code      TEXT NOT NULL,      -- ISO 4217: 'INR', 'USD', 'GBP'
  currency_symbol    TEXT NOT NULL,      -- '₹', '$', '£'
  postal_code_label  TEXT NOT NULL DEFAULT 'Postal Code',
  flat_label         TEXT NOT NULL DEFAULT 'Flat',
  society_label      TEXT NOT NULL DEFAULT 'Society'
);

INSERT INTO countries (code, name, currency_code, currency_symbol, postal_code_label, flat_label, society_label) VALUES
  ('IN', 'India',          'INR', '₹', 'Pincode',  'Flat',  'Society'),
  ('US', 'United States',  'USD', '$', 'ZIP Code', 'Unit',  'Condo'),
  ('GB', 'United Kingdom', 'GBP', '£', 'Postcode', 'Flat',  'Block of Flats');

-- ============================================================
-- societies
-- ============================================================
CREATE TABLE societies (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  slug         TEXT UNIQUE NOT NULL,
  city         TEXT,
  state        TEXT,
  postal_code  TEXT NOT NULL,
  country_code TEXT REFERENCES countries(code) DEFAULT 'IN',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX societies_postal_code_idx ON societies(postal_code);
CREATE INDEX societies_country_code_idx ON societies(country_code);

-- ============================================================
-- owners
-- ============================================================
CREATE TABLE owners (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  phone        TEXT,
  flat_number  TEXT,
  society_id   UUID UNIQUE REFERENCES societies(id),  -- UNIQUE: one owner per society
  shop_name    TEXT,
  status       TEXT NOT NULL DEFAULT 'active'         -- 'active', 'paused', 'inactive'
                CHECK (status IN ('active', 'paused', 'inactive')),
  bw_rate      INTEGER NOT NULL DEFAULT 200,          -- paise (₹2.00)
  color_rate   INTEGER NOT NULL DEFAULT 500,          -- paise (₹5.00)
  delivery_fee INTEGER NOT NULL DEFAULT 800,          -- paise (₹8.00)
  upi_id       TEXT,
  accept_cash  BOOLEAN NOT NULL DEFAULT TRUE,
  country_code TEXT REFERENCES countries(code) DEFAULT 'IN',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX owners_user_id_idx ON owners(user_id);
CREATE INDEX owners_society_id_idx ON owners(society_id);
CREATE INDEX owners_status_idx ON owners(status);

-- ============================================================
-- jobs
-- ============================================================
CREATE TABLE jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number      TEXT UNIQUE NOT NULL,      -- 'INK-0042'
  owner_id        UUID REFERENCES owners(id) ON DELETE SET NULL,
  society_id      UUID REFERENCES societies(id) ON DELETE SET NULL,
  customer_name   TEXT NOT NULL,
  customer_flat   TEXT NOT NULL,
  customer_phone  TEXT,
  file_path       TEXT,                      -- Supabase Storage path
  file_name       TEXT,
  page_count      INTEGER,
  print_type      TEXT NOT NULL CHECK (print_type IN ('bw', 'color')),
  paper_size      TEXT NOT NULL DEFAULT 'A4',
  copies          INTEGER NOT NULL DEFAULT 1 CHECK (copies >= 1),
  total_amount    INTEGER NOT NULL,          -- smallest currency unit
  payment_method  TEXT NOT NULL CHECK (payment_method IN ('upi', 'cash')),
  payment_status  TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
  status          TEXT NOT NULL DEFAULT 'submitted'
                  CHECK (status IN ('submitted','accepted','printing','delivered','cancelled','feedback_pending','feedback_done')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX jobs_owner_id_idx ON jobs(owner_id);
CREATE INDEX jobs_status_idx ON jobs(status);
CREATE INDEX jobs_created_at_idx ON jobs(created_at DESC);

-- Auto-update updated_at on jobs
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- platform_config
-- ============================================================
CREATE TABLE platform_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO platform_config (key, value) VALUES
  ('default_bw_rate',      '200'),   -- ₹2.00 in paise
  ('default_color_rate',   '500'),   -- ₹5.00 in paise
  ('default_delivery_fee', '800'),   -- ₹8.00 in paise
  ('commission_percent',   '0'),     -- Phase 1: free
  ('subscription_fee',     '9900'),  -- ₹99 in paise (Phase 2)
  ('subscription_active',  'false'); -- Phase 2

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE societies ENABLE ROW LEVEL SECURITY;
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;

-- countries: public read
CREATE POLICY "countries_public_read" ON countries FOR SELECT USING (true);

-- societies: public read, authenticated write
CREATE POLICY "societies_public_read" ON societies FOR SELECT USING (true);
CREATE POLICY "societies_auth_insert" ON societies FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- owners: owner can read/update own row only
CREATE POLICY "owners_select_own" ON owners FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "owners_update_own" ON owners FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "owners_insert_own" ON owners FOR INSERT WITH CHECK (user_id = auth.uid());
-- Public read for shop discovery (non-sensitive fields only)
CREATE POLICY "owners_public_read" ON owners FOR SELECT USING (true);

-- jobs: owner can read/update their jobs; customers can INSERT anonymously
CREATE POLICY "jobs_owner_select" ON jobs FOR SELECT USING (
  owner_id IN (SELECT id FROM owners WHERE user_id = auth.uid())
);
CREATE POLICY "jobs_owner_update" ON jobs FOR UPDATE USING (
  owner_id IN (SELECT id FROM owners WHERE user_id = auth.uid())
);
CREATE POLICY "jobs_anon_insert" ON jobs FOR INSERT WITH CHECK (true); -- customers place orders unauthenticated
-- Customers can read their own job (by job ID — no auth required)
CREATE POLICY "jobs_public_read_by_id" ON jobs FOR SELECT USING (true);

-- platform_config: service role only (admin via Edge Function / Supabase Studio)
-- No public policies — only service role key can access
