require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const dns = require('dns').promises;

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ──────────────────────────────────────────────
// COUNTRY HELPERS
// ──────────────────────────────────────────────
const COUNTRY_CODES = {
  // United States
  'united states': 'us', 'usa': 'us',

  // Africa
  'algeria': 'dz', 'angola': 'ao', 'benin': 'bj',
  'botswana': 'bw', 'burkina faso': 'bf', 'burundi': 'bi',
  'cabo verde': 'cv', 'cape verde': 'cv', 'cameroon': 'cm',
  'central african republic': 'cf', 'chad': 'td', 'comoros': 'km',
  'congo (brazzaville)': 'cg', 'congo (kinshasa)': 'cd',
  'democratic republic of congo': 'cd', 'djibouti': 'dj',
  'egypt': 'eg', 'equatorial guinea': 'gq', 'eritrea': 'er',
  'eswatini': 'sz', 'swaziland': 'sz', 'ethiopia': 'et',
  'gabon': 'ga', 'gambia': 'gm', 'ghana': 'gh',
  'guinea': 'gn', 'guinea-bissau': 'gw', 'ivory coast': 'ci',
  "cote d'ivoire": 'ci', 'kenya': 'ke', 'lesotho': 'ls',
  'liberia': 'lr', 'libya': 'ly', 'madagascar': 'mg',
  'malawi': 'mw', 'mali': 'ml', 'mauritania': 'mr',
  'mauritius': 'mu', 'morocco': 'ma', 'mozambique': 'mz',
  'namibia': 'na', 'niger': 'ne', 'nigeria': 'ng',
  'rwanda': 'rw', 'sao tome and principe': 'st',
  'senegal': 'sn', 'seychelles': 'sc', 'sierra leone': 'sl',
  'somalia': 'so', 'south africa': 'za', 'south sudan': 'ss',
  'sudan': 'sd', 'tanzania': 'tz', 'togo': 'tg',
  'tunisia': 'tn', 'uganda': 'ug', 'zambia': 'zm',
  'zimbabwe': 'zw'
};

function getCountryCode(country) {
  return COUNTRY_CODES[country.toLowerCase()] || 'us';
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function generateEmailPatterns(domain, firstName = '', lastName = '') {
  if (!domain) return [];
  const f = firstName.toLowerCase().replace(/[^a-z]/g, '');
  const l = lastName.toLowerCase().replace(/[^a-z]/g, '');
  const patterns = [];
  if (f && l) {
    patterns.push(`${f}.${l}@${domain}`);
    patterns.push(`${f}${l}@${domain}`);
    patterns.push(`${f[0]}${l}@${domain}`);
    patterns.push(`${f}.${l[0]}@${domain}`);
    patterns.push(`${f}@${domain}`);
  }
  patterns.push(`info@${domain}`);
  patterns.push(`hello@${domain}`);
  patterns.push(`contact@${domain}`);
  patterns.push(`sales@${domain}`);
  return [...new Set(patterns)];
}

async function validateDomain(domain) {
  try {
    const records = await dns.resolveMx(domain);
    return records && records.length > 0;
  } catch {
    return false;
  }
}

async function scrapeEmailsFromWebsite(url) {
  try {
    const res = await axios.get(url, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadBot/1.0)' }
    });
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = res.data.match(emailRegex) || [];
    return [...new Set(emails)].filter(e =>
      !e.includes('noreply') && !e.includes('no-reply') &&
      !e.includes('example') && !e.includes('.png') && !e.includes('.jpg')
    ).slice(0, 5);
  } catch {
    return [];
  }
}

async function searchDuckDuckGo(query) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await axios.get(url, { timeout: 10000 });
    const data = res.data;
    const results = [];
    if (data.AbstractURL && data.AbstractTitle) {
      results.push({ title: data.AbstractTitle, url: data.AbstractURL, snippet: data.AbstractText });
    }
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, 8)) {
        if (topic.FirstURL && topic.Text) {
          results.push({ title: topic.Text.split(' - ')[0] || topic.Text, url: topic.FirstURL, snippet: topic.Text });
        }
      }
    }
    return results;
  } catch (err) {
    console.error('DuckDuckGo error:', err.message);
    return [];
  }
}

