# 🚀 Lead Generator v4.1

A full-stack lead generation, outreach automation, and CRM platform — built for finding business owners across Africa and beyond. No paid API keys required.

---

## What's New in v4.1
- ⚡ **25-lead enrichment per search** (up from 8) — WhatsApp, email, owner name, Instagram, phone extracted for top 25 results
- 🔥 **Pain signal detection expanded** to top 8 leads per search
- 🏗 **New niches:** Creative Agencies, PR Agencies, Construction Companies, Construction Contractors
- 🔍 Per-source result limit increased for higher raw lead volume

---

## Features

### 🔍 Search
- Search by niche, country, city, team size, and contact role
- **31 niche categories** with 50+ sub-niches (browse picker in UI)
- **Education niches**: daycare → secondary school, tutorial centers, JAMB/WAEC coaching, vocational, arts
- **New niches**: Creative Agencies, PR Agencies, Construction, Construction Contractors
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
| Google Maps | Local business data (search link) |
| Facebook / Instagram / Twitter | Social search links |

### ⚡ Parallel Scraping
- All 9 sources fire **simultaneously** via `Promise.allSettled`
- All enrichments run in **parallel batches of 5** — no sequential blocking
- ~5x faster than sequential scraping

### 🧠 Lead Intelligence (per lead)
- **Owner/founder name** — extracted from About pages
- **WhatsApp number** — from wa.me links and website text
- **Instagram handle** — from website footers and bios
- **Phone number** — Nigerian format (+234 / 0XX)
- **Email** — scraped from website + contact page
- **Email pattern guesses** — firstname.lastname@, info@, etc.
- **Company logo** — via Clearbit
- **Google Maps mining** — phone, rating, review count
- **Instagram bio scraper** — phone, email, followers
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
Searches for freelancer/contractor job postings near the company. Top 8 leads per search are checked.

### 💾 Local Database
- All leads saved to `leads-db.json` automatically
- Cross-session deduplication
- Search history with date, query, and count

### 📤 Export
- **CSV** — all fields including CRM status
- **JSON** — structured, API/CRM-ready
- **Google Sheets (TSV)** — direct paste
- Available in UI toolbar and CLI

---

## 💬 WhatsApp Queue

```
POST /api/wa-queue/add        — Add leads with personalized messages
GET  /api/wa-queue/:id/link   — Get wa.me link pre-loaded with message
PATCH /api/wa-queue/:id       — Update status: pending/sent/replied/skipped
GET  /api/wa-queue/stats      — Queue analytics
```

---

## 📬 Outreach Automation

Industry-specific Day 1 / 3 / 7 / 14 sequences.

```
POST /api/outreach/enroll          — Enroll a lead
POST /api/outreach/enroll-bulk     — Enroll multiple leads
GET  /api/outreach/due             — Today's follow-ups
PATCH /api/outreach/:id/step/:n/sent  — Mark step sent
PATCH /api/outreach/:id/reply      — Mark as replied
GET  /api/outreach/stats           — Reply rate and counts
```

**Templates:** Event Planning, Cleaning/Facilities, General

---

## 📊 Analytics Dashboard

```
GET /api/analytics/overview     — Totals, conversion rate, avg score
GET /api/analytics/by-source    — Performance per source
GET /api/analytics/by-country   — Leads by country
GET /api/analytics/scores       — Score distribution
GET /api/analytics/funnel       — CRM conversion funnel
GET /api/analytics/timeline     — Leads per day (30 days)
GET /api/analytics/whatsapp     — WA reply rate
GET /api/analytics/top-niches   — Most searched niches
```

---

## 📊 CRM Pipeline

`new → contacted → interested → demo → converted → dead`

```
GET  /api/crm                  — Full pipeline
POST /api/crm                  — Add lead
POST /api/crm/bulk             — Add multiple
PATCH /api/crm/:id/stage       — Move stage
POST /api/crm/:id/note         — Add note
GET  /api/crm/stats            — Conversion rate + counts
```

