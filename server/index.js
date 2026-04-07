require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const dns = require('dns').promises;
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
app.use(cors());
app.use(express.json());

// ─── Local leads DB ──────────────────────────────────────────────────────────
const DB_PATH = path.join(__dirname, '..', 'leads-db.json');
function loadDb() { try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch { return { leads: [], searches: [] }; } }
function saveDb(db) { try { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); } catch(e) { console.error('DB save error:', e.message); } }

// ─── Country codes ────────────────────────────────────────────────────────────
const COUNTRY_CODES = {
  'united states':'us','usa':'us','algeria':'dz','angola':'ao','benin':'bj','botswana':'bw',
  'burkina faso':'bf','burundi':'bi','cabo verde':'cv','cameroon':'cm','central african republic':'cf',
  'chad':'td','comoros':'km','congo (brazzaville)':'cg','congo (kinshasa)':'cd','djibouti':'dj',
  'egypt':'eg','equatorial guinea':'gq','eritrea':'er','eswatini':'sz','ethiopia':'et','gabon':'ga',
  'gambia':'gm','ghana':'gh','guinea':'gn','guinea-bissau':'gw','ivory coast':'ci','kenya':'ke',
  'lesotho':'ls','liberia':'lr','libya':'ly','madagascar':'mg','malawi':'mw','mali':'ml',
  'mauritania':'mr','mauritius':'mu','morocco':'ma','mozambique':'mz','namibia':'na','niger':'ne',
  'nigeria':'ng','rwanda':'rw','sao tome and principe':'st','senegal':'sn','seychelles':'sc',
  'sierra leone':'sl','somalia':'so','south africa':'za','south sudan':'ss','sudan':'sd',
  'tanzania':'tz','togo':'tg','tunisia':'tn','uganda':'ug','zambia':'zm','zimbabwe':'zw'
};
function getCountryCode(c){return COUNTRY_CODES[c.toLowerCase()]||'ng';}

// ─── Search terms ─────────────────────────────────────────────────────────────
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

const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// ─── Lead scoring ─────────────────────────────────────────────────────────────
function scoreLead(lead){
  let score=0;
  if(lead.ownerName&&lead.ownerName.trim())score+=2;
  if(lead.whatsapp&&lead.whatsapp.trim())score+=2;
  if(lead.email&&lead.email.trim()&&!lead.email.includes('info@')&&!lead.email.includes('contact@'))score+=2;
  else if(lead.email&&lead.email.trim())score+=1;
  if(lead.painSignal)score+=2;
  if(lead.instagram&&lead.instagram.trim())score+=1;
  if(lead.linkedinUrl&&!lead.linkedinUrl.includes('search?'))score+=1;
  return Math.min(score,10);
}

// ─── Pain signal detection ────────────────────────────────────────────────────
async function detectPainSignal(companyName,country){
  try{
    const q=`"${companyName}" "${country}" (hiring freelancer OR contractor needed OR gig worker OR part-time staff)`;
    const res=await searchDuckDuckGo(q);
    return res.length>0;
  }catch{return false;}
}

// ─── Social/contact extraction ────────────────────────────────────────────────
async function extractContactDetails(url){
  const result={ownerName:'',whatsapp:'',instagram:'',phone:''};
  if(!url)return result;
  try{
    const res=await axios.get(url,{timeout:8000,headers:{'User-Agent':'Mozilla/5.0 (compatible; LeadBot/1.0)'}});
    const text=res.data;
    const waMatches=text.match(/(?:wa\.me\/|whatsapp\.com\/send\?phone=|WhatsApp[:\s]+)(\+?[\d\s\-\(\)]{10,15})/gi)||[];
    if(waMatches.length>0){const num=waMatches[0].replace(/[^\d+]/g,'');if(num.length>=10)result.whatsapp=num.startsWith('+')?num:`+${num}`;}
    const phoneMatches=text.match(/(?:\+?234|0)[789][01]\d{8}/g)||[];
    if(phoneMatches.length>0&&!result.whatsapp)result.phone=phoneMatches[0];
    const igMatches=text.match(/(?:instagram\.com\/|@)([a-zA-Z0-9_.]{3,30})/g)||[];
    if(igMatches.length>0){const handle=igMatches[0].replace('instagram.com/','').replace('@','').split('/')[0];if(handle&&!handle.includes('share')&&!handle.includes('explore'))result.instagram=`@${handle}`;}
    const ownerPatterns=[/(?:founded by|CEO|Managing Director|Owner|Principal|Director|Head)\s*:?\s*([A-Z][a-z]+ [A-Z][a-z]+)/g,/([A-Z][a-z]+ [A-Z][a-z]+)\s*(?:,?\s*(?:CEO|Founder|Owner|MD|Director|Principal))/g];
    for(const pat of ownerPatterns){const m=text.match(pat);if(m&&m.length>0){result.ownerName=m[0].replace(/(?:founded by|CEO|Managing Director|Owner|Principal|Director|Head|Founder|MD)\s*:?\s*/gi,'').replace(/\s*,?\s*(?:CEO|Founder|Owner|MD|Director|Principal)\s*/gi,'').trim();if(result.ownerName.split(' ').length>=2)break;else result.ownerName='';} }
  }catch{}
  return result;
}

