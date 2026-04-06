const axios = require('axios');
const cooldowns = new Map();

function isOnCooldown(command, userId, seconds = 5) {
  const key = `${command}:${userId}`;
  const last = cooldowns.get(key);
  const now = Date.now();
  if (last && now - last < seconds * 1000) return true;
  cooldowns.set(key, now);
  return false;
}

async function getUptime(channel) {
  try {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const token = process.env.TWITCH_OAUTH_TOKEN?.replace('oauth:', '');
    if (!clientId || !token) return null;
    const userRes = await axios.get(`https://api.twitch.tv/helix/users?login=${channel.replace('#', '')}`, { headers: { 'Client-ID': clientId, 'Authorization': `Bearer ${token}` }, timeout: 5000 });
    const userId = userRes.data.data?.[0]?.id;
    if (!userId) return null;
    const streamRes = await axios.get(`https://api.twitch.tv/helix/streams?user_id=${userId}`, { headers: { 'Client-ID': clientId, 'Authorization': `Bearer ${token}` }, timeout: 5000 });
    const stream = streamRes.data.data?.[0];
    if (!stream) return 'Stream is currently offline.';
    const diffMs = new Date() - new Date(stream.started_at);
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    return hours > 0 ? `Stream has been live for ${hours}h ${minutes}m! 🟢` : `Stream has been live for ${minutes} minutes! 🟢`;
  } catch { return null; }
}

async function handle(client, channel, tags, commandName, args, config) {
  const username = tags['display-name'] || tags.username;
  const isMod = tags.mod || tags['user-type'] === 'mod';
  const isBroadcaster = tags.badges?.broadcaster === '1';
  if (!isMod && !isBroadcaster && isOnCooldown(commandName, tags['user-id'], 5)) return;
  if (config.commands[commandName]) { client.say(channel, `@${username} → ${config.commands[commandName]}`); return; }
  switch (commandName) {
    case 'uptime': { const u = await getUptime(channel); client.say(channel, u || 'Could not fetch stream uptime.'); break; }
    case 'commands': { const all = [...Object.keys(config.commands).map(c => `!${c}`), '!uptime', '!commands'].join(' | '); client.say(channel, `📋 Commands: ${all}`); break; }
    case 'shoutout': case 'so': { if (!isMod && !isBroadcaster) return; const t = args[0]?.replace('@', ''); if (!t) { client.say(channel, 'Usage: !so @username'); return; } client.say(channel, `📢 Go check out @${t}! Follow at twitch.tv/${t} 💜`); break; }
    case 'raid': { if (!isBroadcaster) return; const t = args[0]?.replace('@', ''); if (!t) { client.say(channel, 'Usage: !raid @channel'); return; } client.say(channel, `🚀 Get ready to raid @${t}! Show them love! twitch.tv/${t}`); break; }
    default: break;
  }
}

module.exports = { handle };
