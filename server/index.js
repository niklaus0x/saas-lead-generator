require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dns = require('dns').promises;
const fs = require('fs');
const path = require('path');
const { searchGoogle } = require('./search');

const app = express();
const PORT = process.env.API_PORT || 3001;
app.use(cors());
app.use(express.json());

const DB_PATH = path.join(__dirname, '..', 'leads-db.json');
const WA_QUEUE_PATH = path.join(__dirname, '..', 'wa-queue.json');
const CRM_PATH = path.join(__dirname, '..', 'crm.json');

function loadDb() { try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch { return { leads: [], searches: [] }; } }
function saveDb(db) { try { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); } catch(e) { console.error('DB save:', e.message); } }
function loadWaQueue() { try { return JSON.parse(fs.readFileSync(WA_QUEUE_PATH, 'utf8')); } catch { return { queue: [] }; } }
function saveWaQueue(q) { try { fs.writeFileSync(WA_QUEUE_PATH, JSON.stringify(q, null, 2)); } catch(e) { console.error('WA queue save:', e.message); } }
function loadCrm() { try { return JSON.parse(fs.readFileSync(CRM_PATH, 'utf8')); } catch { return { leads: [] }; } }
function saveCrm(c) { try { fs.writeFileSync(CRM_PATH, JSON.stringify(c, null, 2)); } catch(e) { console.error('CRM save:', e.message); } }

const COUNTRY_CODES = {'united states':'us','usa':'us','algeria':'dz','angola':'ao','benin':'bj','botswana':'bw','burkina faso':'bf','burundi':'bi','cabo verde':'cv','cameroon':'cm','central african republic':'cf','chad':'td','comoros':'km','congo (brazzaville)':'cg','congo (kinshasa)':'cd','djibouti':'dj','egypt':'eg','equatorial guinea':'gq','eritrea':'er','eswatini':'sz','ethiopia':'et','gabon':'ga','gambia':'gm','ghana':'gh','guinea':'gn','guinea-bissau':'gw','ivory coast':'ci','kenya':'ke','lesotho':'ls','liberia':'lr','libya':'ly','madagascar':'mg','malawi':'mw','mali':'ml','mauritania':'mr','mauritius':'mu','morocco':'ma','mozambique':'mz','namibia':'na','niger':'ne','nigeria':'ng','rwanda':'rw','sao tome and principe':'st','senegal':'sn','seychelles':'sc','sierra leone':'sl','somalia':'so','south africa':'za','south sudan':'ss','sudan':'sd','tanzania':'tz','togo':'tg','tunisia':'tn','uganda':'ug','zambia':'zm','zimbabwe':'zw'};
function getCountryCode(c){return COUNTRY_CODES[c.toLowerCase()]||'ng';}

