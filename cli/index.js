#!/usr/bin/env node
'use strict';

const { Command } = require('commander');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const program = new Command();
const API = process.env.LEAD_GEN_API || 'http://localhost:3001';
const DB_PATH = path.join(__dirname, '..', 'leads-db.json');

function loadDb() { try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch { return { leads: [], searches: [] }; } }
function scoreColor(score) { if (score >= 8) return '\x1b[32m'; if (score >= 5) return '\x1b[33m'; return '\x1b[31m'; }
const reset='\x1b[0m',bold='\x1b[1m',dim='\x1b[2m',cyan='\x1b[36m',green='\x1b[32m',yellow='\x1b[33m';

function printLead(l, i) {
  const sc = scoreColor(l.score || 0);
  console.log(`\n${bold}${i + 1}. ${l.companyName}${reset} ${sc}[${l.score || 0}/10]${reset}${l.painSignal ? ' 🔥' : ''}${l.isDuplicate ? ' (already saved)' : ''}`);
  if (l.ownerName)  console.log(`   ${dim}Owner:${reset}     ${l.ownerName}`);
  if (l.email)      console.log(`   ${dim}Email:${reset}     ${cyan}${l.email}${reset}`);
  if (l.whatsapp)   console.log(`   ${dim}WhatsApp:${reset}  ${green}${l.whatsapp}${reset}`);
  if (l.instagram)  console.log(`   ${dim}Instagram:${reset} ${l.instagram}`);
  if (l.website)    console.log(`   ${dim}Website:${reset}   ${l.website}`);
  if (l.source)     console.log(`   ${dim}Source:${reset}    ${l.source}`);
}

function printTable(leads) {
  const w = { name: 30, score: 6, owner: 20, wa: 16, email: 28 };
  const header = ['Company'.padEnd(w.name),'Score'.padEnd(w.score),'Owner'.padEnd(w.owner),'WhatsApp'.padEnd(w.wa),'Email'.padEnd(w.email)].join(' | ');
  console.log('\n' + bold + header + reset);
  console.log('─'.repeat(header.length));
  for (const l of leads) {
    const sc = scoreColor(l.score || 0);
    console.log([(l.companyName||'').substring(0,w.name-1).padEnd(w.name),(sc+String(l.score||0)+'/10'+reset).padEnd(w.score+10),(l.ownerName||'—').substring(0,w.owner-1).padEnd(w.owner),(l.whatsapp||'—').substring(0,w.wa-1).padEnd(w.wa),(l.email||'—').substring(0,w.email-1).padEnd(w.email)].join(' | '));
  }
  console.log('');
}

function leadsToCSV(leads) {
  const h=['Company Name','Owner Name','Email','Phone','WhatsApp','Instagram','LinkedIn','Website','Country','Source','Score','Pain Signal','Date Found'];
  const rows=leads.map(l=>[l.companyName||'',l.ownerName||'',l.email||'',l.phone||'',l.whatsapp||'',l.instagram||'',l.linkedinUrl||'',l.website||'',l.country||'',l.source||'',l.score||0,l.painSignal?'Yes':'No',l.dateFound||''].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','));
  return[h.join(','),...rows].join('\n');
}

function leadsToTSV(leads) {
  const h=['Company Name','Owner Name','Email','Phone','WhatsApp','Instagram','Website','Score','Pain Signal','Source','Country'];
  const rows=leads.map(l=>[l.companyName||'',l.ownerName||'',l.email||'',l.phone||'',l.whatsapp||'',l.instagram||'',l.website||'',l.score||0,l.painSignal?'Yes':'No',l.source||'',l.country||''].join('\t'));
  return[h.join('\t'),...rows].join('\n');
}

