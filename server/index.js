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

const COUNTRY_CODES = {
  'united states':'us','usa':'us','algeria':'dz','angola':'ao','benin':'bj','botswana':'bw','burkina faso':'bf','burundi':'bi','cabo verde':'cv','cameroon':'cm','central african republic':'cf','chad':'td','comoros':'km','congo (brazzaville)':'cg','congo (kinshasa)':'cd','djibouti':'dj','egypt':'eg','equatorial guinea':'gq','eritrea':'er','eswatini':'sz','ethiopia':'et','gabon':'ga','gambia':'gm','ghana':'gh','guinea':'gn','guinea-bissau':'gw','ivory coast':'ci','kenya':'ke','lesotho':'ls','liberia':'lr','libya':'ly','madagascar':'mg','malawi':'mw','mali':'ml','mauritania':'mr','mauritius':'mu','morocco':'ma','mozambique':'mz','namibia':'na','niger':'ne','nigeria':'ng','rwanda':'rw','sao tome and principe':'st','senegal':'sn','seychelles':'sc','sierra leone':'sl','somalia':'so','south africa':'za','south sudan':'ss','sudan':'sd','tanzania':'tz','togo':'tg','tunisia':'tn','uganda':'ug','zambia':'zm','zimbabwe':'zw'
};
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
  'security':['security service','event security','crowd control','private security'],
  'cleaning':['cleaning service','janitorial','cleaning company','office cleaning'],
  'printing':['printing press','print shop','banner printing','flyer printing'],
  'logistics':['logistics company','delivery service','haulage','courier service','dispatch rider'],
  'tailoring':['tailor','fashion designer','seamstress','clothing alteration'],
  'digital marketing':['digital marketing agency','social media manager','content creator','influencer marketing'],
  'web design':['web designer','web developer','website design','graphic designer'],
  'real estate':['estate agent','property agent','real estate agency','property management'],
  'travel agency':['travel agency','tour operator','holiday packages','visa agent'],
  'hair salon':['hair salon','hairdresser','hair stylist','natural hair'],
  'catering equipment':['catering equipment hire','tent rental','chair hire','table rental'],
  'tutoring':['tutor','private teacher','lesson teacher','home lessons'],
};

function getSearchTerms(niche){
  const lower=niche.toLowerCase();
  for(const[cat,terms]of Object.entries(INFORMAL_CATEGORIES)){
    if(lower.includes(cat)||cat.includes(lower))return terms;
  }
  return[niche,`${niche} service`,`${niche} company`,`${niche} agency`];
}

const sleep=ms=>new Promise(r=>setTimeout(r,ms));

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

async function searchAfricaDirectories(niche,country){
  const results=[];
  for(const[site,label]of[['bark.com','Bark.com'],['vconnect.com','VConnect']]){
    try{
      const r=await searchDuckDuckGo(`site:${site} "${niche}" "${country}"`);
      for(const x of r.filter(x=>x.url.includes(site)).slice(0,3))results.push({companyName:extractCompanyName(x.title),website:x.url,country,source:label});
      await sleep(300);
    }catch{}
  }
  try{
    const r=await searchDuckDuckGo(`"${niche}" "${country}" contact phone WhatsApp`);
    for(const x of r.slice(0,4)){if(!x.url.includes('duckduckgo')&&!x.url.includes('wikipedia'))results.push({companyName:extractCompanyName(x.title),website:x.url,country,source:'Web Search'});}
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
    bark:`https://www.bark.com/en/ng/?search=${encodeURIComponent(niche)}`,
  };
}

function extractDomain(url){try{return new URL(url.startsWith('http')?url:`https://${url}`).hostname.replace('www.','');}catch{return url;}}
function extractCompanyName(t){return t.replace(/\s*[-–—|:]\s*.*/g,'').trim()||t.trim();}
function getClearbitLogoUrl(d){return`https://logo.clearbit.com/${d}`;}
function buildLinkedInSearchUrl(q,j,c){const kw=[q,j,c].filter(Boolean).join(' ');return`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(kw)}`;}
function buildGoogleLinkedInUrl(q,j,c){return`https://www.google.com/search?q=${encodeURIComponent(`site:linkedin.com/in "${q}" "${c}"`)}`; }
function deduplicateLeads(leads){const s=new Set();return leads.filter(l=>{const k=(l.companyName||'').toLowerCase().trim();if(!k||k.length<3||s.has(k))return false;s.add(k);return true;});}

