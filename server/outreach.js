/**
 * Outreach Automation Module v4
 * Email sequences, follow-up reminders, reply tracking
 */

const fs = require('fs');
const path = require('path');

const OUTREACH_PATH = path.join(__dirname, '..', 'outreach.json');

function loadOutreach() { try { return JSON.parse(fs.readFileSync(OUTREACH_PATH, 'utf8')); } catch { return { sequences: [] }; } }
function saveOutreach(o) { try { fs.writeFileSync(OUTREACH_PATH, JSON.stringify(o, null, 2)); } catch(e) { console.error('Outreach save:', e.message); } }

function today() { return new Date().toISOString().split('T')[0]; }
function addDays(dateStr, n) { const d = new Date(dateStr); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]; }

// Industry-specific sequence templates
const SEQUENCE_TEMPLATES = {
  default: [
    { day: 1, type: 'whatsapp', subject: null, body: `Hi {firstName},\n\nI came across {company} and wanted to reach out about CrewPay — a Nigerian platform that lets you fund tasks upfront and release payment only after work is verified.\n\nPerfect for businesses managing contractors or gig workers. Would you be open to a quick 10-minute chat?\n\nBest,\n{senderName}` },
    { day: 3, type: 'whatsapp', subject: null, body: `Hi {firstName},\n\nJust following up on my message about CrewPay. I know managing contractor payments can be stressful — especially when you're juggling multiple vendors.\n\nHappy to share a quick demo or video. What works for you?\n\n— {senderName}` },
    { day: 7, type: 'email', subject: 'Quick follow-up: CrewPay for {company}', body: `Hi {firstName},\n\nCircling back on CrewPay. Businesses like {company} use it to:\n\n✅ Fund tasks upfront (so contractors show up)\n✅ Release payment only after work is verified\n✅ Manage 5 or 500 contractors without payment disputes\n\nBuilt in Nigeria, for Nigerian businesses.\n\nCan I show you how it works in 10 minutes?\n\nBest,\n{senderName}` },
    { day: 14, type: 'whatsapp', subject: null, body: `Hi {firstName},\n\nLast message from me — I've reached out a few times about CrewPay but haven't heard back. No worries at all.\n\nIf managing contractor payments ever becomes a bigger pain point for {company}, feel free to ping me anytime.\n\nAll the best!\n\n— {senderName}` },
  ],
  'event planning': [
    { day: 1, type: 'whatsapp', subject: null, body: `Hi {firstName},\n\nEvent planners like {company} coordinate caterers, decorators, DJs, ushers — sometimes 10+ vendors per event.\n\nCrewPay makes vendor payments safer: fund each task upfront, vendor sees payment is secured, you release only after the event.\n\nNo more advance payment risk. Want a quick 10-min demo?\n\n— {senderName}` },
    { day: 3, type: 'whatsapp', subject: null, body: `Hi {firstName},\n\nJust following up — did you get a chance to look at CrewPay?\n\nIt's the easiest way to manage 10+ vendor payments for a single event without losing sleep over who delivered and who didn't.\n\nHappy to send a video explainer!\n\n— {senderName}` },
    { day: 7, type: 'email', subject: 'Stop paying vendors before your events are done', body: `Hi {firstName},\n\nManaging an event means trusting vendors with your clients' money. When a caterer takes advance payment and underdelivers, that's your reputation on the line.\n\nCrewPay solves this:\n✅ Fund vendor tasks before the event\n✅ Vendors know payment is secured — they show up\n✅ You release payment after the event when everything's confirmed\n\nWould you be open to a 10-minute demo?\n\n— {senderName}` },
    { day: 14, type: 'whatsapp', subject: null, body: `Hi {firstName}, last message from me on CrewPay. If managing vendor payments for events ever becomes a bigger headache, feel free to reach out. Wishing {company} all the best! — {senderName}` },
  ],
  'cleaning': [
    { day: 1, type: 'whatsapp', subject: null, body: `Hi {firstName},\n\nManaging cleaning staff across multiple sites is tough — especially verifying shifts and releasing payments.\n\nCrewPay helps facilities companies fund shifts upfront, track completion, and pay staff only after the job is verified.\n\nBuilt for Nigerian businesses with large contractor teams. Quick 10-min chat?\n\n— {senderName}` },
    { day: 3, type: 'whatsapp', subject: null, body: `Hi {firstName},\n\nFollowing up on CrewPay for {company}. How do you currently handle payments for your cleaning/facilities staff?\n\nIf it involves any advance payment risk or manual verification, CrewPay can cut that headache significantly.\n\n— {senderName}` },
    { day: 7, type: 'email', subject: 'Better payment tracking for your cleaning staff', body: `Hi {firstName},\n\n{company} manages cleaning and facilities for multiple clients — which means coordinating dozens of staff across locations.\n\nCrewPay helps:\n✅ Fund shifts upfront\n✅ Staff know payment is secured\n✅ Release payment after shift completion is verified\n\nCan I walk you through a 10-minute demo?\n\n— {senderName}` },
    { day: 14, type: 'whatsapp', subject: null, body: `Hi {firstName}, wrapping up my outreach about CrewPay. If managing contractor payments ever becomes a priority, I'm here. All the best to {company}! — {senderName}` },
  ],
};