const INFORMAL_CATEGORIES = {
  'event planning':['event planner','event planning','event management','event organizer','party planner'],
  'catering':['catering service','caterer','food catering','event catering','catering company'],
  'ushering':['usher service','ushering company','protocol officer','event ushers','hospitality staff'],
  'photography':['photographer','photography studio','event photographer','wedding photographer'],
  'videography':['videographer','video production','event videography','film crew'],
  'makeup':['makeup artist','MUA','bridal makeup','makeup studio'],
  'decor':['event decor','decoration service','floral designer','balloon decor','event decorator'],
  'wedding planning':['wedding planner','wedding coordinator','bridal consultant','wedding vendor'],
  'dj services':['DJ','disc jockey','mobile DJ','event DJ','music entertainment'],
  'mc services':['MC','master of ceremonies','event MC','compere','host'],
  'cleaning':['cleaning service','janitorial','cleaning company','office cleaning','facility management'],
  'printing':['printing press','print shop','banner printing','flyer printing'],
  'logistics':['logistics company','delivery service','haulage','courier service','dispatch rider'],
  'tailoring':['tailor','fashion designer','seamstress','clothing alteration'],
  'digital marketing':['digital marketing agency','social media manager','content creator','influencer marketing'],
  'web design':['web designer','web developer','website design','graphic designer'],
  'creative agency':['creative agency','creative studio','branding agency','design agency','advertising agency','creative director','brand identity','visual identity','art direction','creative house'],
  'pr agency':['PR agency','public relations','communications agency','media relations','press office','brand communications','reputation management','PR firm','publicity agency','media strategy'],
  'construction':['construction company','building contractor','civil engineering','structural contractor','general contractor','building firm','construction project','site contractor','turnkey contractor','building and construction'],
  'construction contractor':['contractor','subcontractor','plumbing contractor','electrical contractor','mason','carpentry contractor','tiling contractor','roofing contractor','painting contractor','fit-out contractor'],
  'real estate':['estate agent','property agent','real estate agency','property management'],
  'travel agency':['travel agency','tour operator','holiday packages','visa agent'],
  'hair salon':['hair salon','hairdresser','hair stylist','natural hair'],
  'tutoring':['tutor','private teacher','lesson teacher','home lessons'],
  'daycare center':['daycare','creche','day care center','child care','infant care'],
  'nursery school':['nursery school','pre-nursery','early years','toddler school'],
  'preschool':['preschool','pre-school','kindergarten','early childhood education'],
  'primary school':['primary school','elementary school','basic school','junior school'],
  'secondary school':['secondary school','high school','senior secondary','JSS','SSS'],
  'tutorial center':['tutorial center','lesson center','coaching center','extra lessons','JAMB center','WAEC coaching'],
  'montessori school':['montessori','montessori school','child-led learning'],
};

function getSearchTerms(niche){
  const lower=niche.toLowerCase();
  for(const[cat,terms] of Object.entries(INFORMAL_CATEGORIES)){
    if(lower.includes(cat)||cat.includes(lower))return terms;
  }
  return[niche,`${niche} service`,`${niche} company`,`${niche} agency`];
}

function scoreLead(lead){let score=0;if(lead.ownerName&&lead.ownerName.trim())score+=2;if(lead.whatsapp&&lead.whatsapp.trim())score+=2;if(lead.email&&lead.email.trim()&&!lead.email.includes('info@')&&!lead.email.includes('contact@'))score+=2;else if(lead.email&&lead.email.trim())score+=1;if(lead.painSignal)score+=2;if(lead.instagram&&lead.instagram.trim())score+=1;if(lead.linkedinUrl&&!lead.linkedinUrl.includes('search?'))score+=1;return Math.min(score,10);}

async function detectPainSignal(companyName,country){try{const res=await searchGoogle(`"${companyName}" "${country}" (hiring freelancer OR contractor needed OR gig worker OR part-time staff)`);return res.length>0;}catch{return false;}}

async function extractContactDetails(url){const result={ownerName:'',whatsapp:'',instagram:'',phone:''};if(!url)return result;try{const res=await axios.get(url,{timeout:7000,headers:{'User-Agent':'Mozilla/5.0 (compatible; LeadBot/4.0)'}});const text=res.data;const waMatches=text.match(/(?:wa\.me\/|whatsapp\.com\/send\?phone=|WhatsApp[:\s]+)(\+?[\d\s\-\(\)]{10,15})/gi)||[];if(waMatches.length>0){const num=waMatches[0].replace(/[^\d+]/g,'');if(num.length>=10)result.whatsapp=num.startsWith('+')?num:`+${num}`;}const phoneMatches=text.match(/(?:\+?234|0)[789][01]\d{8}/g)||[];if(phoneMatches.length>0&&!result.whatsapp)result.phone=phoneMatches[0];const igMatches=text.match(/(?:instagram\.com\/|@)([a-zA-Z0-9_.]{3,30})/g)||[];if(igMatches.length>0){const handle=igMatches[0].replace('instagram.com/','').replace('@','').split('/')[0];if(handle&&!handle.includes('share')&&!handle.includes('explore'))result.instagram=`@${handle}`;}const ownerPatterns=[/(?:founded by|CEO|Managing Director|Owner|Principal|Director|Head)\s*:?\s*([A-Z][a-z]+ [A-Z][a-z]+)/g,/([A-Z][a-z]+ [A-Z][a-z]+)\s*(?:,?\s*(?:CEO|Founder|Owner|MD|Director|Principal))/g];for(const pat of ownerPatterns){const m=text.match(pat);if(m&&m.length>0){result.ownerName=m[0].replace(/(?:founded by|CEO|Managing Director|Owner|Principal|Director|Head|Founder|MD)\s*:?\s*/gi,'').replace(/\s*,?\s*(?:CEO|Founder|Owner|MD|Director|Principal)\s*/gi,'').trim();if(result.ownerName.split(' ').length>=2)break;else result.ownerName='';}} }catch{}return result;}

