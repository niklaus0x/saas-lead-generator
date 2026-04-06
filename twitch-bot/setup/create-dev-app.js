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

async function createDevApp() {
  log('\n' + '='.repeat(60), C.bright);
  log('🔧 Twitch Developer App Automation', C.bright);
  log('='.repeat(60) + '\n', C.bright);

  const username = process.env.TWITCH_BOT_USERNAME;
  const password = process.env.TWITCH_BOT_PASSWORD;
  if (!username || !password) { err('Set TWITCH_BOT_USERNAME and TWITCH_BOT_PASSWORD in .env'); process.exit(1); }

  if (process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET) {
    warn('Client credentials already exist. Continuing will create a new app. Ctrl+C to cancel.');
    await new Promise(r => setTimeout(r, 3000));
  }

  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();

  try {
    step('1/10', 'Opening Twitch Developer Console...');
    await page.goto('https://dev.twitch.tv/console/apps', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    if (page.url().includes('login') || page.url().includes('id.twitch.tv')) {
      step('2/10', 'Logging in...');
      await page.waitForSelector('input[autocomplete="username"]', { state: 'visible', timeout: 10000 });
      await page.fill('input[autocomplete="username"]', username);
      await page.fill('input[type="password"]', password);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
      if (page.url().includes('two_factor') || page.url().includes('2fa')) {
        warn('2FA detected! Complete it in the browser (up to 2 minutes)...');
        await page.waitForURL('**/dev.twitch.tv/**', { timeout: 120000 });
      }
      await page.waitForURL('**/dev.twitch.tv/**', { timeout: 15000 });
      ok('Logged in');
    } else { ok('Already logged in'); }

    await page.waitForLoadState('networkidle');

    step('3/10', 'Clicking Register Your Application...');
    const regBtn = await page.waitForSelector('button:has-text("Register"), a:has-text("Register")', { state: 'visible', timeout: 10000 });
    await regBtn.click();
    await page.waitForTimeout(1000);
    ok('Registration form opened');

    step('4/10', 'Filling app details...');
    await page.waitForSelector('input[name="name"], input[placeholder*="name" i]', { state: 'visible', timeout: 10000 });
    await page.fill('input[name="name"], input[placeholder*="name" i]', 'niklaus0x-bot');
    await page.fill('input[name="redirect_uris"], input[placeholder*="redirect" i]', 'http://localhost:3000');
    await page.selectOption('select[name="category"]', { label: 'Chat Bot' });
    ok('App details filled');

    step('5/10', 'Creating app...');
    await page.click('button[type="submit"]:has-text("Create"), button:has-text("Create")');
    await page.waitForTimeout(2000);
    ok('App created');

    step('6/10', 'Opening app management...');
    await page.waitForSelector('text=niklaus0x-bot', { timeout: 10000 });
    const manageBtn = page.locator('text=niklaus0x-bot').locator('..').locator('button:has-text("Manage"), a:has-text("Manage")').first();
    await manageBtn.click();
    await page.waitForLoadState('networkidle');
    ok('Management page opened');

    step('7/10', 'Extracting Client ID...');
    const clientIdEl = await page.waitForSelector('input[readonly], code, [data-test-selector*="client-id"]', { timeout: 10000 });
    let clientId = (await clientIdEl.inputValue().catch(() => clientIdEl.textContent())).trim();
    if (!clientId || clientId.length < 20) throw new Error('Invalid Client ID');
    ok(`Client ID: ${clientId.substring(0, 20)}...`);

    step('8/10', 'Generating Client Secret...');
    const secretBtn = await page.waitForSelector('button:has-text("New Secret"), button:has-text("Generate")', { state: 'visible', timeout: 10000 });
    await secretBtn.click();
    await page.waitForTimeout(1000);
    const secretEl = await page.waitForSelector('code, input[type="text"][value*="a"]', { timeout: 10000 });
    let clientSecret = (await secretEl.inputValue().catch(() => secretEl.textContent())).trim();
    if (!clientSecret || clientSecret.length < 20) throw new Error('Invalid Client Secret');
    ok(`Client Secret: ${clientSecret.substring(0, 20)}...`);

    step('9/10', 'Saving to .env...');
    await updateEnv('TWITCH_CLIENT_ID', clientId);
    await updateEnv('TWITCH_CLIENT_SECRET', clientSecret);

    log('\n' + '='.repeat(60), C.green);
    log('✅ Developer App created and credentials saved!', C.green);
    log('\nNext: npm run setup:deploy', C.cyan);
    await page.waitForTimeout(3000);
  } catch (e) {
    err(`\n❌ ${e.message}`);
    process.exit(1);
  } finally { await browser.close(); }
}

if (require.main === module) createDevApp().catch(e => { err(e.message); process.exit(1); });
module.exports = { createDevApp };
