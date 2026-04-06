const spamTracker = new Map();

function check(message, username, tags, config) {
  const mod = config.moderation || {};
  const msg = message.trim();
  const msgLower = msg.toLowerCase();
  for (const word of (mod.bannedWords || [])) { if (msgLower.includes(word.toLowerCase())) return { action: 'timeout', duration: 300, reason: 'Banned word', warn: 'Please keep chat clean! Timeout: 5 minutes.' }; }
  if (!mod.allowLinks && /(https?:\/\/|www\.)[^\s]+/i.test(msg)) return { action: 'delete', warn: `Links not allowed @${username}. Ask a mod for permission.` };
  if (msg.length >= (mod.capsMinLength || 10)) { const letters = msg.replace(/[^a-zA-Z]/g, ''); const caps = msg.replace(/[^A-Z]/g, ''); if (letters.length > 0 && caps.length / letters.length >= (mod.capsThreshold || 0.8)) return { action: 'delete', warn: `@${username} Please avoid excessive CAPS!` }; }
  if (tags.emotes && Object.keys(tags.emotes).length >= (mod.emoteSpamLimit || 10)) return { action: 'delete', warn: `@${username} Too many emotes!` };
  const spamConfig = mod.spamDetection || {};
  if (spamConfig.enabled !== false) {
    const maxSame = spamConfig.maxSameMessages || 3; const windowMs = (spamConfig.windowSeconds || 30) * 1000;
    const userId = tags['user-id'] || username; const now = Date.now(); const tracker = spamTracker.get(userId); const normalizedMsg = msg.toLowerCase().trim();
    if (tracker && tracker.message === normalizedMsg && now - tracker.firstSeen < windowMs) { tracker.count++; if (tracker.count >= maxSame) { spamTracker.delete(userId); return { action: 'timeout', duration: 120, reason: 'Spam', warn: `@${username} Please don't spam! Timeout: 2 minutes.` }; } }
    else { spamTracker.set(userId, { message: normalizedMsg, count: 1, firstSeen: now }); }
    if (spamTracker.size > 100) { for (const [k, v] of spamTracker.entries()) { if (now - v.firstSeen > windowMs) spamTracker.delete(k); } }
  }
  return { action: 'allow' };
}

module.exports = { check };