function generateEmailPatterns(domain,firstName='',lastName=''){if(!domain)return[];const f=firstName.toLowerCase().replace(/[^a-z]/g,'');const l=lastName.toLowerCase().replace(/[^a-z]/g,'');const p=[];if(f&&l){p.push(`${f}.${l}@${domain}`,`${f}${l}@${domain}`,`${f[0]}${l}@${domain}`,`${f}@${domain}`);}p.push(`info@${domain}`,`hello@${domain}`,`contact@${domain}`,`bookings@${domain}`,`enquiries@${domain}`);return[...new Set(p)];}
async function validateDomain(domain){try{const r=await dns.resolveMx(domain);return r&&r.length>0;}catch{return false;}}
async function scrapeEmailsFromWebsite(url){try{const res=await axios.get(url,{timeout:7000,headers:{'User-Agent':'Mozilla/5.0 (compatible; LeadBot/4.0)'}});const emails=res.data.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)||[];return[...new Set(emails)].filter(e=>!e.includes('noreply')&&!e.includes('example')&&!e.includes('.png')&&!e.includes('sentry')).slice(0,5);}catch{return[];}}

async function searchOpenCorporates(query,country){try{const cc=getCountryCode(country);const res=await axios.get(`https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(query)}&jurisdiction_code=${cc}&per_page=10`,{timeout:10000});return(res.data?.results?.companies||[]).map(({company})=>({companyName:company.name,website:company.registry_url||'',country,source:'OpenCorporates'}));}catch(err){console.error('OC:',err.message);return[];}}

function today(){return new Date().toISOString().split('T')[0];}
function extractDomain(url){try{return new URL(url.startsWith('http')?url:`https://${url}`).hostname.replace('www.','');}catch{return url;}}
function extractCompanyName(t){return t.replace(/\s*[-\u2013\u2014|:]\s*.*/g,'').trim()||t.trim();}
function getClearbitLogoUrl(d){return`https://logo.clearbit.com/${d}`;}
function buildLinkedInSearchUrl(q,j,c){const kw=[q,j,c].filter(Boolean).join(' ');return`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(kw)}`;}
function deduplicateLeads(leads){const s=new Set();return leads.filter(l=>{const k=(l.companyName||'').toLowerCase().trim();if(!k||k.length<3||s.has(k))return false;s.add(k);return true;});}
function buildSocialSearchUrls(niche,country,terms){const primary=terms[0]||niche;const q=`${primary} ${country}`;return{facebook:`https://www.facebook.com/search/pages/?q=${encodeURIComponent(q)}`,instagram:`https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(q)}`,twitter:`https://twitter.com/search?q=${encodeURIComponent(q)}&f=user`,googleMaps:`https://www.google.com/maps/search/${encodeURIComponent(q)}`,yellowPages:`https://www.yellowpages.com.ng/search?q=${encodeURIComponent(niche)}&l=${encodeURIComponent(country)}`,vconnect:`https://www.vconnect.com/search?q=${encodeURIComponent(niche)}&loc=${encodeURIComponent(country)}`,connectNigeria:`https://connectnigeria.com/?s=${encodeURIComponent(niche)}`,businessList:`https://www.businesslist.com.ng/search?q=${encodeURIComponent(niche)}`,bark:`https://www.bark.com/en/ng/?search=${encodeURIComponent(niche)}`,};}
function leadsToCSV(leads){const h=['Company','Owner','Email','Phone','WhatsApp','Instagram','LinkedIn','Website','Country','Source','Score','Pain Signal','CRM Status','Date'];const rows=leads.map(l=>[l.companyName||'',l.ownerName||'',l.email||'',l.phone||'',l.whatsapp||'',l.instagram||'',l.linkedinUrl||'',l.website||'',l.country||'',l.source||'',l.score||0,l.painSignal?'Yes':'No',l.crmStatus||'new',l.dateFound||''].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','));return[h.join(','),...rows].join('\n');}

