# 🚀 Lead Generator v5

A production-grade lead generation, outreach automation, and CRM platform — built for finding business owners across Africa and beyond. Runs fully on free tools, no paid API keys required.

---

## Quick Start

### Option A — Local (recommended for development)

```bash
# 1. Clone the repo
git clone https://github.com/niklaus0x/saas-lead-generator.git
cd saas-lead-generator

# 2. Install dependencies
npm install

# Optional: install SQLite for production-grade storage
npm install better-sqlite3

# 3. Set up environment
cp .env.example .env
# Edit .env if needed (all fields optional)

# 4. Start backend (Terminal 1)
npm run server

# 5. Start frontend (Terminal 2)
npm run dev
```

Open **http://localhost:3000** — frontend  
API runs at **http://localhost:3001**

---

### Option B — Docker (one command)

```bash
# Clone and configure
git clone https://github.com/niklaus0x/saas-lead-generator.git
cd saas-lead-generator
cp .env.example .env

# Run everything
docker-compose up
```

Frontend: **http://localhost:3000**  
API: **http://localhost:3001**  
Data persists in `./data/` volume.

---

## Environment Variables

Copy `.env.example` to `.env`. **All variables are optional** — the tool works fully without any.

```env
# Server
PORT=3001

# CLI
LEAD_GEN_API=http://localhost:3001

# Enhanced search (optional)
SERPAPI_KEY=           # Paid SerpAPI — overrides free Google scraper

# Email finding (optional)
HUNTER_API_KEY=        # hunter.io — 25 free lookups/month
PROXYCURL_API_KEY=     # LinkedIn enrichment

# AI summaries (optional)
OPENAI_API_KEY=        # GPT-powered per-lead summaries

# Notifications (optional)
SLACK_WEBHOOK_URL=     # New lead alerts to Slack

# Email sending (optional — enables built-in outreach)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=you@gmail.com

# Security
JWT_SECRET=change-this-to-something-random

# Performance
SCRAPE_TIMEOUT=8000
MAX_ENRICH_WORKERS=8
```

### Setting up Gmail SMTP
1. Enable 2-Factor Authentication on your Google account
2. Go to Google Account → Security → App Passwords
3. Generate an app password for "Mail"
4. Use that as `SMTP_PASS` (not your regular password)

---

## Features

### 🔍 Search
- Search by niche, country, city, team size, and contact role
- **31 niche categories** with 50+ sub-niches in the Browse picker
- **New niches:** Creative Agencies, PR Agencies, Construction, Construction Contractors
- **Education niches:** Daycare → Secondary school, Tutorial centers, JAMB/WAEC coaching
- Smart term expansion (e.g. "cleaning" → cleaning service, janitorial, facility management)

### 📡 Data Sources (all free)
| Source | Description |
|---|---|
| Google (direct scrape) | Full organic results with rotating user agents |
| Bing (direct scrape) | Second search engine for broader coverage |
| DuckDuckGo | API fallback if Google/Bing block |
| OpenCorporates | Registered company database |
| VConnect | Nigerian business directory |
| ConnectNigeria | Nigerian business directory |
| BusinessList.com.ng | Nigerian business listings |
| Bark.com | Service provider directory |
| Yellow Pages NG | Local Nigerian listings |

### ⚡ Speed & Reliability
- **Parallel scraping** — all 9 sources fire simultaneously via `Promise.allSettled`
- **Background job queue** — searches run async, client polls for progress (0–100%)
- **SSE real-time stream** — live progress updates via Server-Sent Events
- **In-memory cache** — 30-min result cache, deduplication of in-flight requests
- **Auto-retry** — failed sources don't block other results
- **Rate limiting** — 10 searches/min, 120 API calls/min (protects the server)

### 🧠 Lead Intelligence (top 25 leads enriched per search)
- Owner/founder name extraction (from About pages)
- WhatsApp number (from wa.me links)
- Instagram handle (from website footers)
- Phone number (Nigerian format: +234 / 0XX)
- Email (scraped from website + contact page)
- Email pattern guesses (info@, firstname.lastname@, etc.)
- Company logo via Clearbit
- Google Maps data (rating, review count)
- Instagram bio scraper (phone, email, followers)
- AI-style lead summary per lead (no API key needed)

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
Top 8 leads per search are checked for freelancer/contractor job postings — flags businesses actively hiring gig workers.

