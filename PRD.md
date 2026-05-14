# InkNeighbour — Product Requirements Document
**Version:** 1.9  
**Owner:** Zaheer (Zakapedia)  
**URL:** inkneighbour.zakapedia.in  
**Stack:** React + Vite · Supabase · Vercel  
**Status:** Phase 1 — Build Ready

---

## 1. Product Overview

### 1.1 What Is InkNeighbour?

InkNeighbour is a web-based platform connecting two types of print service providers with customers who need on-demand printing:

- **Home Owners** — apartment residents who own a printer and offer printing to neighbours within their building
- **Print Shop Owners** — professional print businesses who offer printing with delivery within a configurable radius

Customers upload documents, the provider prints and delivers, and charges a per-page fee. InkNeighbour manages the entire order flow, job queue, payments, feedback, and availability — for both provider types on one unified platform.

### 1.2 Origin & Core Problem

Home printers are common in Indian apartments but expensive to maintain — cartridges cost ₹600–1,500 every few weeks. Most owners print only occasionally (school worksheets, forms, notices) and cannot justify the cost alone. Meanwhile, residents who don't own a printer depend on print shops outside their society.

InkNeighbour connects these two groups inside the same building — turning a household expense into a self-sustaining micro-service.

### 1.3 Vision

> "Print anything. Delivered to your door."

Long-term vision: A global platform where any home printer owner or professional print shop can register, serve their local community, and earn — without any technical knowledge. Home owners cover their ink costs. Print shops grow their order volume beyond walk-ins.

### 1.4 Tagline

**"Print it. Drop it. Done."**

---

## 2. Users

### 2.1 User Types

| Role | Description |
|---|---|
| **Home Owner** | Apartment resident with a home printer. Serves neighbours in the same building. Coverage: same building only. |
| **Print Shop Owner** | Professional print business. Serves customers within a configurable delivery radius. Coverage: 1–5km. |
| **Customer** | Anyone needing printing. Finds providers by pincode/map. No account required. |
| **Platform Admin** | Zaheer (product owner). Manages all providers, default rates, and platform settings. |

### 2.2 Home Owner Persona

- Age: 28–55
- Has a home printer (Canon/HP/Epson inkjet or laser)
- Prints school worksheets, forms, or work documents regularly
- Wants to offset cartridge and maintenance costs
- Not a business person — needs a simple, no-jargon interface
- Primarily uses a smartphone
- Coverage: same apartment building only

### 2.3 Print Shop Owner Persona

- Age: 25–50
- Runs a professional print shop (DTP centre, stationery shop, or print business)
- Already has walk-in customers but wants more digital orders
- Needs job management, file tracking, and order flow
- Has delivery capability (own staff, bike, or third-party)
- Motivated paying customer — this is their livelihood
- Coverage: 1–5km delivery radius

### 2.4 Customer Persona

- Age: 18–70 (including elderly residents)
- Lives in the same apartment complex as the Owner
- Needs occasional printing (1–10 pages at a time)
- Comfortable with basic smartphone usage
- Prefers UPI or cash — no credit cards needed

### 2.4 Design Principle: Elder-Friendly First

The UI must be usable by elderly residents with no prior experience. This means:
- Minimum font size: 16px body, 20px+ for headings
- Large tap targets: minimum 48×48px for all buttons
- Clear, plain-English labels — no jargon
- High colour contrast (WCAG AA minimum)
- No more than 3 actions visible at any time
- Progress indicators on every multi-step form
- Friendly, encouraging copy ("Great! Your document is ready to upload 📄")

---

## 3. Global-Ready Architecture

### 3.1 Design Philosophy

Phase 1 targets India. The product must be architected so that expanding to any country requires configuration changes — not code rewrites.

### 3.2 Internationalisation (i18n)

- All UI strings stored in locale files (`/src/locales/en.json`, `hi.json`, `ta.json`, etc.)
- Use `react-i18next` for string management
- Date/time formatted via `Intl.DateTimeFormat` using user locale
- Number formatting via `Intl.NumberFormat` with configurable locale

### 3.3 Currency & Pricing

- Currency stored per-shop as ISO 4217 code (e.g., `INR`, `USD`, `GBP`, `AED`)
- Currency symbol derived from `Intl.NumberFormat` — never hardcoded
- All prices stored in the smallest unit (paise for INR, cents for USD)
- Price display always uses locale-appropriate formatting

```
// Example: price stored as 200 (paise)
// Display: ₹2.00 (India) or $0.02 (US, if applicable)
```

### 3.4 Location & Address

- Society address includes: name, city, state/province, country, postal code
- Postal code field labelled dynamically ("Pincode" in India, "ZIP Code" in US, "Postcode" in UK)
- Country selector present on Owner registration (defaults to India)
- All location data stored with country code for future geo-search

### 3.5 Terminology Localisation

| Global Term | India | UK | USA |
|---|---|---|---|
| Society / Building | Society / Apartment Complex | Block of Flats | Condo / Apartment Building |
| Postal Code | Pincode | Postcode | ZIP Code |
| Mobile | Mobile | Mobile | Cell Phone |
| Flat | Flat | Flat | Unit / Apt |

Terminology driven by country config, not hardcoded.

### 3.6 Payment Architecture

Payments are modular — pluggable per country:

```
/src/payments/
  index.js          ← payment method router (uses country config)
  upi.js            ← India: UPI QR display
  stripe.js         ← Global: Stripe (Phase 2)
  cash.js           ← Universal: Cash on Delivery
```

Phase 1 implements `upi.js` and `cash.js`. Stripe module stubbed but not active.

### 3.7 Notification Architecture

Notifications are modular — pluggable per country and phase:

```
/src/notifications/
  index.js          ← notification method router (uses country config)
  whatsapp.js       ← wa.me link builder (Phase 1) + WATI API (Phase 2)
  sms.js            ← Twilio SMS — fallback for non-WhatsApp regions (Phase 3)
  browser.js        ← Browser push notifications (Phase 1)
```

WhatsApp penetration by region:
- India / Middle East / Southeast Asia → WhatsApp first
- US / Canada / Australia → SMS fallback (Twilio)
- UK / Europe → WhatsApp + SMS

Notification provider is configured per country in `countries.js`:
```javascript
IN: { notificationProvider: 'whatsapp', smsProvider: null },
US: { notificationProvider: 'sms',       smsProvider: 'twilio' },
GB: { notificationProvider: 'whatsapp', smsProvider: 'twilio' },
```

### 3.8 Paper Sizes

Supported paper sizes configurable per region:
- A4 (default globally)
- US Letter (North America)
- Legal (North America)
- A3 (optional, Owner can enable)

---

## 4. Core Business Rules

### 4.1 One Owner Per Society (Home Owners Only)

- Each society can have exactly one active **Home Owner**
- Enforced by `UNIQUE` constraint on `society_id` in the `owners` table — scoped to `provider_type = 'home'`
- **Print Shop Owners are NOT subject to this rule** — multiple print shops can serve the same area
- If a Home Owner's slot is taken, new registrants see: *"This society already has a printer owner."*
- If a Home Owner deactivates, the slot opens immediately

### 4.2 Society Matching (Duplicate Prevention)

To prevent the same society being registered under different spellings:

1. Owner enters their postal code → system fetches known societies in that code
2. Owner selects from dropdown or clicks "Add my society"
3. On manual entry, **Fuse.js fuzzy match** runs against existing society names in the same postal code
4. If similarity score > 75%, system warns: *"Did you mean [existing name]?"*
5. Owner confirms or overrides

### 4.3 Service Menu (Print Shops — Display Only)

Print shops have a **profile page** that displays all their services. This is for information only — InkNeighbour manages only print jobs. All other services are advertised on the profile but handled offline (walk-in, call, or WhatsApp).

**Service display on print shop profile:**

| Service | Displayed on profile? | Online ordering via InkNeighbour? |
|---|---|---|
| B&W Printing | ✅ Yes | ✅ Yes — full order flow |
| Colour Printing | ✅ Yes | ✅ Yes — full order flow |
| Scanning | ✅ Yes (display only) | ❌ No — walk-in / call |
| Photocopying | ✅ Yes (display only) | ❌ No — walk-in / call |
| Binding | ✅ Yes (display only) | ❌ No — walk-in / call |
| Lamination | ✅ Yes (display only) | ❌ No — walk-in / call |
| Passport Photo | ✅ Yes (display only) | ❌ No — walk-in / call |

**Home Owners:** No service menu. Print only (B&W + Colour). Profile is simple.

**Service menu stored as display text** — owner types their own price description:
```
Scanning:     "₹10/page"
Binding:      "From ₹20"
Lamination:   "₹15/item"
Passport:     "Call for price"
```

No pricing model complexity. No per-unit calculation. Just free-text display.

For non-print services, the shop profile shows three contact buttons:
- 📞 Call
- 💬 WhatsApp
- 📍 Directions (Google Maps deep link)

---

### 4.4 Pricing

- Platform sets global default rates per provider type (editable by Admin)
- Each provider sets their own B&W and Colour rates during setup
- All rates stored in smallest currency unit (paise for INR)
- Delivery fee: flat fee set by provider (Home Owner or Print Shop)

**Phase 1 India defaults:**

| Rate | Home Owner | Print Shop |
|---|---|---|
| B&W per page | ₹2 | ₹3 |
| Colour per page | ₹5 | ₹8 |
| Delivery fee | ₹8 flat | ₹8 flat (configurable) |

