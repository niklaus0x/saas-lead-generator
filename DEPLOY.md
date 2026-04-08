# Deployment Guide

## 🚂 Railway (Recommended — ~3 minutes)

### One-click Deploy
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/niklaus0x/saas-lead-generator)

### Manual Steps

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select `saas-lead-generator`
4. Railway auto-detects Node.js and builds
5. Go to **Settings** → **Variables** and add your env vars:
   ```
   PORT=3001
   JWT_SECRET=your-random-secret-here
   NODE_ENV=production
   ```
6. To persist your leads database, go to **New** → **Volume**
   - Mount path: `/app`
   - This keeps `leads-db.json` / `leadgen.db` between deploys
7. Under **Settings** → **Networking**, click **Generate Domain**
8. Your app is live!

### Environment Variables on Railway

| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | Set to `3001` |
| `JWT_SECRET` | Yes | Random string for session security |
| `NODE_ENV` | Yes | Set to `production` |
| `SMTP_HOST` | No | Gmail: `smtp.gmail.com` |
| `SMTP_PORT` | No | `587` |
| `SMTP_USER` | No | Your email address |
| `SMTP_PASS` | No | Gmail app password |
| `HUNTER_API_KEY` | No | Hunter.io email finder |
| `OPENAI_API_KEY` | No | GPT lead summaries |
| `SLACK_WEBHOOK_URL` | No | New lead Slack alerts |

---

## 🎨 Render (Free tier available)

1. Go to [render.com](https://render.com) → **New Web Service**
2. Connect your GitHub repo
3. Set:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `node server/index.js & npm start`
   - **Environment:** Node
4. Add a **Disk** ($1/month) mounted at `/app` for persistent storage
5. Add environment variables (same as Railway table above)
6. Click **Create Web Service**

> ⚠️ Free tier on Render spins down after 15 minutes of inactivity. Upgrade to Starter ($7/month) for always-on.

---

## ✈️ Fly.io (Best performance)

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch app
fly launch

# Create persistent volume for data
fly volumes create leadgen_data --size 1

# Set environment variables
fly secrets set JWT_SECRET=your-random-secret NODE_ENV=production

# Deploy
fly deploy
```

---

## 🔀 Split Deploy: Vercel (frontend) + Railway (backend)

Best setup for maximum performance and free frontend hosting.

### Step 1 — Deploy backend to Railway
Follow the Railway steps above. Note your Railway URL (e.g. `https://your-app.railway.app`).

### Step 2 — Deploy frontend to Vercel
1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import `saas-lead-generator` from GitHub
3. Set **Root Directory** to `/` (default)
4. Add environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://your-app.railway.app
   ```
5. Click **Deploy**

### Step 3 — Update CORS on Railway
Add to Railway environment variables:
```
CORS_ORIGIN=https://your-vercel-app.vercel.app
```

---

## 🐳 Self-host with Docker

```bash
# On any VPS (DigitalOcean, Hetzner, Contabo, etc.)
git clone https://github.com/niklaus0x/saas-lead-generator.git
cd saas-lead-generator
cp .env.example .env
# Edit .env with your values

docker-compose up -d
```

**Recommended VPS:** Hetzner CX11 (€3.29/month) or DigitalOcean Basic ($4/month)

---

## After Deploying

1. Visit `https://your-domain/api/health` — should return `{ "status": "ok" }`
2. Visit `https://your-domain` — frontend should load
3. Visit `https://your-domain/analytics` — analytics dashboard
4. Run your first search and make sure results come back

## Troubleshooting

**Build fails:** Make sure `npm run build` works locally first.

**API not connecting:** Check `NEXT_PUBLIC_API_URL` points to your backend URL.

**Data not persisting:** Make sure you've added a volume/disk mounted at `/app`.

**SMTP not working:** Use a Gmail App Password, not your regular password. Enable 2FA first.
