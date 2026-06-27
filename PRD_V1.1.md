# InkNeighbour — Product Requirements Document
**Version:** 3.1  
**Owner:** Zaheer (Zakapedia)  
**URL:** inkneighbour.zakapedia.in  
**Stack:** React + Vite · Supabase · Vercel  
**Status:** Phase 1 Live · Phase 2 In Progress

---

## 1. Product Overview

### 1.1 What Is InkNeighbour?

InkNeighbour is a hyperlocal print services platform with two distinct models:

**Model 1 — Home Owner (Community Model)**
Apartment residents who own a printer offer on-demand printing to neighbours in the same building. Customer uploads document → owner prints → delivers to their flat door. No leaving home.

**Model 2 — Print Shop (Digital Storefront Model)**
Professional print shops get a digital storefront — a rich profile page with services displayed, map location, online print ordering, walk-in POS billing, and WhatsApp order integration. Customers find them online, order online, or walk in.

### 1.2 Origin Story

Started because of school worksheets. A parent buying a new printer realised cartridge costs ₹600–1,500/month but neighbours also need printing. InkNeighbour was built to let the printer pay for itself — and evolved into a platform for home owners and professional print shops alike.

### 1.3 Vision

> "Print anything. Delivered to your door."

Global platform where any home printer owner or professional print shop can serve their local community and earn — without technical knowledge.

### 1.4 Taglines

**Platform:** "Print it. Drop it. Done."  
**Home Owner:** "Your printer already exists. Let it pay for its own ink."  
**Print Shop:** "Your digital storefront. Walk-in and online. One dashboard."

### 1.5 Live URLs

- App: inkneighbour.zakapedia.in
- GitHub: github.com/zaheer800/InkNeighbour
- Part of Zakapedia product ecosystem (zakapedia.in)

---

## 2. Users

### 2.1 User Types

| Role | Description |
|---|---|
| **Home Owner** | Apartment resident with home printer. Serves same building only. |
| **Print Shop Owner** | Professional print business. Digital storefront + online orders + POS. |
| **Customer** | Anyone needing printing. No account required. |
| **Platform Admin** | Zaheer. Manages all providers, rates, verifications. |

### 2.2 Home Owner Persona

- Age: 28–55, apartment resident
- Has Canon/HP/Epson home printer
- Prints school worksheets, forms occasionally
- Wants to cover cartridge costs (₹600–1,500/month)
- Not a business person — simple interface needed
- Coverage: same building only
- Delivery: walks to customer's flat

### 2.3 Print Shop Owner Persona

- Age: 25–50, runs DTP / stationery / print business
- Currently manages orders via WhatsApp — chaotic
- Loses orders when shop is closed
- No visibility into daily/monthly earnings
- Has walk-in customers + wants online orders
- Has own delivery capability (staff/bike/self)
- Motivated paying customer — this is their livelihood

### 2.4 Customer Persona

- Age: 18–70 (including elderly)
- Needs urgent printing — can't wait till morning
- Prefers not to leave home (rain, baby, late night)
- Pays via UPI or cash
- Privacy conscious about sensitive documents

### 2.5 Design Principle: Elder-Friendly First

- Minimum font size: 16px body, 20px+ headings
- Large tap targets: minimum 52×52px buttons
- Plain English labels — no jargon
- WCAG AA contrast minimum
- Maximum 3 actions visible at once
- Progress indicators on all multi-step forms
- Encouraging copy throughout

---

## 3. Two Product Models — Side by Side

| Dimension | Home Owner | Print Shop |
|---|---|---|
| Discovery | Society name search | Locality search + directory |
| Coverage | Same building | Same neighbourhood |
| Delivery | Owner walks to flat | Shop delivers or customer collects |
| Payment | UPI QR + Cash | UPI (advance, no COD — prevents no-shows) |
| Service menu | Print only (B&W + Colour) | Display all services, order print online |
| POS | Not needed | Walk-in billing via mobile POS |
| WhatsApp | Share link manually | Bot handles orders automatically |
| Subscription | Free (Phase 1) | ₹299/month (Phase 2) |
| Value prop | Cover ink costs | Replace WhatsApp chaos + new customers |

---

## 4. Privacy & Trust

### 4.1 The Privacy Problem

Customers are comfortable sharing documents with a stranger (print shop) but hesitant with a neighbour. Reason: neighbours know their flat, family, see them daily. A professional framing removes this concern.

### 4.2 Positioning — Professional Not Personal

**Wrong:**
> "Your neighbour prints your documents"

**Right:**
> "A verified local printer. Right in your building."

Same person. Different trust perception. Apply consistently across all customer-facing copy.

### 4.3 Technical Privacy Measures

- Files auto-deleted from Supabase Storage on `delivered` OR `cancelled`
- One-time expiring download link — works once, expires immediately after download
- File never needs to be saved to owner's device — print directly from browser
- Privacy message shown prominently before upload:
  > *"🔒 Your file is encrypted, printed immediately, and permanently deleted. Nobody stores your documents."*

### 4.4 Legal Measures

- Owner signs privacy agreement on registration:
  > *"I agree to delete all customer documents from my device immediately after printing. Storing, sharing, or misusing customer documents results in immediate account termination."*

### 4.5 Cultural Measures — Sealed Envelope

Owner onboarding tip (mandatory reading):
> *"Always deliver documents in a sealed envelope. Print → seal → write flat number → deliver. Customer privacy is your responsibility. Envelopes available at any stationery shop for ₹2."*

### 4.6 Document Type Selector

Shown on order form before upload:

```
What are you printing?
○ School / College work
○ Office documents
○ Photos & Invitations
○ Personal ID (Aadhaar, PAN, Bank docs) ← shows extra privacy message
○ Other
```

For Personal ID selection — extra reassurance shown before proceeding.

### 4.7 Verified Owner Badge

`is_verified = true` set by Admin after:
- Government ID submitted ✅
- Address matches society/locality ✅
- Phone number verified ✅
- Privacy agreement signed ✅

Shown as blue ✅ tick on shop profile and search results.

---

## 5. Availability System

> Availability is the core reliability engine. If implemented incorrectly, jobs will be missed, trust will be lost, and the product will fail regardless of features. This is foundational — not optional.

### 5.1 Core Principle

At any moment the shop must be in exactly ONE clear state: `AVAILABLE` or `UNAVAILABLE`. No ambiguity.

### 5.2 State Architecture

```
Input 1: manual_state       ON | OFF          (Owner controlled)
Input 2: schedule_state     ON | OFF          (System — time based)
Input 3: system_override    NONE | FORCED_OFF (System — enforcement)

         ↓ Resolution Logic ↓

Output:  effective_state    AVAILABLE | UNAVAILABLE
```

### 5.3 State Resolution (Priority Order)

```
IF   system_override == FORCED_OFF  →  UNAVAILABLE
ELIF manual_state    == OFF         →  UNAVAILABLE
ELIF manual_state    == ON          →  AVAILABLE
ELSE                                →  schedule_state
```