---

### 4.5 Price Calculation

Simple. Print only.

```
Total = (pages × copies × rate_per_page) + delivery_fee
```

Where `rate_per_page` = `bw_rate` if B&W, `color_rate` if Colour.

Price shown to Customer before confirming. No hidden fees.

---

### 4.6 File Management

- Files stored in Supabase Storage under `jobs/{job_id}/{filename}`
- Auto-deleted when job status → `delivered` **or** `cancelled`
- Purpose: keep storage within Supabase free tier at all times
- Owner downloads file before printing
- File size limit: 10MB per upload
- Accepted formats: PDF, JPG, JPEG, PNG
- File upload always required — print jobs always need a document

### 4.6 Job Lifecycle

```
submitted → accepted → printing → delivered
                ↓
            cancelled
```

| Status | Triggered by | Meaning |
|---|---|---|
| `submitted` | Customer | Order placed, awaiting Owner action |
| `accepted` | Owner | Owner acknowledged the job |
| `printing` | Owner | Document is being printed |
| `delivered` | Owner | Printout handed to customer |
| `cancelled` | Owner or Customer | Job cancelled |
| `feedback_pending` | System | Delivered, feedback not yet submitted (triggered 24hrs after `delivered`) |
| `feedback_done` | Customer | Customer has submitted feedback |

### 4.7 Customer Feedback

**Purpose:** Create accountability for Owners without enabling public neighbour conflict. Owners who know they're being rated deliver on time, print cleanly, and stay active.

**Design Philosophy:** Feedback is honest but neighbourly. No public review text — only aggregate star ratings are visible to customers. Owners see all individual responses privately in their dashboard.

**Trigger:**
- 24 hours after Owner marks a job as `delivered`, the system sets feedback status to `feedback_pending`
- Customer sees a non-intrusive prompt on their order confirmation page on next visit, or via a direct feedback link
- One feedback submission per job — cannot be changed after submission
- Feedback is optional — customer can dismiss without submitting

**Feedback Form (3 questions, kept simple for elder-friendliness):**

```
1. Was it delivered on time?         👍 Yes  /  👎 No
2. Was the print quality good?       👍 Yes  /  👎 No
3. Overall experience (1–5 stars)    ⭐⭐⭐⭐⭐
4. Any comments? (optional, 200 chars max)
```

**What's visible publicly (on shop page and search results):**
- Aggregate star rating: e.g. ⭐ 4.8 · 24 ratings
- No individual review text visible to customers
- No reviewer names shown anywhere

**What's visible to the Owner (dashboard):**
- All individual feedback responses per job
- On-time delivery score (% of jobs marked on time)
- Print quality score (% marked good quality)
- Average star rating over time
- Optional comment text (private)
- Trend chart: rating over last 30 days

**What's visible to Platform Admin:**
- All shop ratings and scores
- Flagged shops (rating below threshold)
- Aggregate platform-wide quality metrics

**Rating thresholds:**
- ≥ 4.0 stars → Normal operation
- 3.0–3.9 stars → Yellow flag in Admin panel, Owner sees improvement nudge
- < 3.0 stars → Red flag in Admin panel, Admin can reach out to Owner
- No automatic deactivation based on rating alone (Phase 1) — Admin decides

**Feedback URL:**
- Each job gets a unique feedback URL: `inkneighbour.zakapedia.in/feedback/:job-id`
- URL is valid for 7 days after delivery
- After 7 days → link expires, feedback no longer accepted

### 4.8 Monetisation (Phase 1)

- **Phase 1:** Platform is free. No subscription, no commission.
- **Phase 2:** ₹99/month subscription per Owner. Non-payment → shop auto-deactivates.
- **Phase 3:** Optional online payments via Stripe/Razorpay with platform commission (10%).

Subscription billing via Razorpay Subscriptions (India) or Stripe Billing (global) — architecture stubbed in Phase 1, not active.

---

---

## 5. Availability System

> Availability is the core reliability engine of the product. If implemented incorrectly, jobs will be missed, users will lose trust, and the product will fail regardless of features. This system is not optional — it is foundational.

### 5.1 Core Principle

At any moment, the shop must be in exactly **one** clear state: `AVAILABLE` or `UNAVAILABLE`. There must never be ambiguity. All job logic depends exclusively on the resolved effective state.

---

### 5.2 State Architecture

Effective availability is derived from three independent inputs resolved into a single output:

```
Input 1: manual_state       (Owner controlled)   ON | OFF
Input 2: schedule_state     (System controlled)   ON | OFF
Input 3: system_override    (System enforced)     NONE | FORCED_OFF

         ↓ Resolution Logic ↓

Output:  effective_state                          AVAILABLE | UNAVAILABLE
```

**Only `effective_state` is visible to customers and used by all job logic.**

---

### 5.3 State Resolution Logic (Priority Order)

```
IF   system_override == FORCED_OFF  →  UNAVAILABLE  (highest priority)
ELIF manual_state    == OFF         →  UNAVAILABLE
ELIF manual_state    == ON          →  AVAILABLE
ELSE                                →  schedule_state
```

All three input states must be stored independently. Never store only the final state — recompute effective state dynamically on every evaluation.

---

### 5.4 Manual State (Owner Toggle)

- Owner toggles availability from dashboard: `ON` / `OFF`
- Default on registration: `OFF`
- Toggle applies immediately
- Toggle overrides schedule state
- Toggle is **ignored** if `system_override == FORCED_OFF`
- **Rapid toggle protection:** minimum 30-second interval between toggles enforced at API level

**Pre-commitment prompt** — shown when owner switches to `ON`:
> *"You are now accepting jobs. You must respond within 15 minutes of each order."*

Owner must confirm before toggle takes effect.

---

### 5.5 Scheduled Availability

Owner defines time slots per day of week. System evaluates schedule continuously and sets `schedule_state` automatically.

**Example configuration:**
```
Monday–Friday:  07:00–09:00 → ON
                18:00–21:00 → ON
Saturday:       09:00–13:00 → ON
Sunday:         OFF
```

**Rules:**
- `manual_state == ON` overrides schedule `OFF` — owner can go live outside schedule
- `manual_state == OFF` always overrides schedule `ON` — owner's explicit off takes priority
- Schedule slots stored per `day_of_week` + `start_time` + `end_time` in `availability_schedules` table

---

### 5.6 System Override (Auto Enforcement)

System sets `FORCED_OFF` automatically when either condition is met:

| Trigger | Threshold |
|---|---|
| Missed jobs within SLA window | ≥ 2 missed jobs |
| Reliability score drops below threshold | < 70% |

**On trigger:**
```
system_override     = FORCED_OFF
override_expires_at = now() + 2 hours
```

**During override:**
- `effective_state` = `UNAVAILABLE` regardless of manual or schedule state
- Owner cannot accept new jobs
- Customer sees: *"Temporarily unavailable"*
- Owner dashboard shows: *"Your shop has been temporarily paused due to missed orders. Available again at [time]."*

**Recovery:**
```
When now() >= override_expires_at:
  system_override = NONE
  effective_state recomputed from manual + schedule
```

---

### 5.7 SLA Enforcement Engine

Applies **only** when `effective_state == AVAILABLE`.

**SLA window:** 15 minutes from job creation to owner acceptance.

**Flow:**
```
1. Job submitted
2. sla_deadline = created_at + 15 minutes stored on job row
3. locked_effective_state = current effective_state stored on job row
4. Escalation reminders fire:
   +5 min  → Push notification: "New job waiting — 10 minutes to respond"
   +10 min → Push notification: "Final warning — 5 minutes left"
   +15 min → SLA breached:
               - Job auto-cancelled
               - sla_breached = true on job row
               - missed_jobs row inserted
               - Reliability score recalculated
               - Override trigger checked
```

**If `effective_state` becomes `UNAVAILABLE` during SLA window:**
- SLA timer cancelled immediately
- Job auto-cancelled
- Does NOT count as missed job (owner went unavailable — different from ignoring)

**SLA is not retroactive** — applies only to jobs created while `effective_state == AVAILABLE`.

---

### 5.8 Reliability Score

```
acceptance_rate  = total_jobs_accepted  / total_jobs_received  × 100
completion_rate  = total_jobs_delivered / total_jobs_accepted  × 100
reliability      = (acceptance_rate × 0.6) + (completion_rate × 0.4)
```

Stored on `owners` row. Recalculated on every job status change.

**Usage:**
- Displayed to Owner in dashboard (motivational)
- Input for system override trigger (< 70% → FORCED_OFF)
- Optionally visible to customers on shop page (Phase 2)

---

### 5.9 Active Job Limit

Maximum concurrent active jobs is **owner-configurable** — set during shop setup and editable in settings.

**Platform defaults:**
- Home Owner: 3 active jobs
- Print Shop: 10 active jobs

Active jobs = jobs with status `submitted`, `accepted`, or `printing`.

**When limit reached:**
- New order attempts blocked at submission
- Customer sees: *"Currently handling multiple jobs. Try again in a little while."*
- Limit check runs before job creation — not after

---

### 5.10 Next Availability Calculation

When `effective_state == UNAVAILABLE`, always show the customer when the shop will next be open:

```
IF system_override == FORCED_OFF:
    next_available = override_expires_at
    display: "Available again at [time]"

ELSE IF schedule drives unavailability:
    next_available = next schedule slot start_time
    display: "Available at [time] today" or "Available [day] at [time]"

ELSE (manual OFF, no schedule):
    display: "Currently unavailable"
```

