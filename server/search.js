/**
 * search.js — All search logic using SerpAPI (Google)
 * Requires SERPAPI_KEY env var
 */
const axios = require('axios');

const SERPAPI_KEY = process.env.SERPAPI_KEY;
const SERPAPI_BASE = 'https://serpapi.com/search';

async function searchGoogle(query) {
  if (!SERPAPI_KEY) {
    console.warn('SERPAPI_KEY not set — skipping search');
    return [];
  }
  try {
    const res = await axios.get(SERPAPI_BASE, {
      params: {
        engine: 'google',
        q: query,
        api_key: SERPAPI_KEY,
        num: 10,
        hl: 'en',
      },
      timeout: 10000,
    });
    const results = res.data.organic_results || [];
    return results.map(r => ({
      title: r.title || '',
      url: r.link || '',
      snippet: r.snippet || '',
    }));
  } catch (err) {
    console.error('SerpAPI error:', err.message);
    return [];
  }
}

module.exports = { searchGoogle };