// ─── Email utilities ──────────────────────────────────────────────────────────
function generateEmailPatterns(domain,firstName='',lastName=''){
  if(!domain)return[];
  const f=firstName.toLowerCase().replace(/[^a-z]/g,'');
  const l=lastName.toLowerCase().replace(/[^a-z]/g,'');
  const p=[];
  if(f&&l){p.push(`${f}.${l}@${domain}`,`${f}${l}@${domain}`,`${f[0]}${l}@${domain}`,`${f}@${domain}`);}
  p.push(`info@${domain}`,`hello@${domain}`,`contact@${domain}`,`bookings@${domain}`,`enquiries@${domain}`);
  return[...new Set(p)];
}

async function validateDomain(domain){
  try{const r=await dns.resolveMx(domain);return r&&r.length>0;}catch{return false;}
}

async function scrapeEmailsFromWebsite(url){
  try{
    const res=await axios.get(url,{timeout:8000,headers:{'User-Agent':'Mozilla/5.0 (compatible; LeadBot/1.0)'}});
    const emails=res.data.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)||[];
    return[...new Set(emails)].filter(e=>!e.includes('noreply')&&!e.includes('example')&&!e.includes('.png')&&!e.includes('sentry')).slice(0,5);
  }catch{return[];}
}

// ─── Search engines ───────────────────────────────────────────────────────────
async function searchDuckDuckGo(query){
  try{
    const res=await axios.get(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,{timeout:10000});
    const data=res.data;
    const results=[];
    if(data.AbstractURL&&data.AbstractTitle)results.push({title:data.AbstractTitle,url:data.AbstractURL,snippet:data.AbstractText});
    if(data.RelatedTopics){for(const t of data.RelatedTopics.slice(0,10)){if(t.FirstURL&&t.Text)results.push({title:t.Text.split(' - ')[0]||t.Text,url:t.FirstURL,snippet:t.Text});}}
    return results;
  }catch(err){console.error('DDG:',err.message);return[];}
}

async function searchOpenCorporates(query,country){
  try{
    const cc=getCountryCode(country);
    const res=await axios.get(`https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(query)}&jurisdiction_code=${cc}&per_page=10`,{timeout:10000});
    return(res.data?.results?.companies||[]).map(({company})=>({companyName:company.name,website:company.registry_url||'',country,source:'OpenCorporates'}));
  }catch(err){console.error('OC:',err.message);return[];}
}

async function searchLagosDirectories(niche,country){
  const results=[];
  const sources=[['vconnect.com','VConnect'],['connectnigeria.com','ConnectNigeria'],['businesslist.com.ng','BusinessList.com.ng'],['bark.com','Bark.com']];
  for(const[site,label] of sources){
    try{
      const r=await searchDuckDuckGo(`site:${site} "${niche}" "${country}"`);
      for(const x of r.filter(x=>x.url.includes(site)).slice(0,3))results.push({companyName:extractCompanyName(x.title),website:x.url,country,source:label,snippet:x.snippet||''});
      await sleep(300);
    }catch{}
  }
  try{
    const r=await searchDuckDuckGo(`"${niche}" "${country}" contact phone WhatsApp`);
    for(const x of r.slice(0,4)){if(!x.url.includes('duckduckgo')&&!x.url.includes('wikipedia'))results.push({companyName:extractCompanyName(x.title),website:x.url,country,source:'Web Search',snippet:x.snippet||''});}
  }catch{}
  return results;
}

