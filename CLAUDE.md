# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# CLAUDE.md — InkNeighbour

AI assistant guide for the InkNeighbour codebase. Read this before making any changes.

---

## Project Overview

**InkNeighbour** connects home printer owners ("Owners") in apartment complexes with neighbours ("Customers") for on-demand printing services. Owners register a shop, customers upload documents, and the owner prints and delivers within the building.

- **Live URL:** https://inkneighbour.zakapedia.in
- **Tagline:** "Print it. Drop it. Done."
- **Status:** Phase 1 — MVP in progress (source code committed and actively developed)
- **Stack:** React 18 + Vite · Supabase · Vercel

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router v6, Tailwind CSS |
| Backend | Supabase (PostgreSQL, Auth, Storage, Edge Functions) |
| Notifications | Browser Push (VAPID), WhatsApp `wa.me` links |
| i18n | react-i18next, native `Intl` APIs |
| Search | Fuse.js (fuzzy society name matching) |
| File upload | react-dropzone, pdfjs-dist (page count detection) |
| Icons | lucide-react |
| Toasts | sonner |
| PWA | vite-plugin-pwa |
| Testing | Vitest + Testing Library + jsdom |
| Hosting | Vercel (auto-deploy from main branch) |

---

## Development Commands

```bash
npm install           # Install dependencies
npm run dev           # Start dev server (http://localhost:5173)
npm run build         # Production build
npm run preview       # Preview production build locally
npm run lint          # ESLint (zero warnings enforced)

# Testing
npm test              # Run all tests once
npm run test:watch    # Watch mode
npm run test:ui       # Vitest browser UI
npm run test:coverage # Coverage report
```

---

## Testing

Tests live in `src/test/` mirroring the `src/` structure. The test runner is **Vitest** with `jsdom`.

**Test setup** (`src/test/setup.js`) globally mocks:
- `react-i18next` — `t(key)` returns the key itself (with `{{var}}` interpolation)
- `react-router-dom` — `useNavigate`, `useParams`, `useSearchParams`
- `../lib/supabase` — full chainable mock (auth, from, storage)
- `sonner` — toast methods
- `pdfjs-dist` — returns 3 pages by default
- `window.matchMedia`, `navigator.clipboard`

Write tests against the mocked Supabase from setup — don't re-mock it per test unless you need different resolved values. Override specific calls with `vi.mocked(...).mockResolvedValueOnce(...)`.

---

## Environment Variables

All prefixed with `VITE_` are exposed to the browser bundle. Keep secrets server-side only (Edge Functions).

```env
# Supabase (required)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# App config
VITE_APP_URL=https://inkneighbour.zakapedia.in
VITE_DEFAULT_COUNTRY=IN
VITE_ADMIN_EMAIL=info@zakapedia.in

# Push notifications (VAPID)
VITE_VAPID_PUBLIC_KEY=          # Public key — safe to expose
VAPID_PRIVATE_KEY=              # Private key — Edge Function only, never commit
VAPID_EMAIL=zaheer@zakapedia.in

# Phase 2 (not active yet)
# WATI_TOKEN=
# WATI_INSTANCE=

# Phase 3 (not active yet)
# TWILIO_ACCOUNT_SID=
# TWILIO_AUTH_TOKEN=
# TWILIO_FROM_NUMBER=
```

---

## Database Schema

All tables live in Supabase PostgreSQL. Prices are stored in **smallest currency unit** (paise for INR, cents for USD — never decimals).

### `countries`
```sql
code (PK), name, currency_code, currency_symbol,
postal_code_label, flat_label, society_label
```

### `societies`
```sql
id UUID PK, name, slug UNIQUE, city, state,
postal_code, country_code, created_at
```

### `owners`
```sql
id UUID PK, user_id (Supabase auth FK), name, phone,
flat_number, society_id UNIQUE FK, shop_name,
status (pending|active|paused|inactive),
bw_rate INT, color_rate INT, delivery_fee INT,  -- all in paise
upi_id, accept_cash BOOL, country_code, created_at
```
- `society_id` has a UNIQUE constraint — **one owner per society**, enforced at DB level.

### `jobs`
```sql
id UUID PK, job_number TEXT UNIQUE (e.g. 'INK-0042'),
owner_id FK, society_id FK,
customer_name, customer_flat, customer_phone,
file_path, file_name, page_count INT,
print_type (bw|color), paper_size (A4|Letter|Legal|A3),
copies INT, total_amount INT,
payment_method (upi|cash), payment_status (pending|paid),
status (submitted|accepted|printing|delivered|cancelled|feedback_pending|feedback_done),
notes TEXT, created_at, updated_at
```

