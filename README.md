# InkNeighbour

**Print it. Drop it. Done.**

InkNeighbour connects home printer owners ("Owners") in apartment complexes with neighbours ("Customers") for on-demand printing services. Owners register a shop, customers upload documents, and the owner prints and delivers within the building.

- **Live:** https://inkneighbour.zakapedia.in
- **Status:** Phase 1 MVP

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, React Router v6, Tailwind CSS 3 |
| Backend | Supabase (PostgreSQL, Auth, Storage, Edge Functions) |
| Search | Fuse.js — fuzzy society name duplicate detection |
| File upload | react-dropzone, pdfjs-dist (PDF page count) |
| Notifications | Browser Push (VAPID), WhatsApp `wa.me` links |
| i18n | react-i18next |
| Icons | lucide-react |
| Toasts | sonner |
| PWA | vite-plugin-pwa (Workbox) |
| Hosting | Vercel (auto-deploy from main) |
| Tests | Vitest + React Testing Library |

---

## Getting Started

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# Start dev server
npm run dev
# → http://localhost:5173
```

### Other commands

```bash
npm run build        # Production build
npm run preview      # Preview production build locally
npm run lint         # ESLint
npm run test         # Run test suite (171 tests)
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
# Required
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# App config
VITE_APP_URL=https://inkneighbour.zakapedia.in
VITE_DEFAULT_COUNTRY=IN
VITE_ADMIN_EMAIL=zaheer@zakapedia.in

# Push notifications (VAPID)
VITE_VAPID_PUBLIC_KEY=      # Public key — safe to expose
VAPID_PRIVATE_KEY=          # Private key — Edge Function only, never commit
VAPID_EMAIL=zaheer@zakapedia.in
```

Never commit `.env`. Only `VITE_*` variables are exposed to the browser.

---

## Project Structure

```
src/
├── components/
│   ├── ui/                  # Button, Input, Badge, Card, Modal
│   ├── JobCard.jsx
│   ├── SocietySearch.jsx
│   ├── UploadZone.jsx
│   ├── PriceBreakdown.jsx
│   ├── StarRating.jsx
│   ├── SLACountdown.jsx     # Live 15-min acceptance countdown
│   ├── ReliabilityScore.jsx # Owner reliability badge + breakdown
│   ├── PreCommitmentPrompt.jsx
│   └── UPIQRCode.jsx
├── pages/
│   ├── Landing.jsx
│   ├── Find.jsx
│   ├── Register/            # 3-step wizard
│   ├── Login.jsx
│   ├── Dashboard/           # Owner protected area
│   ├── ShopPage.jsx         # /:slug
│   ├── OrderConfirm.jsx     # /:slug/confirm/:jobId
│   ├── FeedbackForm.jsx     # /feedback/:jobId
│   └── Admin.jsx
├── hooks/
│   ├── useAuth.js
│   ├── useOwner.js
│   ├── useJobs.js
│   └── useReliability.js    # Reliability score + soft lock state
├── lib/
│   ├── supabase.js          # Shared Supabase client singleton
│   ├── countries.js         # Country/currency/provider config
│   ├── pricing.js           # Price calculation utilities
│   ├── slugify.js
│   ├── storage.js           # deleteJobFile utility
│   └── fuzzyMatch.js        # Fuse.js wrapper
├── payments/                # UPI, Cash (Stripe stub — Phase 2)
├── notifications/           # Browser push, WhatsApp (WATI stub — Phase 2)
└── locales/
    ├── en.json
    └── hi.json              # Phase 2
supabase/
├── migrations/
│   ├── 001_initial_schema.sql
│   ├── 002_feedback.sql
│   ├── 003_push_subscriptions.sql
│   └── 004_behaviour_system.sql  # SLA, reliability, soft lock
└── functions/
    ├── notify/              # Push notification dispatcher
    └── check-sla/           # Auto-cancel + soft lock enforcer
