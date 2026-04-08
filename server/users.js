/**
 * Multi-User Module v4
 * User accounts, API keys, team management
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const USERS_PATH = path.join(__dirname, '..', 'users.json');

function loadUsers() { try { return JSON.parse(fs.readFileSync(USERS_PATH, 'utf8')); } catch { return { users: [], sessions: [] }; } }
function saveUsers(u) { try { fs.writeFileSync(USERS_PATH, JSON.stringify(u, null, 2)); } catch(e) { console.error('Users save:', e.message); } }

function hashPassword(password) { return crypto.createHash('sha256').update(password + 'leadgen-salt-v4').digest('hex'); }
function generateToken() { return crypto.randomBytes(32).toString('hex'); }
function generateApiKey() { return 'lg_' + crypto.randomBytes(24).toString('hex'); }

// Auth middleware
function authMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!apiKey && !token) return res.status(401).json({ error: 'Authentication required. Provide X-Api-Key or Authorization header.' });
  const u = loadUsers();
  let user = null;
  if (apiKey) user = (u.users || []).find(u => u.apiKey === apiKey);
  if (!user && token) {
    const session = (u.sessions || []).find(s => s.token === token && new Date(s.expiresAt) > new Date());
    if (session) user = (u.users || []).find(u => u.id === session.userId);
  }
  if (!user) return res.status(401).json({ error: 'Invalid or expired credentials' });
  req.user = user;
  next();
}

function registerUserRoutes(app) {
  // Register
  app.post('/api/users/register', (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, and password required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const u = loadUsers();
    if ((u.users || []).find(u => u.email.toLowerCase() === email.toLowerCase())) return res.status(409).json({ error: 'Email already registered' });
    const user = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name, email: email.toLowerCase(),
      passwordHash: hashPassword(password),
      apiKey: generateApiKey(),
      role: (u.users || []).length === 0 ? 'admin' : 'member',
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    };
    u.users = [...(u.users || []), user];
    saveUsers(u);
    const { passwordHash, ...safeUser } = user;
    res.json({ user: safeUser, message: 'Account created successfully' });
  });

  // Login
  app.post('/api/users/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const u = loadUsers();
    const user = (u.users || []).find(u => u.email === email.toLowerCase());
    if (!user || user.passwordHash !== hashPassword(password)) return res.status(401).json({ error: 'Invalid email or password' });
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
    u.sessions = [...(u.sessions || []), { token, userId: user.id, createdAt: new Date().toISOString(), expiresAt }];
    user.lastLoginAt = new Date().toISOString();
    saveUsers(u);
    const { passwordHash, ...safeUser } = user;
    res.json({ user: safeUser, token, expiresAt });
  });

  // Get current user
  app.get('/api/users/me', authMiddleware, (req, res) => {
    const { passwordHash, ...safeUser } = req.user;
    res.json({ user: safeUser });
  });

  // Rotate API key
  app.post('/api/users/rotate-key', authMiddleware, (req, res) => {
    const u = loadUsers();
    const idx = (u.users || []).findIndex(u => u.id === req.user.id);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });
    u.users[idx].apiKey = generateApiKey();
    saveUsers(u);
    res.json({ apiKey: u.users[idx].apiKey });
  });

  // List team
  app.get('/api/users/team', authMiddleware, (req, res) => {
    const u = loadUsers();
    const team = (u.users || []).map(({ passwordHash, ...safe }) => safe);
    res.json({ team, count: team.length });
  });

  // Invite teammate (creates account with temp password)
  app.post('/api/users/invite', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can invite teammates' });
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'name and email required' });
    const u = loadUsers();
    if ((u.users || []).find(u => u.email === email.toLowerCase())) return res.status(409).json({ error: 'Email already registered' });
    const tempPassword = Math.random().toString(36).slice(2, 10);
    const user = { id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, email: email.toLowerCase(), passwordHash: hashPassword(tempPassword), apiKey: generateApiKey(), role: 'member', createdAt: new Date().toISOString(), lastLoginAt: null, invitedBy: req.user.id };
    u.users = [...(u.users || []), user];
    saveUsers(u);
    const { passwordHash, ...safeUser } = user;
    res.json({ user: safeUser, tempPassword, message: `Share this temporary password with ${name}: ${tempPassword}` });
  });

  // Logout
  app.post('/api/users/logout', authMiddleware, (req, res) => {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (token) {
      const u = loadUsers();
      u.sessions = (u.sessions || []).filter(s => s.token !== token);
      saveUsers(u);
    }
    res.json({ success: true });
  });
}

module.exports = { registerUserRoutes, authMiddleware };