function buildSocialSearchUrls(niche,country,terms){
  const primary=terms[0]||niche;
  const q=`${primary} ${country}`;
  return{
    facebook:`https://www.facebook.com/search/pages/?q=${encodeURIComponent(q)}`,
    facebookGroups:`https://www.facebook.com/search/groups/?q=${encodeURIComponent(q)}`,
    instagram:`https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(q)}`,
    twitter:`https://twitter.com/search?q=${encodeURIComponent(q)}&f=user`,
    whatsappBusiness:`https://www.google.com/search?q=${encodeURIComponent(`"${primary}" "${country}" WhatsApp contact`)}`,
    googleMaps:`https://www.google.com/maps/search/${encodeURIComponent(q)}`,
    yellowPages:`https://www.yellowpages.com.ng/search?q=${encodeURIComponent(niche)}&l=${encodeURIComponent(country)}`,
    vconnect:`https://www.vconnect.com/search?q=${encodeURIComponent(niche)}&loc=${encodeURIComponent(country)}`,
    connectNigeria:`https://connectnigeria.com/?s=${encodeURIComponent(niche)}`,
    businessList:`https://www.businesslist.com.ng/search?q=${encodeURIComponent(niche)}`,
    bark:`https://www.bark.com/en/ng/?search=${encodeURIComponent(niche)}`,
  };
}

function extractDomain(url){try{return new URL(url.startsWith('http')?url:`https://${url}`).hostname.replace('www.','');}catch{return url;}}
function extractCompanyName(t){return t.replace(/\s*[-\u2013\u2014|:]\s*.*/g,'').trim()||t.trim();}
function getClearbitLogoUrl(d){return`https://logo.clearbit.com/${d}`;}
function buildLinkedInSearchUrl(q,j,c){const kw=[q,j,c].filter(Boolean).join(' ');return`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(kw)}`;}
function buildGoogleLinkedInUrl(q,j,c){return`https://www.google.com/search?q=${encodeURIComponent(`site:linkedin.com/in "${q}" "${c}"`)}`; }
function deduplicateLeads(leads){const s=new Set();return leads.filter(l=>{const k=(l.companyName||'').toLowerCase().trim();if(!k||k.length<3||s.has(k))return false;s.add(k);return true;});}

function leadsToCSV(leads){
  const headers=['Company Name','Owner Name','Email','Phone','WhatsApp','Instagram','LinkedIn','Website','Country','Source','Score','Pain Signal','Date Found'];
  const rows=leads.map(l=>[l.companyName||'',l.ownerName||'',l.email||'',l.phone||'',l.whatsapp||'',l.instagram||'',l.linkedinUrl||'',l.website||'',l.country||'',l.source||'',l.score||0,l.painSignal?'Yes':'No',l.dateFound||''].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','));
  return[headers.join(','),...rows].join('\n');
}

