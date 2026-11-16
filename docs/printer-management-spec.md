# Printer management: build spec (pilot slice)

Source: `docs/PRD_V1.2-printer-management.md`. Pilot: one print shop, real printers.

## Goal
Let a signed-in user connect printers through a Windows agent (InkNeighbour Connect), see their
status and supplies on a dashboard, and get alerts. Honest about unsupported data.

## Slice order
1. Cloud foundation (this branch): tables + RLS, `printer-agent` edge function, My Printers page, fake agent for testing.
2. Windows agent, read-only monitoring: discovery, status, SNMP Printer MIB supplies. Unsigned installer for the pilot.
3. Print execution, off by default, one owner-triggered test job. Separate branch.
4. Marketplace integration. Separate branch.

## Out of scope
AI features, subscriptions/billing, multi-user business UI (tables exist, no UI), analytics and cost
estimates, email alerts, signed installer (needs a purchased certificate), print execution,
marketplace integration, RFQ/bidding.

## Stack
Existing: React 18, Vite, Tailwind, Supabase (Postgres, Edge Functions). Agent: .NET Worker Service (later).

## Decisions
- Printer tables are keyed to the Supabase user via `printer_accounts`, not to `owners`. A personal
  user needs no marketplace record. Marketplace link is an optional nullable column.
- All agent writes go through one edge function, `printer-agent` (verify_jwt off, because agents hold
  no Supabase session). Agents authenticate with a per-agent secret, stored only as a SHA-256 hash.
- Pairing: signed-in user generates a short-lived one-time code (hash stored); the agent exchanges it
  for its credential. Revoking an agent invalidates the credential immediately.
- Tables written only by the service role: metrics, consumables, alerts (insert), agents credentials.
  Members can read their account's rows; owners/admins can rename or remove printers; any member can
  acknowledge alerts.
- Online/offline is derived at read time from `last_seen_at`; a cron sweep raises offline alerts.
- Readings carry `source` (actual/estimated/manual/unsupported) and `observed_at`. Unsupported is
  stored as null level, never as zero.
- Additive migration only (`027_printer_management.sql`). Not applied to the live project until the
  review loop is clean.
