# InkNeighbour roadmap

Written 2026-09-23 for autonomous runs (`run InkNeighbour: Do roadmap item N in docs/ROADMAP.md ...`).

## Context every run must know

- InkNeighbour connects home-printer Owners in apartment complexes with neighbour Customers for
  on-demand printing. Live at https://inkneighbour.zakapedia.in. Phase 1 MVP is in real use -- this
  roadmap closes gaps found in the actual code, it does not add Phase 2/3 features (WATI,
  Razorpay subscriptions, Stripe, Supabase Realtime, multi-language UI, Capacitor) without
  explicit instruction.
- Read first: `CLAUDE.md` (repo), `docs/order-alerts-design.md`, `supabase/migrations/README.md`,
  `supabase/functions/README.md`, and the VM's `~/projects/CLAUDE.md` (the autonomous build loop
  you must follow).
- The elder-friendly UI rules and core business rules in `CLAUDE.md` are hard constraints -- one
  owner per society, one-way job status flow, file auto-delete on `delivered`/`cancelled`,
  feedback immutability, 48px tap targets, no jargon. Never relax these for convenience.
- Live Supabase project: `xgjaagaqtzknvsinbklr` (account a). Pushing to `main` deploys
  `inkneighbour.zakapedia.in` via Vercel.
- Owner order alerts and the 15-minute SLA now run through a WhatsApp outbox
  (`025_notification_outbox.sql`, `docs/order-alerts-design.md`) that posts to a shared CRM app
  in the separate CRM repo (account b) -- not through WATI. Browser push (VAPID) is a second, older
  channel that owners are still prompted to enable but that currently does nothing (Wave 1).
- Tools on this VM: `npm run lint` (zero warnings enforced), `npm test -- --run` (289 tests as of
  2026-09-23), `npm run build` -- exactly what `.github/workflows/ci.yml` runs on every push/PR to
  main. There is no local Supabase/Deno test harness in this repo -- migrations and edge functions
  cannot be unit-tested locally, unlike some sibling repos on this VM.
- ContextForge (MCP `contextforge`) holds project history; check it for project `inkneighbour`
  before starting.

## Rules for every item

1. Do exactly one item per run. Keep it small enough to finish in about 15 minutes; if it will not
   fit, finish a coherent first slice, commit it, and say what is left.
2. **Frontend/JS changes:** `npm run lint`, `npm test -- --run`, and `npm run build` must all pass
   -- this is exactly what CI enforces. Do not introduce new lint warnings (0 is the baseline).
3. **Database changes:** add the next numbered migration in `supabase/migrations/` (continue from
   `025_...`; see `supabase/migrations/README.md` for the two-naming-scheme history -- never
   rename, merge or delete existing files). Prefer idempotent statements (`if not exists`,
   `create or replace`) matching the existing style. Inspect the live schema first with the
   read-only `supabase` MCP; apply with `supabase-write` only after reviewing the SQL; verify
   afterward with read-only SELECTs/advisors. Never rewrite or delete existing rows.