Store all three inputs independently. Recompute effective state dynamically. Never cache it.

### 5.4 Manual Toggle

- Default: OFF on registration
- Pre-commitment prompt when switching ON:
  > *"You are now accepting jobs. You must respond within 15 minutes of each order."*
- Rapid toggle protection: 30-second minimum between toggles
- Ignored if `system_override == FORCED_OFF`

### 5.5 Scheduled Availability

Owner defines time slots per day. System evaluates continuously.

```
Example:
Mon–Fri: 07:00–09:00 ON, 18:00–21:00 ON
Saturday: 09:00–13:00 ON
Sunday: OFF
```

### 5.6 System Override (FORCED_OFF)

Triggered when:
- ≥ 2 missed jobs within SLA window, OR
- Reliability score < 70%

```
system_override     = FORCED_OFF
override_expires_at = now() + 2 hours
```

Recovery: auto-clears when `override_expires_at` passes.

### 5.7 SLA Enforcement

Applies only when `effective_state == AVAILABLE`.

```
Job submitted → sla_deadline = now() + 15 minutes
+5 min  → Push: "New job waiting — 10 minutes to respond"
+10 min → Push: "Final warning — 5 minutes left"
+15 min → Auto-cancel + missed_job logged + reliability recalculated
```

If state becomes UNAVAILABLE during SLA → timer cancelled → job auto-cancelled → NOT counted as missed.

### 5.8 Reliability Score

```
acceptance_rate  = accepted / received × 100
completion_rate  = delivered / accepted × 100
reliability      = (acceptance_rate × 0.6) + (completion_rate × 0.4)
```

### 5.9 Active Job Limit

Owner-configurable. Platform defaults:
- Home Owner: 3 concurrent jobs
- Print Shop: 10 concurrent jobs

When limit reached → new orders blocked → customer sees: *"Busy · Try again shortly."*

### 5.10 Customer-Facing Status

| Effective State | Cause | Display |
|---|---|---|
| AVAILABLE | Any | 🟢 Open · [X–Y mins] |
| AVAILABLE (near limit) | 2+ active jobs | 🟡 Busy · Accepting orders |
| UNAVAILABLE | Manual OFF | 🔴 Closed · Opens at [time] |
| UNAVAILABLE | Schedule | 🔴 Closed · Opens at [time] |
| UNAVAILABLE | Override | 🔴 Temporarily unavailable |
| UNAVAILABLE | At limit | 🔴 Full · Try again in 30 mins |

### 5.11 Estimated Time Display

```
Base time:       Owner sets (e.g. 20 mins)
Per active job:  +10 mins penalty

Display: "Open · 20–30 mins"
         "Busy · 40–50 mins" (2 active jobs)
```

### 5.12 Next Available Time

```
IF override active:    override_expires_at
IF schedule drives it: next schedule slot
IF manual OFF:         "Currently unavailable"
```

### 5.13 Order Anyway (Closed Shop)

When shop is closed, show:
```
🔴 Sri Sai Xerox is closed
   Opens tomorrow at 9:00 AM

[ Place order for tomorrow → ]
[ Set a reminder            → ]
```

Scheduled orders queued with `scheduled_for` timestamp. Processed when shop opens.

### 5.14 Real-Time Status (Supabase Realtime)

Shop profile page subscribes to owner row changes. Status updates instantly without page refresh.

### 5.15 Postgres Function

```sql
CREATE OR REPLACE FUNCTION get_effective_state(owner_id UUID)
RETURNS TEXT AS $$
DECLARE
  o owners%ROWTYPE;
  sched_state TEXT;
BEGIN
  SELECT * INTO o FROM owners WHERE id = owner_id;
  IF o.system_override = 'FORCED_OFF' AND o.override_expires_at > now() THEN
    RETURN 'UNAVAILABLE';
  END IF;
  IF o.system_override = 'FORCED_OFF' AND o.override_expires_at <= now() THEN
    UPDATE owners SET system_override = 'NONE' WHERE id = owner_id;
  END IF;
  IF o.manual_state = 'OFF' THEN RETURN 'UNAVAILABLE'; END IF;
  IF o.manual_state = 'ON'  THEN RETURN 'AVAILABLE';   END IF;
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

## 6. Print Shop Digital Storefront

### 6.1 What the Storefront Includes

```
🏪 Shop Profile          Rich page — photo, verified badge, services, map
📋 Service Display       All services shown (display only for non-print)
📍 Map Pin + Directions  Google Maps deep link
⭐ Ratings               Print-specific reputation
📱 Online Print Orders   B&W + Colour only — full InkNeighbour flow
🖥️ Walk-in POS           Mobile billing for every walk-in customer
💰 Earnings Dashboard    Daily/monthly by service and source
📲 WhatsApp Integration  Bot handles orders via WhatsApp automatically
🔔 Status Visibility     Customers always know if shop is open
```

### 6.2 Service Display Menu

Services displayed on profile — no online ordering except print:

| Service | Displayed | Online Order |
|---|---|---|
| B&W Printing | ✅ | ✅ |
| Colour Printing | ✅ | ✅ |
| Scanning | ✅ (display only) | ❌ Walk-in / call |
| Photocopying | ✅ (display only) | ❌ Walk-in / call |
| Binding | ✅ (display only) | ❌ Walk-in / call |
| Lamination | ✅ (display only) | ❌ Walk-in / call |
| Passport Photo | ✅ (display only) | ❌ Walk-in / call |

Service names shown without prices in Phase 1 (display only — no price points required). Owner adds free-text note per service if needed.

### 6.3 Custom Service Categories

Shop owners can add custom services beyond the defaults:

```
Default services: B&W, Colour, Scan, Photocopy, Bind, Laminate, Passport
Custom examples:  Banner Print, Visiting Cards, A3 Colour, Hardcover Binding
```

Custom services appear on profile (display) and in walk-in POS. NOT available for online ordering.

### 6.4 Walk-in POS (Mobile)

New tab in owner dashboard — `/dashboard/pos`

```
┌─────────────────────────┐
│ Walk-in Order       🖨️  │
│ [Search services... 🔍] │
├─────────────────────────┤
│ B&W Print   ₹2  [−]0[+]│
│ Colour      ₹8  [−]0[+]│
│ Binding    ₹20  [−]0[+]│
│ Lamination ₹15  [−]0[+]│
│ Scanning    ₹5  [−]0[+]│
│ [+ Custom service]      │
├─────────────────────────┤
│ Total:          ₹0      │
│ [💵 Cash] [📱 UPI]      │
│ [Record Transaction]    │
└─────────────────────────┘
```

After recording:
```
✅ Transaction recorded
Total: ₹40