---

### 5.11 Customer-Facing Status Display

| Effective State | Cause | Customer Display |
|---|---|---|
| `AVAILABLE` | Any | 🟢 Available now |
| `UNAVAILABLE` | Manual OFF | 🔴 Not available |
| `UNAVAILABLE` | Schedule OFF | 🔴 Available at [next slot time] |
| `UNAVAILABLE` | System override | 🔴 Temporarily unavailable |
| `UNAVAILABLE` | Job limit reached | 🟡 Busy — try again shortly |

---

### 5.12 Edge Cases

| Case | Behaviour |
|---|---|
| State changes while job is active | Existing jobs unaffected — only new orders blocked |
| State becomes UNAVAILABLE during SLA timer | Timer cancelled — job auto-cancelled — not counted as missed |
| Rapid toggle (< 30 seconds) | Second toggle rejected at API level with message to owner |
| Job created at exact state boundary | `locked_effective_state` stored at creation — job logic uses this, not live state |
| Override expires while owner is manually OFF | `system_override` clears, but `effective_state` stays UNAVAILABLE (manual OFF wins) |

---

### 5.13 Availability System — Implementation Notes for Claude Code

- Treat availability as a **state machine** — never a boolean flag
- Store all three input states (`manual_state`, `schedule_state` derived, `system_override`) — never only the output
- Recompute `effective_state` dynamically via a Postgres function or Edge Function — never cache it
- All job creation logic must check `effective_state` as the **only** gate — never check individual inputs
- SLA timers run via Supabase Edge Function with `pg_cron` or scheduled invocation
- Reliability score updates via Postgres trigger on `jobs.status` change
- Override recovery via `pg_cron` job checking `override_expires_at`

**Postgres function for effective state resolution:**
```sql
CREATE OR REPLACE FUNCTION get_effective_state(owner_id UUID)
RETURNS TEXT AS $$
DECLARE
  o owners%ROWTYPE;
  sched_state TEXT;
BEGIN
  SELECT * INTO o FROM owners WHERE id = owner_id;

  -- Check system override first (highest priority)
  IF o.system_override = 'FORCED_OFF' AND o.override_expires_at > now() THEN
    RETURN 'UNAVAILABLE';
  END IF;

  -- Clear expired override
  IF o.system_override = 'FORCED_OFF' AND o.override_expires_at <= now() THEN
    UPDATE owners SET system_override = 'NONE' WHERE id = owner_id;
  END IF;

  -- Manual state
  IF o.manual_state = 'OFF' THEN RETURN 'UNAVAILABLE'; END IF;
  IF o.manual_state = 'ON'  THEN RETURN 'AVAILABLE';   END IF;

  -- Fallback to schedule
  SELECT CASE WHEN COUNT(*) > 0 THEN 'AVAILABLE' ELSE 'UNAVAILABLE' END
  INTO sched_state
  FROM availability_schedules
  WHERE owner_id = owner_id
    AND day_of_week = EXTRACT(DOW FROM now())
    AND start_time  <= now()::TIME
    AND end_time    >= now()::TIME
    AND is_active   = true;

  RETURN sched_state;
END;
$$ LANGUAGE plpgsql;
```

---

## 6. Screens & Features

### 5.1 Screen Map

| # | Screen | Route | Access |
|---|---|---|---|
| 1 | Landing Page | `/` | Public |
| 2 | Society Search Results | `/find` | Public |
| 3 | Owner Registration — Step 1 (Details) | `/register` | Public |
| 4 | Owner Registration — Step 2 (Society) | `/register/society` | Public |
| 5 | Owner Registration — Step 3 (Rates & Payment) | `/register/rates` | Public |
| 6 | Shop Live Confirmation | `/register/success` | Public |
| 7 | Owner Login | `/login` | Public |
| 8 | Owner Dashboard — Jobs | `/dashboard` | Owner |
| 9 | Owner Dashboard — Earnings | `/dashboard/earnings` | Owner |
| 10 | Owner Dashboard — Settings | `/dashboard/settings` | Owner |
| 11 | Owner Dashboard — Feedback | `/dashboard/feedback` | Owner |
| 12 | Owner Dashboard — Availability | `/dashboard/availability` | Owner |
| 13 | Society Shop Page | `/:society-slug` | Public (Customers) |
| 13 | Order Confirmation | `/:society-slug/confirm/:job-id` | Public |
| 14 | Customer Feedback Form | `/feedback/:job-id` | Public (time-limited) |
| 15 | Platform Admin | `/admin` | Admin only |

---

### 5.2 Screen 1 — Landing Page (`/`)

**Purpose:** Introduce InkNeighbour, drive two actions: find a printer or register as Owner.

**Layout:**
- Full-width hero section
- Tagline: *"Print it. Drop it. Done."*
- Sub-copy: *"Find a home printer in your building. Upload your document. Get it delivered to your door."*
- Primary CTA: Pincode/postal code input + "Find a Printer" button
- Secondary CTA: "Register Your Printer →" (for Owners)
- How it works: 3-step visual (Upload → Print → Delivered)
- Footer: About · Contact · zakapedia.in

**Design Notes:**
- Warm, friendly colour palette — not cold or corporate
- Large icons and text throughout
- Mobile-first layout

---

### 5.3 Screen 2 — Search Results (`/find`)

**Purpose:** Show available providers near the customer. Both Home Owners and Print Shops displayed.

**View toggle:** List view ↔ Map view (persistent preference stored in localStorage)

**List View:**
- Home Owners and Print Shops shown in same list
- Provider type badge on each card: `🏠 Home` or `🏪 Shop`
- Sorted by distance (Phase 2) or relevance (Phase 1)

**Map View:**
- Map centred on customer's pincode (Leaflet+OSM Phase 1, Mappls Phase 2)
- Home Owner markers: 🏠
- Print Shop markers: 🏪 with delivery radius circle overlay
- Tap marker → mini card with name, rates, status, "Order" CTA

**Display per result (both types):**
- Provider name + type badge
- City / Area + first name only (privacy)
- Rates: B&W and Colour per page
- Star rating: ⭐ 4.8 · 24 ratings (hidden if < 3 ratings)
- Status badge: `Open` / `Busy` / `Closed`
- Print Shops only: "Delivers within [X]km"
- CTA: "Order from this shop →"

**Filter bar:**
- All / Home Owners only / Print Shops only
- Open now toggle

**Empty state:** "No printer found in your area yet. Know someone with a printer? Tell them about InkNeighbour!"

---

### 5.4 Screens 3–5 — Owner Registration (3 Steps)

**Step 1 — Provider Type + Your Details**

Provider type selector shown first (large, visual):
```
Are you a...
🏠 Home Printer Owner     🏪 Print Shop Owner
   I print for my            I run a print
   neighbours                business
```

Common fields (both types):
- Full name
- Phone number
- Email address (for login)
- Password
- Country selector (defaults to India)

Home Owner only:
- Flat / unit number

Print Shop only:
- Shop name
- Shop address (street, area, city)
- GST number (optional)

**Step 2 — Location**

Home Owner:
- Postal code input → society search dropdown
- Fuzzy match duplicate detection
- "Add my society" option
- Optional: map pin ([ 📍 Use my location ] or drag pin on map)
- Privacy note: *"We recommend pinning your building entrance — not your exact flat"*

Print Shop:
- Locality / area name (e.g. "Tarnaka") — fuzzy searchable
- Landmark (optional, e.g. "Near Metro Station")
- Map pin — required:
  - [ 📍 Use my current location ] → browser geolocation
  - Or: type address → Nominatim geocoding → pin drops on map
  - Owner drags pin to adjust if needed

**Step 3 — Rates & Payment**

Common fields:
- B&W per page (pre-filled with provider-type default)
- Colour per page (pre-filled with provider-type default)
- UPI ID
- Cash on Delivery toggle
- Active job limit (configurable, pre-filled with provider-type default)

Home Owner only:
- Flat delivery fee (can be set to 0)

Print Shop only:
- Distance-based delivery fee tiers (0–1km, 1–2km, 2–3km — pre-filled, editable)
- Paper sizes available (A4 default, enable A3/Legal optionally)
- Operating hours (Mon–Sun, open/close time per day)

Submit: "Launch My Shop 🚀"

**Validation:**
- Phone: format validation per country
- Email: standard validation
- Rates: must be > 0 for B&W and Colour
- Home Owner: society must be selected or confirmed
- Print Shop: address must be entered, delivery radius must be set

---

### 5.5 Screen 6 — Shop Live Confirmation

**Purpose:** Celebrate the Owner's shop going live. Give them their share link.

**Content:**
- Large success animation (confetti or checkmark)
- "Your shop is live! 🎉"
- Shop URL displayed prominently (copy button)
- WhatsApp share button: pre-filled message *"I've set up a print shop for [Society Name]! Send me your documents here: [URL]"*
- "Go to your dashboard →"

---

### 5.6 Screen 8 — Owner Dashboard — Jobs (`/dashboard`)

**Purpose:** Central command for the Owner. See and act on all print jobs.

**Header:**
- Shop name + live/paused toggle
- Notification bell

**Stats bar:**
- Jobs today
- Earnings this week
- Earnings this month

**Job tabs:**
- Pending | Printing | Delivered | Cancelled

