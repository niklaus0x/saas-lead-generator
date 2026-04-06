/**
 * Script 0: Create Twitch Bot Account
 * Automates creation of a new Twitch bot account via Playwright
 * Usage: node setup/create-account.js
 */

require('dotenv').config();
const { chromium } = require('playwright');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function prompt(q) { return new Promise(r => rl.question(q, r)); }

async function createTwitchAccount() {
  const username = process.env.TWITCH_BOT_USERNAME;
  const password = process.env.TWITCH_BOT_PASSWORD;
  const email = process.env.TWITCH_BOT_EMAIL;
  const dob = process.env.TWITCH_BOT_DOB || '01/15/1990';

  if (!username || !password || !email) {
    console.error('❌ Missing: TWITCH_BOT_USERNAME, TWITCH_BOT_PASSWORD, TWITCH_BOT_EMAIL in .env');
    process.exit(1);
  }

  console.log('🤖 Creating Twitch Bot Account...\n');
  console.log(`Username: ${username} | Email: ${email} | DOB: ${dob}\n`);

  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const page = await browser.newContext({ viewport: { width: 1280, height: 720 } }).then(c => c.newPage());

  try {
    console.log('🌐 Opening Twitch signup...');
    await page.goto('https://www.twitch.tv/signup', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await page.locator('input[autocomplete="username"]').first().fill(username);
    await page.waitForTimeout(500);
    await page.locator('input[autocomplete="new-password"]').first().fill(password);
    await page.waitForTimeout(500);

    const [month, day, year] = dob.split('/');
    const monthSel = page.locator('select[aria-label*="Month"]').first();
    if (await monthSel.count() > 0) await monthSel.selectOption({ value: month });
    else await page.locator('input[placeholder*="MM"]').first().fill(month);
    await page.locator('input[placeholder*="DD"]').first().fill(day);
    await page.locator('input[placeholder*="YYYY"]').first().fill(year);
    await page.waitForTimeout(500);

    await page.locator('input[type="email"]').first().fill(email);
    await page.waitForTimeout(500);

    console.log('🚀 Submitting signup...');
    await page.locator('button:has-text("Sign Up")').first().click();
    await page.waitForTimeout(3000);

    console.log('\n📧 Check your email for a verification code from Twitch.');
    const code = await prompt('✉️  Enter the verification code: ');

    const codeInputs = page.locator('input[inputmode="numeric"], input[maxlength="6"]');
    const count = await codeInputs.count();
    if (count === 1) {
      await codeInputs.first().fill(code);
    } else {
      for (let i = 0; i < Math.min(code.length, count); i++) {
        await codeInputs.nth(i).fill(code[i]);
        await page.waitForTimeout(100);
      }
    }
    await page.waitForTimeout(1000);

    const verifyBtn = page.locator('button:has-text("Verify"), button:has-text("Continue"), button[type="submit"]').first();
    if (await verifyBtn.count() > 0) { await verifyBtn.click(); await page.waitForTimeout(3000); }

    console.log(`\n✅ Account created: @${username}`);
    console.log('\nNext: node setup/get-oauth-token.js');
    await page.waitForTimeout(3000);
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.log('Tip: Check if username is taken, email is valid, password is strong (8+ chars, mixed case, numbers)');
  } finally {
    await browser.close();
    rl.close();
  }
}

createAccount().catch(err => { console.error(err); process.exit(1); });