async function searchCrunchbase(niche, country) {
  try {
    const query = `${niche} startup ${country} site:crunchbase.com`;
    const ddgResults = await searchDuckDuckGo(query);
    return ddgResults.filter(r => r.url.includes('crunchbase.com')).map(r => ({
      companyName: extractCompanyName(r.title),
      website: r.url,
      country,
      source: 'Crunchbase',
      snippet: r.snippet
    }));
  } catch {
    return [];
  }
}

async function searchOpenCorporates(query, country) {
  try {
    const countryCode = getCountryCode(country);
    const url = `https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(query)}&jurisdiction_code=${countryCode}&per_page=10`;
    const res = await axios.get(url, { timeout: 10000 });
    const companies = res.data?.results?.companies || [];
    return companies.map(({ company }) => ({
      companyName: company.name,
      website: company.registry_url || '',
      country,
      source: 'OpenCorporates',
      snippet: `${company.company_type || ''} | ${company.current_status || 'Active'}`
    }));
  } catch (err) {
    console.error('OpenCorporates error:', err.message);
    return [];
  }
}

function buildLinkedInSearchUrl(companyName, jobTitle, country) {
  const kw = [companyName, jobTitle, country].filter(Boolean).join(' ');
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(kw)}`;
}

function buildGoogleLinkedInUrl(companyName, jobTitle, country) {
  const q = `site:linkedin.com/in "${companyName}" "${jobTitle || 'CEO OR founder OR director'}" "${country}"`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

function extractDomain(url) {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function extractCompanyName(title) {
  return title.replace(/\s*[-–—|:]\s*.*/g, '').replace(/\s*(Inc\.|LLC|Ltd\.|Corp\.|Co\.).*$/i, ($0, $1) => $1).trim() || title.trim();
}

function getClearbitLogoUrl(domain) {
  return `https://logo.clearbit.com/${domain}`;
}