**Per Job Card:**
- Job ID + timestamp
- Customer name + flat number
- File name + page count (detected on upload)
- Print type (B&W/Colour) + copies + paper size
- Total amount + payment method
- Status badge

**Actions per job status:**
- `submitted` → [Download File] [Accept Job] [Cancel]
- `accepted` → [Download File] [Mark as Printing]
- `printing` → [Mark as Delivered]
- `delivered` → [View Details]

**Empty state:** "No pending jobs. Share your shop link to get started! 📋"

---

### 5.7 Screen 9 — Owner Dashboard — Earnings (`/dashboard/earnings`)

**Purpose:** Help the Owner understand whether their printer is paying for itself.

**Period selector:** Today / This Week / This Month / All Time

**Summary card:**
- Total earned (large, prominent)
- Pages printed
- Number of jobs

**Breakdown:**
- B&W pages × rate = subtotal
- Colour pages × rate = subtotal
- Delivery fees collected
- Estimated cartridge cost (Owner can enter their actual cartridge cost)
- **Net profit = Total earned − cartridge cost**

**Motivational message:**
- If profitable: "Your printer paid for itself this month! 🎉"
- If break-even: "Almost there — just a few more jobs to cover your ink 🖨️"
- If loss: "Print more to cover your costs — share your link with neighbours!"

**Share link section:**
- Shop URL
- Copy button
- WhatsApp share button

---

### 5.8 Screen 10 — Owner Dashboard — Settings (`/dashboard/settings`)

**Sections:**
- **Shop Info:** Name, society/address, status (Live / Paused), locality (Print Shops), map pin adjustment
- **Print Rates:** Edit B&W rate, Colour rate, Delivery fee
- **Services (Print Shops only):** Toggle each non-print service on/off. Enter display price as free text per service (e.g. "₹10/page", "From ₹20", "Call for price")
- **Contact (Print Shops only):** Phone number shown on profile, WhatsApp number
- **Payment:** UPI ID, Cash on Delivery toggle
- **Active Job Limit:** Configurable (default 3 for home, 10 for shop)
- **Account:** Name, phone, email, password change
- **Danger Zone:** Deactivate shop (with confirmation dialog)

---

### 5.11 Screen 12 — Provider Shop Page (`/:society-slug`)

**Purpose:** Customer-facing page. Two layouts depending on provider type.

---

**Home Owner Layout (simple):**
- Shop name + 🏠 badge
- "Managed by [Name]"
- B&W ₹X/page · Colour ₹X/page · Delivery ₹X
- Star rating (if ≥ 3 ratings)
- Open/Closed status + map pin (optional)
- Order form (steps 1–4 as before)

---

**Print Shop Layout (rich profile):**

*Header:*
- Shop name + 🏪 badge
- Locality + landmark (e.g. "Tarnaka · Near Metro Station")
- Star rating · Open/Closed status
- Map pin (static Leaflet map, non-interactive)

*Services section:*
```
ONLINE ORDER
🖨️ B&W Printing     ₹3/page   [ Order Online → ]
🖨️ Colour Printing  ₹8/page   [ Order Online → ]

OTHER SERVICES
📠 Scanning          ₹10/page
📋 Photocopying      ₹1.50/page
📎 Binding           From ₹20
🗂️ Lamination        ₹15/item
📸 Passport Photo    ₹40/set
```

*Contact bar (for walk-in services):*
```
[ 📞 Call ]  [ 💬 WhatsApp ]  [ 📍 Directions ]
```

Contact buttons use deep links — no backend:
```javascript
Call:       window.location.href = `tel:${shop.phone}`
WhatsApp:   window.open(`https://wa.me/${shop.phone}?text=Hi, I need a service`)
Directions: window.open(`https://maps.google.com/?q=${shop.lat},${shop.lng}`)
```

*Order form:* Same 4-step wizard as Home Owner — triggered by "Order Online" button.

**Design Notes:**
- Only enabled services shown (is_enabled = true in service_menu)
- If no non-print services enabled, "Other Services" section hidden
- Map pin only shown if lat/lng is set
- Contact bar always visible for print shops

---

### 5.13 Screen 14 — Customer Feedback Form (`/feedback/:job-id`)

**Purpose:** Let the customer rate their experience after delivery. Simple, fast, non-intimidating.

**Access:** Public URL, valid for 7 days after job marked delivered. Expired links show a friendly "This feedback link has expired" message.

**Header:**
- "How was your print? 🖨️"
- Job reference: #INK-0042 · [Society Name]
- Owner first name: "Printed by Zaheer"

**Form:**

*Question 1 — On-time delivery (large thumb buttons):*
```
Was it delivered on time?
[ 👍 Yes ]   [ 👎 No ]
```

*Question 2 — Print quality (large thumb buttons):*
```
Was the print quality good?
[ 👍 Yes ]   [ 👎 No ]
```

*Question 3 — Overall rating (large star tap targets):*
```
Overall experience
⭐ ⭐ ⭐ ⭐ ⭐
(tap a star)
```

*Question 4 — Optional comment:*
```
Anything to add? (optional)
[ Text area — max 200 characters ]
```

**Submit button:** "Submit Feedback →"

**Post-submit state:**
- "Thank you! Your feedback helps keep the service great 🙏"
- No redirect — stays on same page with success state

**Design notes:**
- All tap targets minimum 52px height (elder-friendly)
- Star rating uses large, well-spaced stars (min 40px each)
- No mandatory fields except at least one star rating
- No login required

---

### 5.14 Screen 11 (Owner) — Feedback Dashboard (`/dashboard/feedback`)

**Purpose:** Let the Owner see how customers rate their service, privately and in detail.

**Summary card:**
- Average star rating (large, prominent)
- Total ratings received
- On-time delivery score: "92% on time"
- Print quality score: "96% good quality"

**Rating trend:** Simple bar chart — average rating per week for last 8 weeks

**Individual feedback list:**
- Per job: job ID, date, star rating, on-time 👍/👎, quality 👍/👎
- Comment shown if provided (no customer name — anonymous)
- Sorted newest first

**Empty state:** "No feedback yet. Once customers rate their orders, you'll see it here."

**Bottom navigation:** Jobs · Earnings · Feedback · Settings (4 tabs when feedback feature active)

---

**Purpose:** Reassure the Customer their order was received. Show payment instructions.

**Content:**
- Large success icon / animation
- Job ID (e.g., #INK-0042)
- "Your order has been placed!"
- Order summary (document, type, copies, amount)
- Payment instructions:
  - UPI: Show QR code + UPI ID + amount
  - Cash: "Pay ₹[amount] when [Owner name] delivers your printout"
- Contact: "Questions? Call [Owner name]: [phone]"

---

### 5.11 Screen 13 — Platform Admin (`/admin`)

**Access:** Hardcoded admin credentials (Phase 1). Auth guard on route.

**Sections:**

*Overview Stats*
- Total registered societies
- Total jobs today / this month
- Total GMV (gross merchandise value)
- Platform commission (when enabled)

*Shop Management*
- List all shops: Owner name, society, city, status, jobs this month
- Actions: View details, Deactivate, Reactivate

*Society Registry*
- All societies registered on platform
- Prevent duplicates, manage canonical names

*Platform Defaults*
- Edit default B&W rate, Colour rate, Delivery fee
- These pre-fill on new Owner registration

---

## 6. Database Schema (Supabase)

### 6.1 Tables

```sql
-- Countries (config table)
countries (
  code          TEXT PRIMARY KEY,   -- 'IN', 'US', 'GB'
  name          TEXT,
  currency_code TEXT,               -- 'INR', 'USD', 'GBP'
  currency_symbol TEXT,             -- '₹', '$', '£'
  postal_code_label TEXT,           -- 'Pincode', 'ZIP Code', 'Postcode'
  flat_label    TEXT,               -- 'Flat', 'Unit', 'Apt'
  society_label TEXT                -- 'Society', 'Condo', 'Block of Flats'
)

-- Societies
societies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,      -- URL-safe name
  city          TEXT,
  state         TEXT,
  postal_code   TEXT NOT NULL,
  country_code  TEXT REFERENCES countries(code) DEFAULT 'IN',
  created_at    TIMESTAMPTZ DEFAULT now()
)

-- Owners
owners (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id),
  name          TEXT NOT NULL,
  phone         TEXT,
  flat_number   TEXT,                                -- Home Owner only
  society_id    UUID REFERENCES societies(id),       -- Home Owner only (UNIQUE scoped to 'home')
  shop_name     TEXT,
  provider_type TEXT DEFAULT 'home',                 -- 'home' | 'shop'
  -- Print Shop fields (NULL for home owners)
  shop_address  TEXT,
  locality      TEXT,                                -- e.g. 'Tarnaka', 'Malkajgiri'
  landmark      TEXT,                                -- e.g. 'Near Metro Station' (display only)
  lat           NUMERIC(10,7),                       -- for map pin (both types, optional for home)
  lng           NUMERIC(10,7),
  delivery_radius INTEGER,                           -- metres (Phase 2)
  delivery_by   TEXT,                                -- 'self' | 'staff' | 'thirdparty'
  gst_number    TEXT,                                -- optional
  status        TEXT DEFAULT 'active',               -- 'active', 'paused', 'inactive'
  bw_rate       INTEGER NOT NULL DEFAULT 200,        -- paise (₹2.00 home / ₹3.00 shop)
  color_rate    INTEGER NOT NULL DEFAULT 500,        -- paise (₹5.00 home / ₹8.00 shop)
  delivery_fee  INTEGER DEFAULT 800,                 -- flat fee for home owners (paise)
  upi_id        TEXT,
  accept_cash   BOOLEAN DEFAULT true,
  country_code  TEXT REFERENCES countries(code) DEFAULT 'IN',
  -- Availability System fields
  manual_state          TEXT DEFAULT 'OFF',          -- 'ON' | 'OFF'
  system_override       TEXT DEFAULT 'NONE',         -- 'NONE' | 'FORCED_OFF'
  override_expires_at   TIMESTAMPTZ,
  active_job_count      INTEGER DEFAULT 0,
  max_active_jobs       INTEGER DEFAULT 3,           -- 3 for home, 10 for shop (owner sets)
  reliability_score     NUMERIC(5,2) DEFAULT 100.00,
  total_jobs_received   INTEGER DEFAULT 0,
  total_jobs_accepted   INTEGER DEFAULT 0,
  total_jobs_delivered  INTEGER DEFAULT 0,
  last_toggle_at        TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
)