---

## 👥 Multi-User

```
POST /api/users/register     — Create account
POST /api/users/login        — Get 30-day session token
GET  /api/users/me           — Current user
GET  /api/users/team         — Team members
POST /api/users/invite       — Invite teammate (admin only)
POST /api/users/rotate-key   — New API key
```

**Auth:** `X-Api-Key: your_key` or `Authorization: Bearer token`

---

## 🖥 Web UI

- Browse picker with **31 grouped niche categories**
- Score badge per lead: 🟢 8–10 / 🟡 5–7 / 🔴 0–4
- **Lead detail drawer** — full contact + outreach buttons
- One-click WhatsApp and email from drawer
- **Filter bar**: Has WhatsApp / Has Email / Hide Duplicates / Min Score
- **Sort**: Score / Name / Source
- **Export toolbar**: CSV / JSON / Google Sheets
- Company logos, pain signal 🔥 and duplicate ● indicators

---

## 💻 CLI

```bash
# Search — returns up to 25 fully enriched leads
node cli/index.js search -n "creative agency" -c Nigeria --city Lagos
node cli/index.js search -n "PR agency" -c Nigeria --has-whatsapp --min-score 6
node cli/index.js search -n "construction contractor" -c Nigeria --output csv --file leads.csv
node cli/index.js search -n "event planners" -c Nigeria --min-score 7 --sort score

# Saved leads
node cli/index.js saved --filter has-whatsapp
node cli/index.js saved --min-score 7 --output sheets --file leads.tsv

# Export all
node cli/index.js export --format csv --file all-leads.csv

# Database
node cli/index.js status
node cli/index.js clear
```

---

## 📱 Mobile / PWA

- **Installable** — Add to Home Screen (iOS + Android)
- **Offline support** — Service worker
- **App shortcuts** — New Search, WhatsApp Queue, CRM
- Push notification scaffold ready

---

## 🚀 Getting Started

```bash
npm install

# Terminal 1 — backend
npm run server

# Terminal 2 — frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env`. All variables are optional.

```env
PORT=3001
LEAD_GEN_API=http://localhost:3001

# Optional enhancements
SERPAPI_KEY=          # Enhanced Google search
HUNTER_API_KEY=       # Direct email finder
PROXYCURL_API_KEY=    # LinkedIn enrichment
OPENAI_API_KEY=       # GPT lead summaries
SLACK_WEBHOOK_URL=    # New lead Slack alerts
SMTP_HOST=            # Email sending
SMTP_USER=
SMTP_PASS=
JWT_SECRET=           # Session security
```

---

## 📁 File Structure

```
├── server/
│   ├── index.js            # Main API + parallel search (v4.1)
│   ├── intelligence.js     # Maps, Instagram, Facebook, AI summaries
│   ├── outreach.js         # Sequence automation
│   ├── analytics.js        # Dashboard endpoints
│   ├── users.js            # Multi-user auth
│   └── search-optimized.js # Cache, dedup, batch module
├── components/
│   ├── SearchForm.tsx      # Search UI + niche browser
│   └── LeadsTable.tsx      # Results + drawer + filters
├── cli/
│   └── index.js            # CLI tool
├── pages/
│   ├── _app.tsx            # PWA + service worker
│   └── index.tsx           # Main page
├── public/
│   ├── manifest.json       # PWA manifest
│   └── sw.js               # Service worker
├── types/index.ts
├── .env.example
├── outreach-messages.md    # Ready-to-send outreach templates
├── 10-customer-leads.md    # 10 verified Lagos leads for CrewPay
├── leads-db.json           # Auto-created: saved leads
├── crm.json                # Auto-created: CRM pipeline
├── wa-queue.json           # Auto-created: WhatsApp queue
├── outreach.json           # Auto-created: sequences
└── users.json              # Auto-created: accounts
```

---

## 🌍 Countries

55 countries: **United States** + all **54 African nations**

---

## 📜 License

MIT