[ 📱 Share bill on WhatsApp ]
```

WhatsApp receipt sent to customer:
> *"Thank you! B&W Print (10pg): ₹20 · Binding: ₹20 · Total: ₹40 · Powered by InkNeighbour"*

### 6.5 No-Show Prevention

Print shops use UPI advance payment only — no Cash on Delivery.

```
Customer places order
→ Pays UPI before job enters queue
→ Owner prints only paid orders
→ Zero no-shows
→ Zero wasted ink and paper
```

Payment confirmation: customer taps "I have paid" → owner checks UPI history → confirms → job starts.

### 6.6 Earnings Dashboard

```
Source breakdown:
Online orders:    ₹4,200
WhatsApp orders:  ₹8,600
Walk-in (POS):    ₹14,800
──────────────────────────
Total this month: ₹27,600

By service:
B&W Print:    ₹12,400
Colour Print: ₹8,200
Binding:      ₹4,600
Lamination:   ₹2,400
```

Daily/weekly/monthly/all-time selector.

---

## 7. WhatsApp Integration

### 7.1 Strategy

WhatsApp is where Indian small businesses live. Not email. Not apps. WhatsApp.

InkNeighbour integrates WhatsApp at three levels:

```
Phase 1: wa.me links      Manual, free, zero setup
Phase 2: CRM Bot          Automated via Zakapedia WhatsApp CRM
Phase 3: Full Storefront  Entire customer flow on WhatsApp
```

### 7.2 Phase 1 — wa.me Links (Built)

Four touchpoints, all manual:

```javascript
// /src/notifications/whatsapp.js
export const messages = {
  shopLaunch: (shopName, shopUrl, bwRate, colorRate, deliveryFee) =>
    `Hi neighbours! 🖨️ I've set up a home print shop for ${shopName}.\n\nOrder here:\n${shopUrl}\n\nB&W ₹${bwRate}/page · Colour ₹${colorRate}/page · Delivery ₹${deliveryFee}`,

  orderPlaced: (jobId, ownerName, pages, type, copies, amount) =>
    `Hi ${ownerName}! Order #${jobId}\n${pages} pages · ${type} · ${copies} copies\nTotal: ₹${amount}`,

  jobDelivered: (customerName, jobId) =>
    `Hi ${customerName}! Your printout #${jobId} is ready. Dropping it at your flat now. 🚪`,

  feedbackRequest: (customerName, jobId, feedbackUrl) =>
    `Hi ${customerName}! How was your print? #${jobId}\n${feedbackUrl}\n(Valid 7 days)`
}
```

### 7.3 Phase 2 — Zakapedia WhatsApp CRM Bot

**Architecture:**

```
Customer WhatsApps InkNeighbour number (Airtel WABA)
         ↓
Zakapedia WhatsApp CRM (Meta Cloud API)
         ↓
Webhook → Supabase Edge Function
         ↓
InkNeighbour business logic
→ Identify shop by keyword
→ Handle order flow
→ Generate UPI link
→ Create job in dashboard
         ↓
CRM sends response back to customer
```

**Shop registration in CRM:**

```sql
-- crm schema
shop_whatsapp_config (
  id          UUID PRIMARY KEY,
  owner_id    UUID REFERENCES inkneighbour.owners(id),
  keyword     TEXT UNIQUE,  -- 'saisai' | 'tarnaka' | 'greenvalley'
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
)
```

Shop owner sets keyword during registration. Customers message:
> *"saisai — 10 pages B&W"*

CRM matches keyword → routes to correct shop.

**Bot conversation flow:**

```
Customer: "saisai"
Bot:      "Hi! Welcome to Sri Sai Xerox 🖨️
           B&W ₹3/pg · Colour ₹8/pg
           Please send your file."

Customer: [sends PDF]
Bot:      "Got it! 5 pages B&W = ₹15
           Total: ₹23 (incl. delivery)
           Pay: upi://pay?pa=saisai@upi&am=23"

Customer: "I have paid"
Bot:      "Payment confirmed ✅
           Order #INK-0042 queued.
           Ready in 20–30 mins."

Owner dashboard: New job appears 🔔
```

**Edge Functions (Zakapedia CRM → InkNeighbour):**

```
receive_message   → Identify shop, create conversation
send_message      → Price quotes, confirmations, status
handle_media      → Receive PDF, store in Supabase Storage
process_payment   → UPI link + payment confirmation
send_notification → Push to owner dashboard
```

**Job source tracking:**

```sql
jobs.source = 'online' | 'whatsapp' | 'walkin'
jobs.wa_conversation_id UUID REFERENCES crm.conversations(id)
```

### 7.4 Phase 3 — Full WhatsApp Storefront

Customer never downloads InkNeighbour. Entire flow on WhatsApp:
- File upload via WhatsApp
- Price quote in chat
- UPI payment link in chat
- Status updates in chat
- Feedback request in chat

InkNeighbour becomes the backend. WhatsApp is the frontend.

### 7.5 WABA Requirements

```
✅ Meta Business Manager verified
✅ WABA approved (Airtel landline number)
✅ Webhook → Supabase Edge Function
✅ Message templates approved by Meta
```

---

## 8. Location & Maps

### 8.1 Map Provider — Ola Maps

**Why Ola Maps:**
- Built for India — best accuracy for Indian localities, lanes, societies
- Free tier available
- React SDK available
- Autocomplete understands Indian addresses natively
- Better than OSM for hyperlocal Indian search

**API key required** — register at maps.olacabs.com/devportal

```env
VITE_OLA_MAPS_API_KEY=
```

### 8.2 Customer Location Detection

**Primary: GPS auto-detect (browser geolocation)**

```javascript
// /src/lib/location.js
export const detectLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject('Geolocation not supported')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      }),
      (err) => reject(err),
      { timeout: 10000, maximumAge: 300000 }
    )
  })
}
```

**Fallback: Manual locality search via Ola Maps Autocomplete**

If customer denies GPS or detection fails:
```
[ 📍 Detecting your location... ]
     ↓ fails
