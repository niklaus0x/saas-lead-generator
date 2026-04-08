/**
 * Email Sender v5
 * Built-in SMTP email sending for outreach sequences
 * Uses nodemailer — works with Gmail, Outlook, Mailgun SMTP, etc.
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const EMAIL_LOG_PATH = path.join(__dirname, '..', 'email-log.json');

function loadEmailLog() { try { return JSON.parse(fs.readFileSync(EMAIL_LOG_PATH, 'utf8')); } catch { return { sent: [] }; } }
function saveEmailLog(log) { try { fs.writeFileSync(EMAIL_LOG_PATH, JSON.stringify(log, null, 2)); } catch(e) { console.error('Email log save:', e.message); } }

// Create transporter from env config
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env');
  }

  return nodemailer.createTransporter({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

async function sendEmail({ to, subject, text, html, from }) {
  const transporter = createTransporter();
  const fromAddr = from || process.env.SMTP_FROM || process.env.SMTP_USER;

  const info = await transporter.sendMail({
    from: fromAddr,
    to,
    subject,
    text,
    html: html || text.replace(/\n/g, '<br>'),
  });

  // Log it
  const log = loadEmailLog();
  log.sent.push({
    to,
    subject,
    from: fromAddr,
    messageId: info.messageId,
    sentAt: new Date().toISOString(),
    status: 'sent',
  });
  saveEmailLog(log);

  return { messageId: info.messageId, to, subject };
}

async function sendBulkEmails(emails) {
  const results = [];
  for (const email of emails) {
    try {
      const result = await sendEmail(email);
      results.push({ ...result, success: true });
    } catch (err) {
      results.push({ to: email.to, subject: email.subject, success: false, error: err.message });
    }
    // Rate limit: 1 email per second
    await new Promise(r => setTimeout(r, 1000));
  }
  return results;
}

function registerEmailRoutes(app) {
  // Check SMTP config
  app.get('/api/email/status', (req, res) => {
    const configured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    res.json({
      configured,
      host: process.env.SMTP_HOST || null,
      user: process.env.SMTP_USER ? process.env.SMTP_USER.replace(/(.{2}).*@/, '$1***@') : null,
      message: configured ? 'SMTP ready' : 'Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env to enable email sending',
    });
  });

  // Test SMTP connection
  app.post('/api/email/test', async (req, res) => {
    try {
      const transporter = createTransporter();
      await transporter.verify();
      res.json({ success: true, message: 'SMTP connection successful' });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Send single email
  app.post('/api/email/send', async (req, res) => {
    try {
      const { to, subject, text, html, from } = req.body;
      if (!to || !subject || !text) return res.status(400).json({ error: 'to, subject, and text are required' });
      const result = await sendEmail({ to, subject, text, html, from });
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Send sequence step by email
  app.post('/api/email/send-sequence-step', async (req, res) => {
    try {
      const { sequenceId, stepNum, to, subject, text } = req.body;
      if (!to || !subject || !text) return res.status(400).json({ error: 'to, subject, and text required' });
      const result = await sendEmail({ to, subject, text });
      res.json({ success: true, ...result, sequenceId, stepNum });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Bulk send
  app.post('/api/email/send-bulk', async (req, res) => {
    try {
      const { emails } = req.body;
      if (!emails || !Array.isArray(emails)) return res.status(400).json({ error: 'emails array required' });
      if (emails.length > 50) return res.status(400).json({ error: 'Max 50 emails per bulk request' });
      const results = await sendBulkEmails(emails);
      res.json({ results, sent: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Email log
  app.get('/api/email/log', (req, res) => {
    const log = loadEmailLog();
    const sent = (log.sent || []).slice(-100).reverse(); // Last 100, newest first
    res.json({ sent, count: sent.length });
  });
}

module.exports = { sendEmail, sendBulkEmails, registerEmailRoutes };