### `feedback`
```sql
id UUID PK, job_id UNIQUE FK, owner_id FK, society_id FK,
on_time BOOL, quality_good BOOL,
star_rating INT (1–5), comment TEXT (max 200 chars),
created_at, expires_at  -- 7 days after delivery
```
- `job_id` is UNIQUE — one feedback per job, immutable after submission.

### `push_subscriptions`
```sql
id UUID PK, owner_id FK CASCADE, subscription JSONB,
device TEXT, created_at
```

### `platform_config`
```sql
key TEXT PK, value TEXT, updated_at
-- Keys: default_bw_rate, default_color_rate, default_delivery_fee,
--       commission_percent, subscription_fee, subscription_active
```

### Row Level Security (RLS)
- **owners:** Owner reads/updates own row only.
- **jobs:** Owner manages own jobs; customers can INSERT without auth.
- **feedback:** Customers INSERT only; owners can read their own feedback; no updates after insert.
- **push_subscriptions:** Owner manages own; Edge Functions use service role key.
- **societies:** Public read; authenticated write.
- **platform_config:** Service role key only (admin operations).

### Storage
```
Bucket: job-files/
  Path: {job_id}/{original_filename}
```
**Files are auto-deleted when job status becomes `delivered` OR `cancelled`.** This keeps storage near zero on Supabase free tier. Do not change this behaviour.

---

## Routing

```
/                           Landing page (public)
/find                       Society search results (public)
/register                   Owner registration step 1 (public)
/register/society           Owner registration step 2 (public)
/register/rates             Owner registration step 3 (public)
/register/success           Shop created confirmation (public)
/login                      Owner login (public)
/privacy                    Privacy policy (public)
/terms                      Terms of service (public)
/dashboard                  Owner jobs [PROTECTED]
/dashboard/earnings         Owner earnings [PROTECTED]
/dashboard/availability     Owner availability schedule [PROTECTED]
/dashboard/settings         Owner settings [PROTECTED]
/admin                      Platform admin [PROTECTED — admin email only]
/:slug                      Public shop page (dynamic)
/:slug/confirm/:jobId       Order confirmation (public, dynamic)
/feedback/:jobId            Customer feedback form (public, 7-day expiry)
```

- `/dashboard/*` requires valid Supabase auth session.
- `/admin` requires auth user email to match `VITE_ADMIN_EMAIL`.

---

## Core Business Rules

### 1. One Owner Per Society
UNIQUE constraint on `owners.society_id`. Never remove this constraint. If a slot is taken, display: *"This society already has a printer. The owner is [Name]."*

### 2. Society Fuzzy Matching
Use Fuse.js (`/src/lib/fuzzyMatch.js`) to detect duplicate society names during registration. Similarity > 75% triggers a warning prompt. Owner can override but must confirm explicitly.

### 3. Price Calculation
```
Total = (pages × copies × rate_per_page) + delivery_fee
```
All values in smallest currency unit. Use `/src/lib/pricing.js` — never inline this formula.

### 4. File Auto-Delete
Delete from Supabase Storage on **both** `delivered` **and** `cancelled` status transitions. Use the `deleteJobFile` utility in `/src/lib/storage.js`. Do not skip this on cancellation.

### 5. Job Status Flow
```
submitted → accepted → printing → delivered → feedback_pending → feedback_done
                ↓
            cancelled
```
Status transitions are one-way. Never move backwards.

### 6. Feedback Expiry
Feedback links are valid for 7 days after delivery (`expires_at` column). Expired links show a friendly expiry message — never an error.

### 7. Feedback Immutability
One feedback per job (`UNIQUE` on `job_id`). No edits after submission. No public display of review text — only aggregate star rating.

### 8. Rate Customisation
Owners can set rates within ±50% of platform defaults (from `platform_config`). Validate this server-side in the Edge Function or during owner settings save.

---

## UI Design System

### Colour Tokens (Tailwind config)
```
ink       #0A0A0F    Primary text
ink2      #1A1A2E    Deep navy, hero gradients
surface   #FFFFFF    Card backgrounds
bg        #F4F3FF    Soft lavender-white page background
orange    #FF6B35    Primary CTA
orange2   #FF8C61    Orange light
violet    #7C3AED    Secondary actions, active states
violet2   #A78BFA    Violet light
sky       #06B6D4    Tertiary accent
green     #10B981    Success, delivered, live
amber     #F59E0B    Pending, warning
red       #EF4444    Error, cancelled
muted     #6B7280    Secondary text
border    #E5E7EB    Subtle borders
```

### Typography
- **Fonts:** Space Grotesk (headings), Inter (body)
- **Base size:** 18px — larger than typical for elder-friendliness
- **Headings:** 24px–40px, weight 700–800
- **Min caption:** 14px
- **Line-height:** 1.6