[ 🔍 Enter your area... ] ← Ola Maps autocomplete
```

**Customer experience:**
```
1. Customer opens /find
2. App requests GPS permission
3. If granted → detects lat/lng → fetches nearby shops instantly
4. If denied → shows search input with Ola Maps autocomplete
5. Customer types "Tarnaka" → suggestions appear → selects → shops load
```

### 8.3 Location-Based Search

All search results sorted by **distance from customer** — nearest first.

**Search query:**
```javascript
// /src/lib/search.js
export const findNearbyProviders = async (customerLat, customerLng, radiusKm = 5) => {
  const { data } = await supabase
    .rpc('find_nearby_providers', {
      customer_lat: customerLat,
      customer_lng: customerLng,
      radius_km: radiusKm
    })
  return data
}
```

**Postgres function (distance-sorted):**
```sql
CREATE OR REPLACE FUNCTION find_nearby_providers(
  customer_lat NUMERIC,
  customer_lng NUMERIC,
  radius_km NUMERIC DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  shop_name TEXT,
  provider_type TEXT,
  locality TEXT,
  landmark TEXT,
  lat NUMERIC,
  lng NUMERIC,
  bw_rate INTEGER,
  color_rate INTEGER,
  delivery_fee INTEGER,
  avg_star_rating NUMERIC,
  total_ratings INTEGER,
  manual_state TEXT,
  system_override TEXT,
  distance_km NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.shop_name,
    o.provider_type,
    o.locality,
    o.landmark,
    o.lat,
    o.lng,
    o.bw_rate,
    o.color_rate,
    o.delivery_fee,
    COALESCE(AVG(f.star_rating), 0) as avg_star_rating,
    COUNT(f.id)::INTEGER as total_ratings,
    o.manual_state,
    o.system_override,
    -- Haversine distance calculation
    (6371 * acos(
      cos(radians(customer_lat)) *
      cos(radians(o.lat)) *
      cos(radians(o.lng) - radians(customer_lng)) +
      sin(radians(customer_lat)) *
      sin(radians(o.lat))
    )) AS distance_km
  FROM owners o
  LEFT JOIN feedback f ON f.owner_id = o.id
  WHERE
    o.status = 'active'
    AND o.lat IS NOT NULL
    AND o.lng IS NOT NULL
    AND (6371 * acos(
      cos(radians(customer_lat)) *
      cos(radians(o.lat)) *
      cos(radians(o.lng) - radians(customer_lng)) +
      sin(radians(customer_lat)) *
      sin(radians(o.lat))
    )) <= radius_km
  GROUP BY o.id
  ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql;
```

### 8.4 Search Results Display

```
📍 Showing printers near you · Tarnaka, Hyderabad

🏠 Zaheer's Home Printer      0.2 km · 🟢 Open
   Green Valley Ph1 · B&W ₹2 · Colour ₹5

🏪 Sri Sai Xerox               0.8 km · 🟢 Open
   Tarnaka · Near Metro · ⭐ 4.8

🏪 Krishna Digitals            1.2 km · 🔴 Closed
   Malkajgiri · Opens 9am

🏠 Ramesh's Printer            1.5 km · 🟡 Busy
   My Home Jewel · B&W ₹3
```

**Sort:** Distance ascending (nearest first)
**Filter bar:** All / 🏠 Home / 🏪 Shop / Open now

### 8.5 Home Owner Location

Home owners don't need precise coordinates for search to work — their society's approximate centre point is enough.

```javascript
// On society selection during registration
// Geocode society name to get approximate lat/lng
const coords = await olaGeocode(`${societyName}, ${city}`)
// Store on owner row — used for distance calculation only
// NOT shown on map (privacy)
```

### 8.6 Print Shop Location

Map pin required. Two options during registration:

```
[ 📍 Use my current location ] → GPS coordinates
OR
Search address via Ola Maps autocomplete → pin drops → owner adjusts
```

Static non-interactive map pin shown on shop profile page.

### 8.7 Ola Maps Integration

```bash
npm install @ola-maps/react
```

**Autocomplete (customer search + shop registration):**
```jsx
import { OlaMapsAutocomplete } from '@ola-maps/react'

<OlaMapsAutocomplete
  apiKey={import.meta.env.VITE_OLA_MAPS_API_KEY}
  country="IN"
  placeholder="Search your area..."
  onSelect={(place) => {
    setLocation({ lat: place.lat, lng: place.lng, name: place.name })
  }}
/>
```

**Static map pin (shop profile):**
```jsx
import { OlaMapsMap, OlaMapsMarker } from '@ola-maps/react'

<OlaMapsMap
  apiKey={import.meta.env.VITE_OLA_MAPS_API_KEY}
  center={{ lat, lng }}
  zoom={16}
  interactive={false}
  style={{ height: '200px', borderRadius: '12px' }}
>
  <OlaMapsMarker position={{ lat, lng }} />
</OlaMapsMap>
```

**Directions (deep link — no API needed):**
```javascript
window.open(`https://maps.google.com/?q=${lat},${lng}`)
```

### 8.8 Fallback — Locality Text Search

For users who deny GPS and don't use autocomplete — simple text search against `locality` field:

```javascript
// Fuzzy search against stored locality names (Fuse.js)
const results = fuse.search(searchTerm)
// Returns shops in matching localities
// No distance calculation — sorted alphabetically
```

This ensures search always works even without location permission.

---

## 9. Landing Page Strategy

### 9.1 The Problem

Three audiences. One platform. Different reasons to care. One landing page can't speak to all three.

### 9.2 Four Pages

```
/          Main landing — concept intro, routes all 3 audiences
/print     Customer — "Need a printout urgently?"
/earn      Home Owner — "Have a printer? Earn from it"
/shop      Print Shop — "Run a shop? Go digital"
```

### 9.3 Main Landing (/)

**Hero:** *"Verified local printers. Right in your neighbourhood."*

**3-step explainer:**
```
📄 Upload       🖨️ They Print      🚪 Delivered
Your document   Nearby verified    To your door
                printer
```

**Audience cards:**
```
🏘️ Residents          🏠 Home Owners        🏪 Print Shops
Need a printout?      Earn from your        Get digital orders.
Find one near you.    idle printer.         Manage everything
[Find Printer]        [Start Earning]       from one dashboard.
                                            [List My Shop]
```

### 9.4 Customer Landing (/print)

**Hero:** *"Get anything printed without leaving home."*

Pain point: *"It's 10pm. Print shop is closed. Your neighbour has a printer. 🖨️"*

Trust signals:
- "No account needed"
- "Files deleted after printing 🔒"
- "Pay only after confirmation"

### 9.5 Home Owner Landing (/earn)

**Hero:** *"Your printer is costing you money. Let it pay for itself."*

The math:
```
Cartridge: ₹650
At ₹3/page: Print 217 pages → paid for ✅
Average: ₹500–₹1,500/month
```

### 9.6 Print Shop Landing (/shop)

**Hero:** *"More orders. Less chaos."*

Pain: *"Managing print orders on WhatsApp? Wrong files. Forgotten payments. Lost orders."*

Value props:
```
📱 Digital storefront    🖥️ Walk-in POS
📋 Job queue dashboard   💰 Earnings tracking
⭐ Build reputation      📲 WhatsApp integration
```

CTA: "List My Shop →" → `/register?type=shop`

---

## 10. Monetisation

### 10.1 Phase 1 — Free

No fees. Build user base. Validate product.

### 10.2 Phase 2 — Subscription (Print Shops)

```
Free tier:
→ Directory listing
→ Basic profile
→ Map pin

₹299/month:
→ Walk-in POS
→ Online ordering
→ Earnings dashboard
→ WhatsApp bot integration
→ Verified badge

₹499/month:
→ Everything above
→ Custom service categories
→ GST summary report
→ Customer history
→ Priority support
```

Home owners: free indefinitely. Their volume doesn't justify subscription.

### 10.3 Phase 3 — Commission

Online payments via Razorpay Route → platform takes 5–10% commission automatically. Only on digital payments — not cash or UPI direct.

---

## 11. Database Schema

### 11.1 Tables

```sql
-- Countries (config)
countries (
  code          TEXT PRIMARY KEY,   -- 'IN', 'US', 'GB'
  name          TEXT,
  currency_code TEXT,
  currency_symbol TEXT,
  postal_code_label TEXT,
  flat_label    TEXT,
  society_label TEXT
)

-- Societies (Home Owners)
societies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  city          TEXT,
  state         TEXT,
  postal_code   TEXT NOT NULL,
  country_code  TEXT REFERENCES countries(code) DEFAULT 'IN',
  created_at    TIMESTAMPTZ DEFAULT now()
)