function getTemplate(niche) {
  const lower = (niche || '').toLowerCase();
  for (const key of Object.keys(SEQUENCE_TEMPLATES)) {
    if (key !== 'default' && lower.includes(key)) return SEQUENCE_TEMPLATES[key];
  }
  return SEQUENCE_TEMPLATES.default;
}

function personalizeMessage(template, vars) {
  let msg = template.body;
  for (const [k, v] of Object.entries(vars)) {
    msg = msg.replace(new RegExp(`{${k}}`, 'g'), v || '');
  }
  return msg;
}

function buildSequence(lead, senderName = '[Your Name]', niche = '') {
  const firstName = (lead.ownerName || 'there').split(' ')[0];
  const templates = getTemplate(niche);
  const startDate = today();
  const vars = { firstName, company: lead.companyName || 'your business', senderName };

  return {
    id: `seq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    leadId: lead.id,
    companyName: lead.companyName,
    ownerName: lead.ownerName || '',
    whatsapp: lead.whatsapp || '',
    email: lead.email || '',
    score: lead.score || 0,
    niche,
    senderName,
    status: 'active', // active | paused | completed | stopped | replied
    startDate,
    lastContactDate: null,
    nextContactDate: startDate,
    currentStep: 0,
    steps: templates.map((t, i) => ({
      step: i + 1,
      day: t.day,
      type: t.type,
      subject: t.subject ? personalizeMessage({ body: t.subject }, vars) : null,
      message: personalizeMessage(t, vars),
      scheduledDate: addDays(startDate, t.day - 1),
      status: i === 0 ? 'due' : 'pending', // due | sent | skipped
      sentAt: null,
    })),
    enrolledAt: new Date().toISOString(),
    repliedAt: null,
    notes: [],
  };
}

// ─── Outreach routes builder ───────────────────────────────────────────────────
function registerOutreachRoutes(app) {
  // List all sequences
  app.get('/api/outreach/sequences', (req, res) => {
    const o = loadOutreach();
    let sequences = o.sequences || [];
    if (req.query.status) sequences = sequences.filter(s => s.status === req.query.status);
    res.json({ sequences, count: sequences.length });
  });

  // Enroll a lead in a sequence
  app.post('/api/outreach/enroll', (req, res) => {
    const { lead, senderName, niche } = req.body;
    if (!lead) return res.status(400).json({ error: 'lead required' });
    const o = loadOutreach();
    const existing = (o.sequences || []).find(s => s.leadId === lead.id && s.status === 'active');
    if (existing) return res.json({ sequence: existing, message: 'Already enrolled' });
    const seq = buildSequence(lead, senderName, niche);
    o.sequences = [...(o.sequences || []), seq];
    saveOutreach(o);
    res.json({ sequence: seq });
  });

  // Enroll multiple leads
  app.post('/api/outreach/enroll-bulk', (req, res) => {
    const { leads, senderName, niche } = req.body;
    if (!leads || !Array.isArray(leads)) return res.status(400).json({ error: 'leads array required' });
    const o = loadOutreach();
    const existingIds = new Set((o.sequences || []).filter(s => s.status === 'active').map(s => s.leadId));
    let enrolled = 0;
    for (const lead of leads) {
      if (existingIds.has(lead.id)) continue;
      const seq = buildSequence(lead, senderName, niche);
      o.sequences = [...(o.sequences || []), seq];
      enrolled++;
    }
    saveOutreach(o);
    res.json({ enrolled, total: (o.sequences || []).length });
  });

  // Get sequences due today
  app.get('/api/outreach/due', (req, res) => {
    const o = loadOutreach();
    const t = today();
    const due = (o.sequences || []).filter(s => s.status === 'active').map(s => {
      const dueSteps = s.steps.filter(step => step.status === 'due' || (step.status === 'pending' && step.scheduledDate <= t));
      return { ...s, dueSteps };
    }).filter(s => s.dueSteps.length > 0);
    res.json({ due, count: due.length, date: t });
  });

  // Mark a step as sent
  app.patch('/api/outreach/:seqId/step/:stepNum/sent', (req, res) => {
    const o = loadOutreach();
    const seq = (o.sequences || []).find(s => s.id === req.params.seqId);
    if (!seq) return res.status(404).json({ error: 'Sequence not found' });
    const step = seq.steps.find(s => s.step === parseInt(req.params.stepNum));
    if (!step) return res.status(404).json({ error: 'Step not found' });
    step.status = 'sent';
    step.sentAt = new Date().toISOString();
    seq.lastContactDate = today();
    // Activate next step
    const nextStep = seq.steps.find(s => s.status === 'pending');
    if (nextStep) nextStep.status = 'due';
    else seq.status = 'completed';
    seq.currentStep = parseInt(req.params.stepNum);
    saveOutreach(o);
    res.json({ sequence: seq });
  });

  // Mark as replied (stop sequence)
  app.patch('/api/outreach/:seqId/reply', (req, res) => {
    const { note } = req.body;
    const o = loadOutreach();
    const seq = (o.sequences || []).find(s => s.id === req.params.seqId);
    if (!seq) return res.status(404).json({ error: 'Sequence not found' });
    seq.status = 'replied';
    seq.repliedAt = new Date().toISOString();
    if (note) seq.notes.push({ text: note, date: new Date().toISOString() });
    saveOutreach(o);
    res.json({ sequence: seq });
  });

  // Pause/resume
  app.patch('/api/outreach/:seqId/status', (req, res) => {
    const { status } = req.body;
    if (!['active', 'paused', 'stopped'].includes(status)) return res.status(400).json({ error: 'status must be active, paused, or stopped' });
    const o = loadOutreach();
    const seq = (o.sequences || []).find(s => s.id === req.params.seqId);
    if (!seq) return res.status(404).json({ error: 'Sequence not found' });
    seq.status = status;
    saveOutreach(o);
    res.json({ sequence: seq });
  });

  // Sequence stats
  app.get('/api/outreach/stats', (req, res) => {
    const o = loadOutreach();
    const seqs = o.sequences || [];
    const total = seqs.length;
    const active = seqs.filter(s => s.status === 'active').length;
    const replied = seqs.filter(s => s.status === 'replied').length;
    const completed = seqs.filter(s => s.status === 'completed').length;
    const replyRate = total > 0 ? ((replied / total) * 100).toFixed(1) + '%' : '0%';
    res.json({ total, active, replied, completed, stopped: seqs.filter(s => s.status === 'stopped').length, replyRate });
  });
}

module.exports = { registerOutreachRoutes, buildSequence, getTemplate };
