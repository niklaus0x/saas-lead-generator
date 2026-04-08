# 🚀 Lead Generator v4

A full-stack lead generation, outreach automation, and CRM platform — built for finding business owners across Africa and beyond. No paid API keys required.

---

## Features

### 🔍 Search
- Search by niche, country, city, team size, and contact role
- 27 niche categories with 50+ sub-niches (browse picker in UI)
- **Education niches**: daycare → secondary school, tutorial centers, JAMB/WAEC coaching, vocational, arts
- Smart search term expansion per niche

### 📡 Data Sources (all free)
| Source | Type |
|---|---|
| DuckDuckGo | Web search |
| OpenCorporates | Registered companies |
| VConnect | Nigerian business directory |
| ConnectNigeria | Nigerian business directory |
| BusinessList.com.ng | Nigerian business directory |
| Bark.com | Service provider directory |
| Yellow Pages NG | Local business listings |
| Google Maps | Local business data |
| Facebook / Instagram / Twitter | Social search links |

### ⚡ Parallel Scraping
- All 9 sources fire **simultaneously** via `Promise.allSettled`
- All enrichments run in parallel — ~5x faster than sequential
- No blocking between sources

### 🧠 Smarter Lead Intelligence
- **Google Maps mining** — phone, rating, review count
- **Instagram bio scraper** — phone, email, follower count
- **Facebook page finder** — contact info, about
- **Owner name extraction** — scraped from About pages
- **WhatsApp extraction** — from wa.me links and website text
- **Phone extraction** — Nigerian format (+234 / 0XX)
- **AI-style lead summary** — per-lead insight, no API key needed

### 📊 Lead Scoring (0–10)
| Signal | Points |
|---|---|
| Owner name found | +2 |
| WhatsApp found | +2 |
| Verified direct email | +2 |
| Pain signal detected | +2 |
| Instagram found | +1 |
| LinkedIn profile URL | +1 |

### 🔥 Pain Signal Detection
Searches for freelancer/contractor job postings near the company. Flags leads actively hiring gig workers — strong product fit indicator.

### 💾 Local Database
- All leads saved to `leads-db.json` automatically
- Cross-session deduplication
- Search history with date, query, and count

### 📤 Export
- **CSV** — all fields, spreadsheet-ready
- **JSON** — structured, CRM/API-ready
- **Google Sheets (TSV)** — direct paste into Google Sheets
- Available in both UI toolbar and CLI

---

## 💬 WhatsApp Queue

Batch-manage outreach messages with tracking.

```
POST /api/wa-queue/add        — Add leads to queue with personalized messages
GET  /api/wa-queue/:id/link   — Get wa.me link (pre-loaded with message)
PATCH /api/wa-queue/:id       — Update status: pending → sent → replied → skipped
GET  /api/wa-queue/stats      — Queue analytics
```

- Auto-personalizes message with owner name + company
- One-click open in WhatsApp Web or mobile app
- Reply rate tracking

---

## 📬 Outreach Automation

Industry-specific follow-up sequences (Day 1 / 3 / 7 / 14).

```
POST /api/outreach/enroll         — Enroll a lead in a sequence
POST /api/outreach/enroll-bulk    — Enroll multiple leads
GET  /api/outreach/due            — Get today's follow-ups
PATCH /api/outreach/:id/step/:n/sent  — Mark step as sent
PATCH /api/outreach/:id/reply     — Mark as replied (stops sequence)
PATCH /api/outreach/:id/status    — Pause / resume / stop
GET  /api/outreach/stats          — Reply rate and stats
```

**Templates available for:** Event Planning, Cleaning/Facilities, General (default)

---

## 📊 Analytics Dashboard

```
GET /api/analytics/overview     — Totals, conversion rate, avg score
GET /api/analytics/by-source    — Performance per data source
GET /api/analytics/by-country   — Leads by country
GET /api/analytics/scores       — Score distribution (0–10)
GET /api/analytics/funnel       — CRM stage conversion funnel
GET /api/analytics/timeline     — Leads found per day (last 30 days)
GET /api/analytics/whatsapp     — WA queue reply rate
GET /api/analytics/top-niches   — Most searched niches
```

---

## 📊 CRM Pipeline

6-stage pipeline: `new → contacted → interested → demo → converted → dead`