async function spinner(text, fn) {
  const frames=['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];let i=0;
  const id=setInterval(()=>{process.stdout.write(`\r${frames[i++%frames.length]} ${text}`);},80);
  try{const r=await fn();clearInterval(id);process.stdout.write('\r'+' '.repeat(text.length+4)+'\r');return r;}
  catch(e){clearInterval(id);process.stdout.write('\r'+' '.repeat(text.length+4)+'\r');throw e;}
}

program.name('lead-gen').description('🚀 Lead Generator CLI — find business owners anywhere').version('2.0.0');

program.command('search').description('Search for business leads')
  .requiredOption('-n, --niche <niche>','Business niche')
  .requiredOption('-c, --country <country>','Country')
  .option('--city <city>','City filter')
  .option('--size <size>','Company size: 1-10, 1-50, 11-50, 51-200')
  .option('--role <role>','Contact role')
  .option('--has-whatsapp','Only leads with WhatsApp')
  .option('--has-email','Only leads with email')
  .option('--min-score <score>','Minimum lead score',parseInt)
  .option('--sort <field>','Sort: score, name, source','score')
  .option('--output <format>','Output: table, list, json, csv, sheets')
  .option('--file <path>','Save to file')
  .action(async(opts)=>{
    try{
      const result=await spinner(`Searching for "${opts.niche}" in ${opts.country}...`,()=>axios.post(`${API}/api/search-leads`,{productNiche:opts.niche,country:opts.country,industry:opts.city||'',companySize:opts.size||'1-50',jobTitle:opts.role||'founder OR owner OR CEO OR director OR principal'}).then(r=>r.data));
      let leads=result.leads||[];
      if(opts.hasWhatsapp)leads=leads.filter(l=>l.whatsapp);
      if(opts.hasEmail)leads=leads.filter(l=>l.email);
      if(opts.minScore)leads=leads.filter(l=>(l.score||0)>=opts.minScore);
      if(opts.sort==='name')leads.sort((a,b)=>(a.companyName||'').localeCompare(b.companyName||''));
      else if(opts.sort==='source')leads.sort((a,b)=>(a.source||'').localeCompare(b.source||''));
      else leads.sort((a,b)=>(b.score||0)-(a.score||0));
      const format=opts.output||'table';
      if(format==='json'){const out=JSON.stringify(leads,null,2);opts.file?(fs.writeFileSync(opts.file,out),console.log(`✅ Saved ${leads.length} leads to ${opts.file}`)):console.log(out);}
      else if(format==='csv'){const out=leadsToCSV(leads);opts.file?(fs.writeFileSync(opts.file,out),console.log(`✅ Saved ${leads.length} leads to ${opts.file}`)):console.log(out);}
      else if(format==='sheets'){const out=leadsToTSV(leads);opts.file?(fs.writeFileSync(opts.file,out),console.log(`✅ Saved to ${opts.file}`)):console.log(out);}
      else if(format==='list'){console.log(`\n${bold}Found ${leads.length} leads${reset}`);leads.forEach(printLead);}
      else{console.log(`\n${bold}Found ${leads.length} leads${reset} for "${opts.niche}" in ${opts.country}\n${dim}New: ${result.newCount||leads.length} | Dupes: ${result.duplicateCount||0}${reset}`);printTable(leads);if(opts.file){fs.writeFileSync(opts.file,leadsToCSV(leads));console.log(`✅ Also saved to ${opts.file}`);}}
    }catch(e){
      if(e.code==='ECONNREFUSED')console.error(`❌ Cannot connect to API at ${API}. Is the server running? (npm run server)`);
      else console.error('❌ Error:',e.response?.data?.error||e.message);
      process.exit(1);
    }
  });

program.command('saved').description('List saved leads')
  .option('--filter <filter>','has-whatsapp, has-email, high-score')
  .option('--min-score <score>','Minimum score',parseInt)
  .option('--output <format>','table, list, json, csv, sheets','table')
  .option('--file <path>','Save to file')
  .action((opts)=>{
    const db=loadDb();let leads=db.leads||[];
    if(opts.filter==='has-whatsapp')leads=leads.filter(l=>l.whatsapp);
    if(opts.filter==='has-email')leads=leads.filter(l=>l.email);
    if(opts.filter==='high-score')leads=leads.filter(l=>(l.score||0)>=7);
    if(opts.minScore)leads=leads.filter(l=>(l.score||0)>=opts.minScore);
    leads.sort((a,b)=>(b.score||0)-(a.score||0));
    if(!leads.length){console.log('No saved leads. Run `lead-gen search` first.');return;}
    const f=opts.output;
    if(f==='json'){const o=JSON.stringify(leads,null,2);opts.file?(fs.writeFileSync(opts.file,o),console.log(`✅ Saved to ${opts.file}`)):console.log(o);}
    else if(f==='csv'){const o=leadsToCSV(leads);opts.file?(fs.writeFileSync(opts.file,o),console.log(`✅ Saved to ${opts.file}`)):console.log(o);}
    else if(f==='sheets'){const o=leadsToTSV(leads);opts.file?(fs.writeFileSync(opts.file,o),console.log(`✅ Saved to ${opts.file}`)):console.log(o);}
    else{console.log(`\n${bold}${leads.length} saved leads${reset}`);printTable(leads);if(opts.file){fs.writeFileSync(opts.file,leadsToCSV(leads));console.log(`✅ Also saved to ${opts.file}`);}}
  });

program.command('export').description('Export all saved leads')
  .option('--format <format>','csv, json, sheets','csv')
  .option('--file <path>','Output file')
  .action((opts)=>{
    const db=loadDb();const leads=db.leads||[];
    if(!leads.length){console.log('No saved leads to export.');return;}
    const ext=opts.format==='sheets'?'tsv':opts.format;
    const file=opts.file||`leads-export.${ext}`;
    const out=opts.format==='json'?JSON.stringify(leads,null,2):opts.format==='sheets'?leadsToTSV(leads):leadsToCSV(leads);
    fs.writeFileSync(file,out);
    console.log(`✅ Exported ${leads.length} leads to ${file}`);
  });

program.command('clear').description('Clear the leads database').action(()=>{fs.writeFileSync(DB_PATH,JSON.stringify({leads:[],searches:[]},null,2));console.log('✅ Leads database cleared.');});

program.command('status').description('Show database stats').action(()=>{
  const db=loadDb();const leads=db.leads||[];
  const withWA=leads.filter(l=>l.whatsapp).length;
  const withEmail=leads.filter(l=>l.email).length;
  const highScore=leads.filter(l=>(l.score||0)>=8).length;
  console.log(`\n${bold}Lead Generator Status${reset}`);
  console.log(`Total saved leads: ${bold}${leads.length}${reset}`);
  console.log(`With WhatsApp:     ${green}${withWA}${reset}`);
  console.log(`With Email:        ${cyan}${withEmail}${reset}`);
  console.log(`High score (>=8):  ${yellow}${highScore}${reset}`);
  console.log(`Total searches:    ${db.searches?.length||0}`);
  console.log(`API endpoint:      ${API}\n`);
});

program.parse(process.argv);