-- Delivery Fee Tiers (Print Shops only — distance-based)
delivery_fee_tiers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID REFERENCES owners(id) ON DELETE CASCADE,
  max_km      NUMERIC(4,1) NOT NULL,                 -- e.g. 1.0, 2.0, 3.0
  fee         INTEGER NOT NULL                       -- paise
)

-- Availability Schedules
availability_schedules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID REFERENCES owners(id) ON DELETE CASCADE,
  day_of_week   INTEGER NOT NULL,                      -- 0=Sun, 1=Mon ... 6=Sat
  start_time    TIME NOT NULL,                         -- e.g. '07:00:00'
  end_time      TIME NOT NULL,                         -- e.g. '09:00:00'
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
)

-- Missed Jobs Log (for reliability scoring + override trigger)
missed_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        UUID REFERENCES jobs(id),
  owner_id      UUID REFERENCES owners(id),
  missed_at     TIMESTAMPTZ DEFAULT now(),
  reason        TEXT                                   -- 'sla_expired' | 'manual_cancel'
)

-- Service Menu (Print Shops only — display only, not used in job logic)
service_menu (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID REFERENCES owners(id) ON DELETE CASCADE,
  service_code  TEXT NOT NULL,      -- 'scan' | 'photocopy' | 'binding' | 'lamination' | 'passport_photo'
  is_enabled    BOOLEAN DEFAULT false,
  display_price TEXT,               -- free text e.g. "₹10/page" | "From ₹20" | "Call for price"
  UNIQUE (owner_id, service_code)
)

-- Jobs
jobs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number     TEXT UNIQUE NOT NULL,    -- 'INK-0042'
  owner_id       UUID REFERENCES owners(id),
  society_id     UUID REFERENCES societies(id),
  customer_name  TEXT NOT NULL,
  customer_flat  TEXT NOT NULL,
  customer_phone TEXT,
  file_path      TEXT,                    -- Supabase storage path
  file_name      TEXT,
  page_count     INTEGER,
  print_type     TEXT NOT NULL,           -- 'bw' | 'color'
  paper_size     TEXT DEFAULT 'A4',       -- 'A4' | 'Letter' | 'Legal' | 'A3'
  copies         INTEGER DEFAULT 1,
  total_amount   INTEGER NOT NULL,        -- paise
  delivery_fee   INTEGER DEFAULT 0,       -- paise
  payment_method TEXT NOT NULL,           -- 'upi' | 'cash'
  payment_status TEXT DEFAULT 'pending',  -- 'pending' | 'paid'
  status         TEXT DEFAULT 'submitted',
  -- SLA fields
  sla_deadline            TIMESTAMPTZ,
  sla_breached            BOOLEAN DEFAULT false,
  locked_effective_state  TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
)

-- Feedback
feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID UNIQUE REFERENCES jobs(id),   -- UNIQUE: one feedback per job
  owner_id        UUID REFERENCES owners(id),
  society_id      UUID REFERENCES societies(id),
  on_time         BOOLEAN,                           -- true = yes, false = no
  quality_good    BOOLEAN,                           -- true = yes, false = no
  star_rating     INTEGER CHECK (star_rating BETWEEN 1 AND 5),
  comment         TEXT,                              -- optional, max 200 chars
  created_at      TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ                        -- 7 days after job delivered_at
)

-- Push Subscriptions
push_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID REFERENCES owners(id) ON DELETE CASCADE,
  subscription  TEXT NOT NULL,    -- full JSON subscription object from browser
  device        TEXT,             -- user agent string for debugging
  created_at    TIMESTAMPTZ DEFAULT now()
)

-- Platform Config
platform_config (
  key           TEXT PRIMARY KEY,
  value         TEXT,
  updated_at    TIMESTAMPTZ DEFAULT now()
)
-- Rows: 'default_bw_rate_home', 'default_color_rate_home', 'default_delivery_fee_home',
--       'default_bw_rate_shop', 'default_color_rate_shop',
--       'default_scan_rate_home', 'default_scan_rate_shop',
--       'default_photocopy_rate_home', 'default_photocopy_rate_shop',
--       'default_binding_rate_home', 'default_binding_rate_shop',
--       'default_lamination_rate_home', 'default_lamination_rate_shop',
--       'default_passport_photo_rate_home', 'default_passport_photo_rate_shop',
--       'default_delivery_radius_shop', 'default_max_jobs_home', 'default_max_jobs_shop',
--       'commission_percent', 'subscription_fee', 'subscription_active',
--       'sla_acceptance_minutes', 'override_cooldown_minutes',
--       'override_missed_job_threshold', 'reliability_override_threshold'
```

### 6.2 Row Level Security (RLS)

```
owners: Owner can read/update own row only
jobs: Owner can read/update jobs where owner_id = auth.uid()
jobs: INSERT allowed for anonymous (customers place orders without login)
service_menu: Owner can full CRUD own service menu (print shops only)
service_menu: Public read — customers see services on shop profile
feedback: INSERT allowed for anonymous (customers submit without login)
feedback: Owner can read feedback where owner_id = auth.uid()
feedback: No updates or deletes allowed after submission
push_subscriptions: Owner can INSERT / DELETE own subscriptions only
push_subscriptions: No public read — Edge Function uses service role key
availability_schedules: Owner can full CRUD own schedules only
missed_jobs: Owner can read own missed jobs — INSERT via service role only
delivery_fee_tiers: Owner can full CRUD own tiers — public read for customers
societies: Public read, authenticated write only
platform_config: Admin only (via service role key)
```

**UNIQUE constraint for Home Owners:**
```sql
-- Only one home owner per society (print shops exempt)
CREATE UNIQUE INDEX unique_home_owner_per_society
  ON owners (society_id)
  WHERE provider_type = 'home' AND status != 'inactive';
```

**Computed fields on `owners` (derived from `feedback` table):**
```sql
avg_star_rating    -- AVG(star_rating) from feedback WHERE owner_id
total_ratings      -- COUNT(*) from feedback WHERE owner_id
on_time_pct        -- AVG(on_time::int) * 100
quality_pct        -- AVG(quality_good::int) * 100
```
These can be computed via a Supabase view or materialised on the `owners` row and updated on each feedback insert via a Postgres trigger.

### 6.3 Storage Buckets

```
job-files/
  {job_id}/
    {original_filename}
```

Bucket policy: Owner can download files for their own jobs only.

**File deletion rule:** Files are deleted on **two** status transitions — not just delivery:

| Job status | File deleted? | Reason |
|---|---|---|
| `delivered` | ✅ Yes | Job complete, file no longer needed |
| `cancelled` | ✅ Yes | Job abandoned, no reason to retain |
| All other statuses | ❌ No | Owner may still need to download |

**Shared utility function (`/src/lib/storage.js`):**
```javascript
export const deleteJobFile = async (jobId) => {
  const { data: job } = await supabase
    .from('jobs')
    .select('file_path')
    .eq('id', jobId)
    .single()

  if (job?.file_path) {
    await supabase.storage
      .from('job-files')
      .remove([job.file_path])
  }
}