-- Owners (both types)
owners (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES auth.users(id),
  name                  TEXT NOT NULL,
  phone                 TEXT,
  flat_number           TEXT,              -- Home Owner only
  society_id            UUID REFERENCES societies(id), -- Home Owner only
  shop_name             TEXT,
  provider_type         TEXT DEFAULT 'home', -- 'home' | 'shop'
  shop_photo            TEXT,              -- Supabase storage path
  about                 TEXT,              -- max 200 chars
  is_verified           BOOLEAN DEFAULT false,
  -- Location
  shop_address          TEXT,              -- Print Shop
  locality              TEXT,              -- e.g. 'Tarnaka'
  landmark              TEXT,              -- e.g. 'Near Metro Station'
  lat                   NUMERIC(10,7),     -- both types (optional home, required shop)
  lng                   NUMERIC(10,7),
  -- Delivery
  delivery_time_min     INTEGER,           -- mins (Print Shop)
  delivery_time_max     INTEGER,
  delivery_by           TEXT,              -- 'self' | 'staff' | 'thirdparty'
  -- Rates
  status                TEXT DEFAULT 'active', -- 'active' | 'paused' | 'inactive'
  bw_rate               INTEGER NOT NULL DEFAULT 200,
  color_rate            INTEGER NOT NULL DEFAULT 500,
  delivery_fee          INTEGER DEFAULT 800,
  upi_id                TEXT,
  accept_cash           BOOLEAN DEFAULT true,  -- false for print shops
  country_code          TEXT REFERENCES countries(code) DEFAULT 'IN',
  -- Availability System
  manual_state          TEXT DEFAULT 'OFF',
  system_override       TEXT DEFAULT 'NONE',
  override_expires_at   TIMESTAMPTZ,
  active_job_count      INTEGER DEFAULT 0,
  max_active_jobs       INTEGER DEFAULT 3,
  reliability_score     NUMERIC(5,2) DEFAULT 100.00,
  total_jobs_received   INTEGER DEFAULT 0,
  total_jobs_accepted   INTEGER DEFAULT 0,
  total_jobs_delivered  INTEGER DEFAULT 0,
  last_toggle_at        TIMESTAMPTZ,
  -- Subscription
  subscription_tier     TEXT DEFAULT 'free', -- 'free' | 'basic' | 'premium'
  subscription_expires  TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now()
)

-- Unique constraint: one home owner per society
CREATE UNIQUE INDEX unique_home_owner_per_society
  ON owners (society_id)
  WHERE provider_type = 'home' AND status != 'inactive';

-- Service Menu (Print Shops — display only)
service_menu (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID REFERENCES owners(id) ON DELETE CASCADE,
  service_code  TEXT NOT NULL,   -- 'scan' | 'photocopy' | 'binding' | 'lamination' | 'passport_photo'
  service_name  TEXT,            -- custom name e.g. "Spiral Binding (A4)"
  is_enabled    BOOLEAN DEFAULT false,
  sort_order    INTEGER,
  UNIQUE (owner_id, service_code)
)

-- Custom Services (POS only — not online ordering)
custom_services (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID REFERENCES owners(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,   -- "Banner Print" | "Visiting Cards"
  unit_label    TEXT,            -- "per sqft" | "per 100pcs"
  price         INTEGER,         -- paise
  is_enabled    BOOLEAN DEFAULT true,
  sort_order    INTEGER,
  created_at    TIMESTAMPTZ DEFAULT now()
)

-- Availability Schedules
availability_schedules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID REFERENCES owners(id) ON DELETE CASCADE,
  day_of_week   INTEGER NOT NULL,  -- 0=Sun ... 6=Sat
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  is_active     BOOLEAN DEFAULT true
)

-- Jobs
jobs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number             TEXT UNIQUE NOT NULL,     -- 'INK-0042'
  owner_id               UUID REFERENCES owners(id),
  society_id             UUID REFERENCES societies(id),
  customer_name          TEXT NOT NULL,
  customer_flat          TEXT NOT NULL,
  customer_phone         TEXT,
  file_path              TEXT,
  file_name              TEXT,
  page_count             INTEGER,
  print_type             TEXT NOT NULL,             -- 'bw' | 'color'
  paper_size             TEXT DEFAULT 'A4',
  copies                 INTEGER DEFAULT 1,
  total_amount           INTEGER NOT NULL,
  delivery_fee           INTEGER DEFAULT 0,
  payment_method         TEXT NOT NULL,             -- 'upi' | 'cash'
  payment_status         TEXT DEFAULT 'pending',
  status                 TEXT DEFAULT 'submitted',
  source                 TEXT DEFAULT 'online',     -- 'online' | 'whatsapp' | 'walkin'
  document_type          TEXT DEFAULT 'other',      -- 'school' | 'office' | 'photos' | 'personal_id' | 'other'
  scheduled_for          TIMESTAMPTZ,               -- NULL = immediate, set = future order
  wa_conversation_id     UUID,                      -- links to crm.conversations
  sla_deadline           TIMESTAMPTZ,
  sla_breached           BOOLEAN DEFAULT false,
  locked_effective_state TEXT,
  notes                  TEXT,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
)

-- Missed Jobs Log
missed_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        UUID REFERENCES jobs(id),
  owner_id      UUID REFERENCES owners(id),
  missed_at     TIMESTAMPTZ DEFAULT now(),
  reason        TEXT   -- 'sla_expired' | 'manual_cancel'
)

-- Feedback
feedback (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        UUID UNIQUE REFERENCES jobs(id),
  owner_id      UUID REFERENCES owners(id),
  society_id    UUID REFERENCES societies(id),
  on_time       BOOLEAN,
  quality_good  BOOLEAN,
  star_rating   INTEGER CHECK (star_rating BETWEEN 1 AND 5),
  comment       TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  expires_at    TIMESTAMPTZ
)

-- Push Subscriptions
push_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID REFERENCES owners(id) ON DELETE CASCADE,
  subscription  TEXT NOT NULL,
  device        TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
)

-- Delivery Fee Tiers (Print Shops — Phase 2)
delivery_fee_tiers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID REFERENCES owners(id) ON DELETE CASCADE,
  max_km        NUMERIC(4,1) NOT NULL,
  fee           INTEGER NOT NULL
)