async function searchAllSourcesParallel(niche, country, searchTerms, jobFilter) {
  const primary = searchTerms[0];
  const [ocResults, g0, g1, g2, vconnect, connectng, businesslist, bark, webSearch] = await Promise.allSettled([
    searchOpenCorporates(`${primary} ${country}`.trim(), country),
    searchGoogle(`${searchTerms[0]} ${country} contact`),
    searchGoogle(`${searchTerms[1]||searchTerms[0]} ${country} contact`),
    searchGoogle(`${searchTerms[2]||searchTerms[0]} ${country} WhatsApp`),
    searchGoogle(`site:vconnect.com "${primary}" "${country}"`),
    searchGoogle(`site:connectnigeria.com "${primary}" "${country}"`),
    searchGoogle(`site:businesslist.com.ng "${primary}" "${country}"`),
    searchGoogle(`site:bark.com "${primary}" "${country}"`),
    searchGoogle(`"${primary}" "${country}" contact phone WhatsApp`),
  ]);
  const leads = [];
  const makeId = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  if (ocResults.status === 'fulfilled') for (const r of ocResults.value) leads.push({id:makeId('oc'),companyName:r.companyName,website:r.website||'',ownerName:'',contactTitle:'',email:'',instagram:'',whatsapp:'',phone:'',linkedinUrl:buildLinkedInSearchUrl(r.companyName,jobFilter,country),country,source:'OpenCorporates',dateFound:today(),score:0,painSignal:false});
  for (const result of [g0,g1,g2]) if (result.status === 'fulfilled') for (const r of result.value.slice(0,6)) {if(!r.url||r.url.includes('google.com')||r.url.includes('wikipedia'))continue;leads.push({id:makeId('g'),companyName:extractCompanyName(r.title),website:r.url,ownerName:'',contactTitle:'',email:'',instagram:'',whatsapp:'',phone:'',linkedinUrl:buildLinkedInSearchUrl(extractCompanyName(r.title),jobFilter,country),country,source:'Google Search',dateFound:today(),score:0,painSignal:false,snippet:r.snippet||''}); }
  const dirSources = [[vconnect,'vconnect.com','VConnect'],[connectng,'connectnigeria.com','ConnectNigeria'],[businesslist,'businesslist.com.ng','BusinessList.com.ng'],[bark,'bark.com','Bark.com']];
  for (const [result,domain,label] of dirSources) if (result.status === 'fulfilled') for (const x of result.value.filter(x=>x.url.includes(domain)).slice(0,4)) leads.push({id:makeId('dir'),companyName:extractCompanyName(x.title),website:x.url,ownerName:'',contactTitle:'',email:'',instagram:'',whatsapp:'',phone:'',linkedinUrl:buildLinkedInSearchUrl(extractCompanyName(x.title),jobFilter,country),country,source:label,dateFound:today(),score:0,painSignal:false,snippet:x.snippet||''});
  if (webSearch.status === 'fulfilled') for (const x of webSearch.value.slice(0,5)) if(!x.url.includes('google.com')&&!x.url.includes('wikipedia')) leads.push({id:makeId('web'),companyName:extractCompanyName(x.title),website:x.url,ownerName:'',contactTitle:'',email:'',instagram:'',whatsapp:'',phone:'',linkedinUrl:buildLinkedInSearchUrl(extractCompanyName(x.title),jobFilter,country),country,source:'Google Search',dateFound:today(),score:0,painSignal:false,snippet:x.snippet||''});
  return leads;
}