// Call on both transitions:
// → Mark as Delivered: await deleteJobFile(jobId)
// → Cancel job:        await deleteJobFile(jobId)
```

**Why this matters:** With auto-delete on both delivered and cancelled, files only exist for the hours between upload and resolution. Storage stays close to zero regardless of job volume.

---

## 7. Tech Stack

### 7.1 Frontend

| Tool | Purpose |
|---|---|
| React 18 + Vite | App framework |
| React Router v6 | Client-side routing |
| Tailwind CSS | Styling |
| react-i18next | Internationalisation |
| Fuse.js | Fuzzy search for society matching |
| react-dropzone | File upload UI |
| pdf-lib or pdfjs-dist | Client-side PDF page count detection |
| lucide-react | Icons |
| sonner | Toast notifications |
| vite-plugin-pwa | PWA manifest + service worker generation |
| web-push | VAPID push notification sending (used in Supabase Edge Function) |
| leaflet + react-leaflet | Map display for print shop search (Phase 1) |

### 7.2 Backend

| Tool | Purpose |
|---|---|
| Supabase Auth | Owner authentication (email/password) |
| Supabase Database | PostgreSQL — all data |
| Supabase Storage | File uploads (PDFs, images) |
| Supabase Edge Functions | Push notifications + file cleanup |
| Supabase Realtime | Live job queue updates for Owner dashboard |

### 7.3 Supabase Project Strategy

InkNeighbour and WellNest are both on Supabase free tier. Each app gets its **own separate Supabase project** — never combined into one.

```
supabase-project-1: inkneighbour   ← this app
supabase-project-2: wellnest       ← separate app
```

**Why separate projects:**
- Free tier gives 2 active projects — use both
- Mixing apps in one project creates shared auth tables, messy RLS, and debugging nightmares
- Each app has clean isolation — schema, storage, auth users, edge functions
- If one app is paused or deleted, the other is unaffected

**Free tier limits per project:**

| Resource | Free limit | InkNeighbour usage |
|---|---|---|
| Database | 500MB | ~20MB for 10,000 jobs — fine |
| Storage | 1GB | Near zero with auto-delete on delivered + cancelled |
| Bandwidth | 5GB/month | Safe until 50+ active societies |
| Edge Functions | 500,000/month | Fine for push notifications at this scale |
| Auth users | 50,000 | Owners only — no concern |

**Storage stays safe** because files are deleted on both `delivered` and `cancelled` status. Files only exist for hours — never accumulate.

### 7.3 Hosting & DevOps

| Tool | Purpose |
|---|---|
| Vercel | Frontend hosting + CD |
| GitHub | Source control |
| Custom subdomain | inkneighbour.zakapedia.in via CNAME on Vercel |

### 7.4 Environment Variables

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_URL=https://inkneighbour.zakapedia.in
VITE_DEFAULT_COUNTRY=IN
VITE_ADMIN_EMAIL=zaheer@zakapedia.in

# Push Notifications — VAPID keys (generate with: npx web-push generate-vapid-keys)
VITE_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=zaheer@zakapedia.in

# Phase 2 — WATI WhatsApp (uncomment when ready)
# WATI_TOKEN=
# WATI_INSTANCE=

# Phase 3 — Twilio SMS fallback (uncomment when ready)
# TWILIO_ACCOUNT_SID=
# TWILIO_AUTH_TOKEN=
# TWILIO_FROM_NUMBER=
```

---

## 8. UI Design System

### 8.1 Design Principles

1. **Elder-friendly first** — large text, large buttons, high contrast
2. **Warm and welcoming** — not corporate, not cold
3. **Mobile-first** — 90% of users will be on smartphones
4. **Encouraging** — celebrate progress with friendly copy and micro-animations
5. **Minimal cognitive load** — one decision at a time, wizard patterns for multi-step flows

### 8.2 Colour Palette

```css
--ink:           #0A0A0F;   /* Near-black — primary text */
--ink2:          #1A1A2E;   /* Deep navy — hero gradients */
--surface:       #FFFFFF;   /* Card backgrounds */
--background:    #F4F3FF;   /* Soft lavender-white page background */
--orange:        #FF6B35;   /* Primary CTA — vibrant orange */
--orange2:       #FF8C61;   /* Orange light — gradient end */
--violet:        #7C3AED;   /* Secondary actions, active states */
--violet2:       #A78BFA;   /* Violet light */
--sky:           #06B6D4;   /* Tertiary accent */
--green:         #10B981;   /* Success, delivered, live */
--amber:         #F59E0B;   /* Pending, warning */
--red:           #EF4444;   /* Error, cancelled */
--muted:         #6B7280;   /* Secondary text */
--border:        #E5E7EB;   /* Subtle borders */
```

### 8.3 Typography

```css
--font-display: 'Syne', sans-serif;              /* Headings — bold, geometric, modern */
--font-body:    'Plus Jakarta Sans', sans-serif; /* Body — clean, friendly, readable */

font-size base:     18px              /* Larger than standard for elder-friendliness */
font-size heading:  24px–40px
font-size caption:  14px (minimum)
line-height:        1.6
font-weight display: 800
font-weight body:    400–600
```

Google Font import: `Syne:wght@700;800` + `Plus+Jakarta+Sans:wght@400;500;600;700;800`

### 8.4 Spacing & Sizing

```css
--radius:        12px;      /* Default border radius */
--radius-lg:     16px–20px; /* Cards and large containers */
--radius-btn:    14px;      /* Buttons */
--radius-pill:   100px;     /* Badges and chips */

Button min-height:   52px   /* Elder-friendly tap target */
Input min-height:    52px
Input border-radius: 12px
Icon size:           24px (inline), 48–52px (feature icons in rounded containers)
Card padding:        16px–20px
Section spacing:     32px–48px
```

### 8.5 Hero & Background Patterns

All hero sections use dark gradient backgrounds with radial glow overlays:

```css
/* Page hero */
background: linear-gradient(160deg, #1A1A2E 0%, #2D1B69 100%);

/* Decorative glow (top-right) */
background: radial-gradient(circle, rgba(124,58,237,0.4) 0%, transparent 70%);

/* Decorative glow (bottom-left) */  
background: radial-gradient(circle, rgba(255,107,53,0.3) 0%, transparent 70%);
```

### 8.6 Component Patterns

**Primary Button (Orange):**
```
Background: linear-gradient(135deg, #FF6B35, #FF8C61)
Box-shadow: 0 4px 16px rgba(255,107,53,0.35)
Text: white, 16px, font-weight: 700
Height: 52px, border-radius: 14px
```

**Secondary Button (Violet):**
```
Background: linear-gradient(135deg, #7C3AED, #9333EA)
Box-shadow: 0 4px 16px rgba(124,58,237,0.35)
```

**Job Status Badges (pill shape, 100px radius):**
```
submitted/pending → #FEF3C7 background, #92400E text
printing          → #DBEAFE background, #1E40AF text
delivered         → #D1FAE5 background, #065F46 text
cancelled         → #F3F4F6 background, #6B7280 text
```

**Upload Zone:**
```
Border: 2px dashed --border
Background: --background (#F4F3FF)
Icon container: 52×52px, rounded-14, gradient orange background
On hover: orange border, light orange background tint
Text: large, encouraging ("Tap to upload your document 📄")
```

**Price Breakdown Card:**
```
Background: linear-gradient(135deg, #1A1A2E, #2D1B69)
Decorative glow: orange radial in top-right corner
Line items: rgba(255,255,255,0.6) text
Total amount: Syne font, 1.5rem, #FF8C61 (orange2)
```

**Society / Shop Cards:**
```
Featured card: dark gradient background (ink2 → violet2)
Regular card:  white background, 1.5px border, 16px radius
Shadow:        0 2px 8px rgba(0,0,0,0.04)
```

**Bottom Navigation (Owner app):**
```
3 items: Jobs · Earnings · Settings
Active item: violet color
Active indicator: small violet dot below icon
```

---

## 9. Routing & Navigation

```
/                          Landing page
/find                      Search results (list + map toggle)
/register                  Registration step 1 (provider type selector)
/register/location         Registration step 2 (society or address)
/register/rates            Registration step 3 (rates + payment)
/register/success          Shop live confirmation
/login                     Owner login
/dashboard                 Owner dashboard (jobs) [protected]
/dashboard/earnings        Owner earnings [protected]
/dashboard/settings        Owner settings [protected]
/dashboard/feedback        Owner feedback [protected]
/dashboard/availability    Owner schedule [protected]
/admin                     Platform admin [admin only]
/:slug                     Provider shop page (dynamic — both types)
/:slug/confirm/:jobId      Order confirmation (dynamic)
/feedback/:jobId           Customer feedback form (time-limited)
```

Route protection:
- `/dashboard/*` → requires Supabase auth session
- `/admin` → requires admin email match
- All other routes → public

---

## 10. Key User Flows (Detailed)

### 10.1 Owner Registration Flow

```
1. Landing page → "Register Your Printer"
2. Step 1: Select provider type (🏠 Home / 🏪 Shop)
           Fill name, phone, email, password, country
           Home Owner: add flat number
           Print Shop: add shop name, address, optional GST
3. Step 2: Location
           Home Owner: enter postal code → select/add society → fuzzy match check
           Print Shop: enter full address → set delivery radius → select delivery method
4. Step 3: Rates, payment, active job limit
           Home Owner: flat delivery fee, rates, UPI, cash toggle
           Print Shop: distance-based fee tiers, rates, UPI, cash toggle, operating hours
5. Submit → Supabase creates: auth user + owner row + society row (home) / delivery_fee_tiers (shop)
6. Redirect to /register/success with share link
7. WhatsApp share button pre-populated
8. "Go to Dashboard →"
```

### 10.2 Customer Order Flow

```
1. Open society link (/:slug) OR find via search
2. See shop header: name, rates, open status
3. Enter: name, flat number, phone
4. Upload PDF/image (drag or tap)
   → Page count auto-detected
5. Select: B&W or Colour, paper size, copies
6. See price breakdown (calculated live)
7. Select payment method: UPI or Cash
8. "Place Order" → job created in Supabase
9. Redirect to /[slug]/confirm/[jobId]
10. See confirmation + QR code (if UPI)
```

### 10.3 Owner Fulfils a Job

```
1. New job → toast notification + badge on dashboard
2. Open job card → review details
3. "Download File" → file downloads from Supabase Storage
4. Open in system print dialog → Ctrl+P → print
5. "Mark as Printing" → status updates
6. Deliver printout to customer's flat
7. "Mark as Delivered" → status updates → file auto-deleted from storage
8. Job moves to Delivered tab

If job cannot be fulfilled:
7b. "Cancel Job" → status → cancelled → file auto-deleted from storage
8b. Job moves to Cancelled tab
```

