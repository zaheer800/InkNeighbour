-- ============================================================
-- InkNeighbour — Fix get_nearby_shops type error + standalone shops
-- Migration 026:
--   1. Bug fix: get_nearby_shops RETURNS TABLE declared total_ratings
--      as INTEGER, but owner_stats.total_ratings is BIGINT (a count()
--      aggregate) — every call raised 42804 "structure of query does
--      not match function result type". Postgres does not allow
--      CREATE OR REPLACE to change a RETURNS TABLE column type, so
--      the function must be dropped and recreated.
--   2. Product change: shop discovery is no longer gated-community
--      only. Standalone shops (no society_id) are now discoverable
--      by postal code via a new owners.postal_code column, unioned
--      alongside the existing societies-join path. The two paths are
--      mutually exclusive (one requires society_id set, the other
--      requires it NULL), so no duplicate rows are possible.
-- ============================================================

ALTER TABLE owners ADD COLUMN IF NOT EXISTS postal_code TEXT;

CREATE INDEX IF NOT EXISTS owners_postal_code_idx ON owners (postal_code)
  WHERE postal_code IS NOT NULL;

-- Best-effort backfill: pull a 6-digit Indian pincode (first digit 1-9,
-- not part of a longer digit run) out of existing shop_address text.
-- Leaves postal_code NULL where no clear match exists.
UPDATE owners
SET postal_code = substring(shop_address FROM '(?<!\d)[1-9]\d{5}(?!\d)')
WHERE shop_address IS NOT NULL
  AND postal_code IS NULL;

DROP FUNCTION IF EXISTS public.get_nearby_shops(text, text);

CREATE FUNCTION public.get_nearby_shops(
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
  total_ratings       BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  -- (a) society-linked shops — unchanged path
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
    AND s.country_code = p_country_code

  UNION ALL

  -- (b) standalone shops — no society link, matched on owners.postal_code
  SELECT
    NULL::UUID, NULL::TEXT, NULL::TEXT,
    o.id, o.shop_name, o.slug, o.provider_type,
    o.bw_rate, o.color_rate, o.delivery_fee, o.free_delivery_above,
    get_effective_state(o.id),
    os.avg_star_rating, os.total_ratings
  FROM owners o
  LEFT JOIN owner_stats os ON os.owner_id = o.id
  WHERE o.society_id IS NULL
    AND o.status = 'active'
    AND o.postal_code = p_postal_code
    AND o.country_code = p_country_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_nearby_shops(text, text) TO anon, authenticated;
