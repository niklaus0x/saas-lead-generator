#!/usr/bin/env node
/**
 * Master Setup Orchestrator
 * Runs: Step 0 (create account) → Step 1 (OAuth token) → Step 2 (dev app) → Step 3 (deploy)
 * Usage: node setup/run-all.js  OR  npm run setup
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const C = { reset:'\x1b[0m', green:'\x1b[32m', yellow:'\x1b[33m', red:'\x1b[31m', cyan:'\x1b[36m', bright:'\x1b[1m', magenta:'\x1b[35m' };
const log = (m, c=C.reset) => console.log(`${c}${m}${C.reset}`);
const ok = m => log(`✓ ${m}`, C.green);
const err = m => log(`✗ ${m}`, C.red);
const warn = m => log(`⚠ ${m}`, C.yellow);
const check = v => { require('dotenv').config({ override: true }); return !!(process.env[v]?.trim()); };
const run = (file, name) => {
  try { execSync(`node "${path.join(__dirname, file)}"`, { stdio: 'inherit', cwd: path.join(__dirname, '..') }); return true; }
  catch { err(`${name} failed`); return false; }
};

const STEPS = [
  { step: 0, name: 'Create Twitch Bot Account', file: 'create-account.js', skip: () => false, required: ['TWITCH_BOT_USERNAME','TWITCH_BOT_PASSWORD','TWITCH_BOT_EMAIL'] },
  { step: 1, name: 'Get OAuth Token', file: 'get-oauth-token.js', skip: () => check('TWITCH_OAUTH_TOKEN'), required: ['TWITCH_BOT_USERNAME','TWITCH_BOT_PASSWORD'] },
  { step: 2, name: 'Create Developer App', file: 'create-dev-app.js', skip: () => check('TWITCH_CLIENT_ID') && check('TWITCH_CLIENT_SECRET'), required: ['TWITCH_BOT_USERNAME','TWITCH_BOT_PASSWORD'] },
  { step: 3, name: 'Deploy to Railway', file: 'deploy-railway.js', skip: () => false, required: ['TWITCH_OAUTH_TOKEN','TWITCH_CLIENT_ID','TWITCH_CLIENT_SECRET'] },
];

async function main() {
  log('\n' + '='.repeat(70), C.bright);
  log('🚀 Twitch Bot — Complete Setup Automation', C.bright);
  log('='.repeat(70) + '\n', C.bright);
  log('Steps: 0 (create account) → 1 (OAuth token) → 2 (dev app) → 3 (deploy)\n');

  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    const ex = path.join(__dirname, '..', 'env.example.txt');
    if (fs.existsSync(ex)) fs.copyFileSync(ex, envPath);
    warn('.env created — fill in TWITCH_BOT_USERNAME, TWITCH_BOT_PASSWORD, TWITCH_BOT_EMAIL, TWITCH_CHANNEL then run again.');
    process.exit(0);
  }

  require('dotenv').config({ override: true });
  const missing = ['TWITCH_BOT_USERNAME','TWITCH_BOT_PASSWORD','TWITCH_BOT_EMAIL'].filter(v => !process.env[v]);
  if (missing.length) { err(`Missing required vars: ${missing.join(', ')}`); process.exit(1); }

  let done = 0;
  for (const s of STEPS) {
    log(`\n${'═'.repeat(60)}`);
    log(`📌 Step ${s.step}: ${s.name}`, C.cyan);
    if (s.skip()) { ok('Already complete — skipping'); done++; continue; }
    const missingVars = s.required.filter(v => !check(v));
    if (missingVars.length) { warn(`Missing: ${missingVars.join(', ')} — skipping`); continue; }
    if (run(s.file, s.name)) done++;
    else { err(`Step ${s.step} failed — run manually: node setup/${s.file}`); }
  }

  log('\n' + '='.repeat(70), C.bright);
  log(`📊 Completed: ${done}/${STEPS.length}`, done === STEPS.length ? C.green : C.yellow);
  if (done === STEPS.length) {
    log('\n🎉 All done! Your Twitch bot is live.', C.magenta);
    log(`Bot: @${process.env.TWITCH_BOT_USERNAME} in #${process.env.TWITCH_CHANNEL || 'niklaus0x'}`);
  } else {
    log('\nRun individual steps:');
    STEPS.forEach(s => log(`  npm run setup:${['account','token','app','deploy'][s.step]}  — ${s.name}`));
  }
  log('='.repeat(70) + '\n', C.bright);
}

main().catch(e => { err(e.message); process.exit(1); });