4. **Edge function changes:** there is no local test harness for these -- verify by deploying with
   `supabase-write` (`deploy_edge_function`, preserving each function's current `verify_jwt`) and
   checking function logs (`query_logs`) or a manual authenticated request. A clean `npm test`
   does not cover `supabase/functions/` -- do not treat it as verification for these.
5. Update `supabase/functions/README.md` and `supabase/migrations/README.md` whenever an item
   changes deployment or schedule state -- both are already known to go stale (`functions/README.md`
   is dated 2026-09-20 and is out of date the moment this roadmap is read).
6. Out of scope for every item: WATI/Twilio/Stripe/Razorpay activation, Supabase Realtime, a
   language switcher or completing `hi.json` (i18n scaffolding is intentionally inert until
   Phase 2 per README -- no switcher exists yet, so this is not user-facing today), new paid
   services or API keys, anything requiring the owner's action outside this repo (see Parked).
7. When finished, tick the item below (`[x]`, date, one-line result) and commit that with the work.

## Items

### Wave 1: make the order-alert system do what it claims

- [ ] **1. Establish ground truth on what's actually deployed and scheduled.**
  `supabase/functions/README.md` (2026-09-20) says `notify` and `check-sla` were "written but
  never deployed." `check-sla`'s own header says it's "called every minute by pg_cron," but
  `025_notification_outbox.sql` (landed 2026-09-21/22) leaves `cron.schedule('check-sla', ...)`
  as a trailing comment, never actually run in a migration. Since the whole SLA/reminder/outbox
  system depends on this, use the read-only `supabase` MCP (`list_edge_functions`, `query_logs`)
  to find out whether `check-sla` is deployed and whether a cron job exists, and update
  `supabase/functions/README.md` with the true state and today's date. Do not deploy or schedule
  anything in this item -- just find out and document it accurately; the finding decides what
  items 2 and 9 actually need to do.
- [ ] **2. If the cron isn't scheduled, add it as a migration, not a one-off dashboard action.**
  Once item 1 confirms `check-sla` is deployed but unscheduled, add
  `026_schedule_check_sla.sql` with the `cron.schedule(...)` call from migration 025's comment,
  using the `sla_secret` already read from Vault in `queue_new_order_alert()`. Apply via
  `supabase-write`, then verify with a read-only SELECT on `cron.job` and one `query_logs` check
  that a tick ran.
- [ ] **3. Stop the browser push notification from lying.** `supabase/functions/notify/index.ts`
  never sends a push -- it `console.log`s `"Would push to: ..."` and returns `{ sent: N }` as if
  it worked. Meanwhile `Dashboard/index.jsx:286` calls `setupOwnerPush()`, owners grant permission
  and get rows in `push_subscriptions`, and the README describes push as a live Phase 1 channel.
  Now that owner alerts run through the WhatsApp outbox (once items 1-2 confirm it's live), either
  (a) wire real VAPID signing in `notify/index.ts` so it actually fires, or (b) if WhatsApp is now
  the sole owner-alert channel, remove the push permission prompt from `Dashboard/index.jsx` and
  correct the README/CLAUDE.md claims. Prefer (b) unless there's a real reason to keep two
  channels -- it's the smaller, honest fix. Either way, an owner should never be asked to enable a
  channel that silently does nothing.
- [ ] **4. Add the missing outbox notification kinds.** `docs/order-alerts-design.md` designed
  `order_cancelled_owner`, `order_accepted_customer` and `order_ready_customer`, but
  `025_notification_outbox.sql`'s CHECK constraint only allows `order_new`, `order_reminder_10`,
  `order_reminder_5`, `order_cancelled_customer`. A customer who ticks "send my order updates on
  WhatsApp" currently never hears their order was accepted or is ready -- the opt-in promises more
  than the system delivers. Add a migration extending the CHECK constraint plus a trigger (or a
  `check-sla` tick addition) that queues these on the relevant `jobs.status` transitions. If new
  WhatsApp templates are needed, add them to the "What only the owner can do" list in
  `docs/order-alerts-design.md` rather than trying to get them approved yourself (see Parked).
- [ ] **5. Give the admin page visibility into notification failures.** The design doc promises
  failed outbox sends "stay `failed` and are visible in the admin page," but nothing reads
  `notification_outbox` anywhere in `src/pages/Admin*.jsx`. Add a read-only panel (existing
  `AdminJobs.jsx` or a new `/admin/notifications`) listing recent outbox rows -- kind, job, status,
  attempts, error -- filterable to `failed`. Read-only in this item; a manual "retry" action is a
  separate decision.

### Wave 2: small, verified gaps

- [ ] **6. Real UPI QR code.** `src/components/UPIQRCode.jsx` is named for a QR but only renders
  a deep-link button and a copyable UPI ID -- its own comment says "Full QR code generation
  requires a library... add in Phase 2 if needed." Confirm customers actually need to scan (vs.
  the deep link working fine on the phone already looking at the shop page); if yes, add a small
  dependency-free canvas QR renderer, keeping the copy fallback for scan failures.
- [ ] **7. Refresh the stale docs.** `README.md` lists only 3 migrations and 171 tests (actual:
  25 migration files, 289 tests) and does not mention `Dashboard/Availability.jsx`,
  `Dashboard/Feedback.jsx`, `AdminDirectory.jsx`, `AdminJobs.jsx`, print-shop `provider_type`, or
  the notification outbox; its route table and Phase Roadmap table are behind `App.jsx` and
  `supabase/migrations/`. Bring it current -- read the actual routes/migrations/test output before
  writing, do not guess. Pure docs, no lint/test/build risk.
- [ ] **8. Verify the "busy" and closed-shop states end to end.** CLAUDE.md and the README
  describe a "busy" screen at the active job limit and closed-shop messaging driven by
  `src/lib/availability.js`. Click through `ShopPage.jsx` and `Find.jsx` in the dev server for a
  shop that is paused, one outside its schedule, and one at its `active_job_limit`; fix anything
  that shows the wrong state or an ungated order form. Report findings even if nothing is broken --
  this is a verification item, not an assumed-broken one.

## Parked (needs the owner)

- WhatsApp templates (`owner_new_order`, `owner_order_reminder`, `customer_order_cancelled`,
  `customer_order_update`, and any added by item 4) need to be created and approved in Meta
  Business Manager -- category Utility, language en. Listed in `docs/order-alerts-design.md`.
- Registering InkNeighbour as an app in the CRM project (needs `CRM_ADMIN_TOKEN`, which lives
  outside this repo) and storing the returned key as `CRM_API_KEY` in InkNeighbour's Supabase
  function secrets. Without this, `check-sla`'s `drainOutbox()` has nowhere to send.
- Any Phase 2/3 decision (Razorpay subscriptions/commission, Stripe, WATI, multi-language UI,
  Capacitor app) -- explicitly out of scope per `CLAUDE.md` until asked for.
