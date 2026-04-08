/**
 * Search Speed Optimizations v4
 * In-memory cache, request deduplication, timeout tuning, batching
 * Import and use in server/index.js
 */

const axios = require('axios');

// ─── In-memory cache ──────────────────────────────────────────────────────────
const cache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function cacheKey(query) {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

function cacheGet(query) {
  const key = cacheKey(query);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) { cache.delete(key); return null; }
  return entry.data;
}

function cacheSet(query, data) {
  if (cache.size > 500) {
    // Evict oldest 100 entries
    const keys = [...cache.keys()].slice(0, 100);
    keys.forEach(k => cache.delete(k));
  }
  cache.set(cacheKey(query), { data, timestamp: Date.now() });
}

function cacheStats() {
  return { size: cache.size, maxSize: 500, ttlMinutes: 30 };
}

// ─── Request deduplication (in-flight) ───────────────────────────────────────
// Prevents 2 identical searches firing at the same time
const inFlight = new Map();

async function dedupedRequest(key, fn) {
  if (inFlight.has(key)) return inFlight.get(key);
  const promise = fn().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

// ─── Optimized DuckDuckGo search with cache ───────────────────────────────────
async function cachedSearchDuckDuckGo(query) {
  const cached = cacheGet(`ddg:${query}`);
  if (cached) return cached;

  return dedupedRequest(`ddg:${query}`, async () => {
    try {
      const res = await axios.get(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
        { timeout: 6000 } // Tighter timeout: 6s instead of 10s
      );
      const data = res.data;
      const results = [];
      if (data.AbstractURL && data.AbstractTitle) results.push({ title: data.AbstractTitle, url: data.AbstractURL, snippet: data.AbstractText });
      if (data.RelatedTopics) for (const t of data.RelatedTopics.slice(0, 10)) if (t.FirstURL && t.Text) results.push({ title: t.Text.split(' - ')[0] || t.Text, url: t.FirstURL, snippet: t.Text });
      cacheSet(`ddg:${query}`, results);
      return results;
    } catch (err) {
      console.error('DDG:', err.message);
      return [];
    }
  });
}

// ─── Batch enrichment with concurrency limit ──────────────────────────────────
// Process enrichments in parallel but cap at maxConcurrency
async function batchEnrich(items, enrichFn, maxConcurrency = 5) {
  const results = [];
  for (let i = 0; i < items.length; i += maxConcurrency) {
    const batch = items.slice(i, i + maxConcurrency);
    const batchResults = await Promise.allSettled(batch.map(enrichFn));
    results.push(...batchResults.map((r, idx) => r.status === 'fulfilled' ? r.value : batch[idx]));
  }
  return results;
}

// ─── Timeout wrapper ──────────────────────────────────────────────────────────
function withTimeout(promise, ms, fallback = null) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ms))
  ]);
}

// ─── Axios instance with optimized defaults ───────────────────────────────────
const fastAxios = axios.create({
  timeout: 7000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadBot/4.0)' },
  maxRedirects: 3,
  validateStatus: s => s < 500, // Don't throw on 4xx
});

// ─── Search result normalizer ─────────────────────────────────────────────────
function normalizeResults(results, source, country, jobFilter) {
  const buildLinkedInSearchUrl = (q, j, c) => {
    const kw = [q, j, c].filter(Boolean).join(' ');
    return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(kw)}`;
  };
  const extractCompanyName = t => t.replace(/\s*[-\u2013\u2014|:]\s*.*/g, '').trim() || t.trim();
  const today = () => new Date().toISOString().split('T')[0];

  return results
    .filter(r => r.url && !r.url.includes('duckduckgo') && !r.url.includes('wikipedia'))
    .map(r => ({
      id: `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      companyName: extractCompanyName(r.title),
      website: r.url,
      ownerName: '', contactTitle: '', email: '', instagram: '', whatsapp: '', phone: '',
      linkedinUrl: buildLinkedInSearchUrl(extractCompanyName(r.title), jobFilter, country),
      country, source, dateFound: today(), score: 0, painSignal: false,
      snippet: r.snippet || '',
    }));
}

// ─── Pre-warm cache for common queries ────────────────────────────────────────
async function prewarmCache(commonNiches = ['event planning', 'cleaning service', 'logistics'], country = 'Nigeria') {
  console.log('⚡ Pre-warming search cache...');
  const promises = commonNiches.map(niche => cachedSearchDuckDuckGo(`${niche} ${country} contact`).catch(() => {}));
  await Promise.allSettled(promises);
  console.log(`✅ Cache pre-warmed for ${commonNiches.length} niches`);
}

module.exports = {
  cachedSearchDuckDuckGo,
  batchEnrich,
  withTimeout,
  fastAxios,
  normalizeResults,
  prewarmCache,
  cacheStats,
  cacheGet,
  cacheSet,
};