app.post('/api/search-leads',async(req,res)=>{
  try{
    const{productNiche,country,industry,companySize,jobTitle}=req.body;
    if(!productNiche||!country)return res.status(400).json({error:'Product niche and country are required'});
    const leads=[];
    const searchTerms=getSearchTerms(productNiche);
    const primaryTerm=searchTerms[0];
    const isSmall=!companySize||['1-10','1-50','11-50'].includes(companySize);
    const jobFilter=jobTitle||'founder OR owner OR CEO OR director OR "business owner"';

    const ocResults=await searchOpenCorporates(`${primaryTerm} ${industry||''}`.trim(),country);
    for(const r of ocResults)leads.push({id:`oc-${Date.now()}-${Math.random()}`,companyName:r.companyName,website:r.website||'',contactName:'',contactTitle:'',email:'',linkedinUrl:buildLinkedInSearchUrl(r.companyName,jobFilter,country),phone:'',country,source:'OpenCorporates (Registered)',dateFound:new Date().toISOString().split('T')[0]});
    await sleep(400);

    for(const term of searchTerms.slice(0,3)){
      const q=`${term} ${isSmall?'small team OR "home-based" OR boutique':''} ${country} contact`.trim().replace(/\s+/g,' ');
      const ddg=await searchDuckDuckGo(q);
      for(const r of ddg.slice(0,5)){if(!r.url||r.url.includes('duckduckgo')||r.url.includes('wikipedia'))continue;leads.push({id:`ddg-${Date.now()}-${Math.random()}`,companyName:extractCompanyName(r.title),website:r.url,contactName:'',contactTitle:'',email:'',linkedinUrl:buildLinkedInSearchUrl(extractCompanyName(r.title),jobFilter,country),phone:'',country,source:'Web Search',dateFound:new Date().toISOString().split('T')[0]});}
      await sleep(300);
    }

    const dirResults=await searchAfricaDirectories(primaryTerm,country);
    for(const r of dirResults)leads.push({id:`dir-${Date.now()}-${Math.random()}`,companyName:r.companyName,website:r.website,contactName:'',contactTitle:'',email:'',linkedinUrl:buildLinkedInSearchUrl(r.companyName,jobFilter,country),phone:'',country,source:r.source,dateFound:new Date().toISOString().split('T')[0]});

    const unique=deduplicateLeads(leads);
    const social=buildSocialSearchUrls(productNiche,country,searchTerms);
    const searchGuidance={
      ...social,
      linkedinSearch:buildLinkedInSearchUrl(primaryTerm,jobFilter,country),
      googleLinkedIn:buildGoogleLinkedInUrl(primaryTerm,jobFilter,country),
      googleSearch:`https://www.google.com/search?q=${encodeURIComponent(`"${primaryTerm}" "${country}" contact OR phone OR WhatsApp`)}`,
      clutchUrl:`https://clutch.co/agencies?search_term=${encodeURIComponent(productNiche)}`,
      goodfirmsUrl:`https://www.goodfirms.co/directory/country/${country.toLowerCase().replace(/\s+/g,'-')}`,
    };
    res.json({leads:unique,count:unique.length,searchGuidance,searchTermsUsed:searchTerms});
  }catch(err){console.error('Search error:',err);res.status(500).json({error:'Search failed. Please try again.'});}
});

app.post('/api/find-email',async(req,res)=>{
  try{
    const{domain,firstName,lastName,websiteUrl}=req.body;
    if(!domain)return res.status(400).json({error:'Domain is required'});
    const domainValid=await validateDomain(domain);
    const patterns=generateEmailPatterns(domain,firstName||'',lastName||'');
    let scrapedEmails=await scrapeEmailsFromWebsite(websiteUrl||`https://${domain}`);
    if(scrapedEmails.length===0)scrapedEmails=await scrapeEmailsFromWebsite(`https://${domain}/contact`);
    res.json({domain,domainValid,patterns,scrapedEmails,bestGuess:scrapedEmails[0]||patterns[0]||null});
  }catch(err){res.status(500).json({error:'Email lookup failed'});}
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
    const emails=await scrapeEmailsFromWebsite(`https://${cd}`);
    const domainValid=await validateDomain(cd);
    res.json({domain:cd,logoUrl:getClearbitLogoUrl(cd),domainValid,emails,emailPatterns:generateEmailPatterns(cd).slice(0,3)});
  }catch(err){res.status(500).json({error:'Enrichment failed'});}
});

app.post('/api/validate-email',async(req,res)=>{
  try{
    const{email}=req.body;
    if(!email)return res.status(400).json({error:'Email is required'});
    const domain=email.split('@')[1];
    if(!domain)return res.status(400).json({error:'Invalid email format'});
    const valid=await validateDomain(domain);
    res.json({email,domain,valid,message:valid?'Domain accepts email':'Domain has no MX records'});
  }catch(err){res.status(500).json({error:'Validation failed'});}
});

app.get('/api/niches',(req,res)=>res.json({categories:Object.keys(INFORMAL_CATEGORIES),total:Object.keys(INFORMAL_CATEGORIES).length}));
app.get('/api/health',(req,res)=>res.json({status:'ok',mode:'free-only',tools:['DuckDuckGo','OpenCorporates','Bark.com','VConnect','Yellow Pages NG','Google Maps','Cheerio','DNS MX','Clearbit'],informalCategories:Object.keys(INFORMAL_CATEGORIES).length,apiKeysRequired:false}));

app.listen(PORT,()=>{
  console.log(`\n🚀 Lead Generator API — port ${PORT}`);
  console.log(`✅ ${Object.keys(INFORMAL_CATEGORIES).length} informal categories | FREE TOOLS ONLY\n`);
});