-- Platform Config
platform_config (
  key           TEXT PRIMARY KEY,
  value         TEXT,
  updated_at    TIMESTAMPTZ DEFAULT now()
)
-- Keys: default_bw_rate_home, default_color_rate_home, default_delivery_fee_home,
--       default_bw_rate_shop, default_color_rate_shop,
--       sla_acceptance_minutes (15), override_cooldown_minutes (120),
--       override_missed_job_threshold (2), reliability_override_threshold (70),
--       default_max_jobs_home (3), default_max_jobs_shop (10)
```

### 11.2 Row Level Security

```
owners:              Owner reads/updates own row
jobs:                Owner reads/updates own jobs
jobs:                Anonymous INSERT (customer orders)
service_menu:        Owner full CRUD · Public read
custom_services:     Owner full CRUD · Public read
feedback:            Anonymous INSERT · Owner reads own
push_subscriptions:  Owner INSERT/DELETE own · Service role reads all
availability_schedules: Owner full CRUD
missed_jobs:         Owner reads own · Service role inserts
platform_config:     Admin only (service role)
```

### 11.3 Storage Buckets

```
job-files/
  {job_id}/{filename}
  → Deleted on delivered OR cancelled

shop-photos/
  {owner_id}/photo.jpg
  → Persistent
```

### 11.4 Migrations

```
001_initial_schema.sql
002_feedback.sql
003_push_subscriptions.sql
004_availability.sql          → schedules, missed_jobs, get_effective_state()
005_print_shop_owners.sql     → provider_type, shop fields, partial unique index
006_service_menu.sql          → service_menu, custom_services
007_pos_and_whatsapp.sql      → source field, wa_conversation_id, scheduled_for, document_type
```

---

## 12. Screen Map & Routes

```
/                    Main landing page
/print               Customer landing
/earn                Home owner landing
/shop                Print shop landing
/find                Search results (list + map Phase 2)
/register            Registration step 1 — provider type selector
/register/location   Registration step 2 — society or address
/register/rates      Registration step 3 — rates + payment + services
/register/success    Shop live confirmation
/login               Owner login
/dashboard           Owner dashboard — jobs [protected]
/dashboard/pos       Walk-in POS [protected, shop only]
/dashboard/earnings  Earnings dashboard [protected]
/dashboard/feedback  Feedback tab [protected]
/dashboard/availability  Schedule setup [protected]
/dashboard/settings  Settings [protected]
/admin               Platform admin [admin only]
/:slug               Provider shop page
/:slug/confirm/:id   Order confirmation
/feedback/:id        Customer feedback form (7-day expiry)
```

---

## 13. Key Screen Specs

### 13.1 Shop Profile Page (/:slug)

**Home Owner — Simple layout:**
- Shop name + 🏠 Home badge
- "Verified local printer · [Society Name]"
- B&W ₹X · Colour ₹X · Delivery ₹X
- Status: 🟢 Open · 20–30 mins
- Star rating (if ≥ 3)
- Optional map pin
- Order form (4-step wizard)

**Print Shop — Rich profile:**

Header:
- Shop photo
- Shop name + ✅ verified badge
- Locality · landmark (e.g. "Tarnaka · Near Metro Station")
- ⭐ 4.8 · 120+ orders
- 🟢 Open · Closes 9:00 PM

Stats bar:
```
📍 2.1km    🕐 20–30min    ✅ 99%    📦 120+
Distance    Delivery       On-time   Orders
```

Verified banner:
```
✅ Verified Print Shop
   Background verified & shop details confirmed
```

Services:
```
📄 B&W Prints      A4, A3
🎨 Colour Prints   A4, A3
📚 Spiral Binding  A4
🖨️ Lamination      A4, A3
📠 Scanning        PDF, JPG

