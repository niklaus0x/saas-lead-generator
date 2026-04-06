# Twitch Chat Bot for niklaus0x

A fully-featured Twitch chat bot managed by **Tola** (AI Social Media Manager). Handles commands, auto-moderation, event responses, and timed messages for the niklaus0x channel.

## Features

### Commands
`!links` `!schedule` `!discord` `!socials` `!github` `!lurk` `!hype` `!uptime` `!commands` `!so @user` (mods) `!raid @channel` (broadcaster)

### Auto-Moderation
- Banned words filter (configurable)
- Link protection (non-trusted users)
- CAPS spam detection
- Emote spam limit
- Repeat message detection

### Event Responses
Follows, subs, resubs, gift subs, bits, raids, hosts — all with custom messages

### Timed Messages
Rotating promos every 20 mins (only when chat is active)

---

## Setup

### 1. Create a Bot Twitch Account
Create a separate Twitch account for the bot (e.g. `niklaus0x_bot`).

### 2. Get OAuth Token
1. Log in as the **bot account**
2. Go to https://twitchapps.com/tmi/
3. Authorize and copy the token (starts with `oauth:`)

### 3. Get Client ID & Secret
1. Go to https://dev.twitch.tv/console
2. Register a new application (Category: Chat Bot)
3. Copy Client ID and generate a Client Secret

### 4. Configure
```bash
cp env.example.txt .env
# Fill in all values in .env
```

### 5. Run
```bash
npm install
npm start
```

---

## Deploy Free on Railway.app

1. Go to https://railway.app → New Project → Deploy from GitHub
2. Select `niklaus0x/saas-lead-generator`
3. Set **Root Directory** to `twitch-bot`
4. Add env variables (TWITCH_BOT_USERNAME, TWITCH_OAUTH_TOKEN, TWITCH_CHANNEL, TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET)
5. Deploy — runs 24/7 for free

**Alternative:** Render.com — same steps, set start command to `npm start`

---

## Customization

All settings in `config.json`:
- Add/edit commands under `"commands"`
- Add banned words under `"moderation.bannedWords"`
- Add trusted users under `"moderation.trustedUsers"`
- Edit timed messages under `"timedMessages.messages"`

---

## Tola's Role

**Tola (AI Social Media Manager)** manages this bot and can:
- Update commands and timed messages dynamically
- Adjust moderation settings for events/collabs
- Customize event responses (follows, raids, subs)
- Coordinate Twitch activity with broader social media strategy across Instagram, Twitter/X, TikTok, and YouTube

---

Built for **niklaus0x** 💜