app.post('/api/search-leads',async(req,res)=>{
  try{
    const{productNiche,country,industry,companySize,jobTitle}=req.body;
    if(!productNiche||!country)return res.status(400).json({error:'Product niche and country are required'});
    const leads=[];
    const searchTerms=getSearchTerms(productNiche);
    const primaryTerm=searchTerms[0];
    const isSmall=!companySize||['1-10','1-50','11-50'].includes(companySize);
    const jobFilter=jobTitle||'founder OR owner OR CEO OR director OR "business owner" OR principal';
    const ocResults=await searchOpenCorporates(`${primaryTerm} ${industry||''}`.trim(),country);
    for(const r of ocResults)leads.push({id:`oc-${Date.now()}-${Math.random()}`,companyName:r.companyName,website:r.website||'',ownerName:'',contactTitle:'',email:'',instagram:'',whatsapp:'',phone:'',linkedinUrl:buildLinkedInSearchUrl(r.companyName,jobFilter,country),country,source:'OpenCorporates',dateFound:new Date().toISOString().split('T')[0],score:0,painSignal:false});
    await sleep(400);
    for(const term of searchTerms.slice(0,3)){
      const q=`${term} ${isSmall?'small team OR "home-based" OR boutique':''} ${country} contact`.trim().replace(/\s+/g,' ');
      const ddg=await searchDuckDuckGo(q);
      for(const r of ddg.slice(0,5)){if(!r.url||r.url.includes('duckduckgo')||r.url.includes('wikipedia'))continue;leads.push({id:`ddg-${Date.now()}-${Math.random()}`,companyName:extractCompanyName(r.title),website:r.url,ownerName:'',contactTitle:'',email:'',instagram:'',whatsapp:'',phone:'',linkedinUrl:buildLinkedInSearchUrl(extractCompanyName(r.title),jobFilter,country),country,source:'Web Search',dateFound:new Date().toISOString().split('T')[0],score:0,painSignal:false,snippet:r.snippet||''});}
      await sleep(300);
    }
    const dirResults=await searchLagosDirectories(primaryTerm,country);
    for(const r of dirResults)leads.push({id:`dir-${Date.now()}-${Math.random()}`,companyName:r.companyName,website:r.website,ownerName:'',contactTitle:'',email:'',instagram:'',whatsapp:'',phone:'',linkedinUrl:buildLinkedInSearchUrl(r.companyName,jobFilter,country),country,source:r.source,dateFound:new Date().toISOString().split('T')[0],score:0,painSignal:false,snippet:r.snippet||''});
    let unique=deduplicateLeads(leads);
    for(let i=0;i<Math.min(unique.length,8);i++){
      const lead=unique[i];
      if(lead.website){
        try{
          const [details,scraped]=await Promise.all([extractContactDetails(lead.website),scrapeEmailsFromWebsite(lead.website)]);
          if(details.ownerName)lead.ownerName=details.ownerName;
          if(details.whatsapp)lead.whatsapp=details.whatsapp;
          if(details.instagram)lead.instagram=details.instagram;
          if(details.phone&&!lead.phone)lead.phone=details.phone;
          if(scraped.length>0)lead.email=scraped[0];
          const domain=extractDomain(lead.website);
          lead.logoUrl=getClearbitLogoUrl(domain);
          lead.emailPatterns=generateEmailPatterns(domain).slice(0,3);
        }catch{}
      }
      if(i<5)lead.painSignal=await detectPainSignal(lead.companyName,country);
      lead.score=scoreLead(lead);
      await sleep(200);
    }
    for(let i=8;i<unique.length;i++){unique[i].score=scoreLead(unique[i]);}
    unique.sort((a,b)=>b.score-a.score);
    const db=loadDb();
    const dbNames=new Set((db.leads||[]).map(l=>(l.companyName||'').toLowerCase().trim()));
    unique=unique.map(l=>({...l,isDuplicate:dbNames.has((l.companyName||'').toLowerCase().trim())}));
    const newLeads=unique.filter(l=>!l.isDuplicate);
    db.leads=[...(db.leads||[]),...newLeads];
    db.searches=[...(db.searches||[]),{query:productNiche,country,date:new Date().toISOString(),count:unique.length}];
    saveDb(db);
    const social=buildSocialSearchUrls(productNiche,country,searchTerms);
    res.json({leads:unique,count:unique.length,newCount:newLeads.length,duplicateCount:unique.length-newLeads.length,searchGuidance:{...social,linkedinSearch:buildLinkedInSearchUrl(primaryTerm,jobFilter,country),googleLinkedIn:buildGoogleLinkedInUrl(primaryTerm,jobFilter,country),googleSearch:`https://www.google.com/search?q=${encodeURIComponent(`"${primaryTerm}" "${country}" contact OR phone OR WhatsApp`)}`},searchTermsUsed:searchTerms});
  }catch(err){console.error('Search error:',err);res.status(500).json({error:'Search failed. Please try again.'});}
});

app.post('/api/export',async(req,res)=>{
  const{leads,format='csv'}=req.body;
  if(!leads||!Array.isArray(leads))return res.status(400).json({error:'Leads array required'});
  if(format==='csv'){res.setHeader('Content-Type','text/csv');res.setHeader('Content-Disposition','attachment; filename="leads.csv"');return res.send(leadsToCSV(leads));}
  if(format==='json'){res.setHeader('Content-Type','application/json');res.setHeader('Content-Disposition','attachment; filename="leads.json"');return res.send(JSON.stringify(leads,null,2));}
  if(format==='sheets'){const headers=['Company Name','Owner Name','Email','Phone','WhatsApp','Instagram','Website','Score','Pain Signal','Source','Country'];const rows=leads.map(l=>[l.companyName||'',l.ownerName||'',l.email||'',l.phone||'',l.whatsapp||'',l.instagram||'',l.website||'',l.score||0,l.painSignal?'Yes':'No',l.source||'',l.country||''].join('\t'));res.setHeader('Content-Type','text/plain');res.setHeader('Content-Disposition','attachment; filename="leads-sheets.tsv"');return res.send([headers.join('\t'),...rows].join('\n'));}
  res.status(400).json({error:'format must be csv, json, or sheets'});
});