function deduplicateLeads(leads) {
  const seen = new Set();
  return leads.filter(lead => {
    const key = (lead.companyName || '').toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

app.post('/api/search-leads', async (req, res) => {
  try {
    const { productNiche, country, industry, companySize, jobTitle } = req.body;
    if (!productNiche || !country) {
      return res.status(400).json({ error: 'Product niche and country are required' });
    }
    const leads = [];
    const jobTitleFilter = jobTitle || 'founder OR owner OR CEO OR director OR "agency head" OR "managing director"';
    const isSmallTeam = !companySize || companySize === '1-10' || companySize === '1-50' || companySize === '11-50';
    const agencyTerms = isSmallTeam ? 'agency OR boutique OR studio OR consultancy' : '';

    const ocResults = await searchOpenCorporates(`${productNiche} ${industry || ''}`.trim(), country);
    for (const r of ocResults) {
      leads.push({
        id: `oc-${Date.now()}-${Math.random()}`,
        companyName: r.companyName, website: r.website || '',
        contactName: '', contactTitle: '', email: '',
        linkedinUrl: buildLinkedInSearchUrl(r.companyName, jobTitleFilter, country),
        phone: '', country, source: 'OpenCorporates',
        dateFound: new Date().toISOString().split('T')[0]
      });
    }
    await sleep(500);

    const ddgQuery = `${productNiche} ${agencyTerms} ${industry || ''} small team ${country}`.trim().replace(/\s+/g, ' ');
    const ddgResults = await searchDuckDuckGo(ddgQuery);
    for (const r of ddgResults.slice(0, 6)) {
      if (!r.url || r.url.includes('duckduckgo')) continue;
      leads.push({
        id: `ddg-${Date.now()}-${Math.random()}`,
        companyName: extractCompanyName(r.title), website: r.url,
        contactName: '', contactTitle: '', email: '',
        linkedinUrl: buildLinkedInSearchUrl(extractCompanyName(r.title), jobTitleFilter, country),
        phone: '', country, source: 'Web Search',
        dateFound: new Date().toISOString().split('T')[0]
      });
    }
    await sleep(500);

    const crunchbaseResults = await searchCrunchbase(productNiche, country);
    for (const r of crunchbaseResults) {
      leads.push({
        id: `cb-${Date.now()}-${Math.random()}`,
        companyName: r.companyName, website: r.website,
        contactName: '', contactTitle: '', email: '',
        linkedinUrl: buildLinkedInSearchUrl(r.companyName, jobTitleFilter, country),
        phone: '', country, source: 'Crunchbase',
        dateFound: new Date().toISOString().split('T')[0]
      });
    }

    const unique = deduplicateLeads(leads).filter(l => l.companyName && l.companyName.length > 2);
    const searchGuidance = {
      query: `${productNiche} agency small team ${country}`,
      linkedinSearch: buildLinkedInSearchUrl(`${productNiche} agency`, jobTitleFilter, country),
      googleLinkedIn: buildGoogleLinkedInUrl(`${productNiche} agency`, jobTitleFilter, country),
      googleSearch: `https://www.google.com/search?q=${encodeURIComponent(`${productNiche} agency "small team" OR "boutique" OR "studio" ${country}`)}`,
      crunchbaseUrl: `https://www.crunchbase.com/discover/organization.companies?field_ids=identifier,short_description,location_identifiers&predefined_filter=company`,
      clutchUrl: `https://clutch.co/agencies?search_term=${encodeURIComponent(productNiche)}&filter%5Blocations%5D%5B%5D=${encodeURIComponent(country)}`,
      goodfirmsUrl: `https://www.goodfirms.co/directory/country/${country.toLowerCase().replace(/\s+/g, '-')}`
    };

    res.json({ leads: unique, count: unique.length, searchGuidance });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed. Please try again.' });
  }
});

app.post('/api/find-email', async (req, res) => {
  try {
    const { domain, firstName, lastName, websiteUrl } = req.body;
    if (!domain) return res.status(400).json({ error: 'Domain is required' });
    const domainValid = await validateDomain(domain);
    const patterns = generateEmailPatterns(domain, firstName || '', lastName || '');
    let scrapedEmails = await scrapeEmailsFromWebsite(websiteUrl || `https://${domain}`);
    if (scrapedEmails.length === 0) {
      scrapedEmails = await scrapeEmailsFromWebsite(`https://${domain}/contact`);
    }
    res.json({ domain, domainValid, patterns, scrapedEmails, bestGuess: scrapedEmails[0] || patterns[0] || null });
  } catch (error) {
    res.status(500).json({ error: 'Email lookup failed' });
  }
});

app.post('/api/search-linkedin', async (req, res) => {
  try {
    const { companyName, jobTitle, country } = req.body;
    res.json({
      linkedinSearchUrl: buildLinkedInSearchUrl(companyName, jobTitle, country),
      googleLinkedInUrl: buildGoogleLinkedInUrl(companyName, jobTitle, country),
      message: 'Click the links to find profiles on LinkedIn or via Google'
    });
  } catch (error) {
    res.status(500).json({ error: 'LinkedIn search failed' });
  }
});

app.post('/api/enrich-company', async (req, res) => {
  try {
    const { domain, companyName } = req.body;
    if (!domain && !companyName) return res.status(400).json({ error: 'Domain or company name required' });
    const d = domain || `${companyName.toLowerCase().replace(/\s+/g, '')}.com`;
    const cleanDomain = extractDomain(d);
    const logoUrl = getClearbitLogoUrl(cleanDomain);
    const emails = await scrapeEmailsFromWebsite(`https://${cleanDomain}`);
    const domainValid = await validateDomain(cleanDomain);
    const patterns = generateEmailPatterns(cleanDomain);
    res.json({ domain: cleanDomain, logoUrl, domainValid, emails, emailPatterns: patterns.slice(0, 3) });
  } catch (error) {
    res.status(500).json({ error: 'Enrichment failed' });
  }
});

app.post('/api/validate-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const domain = email.split('@')[1];
    if (!domain) return res.status(400).json({ error: 'Invalid email format' });
    const valid = await validateDomain(domain);
    res.json({ email, domain, valid, message: valid ? 'Domain accepts email' : 'Domain has no MX records' });
  } catch (error) {
    res.status(500).json({ error: 'Validation failed' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mode: 'free-only', tools: ['DuckDuckGo', 'OpenCorporates', 'Cheerio scraper', 'DNS MX validation', 'Clearbit Logo (free)'], apiKeysRequired: false });
});

app.listen(PORT, () => {
  console.log(`\n🚀 SaaS Lead Generator API running on port ${PORT}`);
  console.log(`✅ Mode: FREE TOOLS ONLY — no API keys required`);
  console.log(`   Tools: DuckDuckGo · OpenCorporates · Clearbit Logo · DNS Validation · Web Scraper\n`);
});