async function enrichLeadsParallel(leads) {
  const ENRICH_CAP = 25;
  const PAIN_CAP = 8;
  const toEnrich = leads.slice(0, ENRICH_CAP);
  const rest = leads.slice(ENRICH_CAP);
  const BATCH_SIZE = 5;
  const enrichedLeads = [];
  for (let i = 0; i < toEnrich.length; i += BATCH_SIZE) {
    const batch = toEnrich.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(async (lead, batchIdx) => {
      const globalIdx = i + batchIdx;
      if (!lead.website) { lead.score = scoreLead(lead); return lead; }
      try {
        const [details, scraped, painSignal] = await Promise.allSettled([
          extractContactDetails(lead.website),
          scrapeEmailsFromWebsite(lead.website),
          globalIdx < PAIN_CAP ? detectPainSignal(lead.companyName, lead.country) : Promise.resolve(false),
        ]);
        if (details.status === 'fulfilled') { if(details.value.ownerName)lead.ownerName=details.value.ownerName;if(details.value.whatsapp)lead.whatsapp=details.value.whatsapp;if(details.value.instagram)lead.instagram=details.value.instagram;if(details.value.phone&&!lead.phone)lead.phone=details.value.phone; }
        if (scraped.status === 'fulfilled' && scraped.value.length > 0) lead.email = scraped.value[0];
        if (painSignal.status === 'fulfilled') lead.painSignal = painSignal.value;
        const domain = extractDomain(lead.website);
        lead.logoUrl = getClearbitLogoUrl(domain);
        lead.emailPatterns = generateEmailPatterns(domain).slice(0, 3);
      } catch {}
      lead.score = scoreLead(lead);
      return lead;
    }));
    enrichedLeads.push(...results.map((r, idx) => r.status === 'fulfilled' ? r.value : batch[idx]));
  }
  rest.forEach(l => { l.score = scoreLead(l); });
  return [...enrichedLeads, ...rest];
}

app.post('/api/search-leads', async (req, res) => {
  try {
    const { productNiche, country, jobTitle } = req.body;
    if (!productNiche || !country) return res.status(400).json({ error: 'Product niche and country are required' });
    const searchTerms = getSearchTerms(productNiche);
    const jobFilter = jobTitle || 'founder OR owner OR CEO OR director OR "business owner" OR principal';
    let leads = await searchAllSourcesParallel(productNiche, country, searchTerms, jobFilter);
    leads = deduplicateLeads(leads);
    leads = await enrichLeadsParallel(leads);
    leads.sort((a, b) => b.score - a.score);
    const db = loadDb();
    const dbNames = new Set((db.leads || []).map(l => (l.companyName || '').toLowerCase().trim()));
    leads = leads.map(l => ({ ...l, isDuplicate: dbNames.has((l.companyName || '').toLowerCase().trim()) }));
    const newLeads = leads.filter(l => !l.isDuplicate);
    db.leads = [...(db.leads || []), ...newLeads];
    db.searches = [...(db.searches || []), { query: productNiche, country, date: new Date().toISOString(), count: leads.length }];
    saveDb(db);
    const social = buildSocialSearchUrls(productNiche, country, searchTerms);
    res.json({ leads, count: leads.length, newCount: newLeads.length, duplicateCount: leads.length - newLeads.length, searchGuidance: { ...social, linkedinSearch: buildLinkedInSearchUrl(searchTerms[0], jobFilter, country) }, searchTermsUsed: searchTerms });
  } catch (err) { console.error('Search error:', err); res.status(500).json({ error: 'Search failed.' }); }
});

