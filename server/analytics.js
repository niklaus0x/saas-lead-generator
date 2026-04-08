/**
 * Analytics Dashboard Module v4
 * Source performance, score distribution, conversion funnel, timeline
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'leads-db.json');
const CRM_PATH = path.join(__dirname, '..', 'crm.json');
const WA_QUEUE_PATH = path.join(__dirname, '..', 'wa-queue.json');
const OUTREACH_PATH = path.join(__dirname, '..', 'outreach.json');

function loadDb() { try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch { return { leads: [], searches: [] }; } }
function loadCrm() { try { return JSON.parse(fs.readFileSync(CRM_PATH, 'utf8')); } catch { return { leads: [] }; } }
function loadWaQueue() { try { return JSON.parse(fs.readFileSync(WA_QUEUE_PATH, 'utf8')); } catch { return { queue: [] }; } }
function loadOutreach() { try { return JSON.parse(fs.readFileSync(OUTREACH_PATH, 'utf8')); } catch { return { sequences: [] }; } }

const CRM_STAGES = ['new','contacted','interested','demo','converted','dead'];

function registerAnalyticsRoutes(app) {
  // Overview stats
  app.get('/api/analytics/overview', (req, res) => {
    const db = loadDb();
    const crm = loadCrm();
    const wa = loadWaQueue();
    const out = loadOutreach();
    const leads = db.leads || [];
    const crmLeads = crm.leads || [];
    const queue = wa.queue || [];
    const seqs = out.sequences || [];

    const avgScore = leads.length > 0 ? (leads.reduce((s, l) => s + (l.score || 0), 0) / leads.length).toFixed(1) : 0;
    const withWhatsApp = leads.filter(l => l.whatsapp).length;
    const withEmail = leads.filter(l => l.email).length;
    const painSignals = leads.filter(l => l.painSignal).length;
    const converted = crmLeads.filter(l => l.crmStatus === 'converted').length;
    const conversionRate = crmLeads.length > 0 ? ((converted / crmLeads.length) * 100).toFixed(1) + '%' : '0%';

    res.json({
      totalLeads: leads.length,
      totalSearches: (db.searches || []).length,
      avgScore: parseFloat(avgScore),
      withWhatsApp,
      withEmail,
      painSignals,
      highScore: leads.filter(l => (l.score || 0) >= 8).length,
      crmTotal: crmLeads.length,
      converted,
      conversionRate,
      waQueue: { total: queue.length, sent: queue.filter(i => i.status === 'sent').length, replied: queue.filter(i => i.status === 'replied').length },
      outreach: { total: seqs.length, active: seqs.filter(s => s.status === 'active').length, replied: seqs.filter(s => s.status === 'replied').length },
    });
  });

  // Leads by source
  app.get('/api/analytics/by-source', (req, res) => {
    const db = loadDb();
    const leads = db.leads || [];
    const bySource = {};
    for (const l of leads) {
      const src = l.source || 'Unknown';
      if (!bySource[src]) bySource[src] = { count: 0, totalScore: 0, withWhatsApp: 0, withEmail: 0 };
      bySource[src].count++;
      bySource[src].totalScore += l.score || 0;
      if (l.whatsapp) bySource[src].withWhatsApp++;
      if (l.email) bySource[src].withEmail++;
    }
    const result = Object.entries(bySource).map(([source, data]) => ({
      source,
      count: data.count,
      avgScore: data.count > 0 ? (data.totalScore / data.count).toFixed(1) : 0,
      withWhatsApp: data.withWhatsApp,
      withEmail: data.withEmail,
      whatsAppRate: data.count > 0 ? ((data.withWhatsApp / data.count) * 100).toFixed(0) + '%' : '0%',
    })).sort((a, b) => b.count - a.count);
    res.json({ sources: result });
  });

  // Leads by country
  app.get('/api/analytics/by-country', (req, res) => {
    const db = loadDb();
    const leads = db.leads || [];
    const byCountry = {};
    for (const l of leads) {
      const c = l.country || 'Unknown';
      if (!byCountry[c]) byCountry[c] = 0;
      byCountry[c]++;
    }
    const result = Object.entries(byCountry).map(([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count);
    res.json({ countries: result });
  });

  // Score distribution
  app.get('/api/analytics/scores', (req, res) => {
    const db = loadDb();
    const leads = db.leads || [];
    const distribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
    for (const l of leads) distribution[Math.min(l.score || 0, 10)]++;
    const high = leads.filter(l => (l.score || 0) >= 8).length;
    const medium = leads.filter(l => (l.score || 0) >= 5 && (l.score || 0) < 8).length;
    const low = leads.filter(l => (l.score || 0) < 5).length;
    res.json({ distribution, high, medium, low, total: leads.length });
  });

  // CRM funnel
  app.get('/api/analytics/funnel', (req, res) => {
    const crm = loadCrm();
    const leads = crm.leads || [];
    const funnel = CRM_STAGES.map(stage => ({ stage, count: leads.filter(l => l.crmStatus === stage).length }));
    const converted = leads.filter(l => l.crmStatus === 'converted').length;
    res.json({ funnel, total: leads.length, converted, conversionRate: leads.length > 0 ? ((converted / leads.length) * 100).toFixed(1) + '%' : '0%' });
  });

  // Leads found per day (last 30 days)
  app.get('/api/analytics/timeline', (req, res) => {
    const db = loadDb();
    const searches = db.searches || [];
    const byDay = {};
    for (const s of searches) {
      const day = (s.date || '').split('T')[0];
      if (!day) continue;
      if (!byDay[day]) byDay[day] = { searches: 0, leads: 0 };
      byDay[day].searches++;
      byDay[day].leads += s.count || 0;
    }
    const timeline = Object.entries(byDay).map(([date, data]) => ({ date, ...data })).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
    res.json({ timeline });
  });

  // WhatsApp queue analytics
  app.get('/api/analytics/whatsapp', (req, res) => {
    const wa = loadWaQueue();
    const queue = wa.queue || [];
    const total = queue.length;
    const sent = queue.filter(i => i.status === 'sent').length;
    const replied = queue.filter(i => i.status === 'replied').length;
    const pending = queue.filter(i => i.status === 'pending').length;
    const skipped = queue.filter(i => i.status === 'skipped').length;
    const replyRate = sent > 0 ? ((replied / sent) * 100).toFixed(1) + '%' : '0%';
    const avgScore = queue.length > 0 ? (queue.reduce((s, i) => s + (i.score || 0), 0) / queue.length).toFixed(1) : 0;
    res.json({ total, pending, sent, replied, skipped, replyRate, avgScore });
  });

  // Top niches searched
  app.get('/api/analytics/top-niches', (req, res) => {
    const db = loadDb();
    const searches = db.searches || [];
    const byNiche = {};
    for (const s of searches) {
      const q = (s.query || '').toLowerCase();
      if (!byNiche[q]) byNiche[q] = { searches: 0, totalLeads: 0 };
      byNiche[q].searches++;
      byNiche[q].totalLeads += s.count || 0;
    }
    const niches = Object.entries(byNiche).map(([niche, data]) => ({ niche, searches: data.searches, totalLeads: data.totalLeads, avgLeads: data.searches > 0 ? (data.totalLeads / data.searches).toFixed(0) : 0 })).sort((a, b) => b.searches - a.searches).slice(0, 20);
    res.json({ niches });
  });
}

module.exports = { registerAnalyticsRoutes };
