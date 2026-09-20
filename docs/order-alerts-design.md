# Order alerts, reminders and the 15-minute rule — design

Status: DESIGN (2026-09-21). Nothing here is deployed yet.
Goal: a customer never waits on an order the shop owner did not see. If the owner does not accept
in 15 minutes the order is cancelled, the customer is told, and the owner's reliability score drops.

## What exists today
- `jobs.sla_deadline` is set by trigger to `created_at + 15 min` for `submitted` jobs.
- Guest ordering already works: the order form inserts a job with name, flat and optional phone. No customer account is needed.
- `check-sla` (source only, not deployed) has the cancel / missed_jobs / soft-lock logic. Its reminders only `console.log`. It has no auth and nothing schedules it.
- `notify` is a stub. Nothing tells the owner a new order arrived.

## Design

### 1. Outbox (one table, one sender)
`notification_outbox(id, kind, owner_id, job_id, phone, template, params jsonb, status, attempts, created_at, sent_at, error)`.
Everything that must reach a person is a row here, never a direct call from a trigger or the browser.
Kinds: `order_new`, `order_reminder_10`, `order_reminder_5`, `order_cancelled_owner`, `order_cancelled_customer`, `order_accepted_customer`, `order_ready_customer`.
Unique key on `(kind, job_id)` so a reminder or alert can never be queued twice.
RLS on, no policies: only the service role touches it.

### 2. Queueing
- AFTER INSERT trigger on `jobs` (status `submitted`) inserts `order_new`.
- `check-sla` inserts the 10-minute and 5-minute reminders and the cancellation notices.
- Status changes (accepted / ready) insert the customer messages. Only if the customer gave a phone and opted in.

### 3. Sending
`send-notifications` edge function drains the outbox in small batches and calls the CRM `crm-send` with InkNeighbour's app key. Failures retry up to 3 times, then stay `failed` and are visible in the admin page.
Owner channel order: WhatsApp template first; web push as a second channel later (needs VAPID keys, not in scope now).

### 4. The clock
`check-sla` runs every minute from `pg_cron` through `pg_net`, with a shared secret in the `Authorization` header (secret in Supabase Vault and in the function's env). Without the secret it returns 401.
It must:
- cancel only `submitted` jobs whose deadline passed (idempotent: `update ... where status = 'submitted' returning`),
- skip the soft-lock when the owner has fewer than 5 jobs (already in the code),
- queue `order_cancelled_customer` so the customer is told, and `order_cancelled_owner`,
- delete the uploaded file only after the cancel update succeeds.

### 5. Customer opt-in
A phone number typed in the order form is not consent. The order form gets a checkbox "Send my order updates on WhatsApp" (default off). Only a ticked box makes customer messages eligible. Owner messages need no opt-in because owners agree at registration (add one line to the registration terms).

## Fixes found while reading the order code
- `ShopPage.jsx` builds `job_number` from `count(*) + 1`. Anonymous customers can't see other jobs, so the count is wrong and numbers collide. Replace with a database sequence default.
- Delivery PIN is generated in the browser. Move it to the trigger/RPC (migration 022 already hides it from reads).

## What only the owner can do
1. Create and submit these WhatsApp templates in Meta Business Manager (category Utility, language en):
   - `owner_new_order`: "New order {{1}} from {{2}}, {{3}} pages, Rs {{4}}. Accept within 15 minutes: {{5}}"
   - `owner_order_reminder`: "Order {{1}} still waiting, {{2}} minutes left before it is auto-cancelled: {{3}}"
   - `customer_order_cancelled`: "Order {{1}} was cancelled because {{2}} did not respond in time. Please pick another shop: {{3}}"
   - `customer_order_update`: "Order {{1}} is now {{2}}. Track it: {{3}}"
2. Register InkNeighbour as a CRM app (needs `CRM_ADMIN_TOKEN`) and store the returned key as `CRM_API_KEY` in the InkNeighbour Supabase function secrets.
3. Approve this design.

## Rollout order
1. Migration: outbox + trigger + sequence for job numbers.
2. `send-notifications` + `check-sla` with auth, deployed with the schedule left OFF.
3. Test with a dummy owner (your own phone) end to end.
4. Turn the schedule on.