---

## 11. Notifications & WhatsApp Integration

### 11.1 Phase 1 — WhatsApp Links + Browser Notifications

No API required. Uses `wa.me` pre-filled links opened by the user. Owner taps to send — not automatic.

**Browser notifications:**

| Event | Who notified | Method |
|---|---|---|
| New job placed | Owner | Browser notification (if permission granted) |
| New feedback received | Owner | Badge on Feedback tab in dashboard |

**WhatsApp `wa.me` touchpoints (4 in Phase 1):**

| Touchpoint | Who triggers | Pre-filled message |
|---|---|---|
| Shop launch | Owner | Shares shop link to society WhatsApp group |
| Order placed | Customer | Sends order summary to owner's number |
| Job delivered | Owner | Notifies customer printout is at their door |
| Feedback request | Owner | Sends feedback link to customer after delivery |

**`wa.me` link format:**
```
https://wa.me/91{phone}?text={encoded_message}
```

**Utility module — `/src/notifications/whatsapp.js` (Phase 1):**
```javascript
export const waLink = (phone, message) => {
  const encoded = encodeURIComponent(message)
  return `https://wa.me/${phone}?text=${encoded}`
}

export const messages = {
  shopLaunch: (shopName, shopUrl, bwRate, colorRate, deliveryFee) =>
    `Hi neighbours! 🖨️ I've set up a home print shop for ${shopName}.\n\nSend me your documents here:\n${shopUrl}\n\nB&W ₹${bwRate}/page · Colour ₹${colorRate}/page · Delivery ₹${deliveryFee}\n\nPowered by InkNeighbour`,

  orderPlaced: (jobId, ownerName, pages, type, copies, amount) =>
    `Hi ${ownerName}! I just placed a print order.\n\nOrder: #${jobId}\n${pages} pages · ${type} · ${copies} ${copies === 1 ? 'copy' : 'copies'}\nTotal: ₹${amount}\n\nPlease check your InkNeighbour dashboard.`,

  jobDelivered: (customerName, jobId) =>
    `Hi ${customerName}! Your printout for order #${jobId} is ready.\n\nI'm dropping it at your flat now. 🚪\n\nPlease pay if you haven't already. Thank you!`,

  feedbackRequest: (customerName, jobId, feedbackUrl) =>
    `Hi ${customerName}! Hope your print was good 🖨️\n\nMind giving quick feedback for order #${jobId}?\n${feedbackUrl}\n\n(Link valid for 7 days)`
}
```

**Usage in components:**
```javascript
// On "Share on WhatsApp" button click
const link = waLink(
  ownerPhone,
  messages.shopLaunch(shopName, shopUrl, bwRate, colorRate, deliveryFee)
)
window.open(link, '_blank')
```

---

### 11.2 Phase 2 — WATI Automated Messages

When manual WhatsApp taps become impractical at 20+ active shops, replace with WATI automated templates.

**Provider:** WATI (wati.io) — WhatsApp Business Solution Provider
**Cost:** ₹2,499/month base + ~₹0.58 per business-initiated conversation (India)
**Setup:** Facebook Business Manager + WhatsApp Business Account approval (2–7 days)

**Automated triggers via Supabase Edge Functions:**

| Event | To | Template name | Trigger |
|---|---|---|---|
| Order placed | Customer | `order_confirmation` | Job status → `submitted` |
| Order accepted | Customer | `order_accepted` | Job status → `accepted` |
| Job delivered | Customer | `order_delivered` | Job status → `delivered` |
| Feedback request | Customer | `feedback_request` | 24hrs after `delivered` |
| New job | Owner | `new_job_alert` | Job status → `submitted` (if browser notification missed) |

**Pre-approved message template examples:**
```
order_confirmation:
"Hello {{1}}, your print order {{2}} has been placed at 
{{3}} Print Shop. {{4}} pages, {{5}}, ₹{{6}} total. 
We'll notify you when it's ready."

order_delivered:
"Hi {{1}}! Your printout for order {{2}} is at your door. 
{{3}} Please pay ₹{{4}} if you haven't already. Thank you!"

