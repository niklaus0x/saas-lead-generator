/**
 * Lead Intelligence Module v4
 * Smarter data extraction: Google Maps, Facebook, Instagram, AI summaries
 */

const axios = require('axios');
const cheerio = require('cheerio');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Google Maps mining ───────────────────────────────────────────────────────
async function mineGoogleMaps(companyName, country) {
  const result = { phone: '', hours: '', rating: '', reviewCount: 0, address: '', mapUrl: '' };
  try {
    const q = encodeURIComponent(`${companyName} ${country}`);
    result.mapUrl = `https://www.google.com/maps/search/${q}`;
    // Scrape the search snippet page
    const res = await axios.get(`https://www.google.com/search?q=${q}+phone+address`, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadBot/4.0)' }
    });
    const text = res.data;
    // Phone patterns
    const phoneMatch = text.match(/(?:\+?234|0)[789][01]\d{8}/);
    if (phoneMatch) result.phone = phoneMatch[0];
    // Rating
    const ratingMatch = text.match(/(\d\.\d)\s*(?:out of 5|stars|★)/);
    if (ratingMatch) result.rating = ratingMatch[1];
    // Review count
    const reviewMatch = text.match(/(\d[,\d]*)\s*(?:reviews?|ratings?)/);
    if (reviewMatch) result.reviewCount = parseInt(reviewMatch[1].replace(',', ''));
  } catch {}
  return result;
}

// ─── Instagram bio scraper ────────────────────────────────────────────────────
async function scrapeInstagramBio(handle) {
  const result = { bio: '', phone: '', email: '', website: '', followers: '' };
  if (!handle) return result;
  const cleanHandle = handle.replace('@', '');
  try {
    const res = await axios.get(`https://www.instagram.com/${cleanHandle}/`, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15' }
    });
    const text = res.data;
    // Extract bio from meta description
    const bioMatch = text.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/);
    if (bioMatch) result.bio = bioMatch[1];
    // Phone in bio
    const phoneMatch = text.match(/(?:\+?234|0)[789][01]\d{8}/);
    if (phoneMatch) result.phone = phoneMatch[0];
    // Email in bio
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) result.email = emailMatch[0];
    // Follower count
    const followerMatch = text.match(/"edge_followed_by":{"count":(\d+)}/);
    if (followerMatch) result.followers = parseInt(followerMatch[1]).toLocaleString();
  } catch {}
  return result;
}

// ─── Facebook page scraper ────────────────────────────────────────────────────
async function scrapeFacebookPage(companyName, country) {
  const result = { pageUrl: '', phone: '', email: '', about: '', likes: '' };
  try {
    result.pageUrl = `https://www.facebook.com/search/pages/?q=${encodeURIComponent(`${companyName} ${country}`)}`;
    // Try to find the FB page via DuckDuckGo
    const searchRes = await axios.get(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(`site:facebook.com/pages "${companyName}" "${country}"`)}&format=json&no_html=1`,
      { timeout: 8000 }
    );
    const topics = searchRes.data?.RelatedTopics || [];
    const fbTopic = topics.find(t => t.FirstURL && t.FirstURL.includes('facebook.com'));
    if (fbTopic) {
      result.pageUrl = fbTopic.FirstURL;
      result.about = fbTopic.Text || '';
    }
  } catch {}
  return result;
}

// ─── AI-style lead summary (rule-based, no API key needed) ───────────────────
function generateLeadSummary(lead) {
  const parts = [];
  const score = lead.score || 0;
  const company = lead.companyName || 'This business';
  const niche = lead.source || 'their industry';

  // Size/type signal
  if (lead.ownerName) parts.push(`${company} is owner-managed by ${lead.ownerName}`);
  else parts.push(`${company} is a ${niche}-sourced business`);

  // Contact richness
  const contacts = [];
  if (lead.whatsapp) contacts.push('WhatsApp');
  if (lead.email) contacts.push('email');
  if (lead.instagram) contacts.push('Instagram');
  if (lead.phone) contacts.push('phone');
  if (contacts.length > 0) parts.push(`reachable via ${contacts.join(', ')}`);

  // Pain signal
  if (lead.painSignal) parts.push('actively hiring contractors/gig workers — strong CrewPay fit');

  // Score interpretation
  if (score >= 8) parts.push('high-priority lead — contact immediately');
  else if (score >= 5) parts.push('medium-priority — worth a follow-up');
  else parts.push('low data — may need manual research before outreach');

  // Country-specific insight
  if ((lead.country || '').toLowerCase().includes('nigeria')) {
    parts.push('WhatsApp is the best first contact channel for Lagos/Nigerian businesses');
  }

  return parts.join('. ') + '.';
}

// ─── Full enrichment (all sources in parallel) ────────────────────────────────
async function deepEnrichLead(lead) {
  const [mapsData, igData, fbData] = await Promise.allSettled([
    mineGoogleMaps(lead.companyName, lead.country),
    lead.instagram ? scrapeInstagramBio(lead.instagram) : Promise.resolve({}),
    scrapeFacebookPage(lead.companyName, lead.country),
  ]);

  const enriched = { ...lead };

  if (mapsData.status === 'fulfilled') {
    const m = mapsData.value;
    if (m.phone && !enriched.phone) enriched.phone = m.phone;
    if (m.rating) enriched.googleRating = m.rating;
    if (m.reviewCount) enriched.googleReviews = m.reviewCount;
    if (m.mapUrl) enriched.mapUrl = m.mapUrl;
  }

  if (igData.status === 'fulfilled') {
    const ig = igData.value;
    if (ig.phone && !enriched.whatsapp && !enriched.phone) enriched.phone = ig.phone;
    if (ig.email && !enriched.email) enriched.email = ig.email;
    if (ig.followers) enriched.igFollowers = ig.followers;
    if (ig.bio) enriched.igBio = ig.bio;
  }

  if (fbData.status === 'fulfilled') {
    const fb = fbData.value;
    if (fb.phone && !enriched.phone) enriched.phone = fb.phone;
    if (fb.email && !enriched.email) enriched.email = fb.email;
    if (fb.pageUrl) enriched.facebookUrl = fb.pageUrl;
  }

  enriched.aiSummary = generateLeadSummary(enriched);
  return enriched;
}

module.exports = { mineGoogleMaps, scrapeInstagramBio, scrapeFacebookPage, generateLeadSummary, deepEnrichLead };
