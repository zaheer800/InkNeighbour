-- Fix: anonymous users see all societies as "Available" during registration
-- because RLS blocks reads on the owners table for anon role.
-- Solution: SECURITY DEFINER function that exposes only is_taken + owner_name,
-- without granting any direct access to the owners table.

CREATE OR REPLACE FUNCTION public.get_societies_with_availability(
  p_postal_code TEXT,
  p_country_code TEXT DEFAULT 'IN'
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  city TEXT,
  state TEXT,
  is_taken BOOLEAN,
  owner_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.name,
    s.slug,
    s.city,
    s.state,
    (o.id IS NOT NULL AND o.status <> 'inactive') AS is_taken,
    CASE WHEN o.id IS NOT NULL AND o.status <> 'inactive' THEN o.name ELSE NULL END AS owner_name
  FROM societies s
  LEFT JOIN owners o ON o.society_id = s.id
  WHERE s.postal_code = p_postal_code
    AND s.country_code = p_country_code
  ORDER BY s.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_societies_with_availability TO anon;