View All Services →
```
(No prices displayed — customer calls/WhatsApps for non-print services)

Static map pin (Leaflet, non-interactive)

About shop (max 200 chars, expandable)

Sticky bottom bar:
```
[ 🗺️ Directions ] [ 📞 Call ] [ 💬 WhatsApp ]
[          📄 Place an Order          ]
```

### 13.2 Search Results (/find)

- Locality/pincode search input
- List view (Phase 1) + Map view toggle (Phase 2)
- Provider type badge: 🏠 Home / 🏪 Shop
- Status badge per card
- Filter: All / Home / Shop / Open now
- Distance shown for shops (text, no map needed)

### 13.3 Owner Dashboard (/dashboard)

**Stats bar (dark gradient):**
```
Jobs Today | This Week ₹ | This Month ₹
```

**Tabs:** Pending · Printing · Delivered · Cancelled

**Per job card:**
- Job ID + timestamp
- Customer name + flat
- File + page count
- Print type + copies
- Amount + payment method
- Status badge
- Actions: Download → Mark Printing → Mark Delivered

**Bottom nav (Print Shops):**
Jobs · POS · Earnings · Settings

### 13.4 Walk-in POS (/dashboard/pos)

See Section 6.4 for full spec.

### 13.5 Registration (3 steps)

**Step 1 — Provider Type + Details**
- Large visual selector: 🏠 Home Printer Owner / 🏪 Print Shop Owner
- Name, phone, email, password, country
- Home Owner: flat number
- Print Shop: shop name, optional GST

**Step 2 — Location**
- Home Owner: postal code → society search → fuzzy match → optional map pin
- Print Shop: locality name + landmark → map pin (required, Nominatim geocode)

**Step 3 — Rates & Setup**
- B&W rate, Colour rate, delivery fee (pre-filled defaults)
- UPI ID
- Home Owner: Cash on Delivery toggle ON
- Print Shop: Cash on Delivery toggle OFF (advance UPI only)
- Print Shop: Delivery time estimate, shop photo, about text, operating hours
- Print Shop: Service menu (toggle on/off per service)
- Active job limit (configurable)
- Preview shop URL

---

## 14. PWA & Push Notifications

### 14.1 PWA Setup

```javascript
// vite.config.js
VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'InkNeighbour',
    short_name: 'InkNeighbour',
    description: 'Print it. Drop it. Done.',
    theme_color: '#FF6B35',
    background_color: '#F4F3FF',
    display: 'standalone',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  }
})
```

iOS install banner shown when Safari detected + not installed:
> *"Tap Share → Add to Home Screen to install InkNeighbour"*

### 14.2 Push Notifications (Free — VAPID)

Cost: ₹0 forever.

```bash
npx web-push generate-vapid-keys
# Add to .env: VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL
```

Events notified:

| Event | To | Message |
|---|---|---|
| New job | Owner | "New print job! 🖨️ Priya · Flat 304 · ₹20" |
| Job cancelled | Owner | "Order #INK-0042 was cancelled" |
| New feedback | Owner | "New feedback ⭐ 5 stars" |
| Shop flagged | Admin | "Shop below 3.0 rating ⚠️" |

Platform support:

| Platform | Works? |
|---|---|
| Android Chrome | ✅ Full |
| Desktop Chrome | ✅ Full |
| iPhone Safari (iOS 16.4+, installed) | ⚠️ Partial |
| iPhone Chrome | ❌ No |

---

## 15. Global-Ready Architecture

### 15.1 i18n

- All strings in `/src/locales/en.json`, `hi.json`, `te.json`
- `react-i18next` for string management
- Dates via `Intl.DateTimeFormat`, numbers via `Intl.NumberFormat`

### 15.2 Currency

- ISO 4217 per shop (INR, USD, GBP)
- All amounts stored in smallest unit (paise)
- Symbol from `Intl.NumberFormat` — never hardcoded

### 15.3 Terminology by Country

| Term | India | UK | USA |
|---|---|---|---|
| Society | Society / Complex | Block of Flats | Condo |
| Pincode | Pincode | Postcode | ZIP Code |
| Flat | Flat | Flat | Unit / Apt |

### 15.4 Notification by Country

```javascript
IN: { provider: 'whatsapp' }
US: { provider: 'sms', smsProvider: 'twilio' }
GB: { provider: 'whatsapp', fallback: 'twilio' }
```

---

## 16. Tech Stack

### 16.1 Frontend

| Tool | Purpose |
|---|---|
| React 18 + Vite | Framework |
| React Router v6 | Routing |
| Tailwind CSS | Styling |
| Syne + Plus Jakarta Sans | Fonts |
| react-i18next | i18n |
| Fuse.js | Fuzzy society matching |
| react-dropzone | File upload |
| pdfjs-dist | PDF page count detection |
| @ola-maps/react | Location search, map pin, autocomplete |
| lucide-react | Icons |
| sonner | Toast notifications |
| vite-plugin-pwa | PWA + service worker |
| web-push | VAPID push (Edge Function) |

### 16.2 Backend

| Tool | Purpose |
|---|---|
| Supabase Auth | Owner authentication |
| Supabase Database | PostgreSQL |
| Supabase Storage | File uploads + shop photos |
| Supabase Edge Functions | Push notifications, file cleanup, CRM webhooks |
| Supabase Realtime | Live job queue + status updates |

### 16.3 Hosting

| Tool | Purpose |
|---|---|
| Vercel | Frontend hosting + CD |
| GitHub | Source control |
| Cloudflare | DNS + CDN |
| inkneighbour.zakapedia.in | CNAME → Vercel |

### 16.4 Supabase Project Strategy

Two apps. Two separate projects. Never combined.

```
supabase-project-1: inkneighbour   ← this app
supabase-project-2: wellnest       ← separate app
```

Free tier limits per project:

| Resource | Free limit | Usage |
|---|---|---|
| Database | 500MB | ~20MB for 10k jobs |
| Storage | 1GB | Near zero (auto-delete) |
| Bandwidth | 5GB/month | Safe until 50+ societies |
| Edge Functions | 500k/month | Fine at this scale |

### 16.5 Environment Variables

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_URL=https://inkneighbour.zakapedia.in
VITE_DEFAULT_COUNTRY=IN
VITE_ADMIN_EMAIL=zaheer@zakapedia.in
VITE_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=zaheer@zakapedia.in
VITE_OLA_MAPS_API_KEY=        # register at maps.olacabs.com/devportal

# Phase 2 — WhatsApp CRM
# WABA_TOKEN=
# WABA_PHONE_NUMBER_ID=

# Phase 3 — Twilio SMS
# TWILIO_ACCOUNT_SID=
# TWILIO_AUTH_TOKEN=
# TWILIO_FROM_NUMBER=
```

---

## 17. Design System

### 17.1 Colours

```css
--orange:     #FF6B35;  /* Primary CTA */
--orange2:    #FF8C61;  /* Gradient end */
--violet:     #7C3AED;  /* Secondary, active states */
--violet2:    #A78BFA;  /* Violet light */
--green:      #10B981;  /* Success, open */
--amber:      #F59E0B;  /* Pending, busy */
--red:        #EF4444;  /* Error, closed */
--sky:        #06B6D4;  /* Tertiary accent */
--ink:        #0A0A0F;  /* Primary text */
--ink2:       #1A1A2E;  /* Hero gradients */
--surface:    #FFFFFF;  /* Cards */
--background: #F4F3FF;  /* Page background */
--muted:      #6B7280;  /* Secondary text */
--border:     #E5E7EB;  /* Borders */
```

### 17.2 Typography

```css
--font-display: 'Syne', sans-serif;           /* Headings — bold, geometric */
--font-body:    'Plus Jakarta Sans', sans-serif; /* Body — clean, friendly */

Base font size: 18px
Heading: 24px–40px
Caption: 14px minimum
Line height: 1.6
```

### 17.3 Components

```css
Button min-height:   52px
Input min-height:    52px
Input border-radius: 12px
Card border-radius:  16px
Pill border-radius:  100px

Primary button:   linear-gradient(135deg, #FF6B35, #FF8C61)
                  box-shadow: 0 4px 16px rgba(255,107,53,0.35)

Secondary button: linear-gradient(135deg, #7C3AED, #9333EA)
                  box-shadow: 0 4px 16px rgba(124,58,237,0.35)
```

---

## 18. File Structure

```
inkneighbour/
├── public/
│   ├── favicon.ico
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── badge-72.png
│   └── sw.js
├── src/
│   ├── components/
│   │   ├── ui/                      ← Button, Input, Badge, Card, Modal
│   │   ├── JobCard.jsx
│   │   ├── SocietySearch.jsx
│   │   ├── UploadZone.jsx
│   │   ├── PriceBreakdown.jsx
│   │   ├── StarRating.jsx
│   │   ├── IOSInstallBanner.jsx
│   │   ├── ProviderTypeSelector.jsx
│   │   ├── ProviderCard.jsx
│   │   ├── OlaMapsPin.jsx           ← Static map pin on shop profile
│   │   ├── OlaMapsSearch.jsx        ← Autocomplete for customer + registration
│   │   ├── ServiceDisplayMenu.jsx
│   │   ├── POSServiceRow.jsx
│   │   ├── ShopStatusBadge.jsx
│   │   └── UPIQRCode.jsx
│   ├── pages/
│   │   ├── Landing.jsx
│   │   ├── LandingCustomer.jsx
│   │   ├── LandingOwner.jsx
│   │   ├── LandingShop.jsx
│   │   ├── Find.jsx
│   │   ├── Register/
│   │   │   ├── Step1Details.jsx
│   │   │   ├── Step2Location.jsx
│   │   │   ├── Step3Rates.jsx
│   │   │   └── Success.jsx
│   │   ├── Login.jsx
│   │   ├── Dashboard/
│   │   │   ├── index.jsx
│   │   │   ├── POS.jsx
│   │   │   ├── Earnings.jsx
│   │   │   ├── Feedback.jsx
│   │   │   ├── Availability.jsx
│   │   │   └── Settings.jsx
│   │   ├── ShopPage.jsx
│   │   ├── OrderConfirm.jsx
│   │   ├── FeedbackForm.jsx
│   │   └── Admin.jsx
│   ├── lib/
│   │   ├── supabase.js
│   │   ├── countries.js
│   │   ├── pricing.js
│   │   ├── location.js        ← GPS detection + Ola Maps geocoding
│   │   ├── search.js          ← find_nearby_providers(), distance sorting
│   │   ├── slugify.js
│   │   ├── storage.js
│   │   ├── availability.js
│   │   └── fuzzyMatch.js
│   ├── payments/
│   │   ├── index.js
│   │   ├── upi.js
│   │   ├── cash.js
│   │   └── stripe.js
│   ├── notifications/
│   │   ├── index.js
│   │   ├── whatsapp.js
│   │   ├── browser.js
│   │   └── sms.js
│   ├── locales/
│   │   ├── en.json
│   │   └── hi.json
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useOwner.js
│   │   ├── useJobs.js
│   │   └── useAvailability.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── supabase/
│   ├── functions/
│   │   ├── notify/index.ts
│   │   └── crm-webhook/index.ts
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_feedback.sql
│   │   ├── 003_push_subscriptions.sql
│   │   ├── 004_availability.sql
│   │   ├── 005_print_shop_owners.sql
│   │   ├── 006_service_menu.sql
│   │   ├── 007_pos_and_whatsapp.sql
│   │   └── 008_location_search.sql   ← find_nearby_providers() Postgres function
│   └── seed.sql
├── .env.example
├── vite.config.js
├── tailwind.config.js
├── CLAUDE.md
└── package.json
```