app.post('/api/export', async (req, res) => {
  const { leads, format = 'csv' } = req.body;
  if (!leads || !Array.isArray(leads)) return res.status(400).json({ error: 'Leads array required' });
  if (format === 'csv') { res.setHeader('Content-Type', 'text/csv'); res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"'); return res.send(leadsToCSV(leads)); }
  if (format === 'json') { res.setHeader('Content-Type', 'application/json'); res.setHeader('Content-Disposition', 'attachment; filename="leads.json"'); return res.send(JSON.stringify(leads, null, 2)); }
  if (format === 'sheets') { const h=['Company','Owner','Email','Phone','WhatsApp','Instagram','Website','Score','Pain Signal','CRM Status','Source','Country'];const rows=leads.map(l=>[l.companyName||'',l.ownerName||'',l.email||'',l.phone||'',l.whatsapp||'',l.instagram||'',l.website||'',l.score||0,l.painSignal?'Yes':'No',l.crmStatus||'new',l.source||'',l.country||''].join('\t'));res.setHeader('Content-Type','text/plain');res.setHeader('Content-Disposition','attachment; filename="leads-sheets.tsv"');return res.send([h.join('\t'),...rows].join('\n')); }
  res.status(400).json({ error: 'format must be csv, json, or sheets' });
});

app.get('/api/saved-leads', (req, res) => { const db = loadDb(); let leads = db.leads || []; if (req.query.has_whatsapp === 'true') leads = leads.filter(l => l.whatsapp); if (req.query.has_email === 'true') leads = leads.filter(l => l.email); if (req.query.min_score) leads = leads.filter(l => (l.score || 0) >= parseInt(req.query.min_score)); res.json({ leads, count: leads.length }); });
app.delete('/api/saved-leads', (req, res) => { saveDb({ leads: [], searches: [] }); res.json({ success: true }); });

app.get('/api/wa-queue', (req, res) => { const q = loadWaQueue(); res.json({ queue: q.queue || [], count: (q.queue || []).length }); });
app.post('/api/wa-queue/add', (req, res) => { const { leads, messageTemplate, productName = 'CrewPay' } = req.body; if (!leads || !Array.isArray(leads)) return res.status(400).json({ error: 'leads array required' }); const q = loadWaQueue(); const added = []; for (const lead of leads) { if (!lead.whatsapp) continue; if ((q.queue || []).find(i => i.leadId === lead.id)) continue; const name = lead.ownerName ? lead.ownerName.split(' ')[0] : 'there'; const msg = messageTemplate || `Hi ${name},\n\nI came across ${lead.companyName} and I think ${productName} could be a great fit.\n\n${productName} lets you fund tasks upfront and release payment only after work is verified — perfect for businesses managing contractors or gig workers.\n\nWould you be open to a quick 10-minute chat?\n\nBest,\n[Your Name]`; const item = { id: `wa-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, leadId: lead.id, companyName: lead.companyName, ownerName: lead.ownerName || '', whatsapp: lead.whatsapp, score: lead.score || 0, message: msg, status: 'pending', addedAt: new Date().toISOString(), sentAt: null, repliedAt: null, notes: '' }; q.queue = [...(q.queue || []), item]; added.push(item); } saveWaQueue(q); res.json({ added: added.length, queue: q.queue }); });
app.get('/api/wa-queue/stats', (req, res) => { const q = loadWaQueue(); const queue = q.queue || []; res.json({ total: queue.length, pending: queue.filter(i=>i.status==='pending').length, sent: queue.filter(i=>i.status==='sent').length, replied: queue.filter(i=>i.status==='replied').length, skipped: queue.filter(i=>i.status==='skipped').length }); });
app.get('/api/wa-queue/:id/link', (req, res) => { const q = loadWaQueue(); const item = (q.queue || []).find(i => i.id === req.params.id); if (!item) return res.status(404).json({ error: 'Not found' }); const phone = item.whatsapp.replace(/[^\d]/g, ''); res.json({ link: `https://wa.me/${phone}?text=${encodeURIComponent(item.message)}`, item }); });
app.patch('/api/wa-queue/:id', (req, res) => { const q = loadWaQueue(); const idx = (q.queue || []).findIndex(i => i.id === req.params.id); if (idx === -1) return res.status(404).json({ error: 'Not found' }); const { status, message, notes } = req.body; if (status) q.queue[idx].status = status; if (message) q.queue[idx].message = message; if (notes !== undefined) q.queue[idx].notes = notes; if (status === 'sent') q.queue[idx].sentAt = new Date().toISOString(); if (status === 'replied') q.queue[idx].repliedAt = new Date().toISOString(); saveWaQueue(q); res.json({ item: q.queue[idx] }); });
app.delete('/api/wa-queue/:id', (req, res) => { const q = loadWaQueue(); q.queue = (q.queue || []).filter(i => i.id !== req.params.id); saveWaQueue(q); res.json({ success: true }); });

const CRM_STAGES = ['new','contacted','interested','demo','converted','dead'];
app.get('/api/crm', (req, res) => { const crm = loadCrm(); const leads = crm.leads || []; const pipeline = {}; for (const s of CRM_STAGES) pipeline[s] = leads.filter(l => l.crmStatus === s); res.json({ pipeline, leads, stages: CRM_STAGES, counts: Object.fromEntries(CRM_STAGES.map(s => [s, pipeline[s].length])) }); });
app.post('/api/crm', (req, res) => { const { lead } = req.body; if (!lead) return res.status(400).json({ error: 'lead required' }); const crm = loadCrm(); const existing = (crm.leads || []).find(l => l.id === lead.id || (l.companyName||'').toLowerCase() === (lead.companyName||'').toLowerCase()); if (existing) return res.json({ lead: existing, message: 'Already in CRM' }); const crmLead = { ...lead, crmId: `crm-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, crmStatus: 'new', addedToCrmAt: new Date().toISOString(), lastActivityAt: new Date().toISOString(), notes: [], activities: [{ type: 'added', note: 'Added to CRM', date: new Date().toISOString() }] }; crm.leads = [...(crm.leads || []), crmLead]; saveCrm(crm); res.json({ lead: crmLead }); });
app.post('/api/crm/bulk', (req, res) => { const { leads } = req.body; if (!leads || !Array.isArray(leads)) return res.status(400).json({ error: 'leads array required' }); const crm = loadCrm(); const existingIds = new Set((crm.leads || []).map(l => l.id)); const existingNames = new Set((crm.leads || []).map(l => (l.companyName || '').toLowerCase())); let added = 0; for (const lead of leads) { if (existingIds.has(lead.id) || existingNames.has((lead.companyName || '').toLowerCase())) continue; crm.leads.push({ ...lead, crmId: `crm-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, crmStatus: 'new', addedToCrmAt: new Date().toISOString(), lastActivityAt: new Date().toISOString(), notes: [], activities: [{ type: 'added', note: 'Added to CRM', date: new Date().toISOString() }] }); added++; } saveCrm(crm); res.json({ added, total: crm.leads.length }); });
app.patch('/api/crm/:crmId/stage', (req, res) => { const { stage, note } = req.body; if (!CRM_STAGES.includes(stage)) return res.status(400).json({ error: `stage must be one of: ${CRM_STAGES.join(', ')}` }); const crm = loadCrm(); const lead = (crm.leads || []).find(l => l.crmId === req.params.crmId); if (!lead) return res.status(404).json({ error: 'Lead not found' }); const prev = lead.crmStatus; lead.crmStatus = stage; lead.lastActivityAt = new Date().toISOString(); lead.activities = [...(lead.activities || []), { type: 'stage_change', from: prev, to: stage, note: note || '', date: new Date().toISOString() }]; saveCrm(crm); res.json({ lead }); });
app.post('/api/crm/:crmId/note', (req, res) => { const { note } = req.body; if (!note) return res.status(400).json({ error: 'note required' }); const crm = loadCrm(); const lead = (crm.leads || []).find(l => l.crmId === req.params.crmId); if (!lead) return res.status(404).json({ error: 'Lead not found' }); lead.notes = [...(lead.notes || []), { text: note, date: new Date().toISOString() }]; lead.activities = [...(lead.activities || []), { type: 'note', note, date: new Date().toISOString() }]; lead.lastActivityAt = new Date().toISOString(); saveCrm(crm); res.json({ lead }); });
app.patch('/api/crm/:crmId', (req, res) => { const crm = loadCrm(); const idx = (crm.leads || []).findIndex(l => l.crmId === req.params.crmId); if (idx === -1) return res.status(404).json({ error: 'Lead not found' }); const allowed = ['ownerName','email','whatsapp','phone','instagram','website']; for (const key of allowed) { if (req.body[key] !== undefined) crm.leads[idx][key] = req.body[key]; } crm.leads[idx].lastActivityAt = new Date().toISOString(); saveCrm(crm); res.json({ lead: crm.leads[idx] }); });
app.delete('/api/crm/:crmId', (req, res) => { const crm = loadCrm(); crm.leads = (crm.leads || []).filter(l => l.crmId !== req.params.crmId); saveCrm(crm); res.json({ success: true }); });
app.get('/api/crm/stats', (req, res) => { const crm = loadCrm(); const leads = crm.leads || []; res.json({ total: leads.length, byStage: Object.fromEntries(CRM_STAGES.map(s => [s, leads.filter(l => l.crmStatus === s).length])), conversionRate: leads.length > 0 ? ((leads.filter(l => l.crmStatus === 'converted').length / leads.length) * 100).toFixed(1) + '%' : '0%', avgScore: leads.length > 0 ? (leads.reduce((s, l) => s + (l.score || 0), 0) / leads.length).toFixed(1) : 0 }); });

app.post('/api/find-email', async (req, res) => { try { const { domain, firstName, lastName, websiteUrl } = req.body; if (!domain) return res.status(400).json({ error: 'Domain required' }); const [domainValid, scraped] = await Promise.all([validateDomain(domain), scrapeEmailsFromWebsite(websiteUrl || `https://${domain}`)]); const patterns = generateEmailPatterns(domain, firstName || '', lastName || ''); res.json({ domain, domainValid, patterns, scrapedEmails: scraped, bestGuess: scraped[0] || patterns[0] || null }); } catch { res.status(500).json({ error: 'Email lookup failed' }); } });
app.post('/api/enrich-company', async (req, res) => { try { const { domain, companyName } = req.body; if (!domain && !companyName) return res.status(400).json({ error: 'Domain or company name required' }); const d = domain || `${companyName.toLowerCase().replace(/\s+/g, '')}.com`; const cd = extractDomain(d); const [emails, details, domainValid] = await Promise.all([scrapeEmailsFromWebsite(`https://${cd}`), extractContactDetails(`https://${cd}`), validateDomain(cd)]); res.json({ domain: cd, logoUrl: getClearbitLogoUrl(cd), domainValid, emails, ownerName: details.ownerName, whatsapp: details.whatsapp, instagram: details.instagram, phone: details.phone, emailPatterns: generateEmailPatterns(cd).slice(0, 3) }); } catch { res.status(500).json({ error: 'Enrichment failed' }); } });
app.post('/api/validate-email', async (req, res) => { try { const { email } = req.body; if (!email) return res.status(400).json({ error: 'Email required' }); const domain = email.split('@')[1]; const valid = await validateDomain(domain); res.json({ email, domain, valid }); } catch { res.status(500).json({ error: 'Validation failed' }); } });
app.get('/api/niches', (req, res) => res.json({ categories: Object.keys(INFORMAL_CATEGORIES), total: Object.keys(INFORMAL_CATEGORIES).length }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '5.0.0', searchEngine: 'SerpAPI/Google', enrichCap: 25, painCap: 8, totalNiches: Object.keys(INFORMAL_CATEGORIES).length }));

app.listen(PORT, () => {
  console.log(`\n🚀 Lead Generator API v5.0 – port ${PORT}`);
  console.log(`🔍 Search engine: SerpAPI/Google`);
  console.log(`✅ Niches: ${Object.keys(INFORMAL_CATEGORIES).length} categories\n`);
});
