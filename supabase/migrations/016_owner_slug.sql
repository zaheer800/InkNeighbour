-- Add a unique URL slug to each owner row.
-- Home owners inherit the society slug (stored here for convenience).
-- Print shop owners get a slug generated from their shop name at registration.

ALTER TABLE owners ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Back-fill home owners: copy slug from their linked society
UPDATE owners o
SET    slug = s.slug
FROM   societies s
WHERE  o.society_id = s.id
  AND  o.slug IS NULL
  AND  o.provider_type = 'home';

-- Index for fast slug look-up on the shop page
CREATE INDEX IF NOT EXISTS idx_owners_slug ON owners (slug);
