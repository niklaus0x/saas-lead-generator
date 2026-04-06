const http = require('http');
const BASE_URL = 'http://localhost:3001';
let passed = 0, failed = 0;

async function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({ hostname: 'localhost', port: 3001, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
      let raw = ''; res.on('data', c => raw += c); res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, body: raw }); } });
    });
    req.on('error', reject); req.write(data); req.end();
  });
}

async function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE_URL}${path}`, (res) => {
      let raw = ''; res.on('data', c => raw += c); res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, body: raw }); } });
    }).on('error', reject);
  });
}

function assert(cond, msg) { if (cond) { console.log(`  ✅ ${msg}`); passed++; } else { console.log(`  ❌ ${msg}`); failed++; } }
async function runTest(name, fn) { console.log(`\n🧪 ${name}`); try { await fn(); } catch (e) { console.log(`  ❌ ERROR: ${e.message}`); failed++; } }

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  SaaS Lead Generator — Test Suite v2');
  console.log('═══════════════════════════════════════');

  await runTest('Health Check', async () => {
    const r = await get('/api/health');
    assert(r.status === 200, 'Returns 200');
    assert(r.body.apiKeysRequired === false, 'No API keys required');
  });

  await runTest('Search: digital marketing agency in Nigeria', async () => {
    const r = await post('/api/search-leads', { productNiche: 'digital marketing agency', country: 'Nigeria', companySize: '1-50' });
    assert(r.status === 200, 'Returns 200');
    assert(Array.isArray(r.body.leads), 'Returns leads array');
    assert(r.body.searchGuidance.clutchUrl.includes('clutch.co'), 'Clutch URL present');
    assert(r.body.searchGuidance.goodfirmsUrl.includes('goodfirms'), 'GoodFirms URL present');
    console.log(`     → ${r.body.count} leads`);
  });

  await runTest('Search: web design studio in Ghana', async () => {
    const r = await post('/api/search-leads', { productNiche: 'web design', country: 'Ghana', companySize: '1-10' });
    assert(r.status === 200, 'Returns 200');
    assert(r.body.searchGuidance.googleSearch.includes('google.com'), 'Google search URL present');
    console.log(`     → ${r.body.count} leads`);
  });

  await runTest('Validation: Missing fields', async () => {
    const r1 = await post('/api/search-leads', { country: 'Kenya' });
    assert(r1.status === 400, 'Missing niche returns 400');
    const r2 = await post('/api/search-leads', { productNiche: 'agency' });
    assert(r2.status === 400, 'Missing country returns 400');
  });

  await runTest('Email Patterns: jane doe at acme.com', async () => {
    const r = await post('/api/find-email', { domain: 'acme.com', firstName: 'Jane', lastName: 'Doe' });
    assert(r.status === 200, 'Returns 200');
    assert(r.body.patterns.some(p => p === 'jane.doe@acme.com'), 'jane.doe pattern exists');
    assert(r.body.patterns.some(p => p === 'info@acme.com'), 'info@ pattern exists');
  });

  await runTest('MX Validation: gmail.com', async () => {
    const r = await post('/api/validate-email', { email: 'test@gmail.com' });
    assert(r.body.valid === true, 'gmail.com valid');
    const r2 = await post('/api/validate-email', { email: 'test@nxdomain-xyz999.com' });
    assert(r2.body.valid === false, 'Fake domain invalid');
  });

  await runTest('Enrichment: stripe.com', async () => {
    const r = await post('/api/enrich-company', { domain: 'stripe.com' });
    assert(r.status === 200, 'Returns 200');
    assert(r.body.logoUrl.includes('clearbit.com'), 'Logo URL present');
  });

  await runTest('LinkedIn URL generation', async () => {
    const r = await post('/api/search-linkedin', { companyName: 'Test Agency', jobTitle: 'founder', country: 'Nigeria' });
    assert(r.body.linkedinSearchUrl.includes('linkedin.com'), 'LinkedIn URL valid');
  });

  const total = passed + failed;
  console.log(`\n${'═'.repeat(40)}`);
  console.log(`  Results: ${passed}/${total} passed ${failed === 0 ? '🎉' : `(${failed} failed)`}`);
  console.log('═'.repeat(40));
  process.exit(failed > 0 ? 1 : 0);
}

http.get(`${BASE_URL}/api/health`, () => main().catch(e => { console.error(e.message); process.exit(1); }))
  .on('error', () => { console.error('\n❌ Server not running. Run: npm run server\n'); process.exit(1); });
