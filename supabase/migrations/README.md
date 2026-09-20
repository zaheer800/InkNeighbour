# Migrations: how to read this folder

There are two naming styles here. Nothing should be renamed or deleted, because the live
project's migration history (`supabase_migrations.schema_migrations`) recorded both.

## The numbered files: `001` to `024`

These are the intended sequence and the ones to read. `024_customer_accounts.sql` was applied
directly to the live project (recorded there as version `024`) and committed afterwards on
2026-09-20. It adds the `customers` table, `jobs.customer_id` with its policies, and the
`get_nearby_shops` function used by InkNeighbour-Mobile.

## The eight timestamped files

Changes that were first applied to the live database on 2026-04-19 and 2026-04-25 through the
Supabase dashboard/MCP, which recorded them under a timestamp version. Most are counterparts of
a numbered file; they are related but **not byte-identical** (formatting and, in places,
statements differ):

| Timestamped file | Numbered counterpart |
|---|---|
| `20260419145605_009_job_sides` | `009_job_sides` |
| `20260419170920_admin_rls` | `010_admin_rls` |
| `20260419171200_admin_rls_fix_auth_email` | none (a one-line note: "Applied directly on remote. Captured in local migrations 001-021.") |
| `20260419171559_storage_rls_allow_authenticated_upload` | `008_storage_rls` (a follow-up variant) |
| `20260419172517_delivery_pin` | `011_delivery_pin` |
| `20260425170951_platform_config_public_defaults_read` | `019_platform_config_public_defaults_read` |
| `20260425174602_fix_owner_society_unique_and_availability` | `020_fix_owner_society_unique_and_availability` |
| `20260425184641_owners_user_phone_unique_active` | `021_owners_user_phone_unique_active` |

## What to do

- **New migrations:** continue the numbered sequence (`025_...`). If a tool records a timestamp
  version when applying, that is expected; keep the numbered file as the source of truth.
- **Do not** rename, merge or delete existing files.
- **Not verified:** replaying `001`-`024` on a blank database. Do that on a scratch project
  before relying on this folder to rebuild the database from nothing.
- To see what the live project has recorded:
  `select version, name from supabase_migrations.schema_migrations order by version;`