### 💾 Database
- **SQLite** (if `better-sqlite3` installed) — production-grade, WAL mode, indexed
- **JSON fallback** — works without any installation
- Cross-session deduplication
- Search history with date, query, and count

### 📤 Export
- CSV — all fields including CRM status
- JSON — structured, API/CRM-ready
- Google Sheets (TSV) — direct paste
- Available in UI toolbar and CLI

---

## 💬 WhatsApp Queue

Batch manage outreach with message tracking.

```
POST /api/wa-queue/add        — Add leads with personalized messages
GET  /api/wa-queue/:id/link   — Get wa.me link pre-loaded with message
PATCH /api/wa-queue/:id       — Update: pending → sent → replied → skipped
GET  /api/wa-queue/stats      — Queue analytics
```

Messages auto-personalized with owner name + company name.

---

## 📬 Outreach Automation

Industry-specific Day 1 / 3 / 7 / 14 sequences.

```
POST /api/outreach/enroll           — Enroll a lead
POST /api/outreach/enroll-bulk      — Enroll multiple leads
GET  /api/outreach/due              — Today's follow-ups
PATCH /api/outreach/:id/step/:n/sent — Mark step sent
PATCH /api/outreach/:id/reply       — Mark replied (stops sequence)
GET  /api/outreach/stats            — Reply rate and counts
```

**Templates included for:** Event Planning, Cleaning/Facilities, General

### Built-in Email Sending

Configure SMTP in `.env` to send emails directly:

```
GET  /api/email/status              — Check SMTP config
POST /api/email/test                — Test SMTP connection
POST /api/email/send                — Send single email
POST /api/email/send-bulk           — Send up to 50 emails
POST /api/email/send-sequence-step  — Send a sequence step
GET  /api/email/log                 — Sent email log
```

---

## 📊 Analytics Dashboard

Visual dashboard at **http://localhost:3000/analytics**

```
GET /api/analytics/overview     — Totals, conversion rate, avg score
GET /api/analytics/by-source    — Leads and score per source
GET /api/analytics/by-country   — Leads by country
GET /api/analytics/scores       — Score distribution (0–10)
GET /api/analytics/funnel       — CRM stage conversion funnel
GET /api/analytics/timeline     — Leads found per day (30 days)
GET /api/analytics/whatsapp     — WA queue reply rate
GET /api/analytics/top-niches   — Most searched niches
```

**UI includes:** stat cards, CRM funnel bars, score distribution chart, source bar chart, niche bar chart, daily timeline, source performance table. Auto-refreshes every 30 seconds.

---

## 📊 CRM Pipeline

`new → contacted → interested → demo → converted → dead`

```
GET  /api/crm                  — Full pipeline view
POST /api/crm                  — Add lead
POST /api/crm/bulk             — Add multiple leads
PATCH /api/crm/:id/stage       — Move to new stage + note
POST /api/crm/:id/note         — Add note (full activity log)
PATCH /api/crm/:id             — Update contact fields
DELETE /api/crm/:id            — Remove from CRM
GET  /api/crm/stats            — Conversion rate, avg score, stage counts
```

---

## 👥 Multi-User

```
POST /api/users/register     — Create account
POST /api/users/login        — Get 30-day session token
GET  /api/users/me           — Current user
GET  /api/users/team         — List team members
POST /api/users/invite       — Invite teammate (admin only)
POST /api/users/rotate-key   — Generate new API key
POST /api/users/logout       — End session
```

**Auth:** Add `X-Api-Key: your_key` or `Authorization: Bearer token` to any request.

---

## ⚙️ Background Jobs

Searches run in the background — no HTTP timeouts.

```
POST /api/search-leads        — Returns { jobId } immediately
GET  /api/jobs/:id            — Poll for progress + results
GET  /api/jobs/:id/stream     — SSE real-time progress stream
GET  /api/jobs               — List recent jobs
```