```
GET  /api/crm                    — Full pipeline view
POST /api/crm                    — Add lead to CRM
POST /api/crm/bulk               — Add multiple leads
PATCH /api/crm/:id/stage         — Move to a new stage
POST /api/crm/:id/note           — Add note (full activity log)
PATCH /api/crm/:id               — Update contact fields
DELETE /api/crm/:id              — Remove from CRM
GET  /api/crm/stats              — Conversion rate, avg score, stage counts
```

Persisted to `crm.json`.

---

## 👥 Multi-User

```
POST /api/users/register     — Create account
POST /api/users/login        — Get session token (30-day)
GET  /api/users/me           — Current user profile
GET  /api/users/team         — List all team members
POST /api/users/invite       — Invite teammate (admin only)
POST /api/users/rotate-key   — Generate new API key
POST /api/users/logout       — End session
```

**Auth:** Pass `X-Api-Key: your_key` or `Authorization: Bearer your_token` on any request.

---

## 🖥 Web UI

- Browse picker with grouped niche categories (education niches at top)
- Results table with **score badge** per lead (🟢🟡🔴)
- **Lead detail drawer** — click any row for full contact + outreach
- One-click WhatsApp message from drawer
- One-click email draft
- **Filter bar**: Has WhatsApp / Has Email / Hide Duplicates / Min Score
- **Sort**: Score / Name / Source
- **Export toolbar**: CSV / JSON / Google Sheets
- Company logos via Clearbit
- Pain signal 🔥 and duplicate ● indicators

---

## 💻 CLI

```bash
# Search
node cli/index.js search -n "event planners" -c Nigeria
node cli/index.js search -n "daycare" -c Nigeria --city Lagos --has-whatsapp
node cli/index.js search -n "cleaning" -c Nigeria --min-score 6 --output csv --file leads.csv

# Saved leads
node cli/index.js saved --filter has-whatsapp
node cli/index.js saved --min-score 7 --output sheets --file leads.tsv

# Export
node cli/index.js export --format csv --file all-leads.csv

# Database
node cli/index.js status
node cli/index.js clear
```

**Output formats:** `table` (default), `list`, `json`, `csv`, `sheets`  
**Colorized:** 🟢 high score, 🟡 medium, 🔴 low

---

## 📱 Mobile / PWA

- **Installable** — Add to Home Screen on iOS and Android
- **Offline support** — Service worker caches static assets
- **Mobile-optimized** viewport and touch-friendly UI
- **App shortcuts** — New Search, WhatsApp Queue, CRM Pipeline
- **Push notifications** — scaffold ready for future use

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Start backend
npm run server

# Start frontend (in a new terminal)
npm run dev

# Or run both
npm run dev & npm run server
```

Open [http://localhost:3000](http://localhost:3000)

---

## ⚙️ Environment Variables

Create a `.env` file (all optional — tool works without any):

```env
PORT=3001
HUNTER_API_KEY=your_hunter_key        # Optional: better email finding
SERPAPI_KEY=your_serpapi_key           # Optional: enhanced Google search
LEAD_GEN_API=http://localhost:3001     # CLI API endpoint
```

---

## 📁 File Structure

```
├── server/
│   ├── index.js          # Main API + parallel search engine
│   ├── intelligence.js   # Maps, Instagram, Facebook, AI summaries
│   ├── outreach.js       # Email/WA sequence automation
│   ├── analytics.js      # Analytics dashboard endpoints
│   └── users.js          # Multi-user auth + team management
├── components/
│   ├── SearchForm.tsx    # Search UI with niche browser
│   └── LeadsTable.tsx    # Results table with drawer + filters
├── cli/
│   └── index.js          # Full CLI tool
├── pages/
│   ├── _app.tsx          # PWA meta tags + service worker
│   └── index.tsx         # Main page
├── public/
│   ├── manifest.json     # PWA manifest
│   └── sw.js             # Service worker
├── types/
│   └── index.ts          # TypeScript types
├── leads-db.json         # Auto-created: saved leads
├── crm.json              # Auto-created: CRM pipeline
├── wa-queue.json         # Auto-created: WhatsApp queue
├── outreach.json         # Auto-created: email sequences
└── users.json            # Auto-created: user accounts
```

---

## 🌍 Countries Supported

55 countries: **United States** + all **54 African nations**

---

## 📜 License

MIT