feedback_request:
"Hi {{1}}! How was your print from {{2}}? 
Share quick feedback here: {{3}} (valid 7 days)"
```

**Supabase Edge Function — `/supabase/functions/notify/index.ts`:**
```typescript
const sendWATI = async (phone: string, template: string, params: string[]) => {
  const res = await fetch(
    `https://live-server-${WATI_INSTANCE}.wati.io/api/v1/sendTemplateMessage`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WATI_TOKEN}`
      },
      body: JSON.stringify({
        whatsappNumber: `91${phone}`,
        template_name: template,
        broadcast_name: template,
        parameters: params.map((value, index) => ({
          name: String(index + 1),
          value
        }))
      })
    }
  )
  return res.json()
}
```

**Environment variables needed for Phase 2:**
```env
WATI_TOKEN=
WATI_INSTANCE=
```

---

### 11.3 Phase 3 — SMS Fallback (Non-WhatsApp Regions)

For countries where WhatsApp is not dominant (US, Canada, Australia):

**Provider:** Twilio SMS
**Cost:** ~$0.0079 per SMS (US)
**Integration:** Same Supabase Edge Function, routed by `country_code`

```typescript
// In notify Edge Function
if (countryConfig.notificationProvider === 'whatsapp') {
  await sendWATI(phone, template, params)
} else {
  await sendTwilioSMS(phone, message)
}
```

**Environment variables needed for Phase 3:**
```env
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
```

---

## 12. PWA & Push Notifications

### 12.1 PWA Setup (Phase 1 — Free)

Convert the React + Vite app into an installable PWA using `vite-plugin-pwa`.

**vite.config.js:**
```javascript
import { VitePWA } from 'vite-plugin-pwa'

export default {
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'InkNeighbour',
        short_name: 'InkNeighbour',
        description: 'Print it. Drop it. Done.',
        theme_color: '#FF6B35',
        background_color: '#F4F3FF',
        display: 'standalone',        // ← removes browser chrome, feels native
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',   // always try network, fall back to cache
            options: { cacheName: 'supabase-cache' }
          }
        ]
      }
    })
  ]
}
```

**Android install experience:** Chrome auto-shows "Add to Home Screen" banner after second visit.

**iOS install — detect Safari and show manual instructions:**
```javascript
// /src/components/IOSInstallBanner.jsx
const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase())
const isInstalled = window.matchMedia('(display-mode: standalone)').matches

if (isIOS && !isInstalled) {
  // Show banner: "Tap Share → Add to Home Screen to install InkNeighbour"
}
```

---

### 12.2 Push Notifications (Phase 1 — Free)

**Cost:** ₹0 forever. Google and Apple deliver push notifications at no charge.

**Step 1 — Generate VAPID keys (one time):**
```bash
npx web-push generate-vapid-keys
# Paste output into .env
```

**Step 2 — Service Worker (`/public/sw.js`):**
```javascript
// Receive push → show notification
self.addEventListener('push', (event) => {
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      data: { url: data.url },
      actions: [
        { action: 'open',    title: 'View Job' },
        { action: 'dismiss', title: 'Dismiss'  }
      ]
    })
  )
})

// Tap notification → open dashboard
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'open' || !event.action) {
    event.waitUntil(clients.openWindow(event.notification.data.url))
  }
})
```

**Step 3 — Subscribe Owner on login (`/src/notifications/browser.js`):**
```javascript
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

export const subscribeToPush = async (ownerId) => {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: VAPID_PUBLIC_KEY
  })

  // Save to Supabase
  await supabase.from('push_subscriptions').upsert({
    owner_id: ownerId,
    subscription: JSON.stringify(subscription),
    device: navigator.userAgent
  })

  return subscription
}
```

**Step 4 — Send from Supabase Edge Function (`/supabase/functions/notify/index.ts`):**
```typescript
import webpush from 'npm:web-push'

webpush.setVapidDetails(
  `mailto:${Deno.env.get('VAPID_EMAIL')}`,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
)

export const sendPushToOwner = async (ownerId: string, payload: object) => {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('owner_id', ownerId)

  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        JSON.parse(sub.subscription),
        JSON.stringify(payload)
      )
    } catch (err: any) {
      // Subscription expired — clean up stale record
      if (err.statusCode === 410) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('subscription', sub.subscription)
      }
    }
  }
}
```

---

### 12.3 Push Notification Events

| Event | To | Title | Body |
|---|---|---|---|
| New job submitted | Owner | "New print job! 🖨️" | "Priya · Flat 304 · 4 pages · ₹20" |
| Job cancelled by customer | Owner | "Job cancelled" | "Order #INK-0042 was cancelled" |
| New feedback received | Owner | "New feedback ⭐" | "Priya rated your service 5 stars" |
| Low rating alert | Admin | "Shop flagged ⚠️" | "Green Valley Ph1 dropped below 3.0" |

Customer notifications are handled via WhatsApp links — customers don't log in so there is no push subscription to store.

---

### 12.4 Platform Support

| Platform | Push works? | Notes |
|---|---|---|
| Android Chrome | ✅ Yes | Works even with browser closed |
| Android Samsung Browser | ✅ Yes | Full support |
| Desktop Chrome / Edge | ✅ Yes | Full support |
| iPhone Safari (iOS 16.4+) | ⚠️ Partial | Must be installed to home screen first |
| iPhone Chrome | ❌ No | Apple blocks third-party browsers from push |
| Older iPhones (< iOS 16.4) | ❌ No | No web push support |

For India (~95% Android users), push notifications work fully for the vast majority of Owners.

---

## 13. SEO & Discoverability

Each society shop page (`/:slug`) should have:
```html
<title>[Society Name] Print Shop — InkNeighbour</title>
<meta name="description" content="Get documents printed by your neighbour in [Society Name], [City]. Upload, print, delivered to your door.">
<meta property="og:title" content="...">
<meta property="og:image" content="...">  <!-- Generic InkNeighbour OG image -->
```

Sitemap auto-generated from active society slugs.

---

## 13. Error Handling

| Scenario | Behaviour |
|---|---|
| Society already registered | Clear message + show existing owner's first name |
| File upload fails | Friendly retry message |
| File too large (>10MB) | "Your file is too large. Please compress it and try again." |
| Page count detection fails | Show "We couldn't detect the page count. The owner will confirm before printing." |
| Shop is paused | Customer sees: "This shop is temporarily closed. Try again later." |
| Network error | Toast with retry option |
| Invalid slug | 404 page with link back to home |

---

## 14. Phase Roadmap

### Phase 1 — MVP (Build Now)
- [ ] Landing page with locality/pincode search
- [ ] Provider type selector — Home Owner vs Print Shop
- [ ] Owner registration (3 steps — shared form, conditional fields)
- [ ] Society creation with fuzzy match (Home Owners)
- [ ] Locality + landmark entry for Print Shops
- [ ] Map pin setup — Nominatim geocoding + Leaflet pin (both provider types)
- [ ] Owner-configurable active job limit
- [ ] Service display menu for Print Shops (display-only, free text pricing)
- [ ] Owner dashboard (job queue, tabs, actions)
- [ ] Earnings summary
- [ ] Customer order form — print only (B&W/Colour, copies, paper size, file upload)
- [ ] Simple price calculation (pages × copies × rate + delivery)
- [ ] Order confirmation with UPI QR
- [ ] Print shop profile page — rich layout with service display + contact buttons + map pin
- [ ] Home owner profile page — simple layout
- [ ] Customer feedback form (`/feedback/:job-id`)
- [ ] Owner feedback dashboard tab
- [ ] Star rating on search results and shop profile
- [ ] Admin flagging for low-rated shops
- [ ] Search results — list view with locality filter
- [ ] Provider type badges in search results
- [ ] Availability system — manual toggle + pre-commitment prompt
- [ ] Availability system — schedule configuration
- [ ] Availability system — SLA enforcement
- [ ] Availability system — system override + reliability score
- [ ] Platform admin panel (basic)
- [ ] File auto-delete on delivery AND cancellation
- [ ] PWA setup + iOS install banner
- [ ] Push notifications (VAPID + Supabase Edge Function)
- [ ] Global-ready architecture (i18n, currency, country config)

### Phase 2 — Growth
- [ ] Map view on search results (multiple pins — Leaflet + OSM)
- [ ] Locality-based filtering + distance sorting
- [ ] WATI WhatsApp automated messages
- [ ] Real-time job status (Supabase Realtime)
- [ ] Customer order tracking page
- [ ] Owner subscription billing (Razorpay Subscriptions)
- [ ] Owner response to feedback
- [ ] Mappls integration for better India accuracy

### Phase 2 — Growth
- [ ] WATI WhatsApp automated messages (order confirmation, delivery, feedback request)
- [ ] Real-time job status (Supabase Realtime)
- [ ] Customer order tracking page
- [ ] Owner subscription billing (Razorpay Subscriptions)
- [ ] Google Places API for society autocomplete
- [ ] Owner response to feedback (reply to comments)

### Phase 3 — Scale
- [ ] Stripe payment integration (global online payments)
- [ ] Razorpay Route commission split (India)
- [ ] Twilio SMS fallback for non-WhatsApp regions
- [ ] Multi-language UI (Hindi, Telugu, Tamil)
- [ ] Capacitor wrapper for Play Store + App Store listing
- [ ] Desktop companion app for one-click printing
- [ ] Analytics dashboard for Admin

---

## 15. File Structure (Suggested)

```
inkneighbour/
├── public/
│   ├── favicon.ico
│   ├── icon-192.png           ← PWA icon
│   ├── icon-512.png           ← PWA icon (maskable)
│   ├── badge-72.png           ← Push notification badge
│   └── sw.js                  ← Service worker (push + offline)
├── src/
│   ├── components/
│   │   ├── ui/              ← Reusable: Button, Input, Badge, Card, Modal
│   │   ├── JobCard.jsx
│   │   ├── SocietySearch.jsx
│   │   ├── UploadZone.jsx
│   │   ├── PriceBreakdown.jsx
│   │   ├── StarRating.jsx
│   │   ├── IOSInstallBanner.jsx
│   │   ├── ProviderTypeSelector.jsx      ← Home vs Shop selector on registration
│   │   ├── ProviderCard.jsx              ← Unified card for both types in search results
│   │   ├── ShopLocationMap.jsx           ← Static Leaflet pin for shop profile + registration
│   │   ├── ServiceDisplayMenu.jsx        ← Display-only service list on print shop profile
│   │   └── UPIQRCode.jsx
│   ├── pages/
│   │   ├── Landing.jsx
│   │   ├── Find.jsx
│   │   ├── Register/
│   │   │   ├── Step1Details.jsx
│   │   │   ├── Step2Society.jsx
│   │   │   ├── Step3Rates.jsx
│   │   │   └── Success.jsx
│   │   ├── Login.jsx
│   │   ├── Dashboard/
│   │   │   ├── index.jsx      ← Jobs tab
│   │   │   ├── Earnings.jsx
│   │   │   ├── Feedback.jsx
│   │   │   ├── Availability.jsx
│   │   │   └── Settings.jsx
│   │   ├── ShopPage.jsx
│   │   ├── OrderConfirm.jsx
│   │   ├── FeedbackForm.jsx
│   │   └── Admin.jsx
│   ├── lib/
│   │   ├── supabase.js        ← Supabase client init
│   │   ├── countries.js       ← Country config (currency, labels)
│   │   ├── pricing.js         ← Price calculation utilities (pages × copies × rate + delivery)
│   │   ├── slugify.js         ← Society name → URL slug
│   │   ├── storage.js         ← deleteJobFile() — called on delivered + cancelled
│   │   ├── availability.js    ← getEffectiveState(), resolveNextAvailable()
│   │   └── fuzzyMatch.js      ← Fuse.js wrapper
│   ├── payments/
│   │   ├── index.js           ← Payment method router
│   │   ├── upi.js             ← UPI QR generation
│   │   ├── cash.js            ← Cash on delivery
│   │   └── stripe.js          ← Stubbed for Phase 2
│   ├── notifications/
│   │   ├── index.js           ← Notification method router (uses country config)
│   │   ├── whatsapp.js        ← wa.me link builder (Phase 1) + WATI API (Phase 2)
│   │   ├── browser.js         ← Browser push notifications
│   │   └── sms.js             ← Twilio SMS fallback (Phase 3)
│   ├── locales/
│   │   ├── en.json
│   │   └── hi.json            ← Hindi (Phase 2)
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useOwner.js
│   │   ├── useJobs.js
│   │   └── useAvailability.js ← effective state, toggle, schedule CRUD
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── supabase/
│   ├── functions/
│   │   └── notify/
│   │       └── index.ts       ← WATI / Twilio Edge Function (Phase 2)
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_feedback.sql               ← feedback table + trigger for owner rating
│   │   ├── 003_push_subscriptions.sql     ← push_subscriptions table
│   │   ├── 004_availability.sql           ← availability_schedules, missed_jobs, get_effective_state()
│   │   ├── 005_print_shop_owners.sql      ← provider_type, shop fields, delivery_fee_tiers, partial unique index
│   │   └── 006_service_menu.sql           ← service_menu display-only table (print shops)
│   └── seed.sql               ← Country config + platform defaults
├── .env.example
├── vite.config.js
├── tailwind.config.js
├── package.json
└── README.md
```

---

## 16. README Starter

```markdown
# InkNeighbour

> "Print it. Drop it. Done."

A platform for home printer owners in apartment complexes to offer
on-demand printing services to their neighbours.

## Live URL
https://inkneighbour.zakapedia.in

## Stack
- React 18 + Vite
- Supabase (Auth + DB + Storage)
- Tailwind CSS
- Deployed on Vercel

## Setup

1. Clone the repo
2. Copy `.env.example` to `.env` and fill in Supabase credentials
3. Run `npm install`
4. Run `npm run dev`

## Supabase Setup

1. Create a new Supabase project
2. Run `supabase/migrations/001_initial_schema.sql`
3. Run `supabase/seed.sql` for country config and default rates

## Deployment

Connect GitHub repo to Vercel.
Add custom domain: inkneighbour.zakapedia.in
Add CNAME record in domain registrar pointing to cname.vercel-dns.com
```

---

## 17. Out of Scope (Phase 1)

- Printer integration / direct print commands
- Real-time delivery tracking / maps
- Multiple owners per society
- Customer accounts / login
- Payment gateway / online payments
- Commission collection
- Native Android / iOS app (Capacitor in Phase 3)
- Multi-language UI (English only in Phase 1)

---

*Document maintained by Zaheer · Zakapedia · inkneighbour.zakapedia.in*  
*Last updated: April 2025*