**Job progress example:**
```json
{ "status": "running", "progress": 65, "progressMsg": "Enriching leads..." }
{ "status": "done", "progress": 100, "result": { "leads": [...] } }
```

---

## 🖥 Web UI

| Page | URL | Description |
|---|---|---|
| Search | / | Find leads, filter, export, CRM |
| Analytics | /analytics | Charts, funnel, source performance |

**Features:** browse picker (31 niches), score badges 🟢🟡🔴, lead detail drawer, one-click WhatsApp + email, filter bar, sort controls, export toolbar, company logos, pain signal 🔥 and duplicate ● indicators.

---

## 💻 CLI

```bash
# Search — up to 25 fully enriched leads
node cli/index.js search -n "creative agency" -c Nigeria --city Lagos
node cli/index.js search -n "PR agency" -c Nigeria --has-whatsapp --min-score 6
node cli/index.js search -n "construction" -c Nigeria --output csv --file leads.csv
node cli/index.js search -n "event planners" -c Nigeria --min-score 7 --sort score
node cli/index.js search -n "daycare" -c Nigeria --city Lagos --has-whatsapp

# Saved leads
node cli/index.js saved --filter has-whatsapp
node cli/index.js saved --min-score 7 --output sheets --file leads.tsv

# Export
node cli/index.js export --format csv --file all-leads.csv
node cli/index.js export --format json

# Database
node cli/index.js status
node cli/index.js clear
```

**Output formats:** `table` (default), `list`, `json`, `csv`, `sheets`  
**Colors:** 🟢 high score (8+), 🟡 medium (5–7), 🔴 low (0–4)

---

## 📱 Mobile / PWA

- **Installable** — Add to Home Screen on iOS + Android
- **Offline support** — Service worker caches static assets
- **App shortcuts** — New Search, WhatsApp Queue, CRM Pipeline
- Push notification scaffold ready

---

## 🐳 Docker Deployment

```bash
# Development
docker-compose up

# Production (detached)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

**Ports:**
- `3000` — Next.js frontend
- `3001` — Express API

Data persists in `./data/` volume between restarts.

---

## 📁 File Structure

```
├── server/
│   ├── index.js              # Main API + parallel search engine (v4.1)
│   ├── google-search.js      # Free Google + Bing + DDG search
│   ├── queue.js              # Background job queue + SSE streaming
│   ├── db.js                 # SQLite / JSON storage layer
│   ├── rate-limiter.js       # Per-IP rate limiting
│   ├── email-sender.js       # SMTP email sending
│   ├── intelligence.js       # Maps, Instagram, Facebook, AI summaries
│   ├── outreach.js           # Sequence automation
│   ├── analytics.js          # Dashboard API endpoints
│   └── users.js              # Multi-user auth
├── components/
│   ├── SearchForm.tsx         # Search UI + 31-niche browser
│   └── LeadsTable.tsx         # Results table + drawer + filters
├── pages/
│   ├── _app.tsx               # PWA + service worker registration
│   ├── index.tsx              # Main search page
│   └── analytics.tsx          # Analytics dashboard
├── cli/
│   └── index.js               # Full CLI tool
├── public/
│   ├── manifest.json          # PWA manifest
│   └── sw.js                  # Service worker
├── types/index.ts
├── .env.example               # All environment variables documented
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── outreach-messages.md       # Ready-to-send outreach templates (10 industries)
└── 10-customer-leads.md       # 10 verified Lagos leads for CrewPay
```

**Auto-created data files** (excluded from git):
```
leads-db.json / leadgen.db   # Saved leads
crm.json                     # CRM pipeline
wa-queue.json                # WhatsApp queue
outreach.json                # Email sequences
users.json                   # User accounts
email-log.json               # Sent email log
```

---

## 🌍 Countries

55 countries: **United States** + all **54 African nations**

---

## 📦 Dependencies

**Required:**
```bash
npm install express cors axios cheerio dotenv nodemailer commander
```

**Optional (recommended for production):**
```bash
npm install better-sqlite3   # SQLite database
```

---

## 📜 License

MIT — free to use, modify, and deploy.