app.get('/api/saved-leads',(req,res)=>{
  const db=loadDb();
  let leads=db.leads||[];
  if(req.query.has_whatsapp==='true')leads=leads.filter(l=>l.whatsapp);
  if(req.query.has_email==='true')leads=leads.filter(l=>l.email);
  if(req.query.min_score)leads=leads.filter(l=>(l.score||0)>=parseInt(req.query.min_score));
  res.json({leads,count:leads.length});
});

app.delete('/api/saved-leads',(req,res)=>{saveDb({leads:[],searches:[]});res.json({success:true,message:'All saved leads cleared'});});

app.post('/api/find-email',async(req,res)=>{
  try{const{domain,firstName,lastName,websiteUrl}=req.body;if(!domain)return res.status(400).json({error:'Domain is required'});const domainValid=await validateDomain(domain);const patterns=generateEmailPatterns(domain,firstName||'',lastName||'');let scrapedEmails=await scrapeEmailsFromWebsite(websiteUrl||`https://${domain}`);if(scrapedEmails.length===0)scrapedEmails=await scrapeEmailsFromWebsite(`https://${domain}/contact`);res.json({domain,domainValid,patterns,scrapedEmails,bestGuess:scrapedEmails[0]||patterns[0]||null});}catch(err){res.status(500).json({error:'Email lookup failed'});}
});

app.post('/api/search-linkedin',async(req,res)=>{
  try{const{companyName,jobTitle,country}=req.body;res.json({linkedinSearchUrl:buildLinkedInSearchUrl(companyName,jobTitle,country),googleLinkedInUrl:buildGoogleLinkedInUrl(companyName,jobTitle,country)});}catch(err){res.status(500).json({error:'LinkedIn search failed'});}
});

app.post('/api/enrich-company',async(req,res)=>{
  try{
    const{domain,companyName}=req.body;
    if(!domain&&!companyName)return res.status(400).json({error:'Domain or company name required'});
    const d=domain||`${companyName.toLowerCase().replace(/\s+/g,'')}.com`;
    const cd=extractDomain(d);
    const[emails,details,domainValid]=await Promise.all([scrapeEmailsFromWebsite(`https://${cd}`),extractContactDetails(`https://${cd}`),validateDomain(cd)]);
    res.json({domain:cd,logoUrl:getClearbitLogoUrl(cd),domainValid,emails,ownerName:details.ownerName,whatsapp:details.whatsapp,instagram:details.instagram,phone:details.phone,emailPatterns:generateEmailPatterns(cd).slice(0,3)});
  }catch(err){res.status(500).json({error:'Enrichment failed'});}
});

app.post('/api/validate-email',async(req,res)=>{
  try{const{email}=req.body;if(!email)return res.status(400).json({error:'Email is required'});const domain=email.split('@')[1];if(!domain)return res.status(400).json({error:'Invalid email format'});const valid=await validateDomain(domain);res.json({email,domain,valid,message:valid?'Domain accepts email':'Domain has no MX records'});}catch(err){res.status(500).json({error:'Validation failed'});}
});

app.get('/api/niches',(req,res)=>res.json({categories:Object.keys(INFORMAL_CATEGORIES),total:Object.keys(INFORMAL_CATEGORIES).length}));
app.get('/api/health',(req,res)=>res.json({status:'ok',mode:'free-only',tools:['DuckDuckGo','OpenCorporates','VConnect','ConnectNigeria','BusinessList.com.ng','Bark.com','Yellow Pages NG','Cheerio','DNS MX','Clearbit'],features:['lead-scoring','pain-signal-detection','whatsapp-extraction','instagram-extraction','owner-extraction','csv-export','json-export','sheets-export','deduplication','saved-leads'],informalCategories:Object.keys(INFORMAL_CATEGORIES).length,apiKeysRequired:false}));

app.listen(PORT,()=>{
  console.log(`\n🚀 Lead Generator API – port ${PORT}`);
  console.log(`✅ ${Object.keys(INFORMAL_CATEGORIES).length} categories | FREE TOOLS ONLY`);
  console.log(`✅ Lead scoring | Pain signal detection | Contact extraction`);
  console.log(`✅ CSV / JSON / Google Sheets export | Deduplication\n`);
});
