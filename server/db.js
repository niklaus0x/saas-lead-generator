/**
 * SQLite Database Module v5
 * Replaces JSON file storage for production-grade persistence
 * Falls back to JSON if SQLite not available
 */

const fs = require('fs');
const path = require('path');

// Try to use better-sqlite3, fall back to JSON files
let db = null;
let usingSQLite = false;

try {
  const Database = require('better-sqlite3');
  const DB_FILE = path.join(__dirname, '..', 'leadgen.db');
  db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  usingSQLite = true;

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      company_name TEXT,
      owner_name TEXT,
      email TEXT,
      phone TEXT,
      whatsapp TEXT,
      instagram TEXT,
      linkedin_url TEXT,
      website TEXT,
      country TEXT,
      source TEXT,
      score INTEGER DEFAULT 0,
      pain_signal INTEGER DEFAULT 0,
      crm_status TEXT DEFAULT 'new',
      date_found TEXT,
      data JSON,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_leads_country ON leads(country);
    CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score);
    CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
    CREATE INDEX IF NOT EXISTS idx_leads_crm ON leads(crm_status);

    CREATE TABLE IF NOT EXISTS searches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT,
      country TEXT,
      count INTEGER,
      searched_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS crm_leads (
      crm_id TEXT PRIMARY KEY,
      lead_id TEXT,
      company_name TEXT,
      crm_status TEXT DEFAULT 'new',
      notes JSON DEFAULT '[]',
      activities JSON DEFAULT '[]',
      added_at TEXT DEFAULT (datetime('now')),
      last_activity_at TEXT DEFAULT (datetime('now')),
      data JSON
    );

    CREATE TABLE IF NOT EXISTS wa_queue (
      id TEXT PRIMARY KEY,
      lead_id TEXT,
      company_name TEXT,
      owner_name TEXT,
      whatsapp TEXT,
      score INTEGER,
      message TEXT,
      status TEXT DEFAULT 'pending',
      added_at TEXT DEFAULT (datetime('now')),
      sent_at TEXT,
      replied_at TEXT,
      notes TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS outreach_sequences (
      id TEXT PRIMARY KEY,
      lead_id TEXT,
      company_name TEXT,
      status TEXT DEFAULT 'active',
      data JSON,
      enrolled_at TEXT DEFAULT (datetime('now')),
      replied_at TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      password_hash TEXT,
      api_key TEXT UNIQUE,
      role TEXT DEFAULT 'member',
      created_at TEXT DEFAULT (datetime('now')),
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT,
      expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  console.log('✅ SQLite database initialized:', DB_FILE);
} catch (err) {
  console.log('⚠️  SQLite not available, using JSON files:', err.message);
  console.log('   Install better-sqlite3: npm install better-sqlite3');
  usingSQLite = false;
}

// ─── Lead operations ──────────────────────────────────────────────────────────
const jsonDbPath = path.join(__dirname, '..', 'leads-db.json');
function jsonLoad() { try { return JSON.parse(fs.readFileSync(jsonDbPath, 'utf8')); } catch { return { leads: [], searches: [] }; } }
function jsonSave(d) { try { fs.writeFileSync(jsonDbPath, JSON.stringify(d, null, 2)); } catch(e) { console.error(e); } }

function saveLead(lead) {
  if (usingSQLite) {
    const stmt = db.prepare(`INSERT OR REPLACE INTO leads (id, company_name, owner_name, email, phone, whatsapp, instagram, linkedin_url, website, country, source, score, pain_signal, crm_status, date_found, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    stmt.run(lead.id, lead.companyName, lead.ownerName || '', lead.email || '', lead.phone || '', lead.whatsapp || '', lead.instagram || '', lead.linkedinUrl || '', lead.website || '', lead.country || '', lead.source || '', lead.score || 0, lead.painSignal ? 1 : 0, lead.crmStatus || 'new', lead.dateFound || '', JSON.stringify(lead));
  } else {
    const d = jsonLoad();
    const idx = d.leads.findIndex(l => l.id === lead.id);
    if (idx >= 0) d.leads[idx] = lead; else d.leads.push(lead);
    jsonSave(d);
  }
}

function saveLeads(leads) {
  if (usingSQLite) {
    const insert = db.prepare(`INSERT OR REPLACE INTO leads (id, company_name, owner_name, email, phone, whatsapp, instagram, linkedin_url, website, country, source, score, pain_signal, crm_status, date_found, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const insertMany = db.transaction(items => { for (const l of items) insert.run(l.id, l.companyName, l.ownerName||'', l.email||'', l.phone||'', l.whatsapp||'', l.instagram||'', l.linkedinUrl||'', l.website||'', l.country||'', l.source||'', l.score||0, l.painSignal?1:0, l.crmStatus||'new', l.dateFound||'', JSON.stringify(l)); });
    insertMany(leads);
  } else {
    const d = jsonLoad();
    const existingIds = new Set(d.leads.map(l => l.id));
    const newLeads = leads.filter(l => !existingIds.has(l.id));
    d.leads.push(...newLeads);
    jsonSave(d);
  }
}

function getLeads(filters = {}) {
  if (usingSQLite) {
    let query = 'SELECT data FROM leads WHERE 1=1';
    const params = [];
    if (filters.country) { query += ' AND country = ?'; params.push(filters.country); }
    if (filters.minScore) { query += ' AND score >= ?'; params.push(filters.minScore); }
    if (filters.hasWhatsapp) { query += " AND whatsapp != ''"; }
    if (filters.hasEmail) { query += " AND email != ''"; }
    query += ' ORDER BY score DESC';
    if (filters.limit) { query += ` LIMIT ${parseInt(filters.limit)}`; }
    return db.prepare(query).all(...params).map(r => JSON.parse(r.data));
  } else {
    let leads = jsonLoad().leads;
    if (filters.country) leads = leads.filter(l => l.country === filters.country);
    if (filters.minScore) leads = leads.filter(l => (l.score || 0) >= filters.minScore);
    if (filters.hasWhatsapp) leads = leads.filter(l => l.whatsapp);
    if (filters.hasEmail) leads = leads.filter(l => l.email);
    return leads.sort((a, b) => (b.score || 0) - (a.score || 0));
  }
}

function getLeadNames() {
  if (usingSQLite) return new Set(db.prepare('SELECT company_name FROM leads').all().map(r => r.company_name.toLowerCase().trim()));
  return new Set(jsonLoad().leads.map(l => (l.companyName || '').toLowerCase().trim()));
}

function saveSearch(query, country, count) {
  if (usingSQLite) db.prepare('INSERT INTO searches (query, country, count) VALUES (?, ?, ?)').run(query, country, count);
  else { const d = jsonLoad(); d.searches = [...(d.searches || []), { query, country, count, date: new Date().toISOString() }]; jsonSave(d); }
}

function getSearches() {
  if (usingSQLite) return db.prepare('SELECT * FROM searches ORDER BY searched_at DESC').all().map(r => ({ query: r.query, country: r.country, count: r.count, date: r.searched_at }));
  return jsonLoad().searches || [];
}

function clearLeads() {
  if (usingSQLite) { db.prepare('DELETE FROM leads').run(); db.prepare('DELETE FROM searches').run(); }
  else jsonSave({ leads: [], searches: [] });
}

module.exports = { saveLead, saveLeads, getLeads, getLeadNames, saveSearch, getSearches, clearLeads, usingSQLite };