---

## 19. Success Metrics

### 19.1 North Star Metric

> **Monthly jobs fulfilled** — captures both supply (active owners) and demand (ordering customers) in one number.

```
Phase 1 target:   500 jobs/month
Phase 2 target:   5,000 jobs/month
Phase 3 target:   50,000 jobs/month
```

### 19.2 Phase 1 Metrics (0–3 months)

**Supply:**
```
Home owners registered:          10+
Print shops listed:              50+
Societies/localities covered:    10+ (Hyderabad)
Owner active after 30 days:      60%+
```

**Demand:**
```
Jobs placed per week:            50+
Customer repeat order rate:      30%+
Average jobs per owner/month:    20+
```

**Quality:**
```
Average star rating:             4.0+
SLA acceptance rate:             80%+
Job completion rate:             90%+
File auto-delete compliance:     100%
```

**Growth:**
```
Pamphlet → app visit rate:       2%+
App visit → registration rate:   30%+
WhatsApp inquiries per week:     20+
```

### 19.3 Phase 2 Metrics (3–6 months)

```
Cities live:                     3+
Home owners:                     100+
Print shops listed:              500+
Monthly jobs:                    1,000+
Paying shop subscribers:         20+
MRR:                             ₹5,980+ (20 × ₹299)
WhatsApp orders % of total:      20%+
```

### 19.4 Phase 3 Metrics (6–12 months)

```
Print shops listed nationally:   5,000+
Cities covered:                  50+
Monthly searches:                10,000+
MRR:                             ₹1,00,000+
GMV monthly:                     ₹10,00,000+
PWA installs:                    5,000+
Google rank "print shop [city]": Top 3 in 10+ cities
```

---

## 20. Phase Roadmap

### Phase 1 — Stripped MVP

**Rule:** *"Can a real person in Tarnaka place their first print order without this feature?"* If no — it's not Phase 1.

**Home Owner (already built ✅):**
- ✅ Registration + society matching
- ✅ Job queue + availability toggle
- ✅ Push notifications
- ✅ PWA
- ✅ Basic feedback (star rating)
- ✅ File auto-delete

**Print Shop (build next):**
- [ ] Registration — name, locality, map pin (Ola Maps)
- [ ] Basic shop profile — photo, services list (text), contact buttons
- [ ] Online print ordering (B&W + Colour only)
- [ ] UPI advance payment (no COD)
- [ ] Same job queue as home owners
- [ ] Shop status visible to customers (manual toggle only)

**Discovery:**
- [ ] GPS-based location detection (Ola Maps)
- [ ] Distance-sorted search results
- [ ] Locality text search fallback
- [ ] Provider type badges (🏠 / 🏪)

**Landing:**
- [ ] One main landing page (not 4 — just /)

**Privacy (minimal):**
- [ ] "Verified local printer" framing
- [ ] File deleted message on confirmation page

### Phase 2 — Growth Features

- [ ] Walk-in POS (/dashboard/pos)
- [ ] Earnings breakdown by source (online/walkin)
- [ ] Verified badge system
- [ ] Service display menu with prices
- [ ] Schedule-based availability
- [ ] Real-time status (Supabase Realtime)
- [ ] Scheduled/future orders
- [ ] Document type selector + privacy framework
- [ ] One-time expiring download link
- [ ] 3 audience landing pages (/print, /earn, /shop)
- [ ] Zakapedia WhatsApp CRM integration
- [ ] Map view on search results (Ola Maps multi-pin)
- [ ] Print shop subscription billing (₹299/₹499)
- [ ] SLA escalation reminders
- [ ] Reliability score display
- [ ] Customer order tracking page
- [ ] Owner response to feedback

### Phase 3 — Scale

- [ ] Full WhatsApp storefront (entire flow in WhatsApp)
- [ ] Custom service categories (POS)
- [ ] National print shop directory (crawled + listed)
- [ ] Razorpay Route — commission split
- [ ] Stripe — global payments
- [ ] Twilio SMS — non-WhatsApp regions
- [ ] Capacitor — Play Store + App Store
- [ ] Multi-language (Hindi, Telugu, Tamil)
- [ ] White-label for housing developers
- [ ] GST summary reports
- [ ] Analytics dashboard

### Phase 4 — The Directory Vision

- [ ] Every print shop in India listed
- [ ] Every home printer owner discoverable
- [ ] Office printers (opt-in)
- [ ] Print kiosks listed
- [ ] InkNeighbour = Google Maps of printing in India

---

## 21. Out of Scope (Phase 1)

- Walk-in POS (Phase 2)
- WhatsApp CRM bot (Phase 2)
- Schedule-based availability (Phase 2)
- Real-time Supabase status updates (Phase 2)
- Verified badge system (Phase 2)
- Document type selector (Phase 2)
- One-time expiring download link (Phase 2)
- Earnings by source breakdown (Phase 2)
- Audience-specific landing pages /print /earn /shop (Phase 2)
- Map view on search results (Phase 2)
- Subscription billing (Phase 2)
- Printer integration / direct print commands
- Scanning, binding, lamination as managed services
- Customer accounts / login
- Payment gateway / commission collection
- Native Android / iOS app (Phase 3)
- Multi-language UI (Phase 3)
- Full WhatsApp storefront (Phase 3)
- National directory crawling (Phase 4)

---

*InkNeighbour · PRD v3.0 · Zaheer · Zakapedia · inkneighbour.zakapedia.in*