```

---

## Database Migrations

Apply in order against your Supabase project:

```
supabase/migrations/001_initial_schema.sql   — Countries, Societies, Owners, Jobs, platform_config
supabase/migrations/002_feedback.sql         — Feedback table, owner_stats view, expiry trigger
supabase/migrations/003_push_subscriptions.sql — Push subscriptions table
supabase/migrations/004_behaviour_system.sql  — SLA columns, reliability view, soft lock function
```

Use the Supabase dashboard SQL editor or `supabase db push` with the CLI.

---

## Key Routes

| Route | Description | Auth |
|---|---|---|
| `/` | Landing page | Public |
| `/find` | Society search by pincode | Public |
| `/register` | Owner registration (3-step wizard) | Public |
| `/login` | Owner login | Public |
| `/dashboard` | Owner jobs + toggle | Protected |
| `/dashboard/earnings` | Earnings breakdown | Protected |
| `/dashboard/settings` | Shop settings | Protected |
| `/admin` | Platform admin | Admin email only |
| `/:slug` | Customer shop page | Public |
| `/:slug/confirm/:jobId` | Order confirmation | Public |
| `/feedback/:jobId` | Customer feedback (7-day window) | Public |

---

## Business Rules

**One owner per society** — enforced by `UNIQUE` constraint on `owners.society_id`.

**Pricing formula:**
```
Total = (pages × copies × rate_per_page) + delivery_fee
```
All amounts stored in smallest currency unit (paise for INR). Use `src/lib/pricing.js`.

**Job status flow:**
```
submitted → accepted → printing → delivered → feedback_pending → feedback_done
                ↓
            cancelled
```

**File auto-delete** — files deleted from Supabase Storage on `delivered` and `cancelled`.

**Feedback** — valid for 7 days after delivery. One per job, immutable after submit.

**Owner Behaviour System:**
- **SLA:** Owners have 15 minutes to accept each submitted job
- **Auto-cancel:** Expired unaccepted jobs are cancelled client-side (on dashboard load) and server-side (via `check-sla` Edge Function every few minutes)
- **Reliability score:** Average of acceptance rate (accepted within SLA / total) and completion rate (delivered / accepted); shown once ≥ 5 jobs exist
- **Streak:** Consecutive on-time accepted + delivered jobs; resets on miss or cancellation
- **Soft lock:** When reliability drops below 70%, shop is auto-paused for 24 hours
- **Pre-commitment prompt:** Modal shown each time an owner toggles their shop live
- **Transparency signals:** Shop page shows average response time to customers; "busy" screen when at active job limit (default: 3)

---

## Testing

```bash
npm run test
```

171 tests across 17 files covering:
- Utility libraries (`pricing`, `slugify`, `countries`, `fuzzyMatch`)
- Payment and notification modules
- UI components (`Button`, `Input`, `Badge`, `Modal`, `StarRating`, `PriceBreakdown`)
- Pages (`Landing`, `Login`, `FeedbackForm`)

Tests use Vitest + jsdom + React Testing Library. Supabase, react-i18next, and sonner are mocked in `src/test/setup.js`.

---

## PWA

- Install prompt auto-shown on Android Chrome after 2nd visit
- iOS: tap **Share → Add to Home Screen** (banner shown automatically)
- Service worker at `public/sw.js` handles push events and offline caching
- Push notifications use VAPID (owner new-job alerts); full delivery wired in Phase 2

---

## Phase Roadmap

| Phase | Status | Key Features |
|---|---|---|
| **1 — MVP** | Now | Registration, dashboard, customer ordering, feedback, UPI/cash, browser push, PWA, behaviour system |
| **2 — Growth** | Planned | WATI WhatsApp automation, Realtime updates, Razorpay subscriptions, Google Places |
| **3 — Scale** | Planned | Stripe, Twilio SMS, multi-language UI, Capacitor app |

---

## Contributing

See `CLAUDE.md` for AI assistant guidelines and architectural decisions.
Full product specification is in `PRD.md`.
