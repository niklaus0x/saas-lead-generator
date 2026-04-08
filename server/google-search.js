/**
 * Free Google Search Module v5
 * Uses direct HTTP scraping with rotating user agents
 * No API key required — SerpAPI replacement
 */

const axios = require('axios');
const cheerio = require('cheerio');

// Rotating user agents to avoid blocks
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
];

function randomUA() { return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

// In-memory cache
const searchCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 min

function getCached(query) {
  const e = searchCache.get(query);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL) { searchCache.delete(query); return null; }
  return e.data;
}
function setCache(query, data) {
  if (searchCache.size > 300) {
    const oldest = [...searchCache.entries()].sort((a, b) => a[1].ts - b[1].ts).slice(0, 50);
    oldest.forEach(([k]) => searchCache.delete(k));
  }
  searchCache.set(query, { data, ts: Date.now() });
}

/**
 * Scrape Google search results directly
 * Falls back to DuckDuckGo if Google blocks
 */
async function googleSearch(query, numResults = 10) {
  const cached = getCached(query);
  if (cached) return cached;

  // Try Google first
  try {
    const res = await axios.get('https://www.google.com/search', {
      params: { q: query, num: numResults, hl: 'en', gl: 'ng' },
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 10000,
      maxRedirects: 3,
    });

    const $ = cheerio.load(res.data);
    const results = [];

    // Parse organic results — Google's main result selectors
    $('div.g, div[data-sokoban-container], div.tF2Cxc').each((i, el) => {
      if (results.length >= numResults) return false;
      const titleEl = $(el).find('h3').first();
      const linkEl = $(el).find('a[href]').first();
      const snippetEl = $(el).find('div[data-sncf], div.VwiC3b, span.aCOpRe, div.IsZvec').first();

      const title = titleEl.text().trim();
      const href = linkEl.attr('href') || '';
      const url = href.startsWith('/url?q=') ? decodeURIComponent(href.slice(7).split('&')[0]) : href;
      const snippet = snippetEl.text().trim();

      if (title && url && url.startsWith('http') && !url.includes('google.com')) {
        results.push({ title, url, snippet });
      }
    });

    if (results.length > 0) {
      setCache(query, results);
      return results;
    }
  } catch (err) {
    console.log('Google scrape blocked, falling back to DDG:', err.message);
  }

  // Fallback: DuckDuckGo
  return await duckDuckGoSearch(query);
}

/**
 * DuckDuckGo fallback
 */
async function duckDuckGoSearch(query) {
  const cached = getCached(`ddg:${query}`);
  if (cached) return cached;
  try {
    const res = await axios.get(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`, { timeout: 8000 });
    const data = res.data;
    const results = [];
    if (data.AbstractURL && data.AbstractTitle) results.push({ title: data.AbstractTitle, url: data.AbstractURL, snippet: data.AbstractText || '' });
    if (data.RelatedTopics) {
      for (const t of data.RelatedTopics.slice(0, 10)) {
        if (t.FirstURL && t.Text) results.push({ title: t.Text.split(' - ')[0] || t.Text, url: t.FirstURL, snippet: t.Text });
      }
    }
    setCache(`ddg:${query}`, results);
    return results;
  } catch (err) {
    console.error('DDG error:', err.message);
    return [];
  }
}

/**
 * Bing search (second free fallback)
 */
async function bingSearch(query, numResults = 10) {
  const cached = getCached(`bing:${query}`);
  if (cached) return cached;
  try {
    const res = await axios.get('https://www.bing.com/search', {
      params: { q: query, count: numResults },
      headers: { 'User-Agent': randomUA(), 'Accept-Language': 'en-US,en;q=0.9' },
      timeout: 10000,
    });
    const $ = cheerio.load(res.data);
    const results = [];
    $('li.b_algo').each((i, el) => {
      if (results.length >= numResults) return false;
      const title = $(el).find('h2').text().trim();
      const url = $(el).find('h2 a').attr('href') || '';
      const snippet = $(el).find('.b_caption p').text().trim();
      if (title && url && url.startsWith('http')) results.push({ title, url, snippet });
    });
    if (results.length > 0) { setCache(`bing:${query}`, results); return results; }
  } catch (err) { console.error('Bing error:', err.message); }
  return [];
}

/**
 * Multi-engine search — tries Google, falls back to Bing, then DDG
 */
async function multiSearch(query, numResults = 10) {
  const [google, bing] = await Promise.allSettled([
    googleSearch(query, numResults),
    bingSearch(query, numResults),
  ]);

  const googleResults = google.status === 'fulfilled' ? google.value : [];
  const bingResults = bing.status === 'fulfilled' ? bing.value : [];

  // Merge and deduplicate by URL
  const seen = new Set();
  const merged = [];
  for (const r of [...googleResults, ...bingResults]) {
    if (!seen.has(r.url)) { seen.add(r.url); merged.push(r); }
    if (merged.length >= numResults * 2) break;
  }

  return merged.length > 0 ? merged : await duckDuckGoSearch(query);
}

module.exports = { googleSearch, duckDuckGoSearch, bingSearch, multiSearch, getCached, setCache };
