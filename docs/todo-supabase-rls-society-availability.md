# DONE: Fix Society Availability Display via Supabase RLS
<!-- Resolved 2026-04-20 via migration 012_society_availability_rpc.sql -->

## Problem

During owner registration (Step 2 — Society Selection), all societies show as
**Available** regardless of whether they already have an active owner. This is
because the `SocietySearch` component queries:

```js
supabase.from('societies')
  .select('id, name, slug, city, state, owners(id, name, status)')
  .eq('postal_code', postalCode)
```

The nested `owners(...)` join is blocked by the current RLS policy on the
`owners` table ("owner reads/updates own row only"). Anonymous users get back
an empty `[]` for every society's owners array, so the UI marks every society
as available.

The database UNIQUE constraint on `owners.society_id` still prevents an actual
takeover — the INSERT fails with a `23505` error and a friendly message is
shown. But the UX is poor: the user fills out all three registration steps
before learning the society is taken.

## Fix Required

### Option A — Public read policy on `owners` (recommended)

Add a Supabase RLS SELECT policy that lets anonymous (unauthenticated) users
read only the `name` and `status` columns of the `owners` table:

```sql
CREATE POLICY "Public can read owner name and status for society lookup"
ON owners
FOR SELECT
TO anon
USING (true);
```

> If exposing the full row to anon is too broad, use a restricted view instead
> (see Option B).

### Option B — Security-definer view (more restrictive)

Create a view that exposes only what the registration UI needs:

```sql
CREATE VIEW public_society_owners AS
  SELECT society_id, name, status
  FROM owners;

-- Grant anon read on the view only (not the base table)
GRANT SELECT ON public_society_owners TO anon;
```

Then update `SocietySearch.jsx` to join against this view instead of the
`owners` table directly.

### Option C — SECURITY DEFINER RPC function

Add a Postgres function (similar to the existing `admin_get_owner_email_status`)
that takes a postal code and returns societies with their taken/available status:

```sql
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
```

Then update `SocietySearch.jsx` to call this RPC instead of the direct query:

```js
const { data } = await supabase
  .rpc('get_societies_with_availability', {
    p_postal_code: postalCode,
    p_country_code: countryCode
  })
```

And update the `taken` check from:
```js
const taken = owner && owner.status !== 'inactive'
```
to:
```js
const taken = s.is_taken
```

## How to Apply

Connect the Supabase MCP plugin to Claude Code:

```bash
claude mcp add --transport sse supabase https://mcp.supabase.com/sse
```

Or add to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--access-token", "<your-supabase-access-token>"
      ]
    }
  }
}
```

Get your access token from **Supabase Dashboard → Account → Access Tokens**.

Once connected, Claude Code can apply the SQL above directly without needing
the Supabase dashboard.

## Files to Update After DB Change

| File | Change |
|---|---|
| `src/components/SocietySearch.jsx` | Replace nested `owners(...)` join with RPC call (Option C) or adjust `taken` logic |

## Priority

**Medium** — The DB constraint prevents actual takeovers. The UX impact is
that users waste time filling registration steps before learning a society is
taken. Fix before launch.