### Sizing Rules
- **Border-radius:** 12px default, 16–20px cards, 100px pills
- **Button/Input min-height:** 52px
- **Icon size:** 24px inline, 48–52px feature icons
- **Tap target minimum:** 48×48px (WCAG)

### Elder-Friendly Rules — Never Violate
1. No body text below 16px.
2. All interactive elements at least 48×48px.
3. Maximum 3 actions visible at once.
4. Every multi-step form must show a progress indicator.
5. No jargon — use plain English.
6. High contrast — WCAG AA minimum.

---

## Naming Conventions

| Type | Convention | Example |
|---|---|---|
| React components | PascalCase | `JobCard.jsx`, `SocietySearch.jsx` |
| Hooks | camelCase with `use` prefix | `useAuth.js`, `useJobs.js` |
| Utility files | camelCase | `fuzzyMatch.js`, `slugify.js` |
| CSS classes | Tailwind utilities only | No custom CSS unless unavoidable |
| Database columns | snake_case | `society_id`, `bw_rate` |
| Job numbers | `INK-XXXX` zero-padded | `INK-0042` |
| UUIDs | All table primary keys | Never use sequential integers as PKs |

---

## Supabase Patterns

- **Single client instance:** Import from `/src/lib/supabase.js` everywhere. Never create a second client.
- **Trust RLS:** Do not add application-level access checks that duplicate RLS policies. RLS is the source of truth.
- **Mutations in hooks:** Prefer co-locating Supabase mutations in custom hooks (`useJobs.js`) rather than scattering them across components.
- **Edge Functions:** Use service role key only inside Supabase Edge Functions, never in browser code.
- **Realtime (Phase 2):** Don't implement Supabase Realtime in Phase 1. Keep job list updates to manual refresh or polling.

---

## Internationalisation Rules

- **Never hardcode currency symbols.** Use `Intl.NumberFormat` with the `currency_code` from the `countries` table.
- **Never hardcode "Pincode", "Flat", "Society".** Use the label fields from the `countries` table.
- **All UI strings** must go through `react-i18next` (`t('key')`). No bare strings in JSX.
- **Dates:** Use `Intl.DateTimeFormat` with the user's locale. No `moment.js` or `date-fns`.

---

## Notification Architecture

Notifications are routed through `/src/notifications/index.js`. Never call `whatsapp.js` or `browser.js` directly from components — always go through the router so Phase 2/3 providers can be swapped.

**Phase 1 active channels:**
- `browser.js` — VAPID push for owners (new job alerts)
- `whatsapp.js` — `wa.me` deep links (manual, no API)

**Phase 2/3 stubs (do not activate without explicit instruction):**
- WATI automated WhatsApp API
- Twilio SMS

---

## Payment Architecture

Payments are routed through `/src/payments/index.js`. Phase 1 implements UPI and cash only. Stripe module exists as a stub — do not implement it unless explicitly asked.

---

## PWA

- Manifest is generated by `vite-plugin-pwa` in `vite.config.js`.
- Service worker at `/public/sw.js` handles push events and offline caching.
- iOS users must manually add to home screen (Safari → Share → Add to Home Screen). Show `IOSInstallBanner` component to guide them.
- Android Chrome auto-prompts install after 2nd visit.

---

## Error Handling Conventions

| Scenario | Message / Behaviour |
|---|---|
| Society already taken | "This society already has a printer. The owner is [Name]." |
| File too large (>10MB) | "Your file is too large. Please compress it and try again." |
| Page count detection fails | "We couldn't detect the page count. The owner will confirm before printing." |
| Shop paused | "This shop is temporarily closed. Try again later." |
| Invalid slug | 404 page with link back to home |
| Feedback URL expired | "This link has expired. Thank you for your feedback!" |
| Network error | Toast with retry option |
| Unauthorized access | Redirect to `/login` or 403 page |

---

## Git & Deployment

- **Main branch** auto-deploys to Vercel.
- No test suite exists yet in Phase 1. Add tests if asked.
- Commit messages should be imperative, present tense: `Add owner registration step 2`.

---

## Phase Roadmap Summary

| Phase | Key Features |
|---|---|
| **1 — MVP (now)** | Registration, dashboard, customer ordering, feedback, UPI/cash, browser push, PWA |
| **2 — Growth** | WATI WhatsApp automation, Realtime updates, Razorpay subscriptions, Google Places |
| **3 — Scale** | Stripe, Razorpay Route commissions, Twilio SMS, multi-language UI, Capacitor app |

When implementing Phase 1, do not implement Phase 2/3 features unless explicitly asked. Stub modules where indicated, but keep them non-functional.

---

## Reference

Full product specification is in `PRD.md`. When in doubt about a business rule, the PRD is the authoritative source.
