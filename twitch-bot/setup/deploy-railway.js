#!/usr/bin/env node

require('dotenv').config();
const { chromium } = require('playwright');

const C = { reset:'\x1b[0m', green:'\x1b[32m', yellow:'\x1b[33m', red:'\x1b[31m', cyan:'\x1b[36m', bright:'\x1b[1m', magenta:'\x1b[35m' };
const log = (m, c=C.reset) => console.log(`${c}${m}${C.reset}`);
const step = (n, m) => log(`\n[${n}] ${m}`, C.cyan);
const ok = m => log(`✓ ${m}`, C.green);
const err = m => log(`✗ ${m}`, C.red);
const warn = m => log(`⚠ ${m}`, C.yellow);

async function deployToRailway() {
  log('\n' + '='.repeat(60), C.bright);
  log('🚂 Railway Deployment Automation', C.bright);
  log('='.repeat(60) + '\n', C.bright);

  const required = ['TWITCH_BOT_USERNAME','TWITCH_OAUTH_TOKEN','TWITCH_CHANNEL','TWITCH_CLIENT_ID','TWITCH_CLIENT_SECRET'];
  const missing = required.filter(v => !process.env[v]);
  if (missing.length) { err(`Missing: ${missing.join(', ')}`); log('Run setup:token and setup:app first.'); process.exit(1); }

  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  let deploymentUrl = null;

  try {
    step('1/8', 'Opening Railway.app...');
    await page.goto('https://railway.app', { waitUntil: 'domcontentloaded', timeout: 30000 });
    ok('Page loaded');

    step('2/8', 'Logging in with GitHub...');
    const loginBtn = await page.waitForSelector('button:has-text("Login"), a:has-text("Login")', { state: 'visible', timeout: 10000 });
    await loginBtn.click();
    await page.waitForTimeout(1000);
    try {
      const ghBtn = await page.waitForSelector('button:has-text("GitHub"), a:has-text("GitHub")', { state: 'visible', timeout: 5000 });
      await ghBtn.click();
    } catch {}
    if (page.url().includes('github.com')) {
      warn('GitHub authorization page — please authorize Railway in the browser if prompted.');
      const authBtn = await page.waitForSelector('button:has-text("Authorize")', { timeout: 30000, state: 'visible' }).catch(() => null);
      if (authBtn) { await authBtn.click(); ok('GitHub authorized'); }
      await page.waitForURL('**/railway.app/**', { timeout: 30000 });
    }
    ok('Logged in');

    step('3/8', 'Creating new project...');
    await page.waitForLoadState('networkidle');
    const newBtn = await page.waitForSelector('button:has-text("New Project")', { state: 'visible', timeout: 10000 });
    await newBtn.click();
    await page.waitForTimeout(1000);
    ok('New project dialog opened');

    step('4/8', 'Selecting Deploy from GitHub...');
    const ghDeployBtn = await page.waitForSelector('button:has-text("Deploy from GitHub")', { state: 'visible', timeout: 10000 });
    await ghDeployBtn.click();
    await page.waitForTimeout(1500);
    ok('GitHub deployment selected');

    step('5/8', 'Selecting saas-lead-generator repo...');
    const search = await page.waitForSelector('input[placeholder*="search" i]', { state: 'visible', timeout: 10000 }).catch(() => null);
    if (search) { await search.fill('saas-lead-generator'); await page.waitForTimeout(1000); }
    const repo = await page.waitForSelector('text=niklaus0x/saas-lead-generator', { state: 'visible', timeout: 10000 });
    await repo.click();
    ok('Repository selected');

    step('6/8', 'Setting root directory to twitch-bot...');
    const rootInput = await page.waitForSelector('input[placeholder*="root" i], input[placeholder*="directory" i]', { state: 'visible', timeout: 5000 }).catch(() => null);
    if (rootInput) { await rootInput.fill('twitch-bot'); ok('Root directory set'); }
    else { warn('Could not set root directory — set to twitch-bot manually in Railway settings'); }

    step('7/8', 'Adding environment variables...');
    const envVars = { TWITCH_BOT_USERNAME: process.env.TWITCH_BOT_USERNAME, TWITCH_OAUTH_TOKEN: process.env.TWITCH_OAUTH_TOKEN, TWITCH_CHANNEL: process.env.TWITCH_CHANNEL, TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET };
    const envBtn = await page.waitForSelector('button:has-text("Variables"), button:has-text("Environment")', { state: 'visible', timeout: 5000 }).catch(() => null);
    if (envBtn) {
      await envBtn.click(); await page.waitForTimeout(1000);
      for (const [key, value] of Object.entries(envVars)) {
        try {
          const addBtn = await page.waitForSelector('button:has-text("Add")', { state: 'visible', timeout: 3000 }).catch(() => null);
          if (addBtn) { await addBtn.click(); await page.waitForTimeout(500); }
          await page.locator('input[placeholder*="KEY" i]').last().fill(key);
          await page.locator('input[placeholder*="VALUE" i], textarea').last().fill(value);
          log(`  ✓ ${key}`, C.green);
        } catch { warn(`  Could not add ${key} — add manually`); }
      }
      ok('Environment variables configured');
    } else { warn('Could not find env vars section — add them manually after deployment'); }

    step('8/8', 'Deploying...');
    const deployBtn = await page.waitForSelector('button:has-text("Deploy")', { state: 'visible', timeout: 10000 });
    await deployBtn.click();
    ok('Deployment initiated!');
    await page.waitForTimeout(5000);

    const urlEl = await page.waitForSelector('a:has-text(".up.railway.app"), code:has-text("railway.app")', { timeout: 20000 }).catch(() => null);
    if (urlEl) deploymentUrl = (await urlEl.textContent() || await urlEl.getAttribute('href'))?.trim();

    log('\n' + '='.repeat(60), C.green);
    log('✅ Deployed to Railway!', C.green);
    if (deploymentUrl) log(`🌐 URL: ${deploymentUrl}`, C.bright);
    else log('📝 Check Railway dashboard for your deployment URL', C.cyan);
    log('\n🎉 Twitch bot is live!', C.magenta);
    await page.waitForTimeout(5000);
  } catch (e) {
    err(`\n❌ ${e.message}`);
    process.exit(1);
  } finally { await browser.close(); }
}

if (require.main === module) deployToRailway().catch(e => { err(e.message); process.exit(1); });
module.exports = { deployToRailway };
