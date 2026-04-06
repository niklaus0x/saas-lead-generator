#!/usr/bin/env node

require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const C = { reset:'\x1b[0m', green:'\x1b[32m', yellow:'\x1b[33m', red:'\x1b[31m', cyan:'\x1b[36m', bright:'\x1b[1m' };
const log = (m, c=C.reset) => console.log(`${c}${m}${C.reset}`);
const step = (n, m) => log(`\n[${n}] ${m}`, C.cyan);
const ok = m => log(`✓ ${m}`, C.green);
const err = m => log(`✗ ${m}`, C.red);
const warn = m => log(`⚠ ${m}`, C.yellow);

async function updateEnv(key, value) {
  const envPath = path.join(__dirname, '..', '.env');
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const re = new RegExp(`^${key}=.*$`, 'm');
  content = re.test(content) ? content.replace(re, `${key}=${value}`) : content + (content.endsWith('\n')?'':'\n') + `${key}=${value}\n`;
  fs.writeFileSync(envPath, content, 'utf8');
  ok(`Saved ${key} to .env`);
}

async function getOAuthToken() {
  log('\n' + '='.repeat(60), C.bright);
  log('🤖 Twitch OAuth Token Automation', C.bright);
  log('='.repeat(60) + '\n', C.bright);

  const username = process.env.TWITCH_BOT_USERNAME;
  const password = process.env.TWITCH_BOT_PASSWORD;
  if (!username || !password) { err('Set TWITCH_BOT_USERNAME and TWITCH_BOT_PASSWORD in .env'); process.exit(1); }

  if (process.env.TWITCH_OAUTH_TOKEN) {
    warn('TWITCH_OAUTH_TOKEN already exists. Continuing will replace it. Ctrl+C to cancel.');
    await new Promise(r => setTimeout(r, 3000));
  }

  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();

  try {
    step('1/10', 'Navigating to twitchapps.com/tmi...');
    await page.goto('https://twitchapps.com/tmi/', { waitUntil: 'networkidle', timeout: 30000 });
    ok('Page loaded');

    step('2/10', 'Clicking Connect with Twitch...');
    await page.click('a[href*="twitch.tv/login"]', { timeout: 10000 });
    await page.waitForURL('**/login**', { timeout: 15000 });
    ok('Twitch login page opened');

    step('3/10', 'Entering credentials...');
    await page.waitForSelector('input[autocomplete="username"]', { state: 'visible', timeout: 10000 });
    await page.fill('input[autocomplete="username"]', username);
    await page.fill('input[type="password"]', password);
    ok('Credentials entered');

    step('4/10', 'Logging in...');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    step('5/10', 'Checking for 2FA...');
    if (page.url().includes('two_factor') || page.url().includes('2fa')) {
      warn('2FA detected! Please complete it in the browser (up to 2 minutes)...');
      await page.waitForURL('**/authorize**', { timeout: 120000 });
      ok('2FA completed');
    } else { ok('No 2FA required'); }

    step('6/10', 'Waiting for authorization page...');
    try { await page.waitForURL('**/authorize**', { timeout: 15000 }); } catch {}
    await page.waitForLoadState('networkidle');
    ok('Authorization page loaded');

    step('7/10', 'Clicking Authorize...');
    const btn = await page.waitForSelector('button[type="submit"], button:has-text("Authorize")', { state: 'visible', timeout: 10000 });
    await btn.click();
    ok('Authorized');

    step('8/10', 'Extracting token...');
    await page.waitForURL('**/twitchapps.com/**', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    const el = await page.waitForSelector('textarea, pre, code, #oauth-token, input[type="text"]', { timeout: 10000 });
    let token = (await el.textContent() || await el.inputValue()).trim();
    if (!token.startsWith('oauth:')) throw new Error('Invalid token format');
    ok('Token extracted');

    step('9/10', 'Saving to .env...');
    await updateEnv('TWITCH_OAUTH_TOKEN', token);

    log('\n' + '='.repeat(60), C.green);
    log('✅ OAuth token saved!', C.green);
    log(`Token: ${token.substring(0, 20)}...`, C.bright);
    log('\nNext: npm run setup:app', C.cyan);
    await page.waitForTimeout(3000);
  } catch (e) {
    err(`\n❌ ${e.message}`);
    log('Check username/password, 2FA, and internet connection.');
    process.exit(1);
  } finally { await browser.close(); }
}

if (require.main === module) getOAuthToken().catch(e => { err(e.message); process.exit(1); });
module.exports = { getOAuthToken };
