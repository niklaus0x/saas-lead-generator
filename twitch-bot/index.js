require('dotenv').config();
const tmi = require('tmi.js');
const config = require('./config.json');
const commands = require('./commands');
const moderation = require('./moderation');
const events = require('./events');
const { startTimedMessages } = require('./timedMessages');

const client = new tmi.Client({
  options: { debug: false },
  identity: {
    username: process.env.TWITCH_BOT_USERNAME,
    password: process.env.TWITCH_OAUTH_TOKEN,
  },
  channels: [process.env.TWITCH_CHANNEL || config.channel],
  connection: { reconnect: true, secure: true },
});

const seenChatters = new Set();

client.connect().then(() => {
  console.log(`\n🟣 Twitch Bot connected to #${config.channel}`);
  console.log(`   Commands: ${Object.keys(config.commands).map(c => `!${c}`).join(', ')}`);
  startTimedMessages(client, config);
}).catch(err => { console.error('❌ Failed to connect:', err); process.exit(1); });

client.on('message', async (channel, tags, message, self) => {
  if (self) return;
  const username = tags['display-name'] || tags.username;
  const isMod = tags.mod || tags['user-type'] === 'mod';
  const isBroadcaster = tags.badges?.broadcaster === '1';
  const isTrusted = isMod || isBroadcaster || (config.moderation.trustedUsers || []).includes(username.toLowerCase());
  const msg = message.trim();

  if (!seenChatters.has(username.toLowerCase())) {
    seenChatters.add(username.toLowerCase());
    if (!isBroadcaster) setTimeout(() => client.say(channel, `👋 Welcome to the stream @${username}! Glad you're here!`), 1000);
  }

  if (!isTrusted) {
    const modResult = moderation.check(msg, username, tags, config);
    if (modResult.action === 'delete') { await client.deletemessage(channel, tags.id).catch(() => {}); if (modResult.warn) client.say(channel, `@${username} ${modResult.warn}`); return; }
    if (modResult.action === 'timeout') { await client.timeout(channel, username, modResult.duration || 60, modResult.reason || 'Auto-mod').catch(() => {}); if (modResult.warn) client.say(channel, `@${username} ${modResult.warn}`); return; }
  }

  if (msg.startsWith(config.prefix || '!')) {
    const args = msg.slice((config.prefix || '!').length).split(' ');
    const commandName = args.shift().toLowerCase();
    await commands.handle(client, channel, tags, commandName, args, config);
  }
});

client.on('follow', (channel, username) => events.onFollow(client, channel, username));
client.on('subscription', (channel, username) => events.onSub(client, channel, username));
client.on('resub', (channel, username, months) => events.onResub(client, channel, username, months));
client.on('subgift', (channel, username, recipient) => events.onGiftSub(client, channel, username, recipient));
client.on('cheer', (channel, tags) => events.onBits(client, channel, tags['display-name'], tags.bits));
client.on('raided', (channel, username, viewers) => events.onRaid(client, channel, username, viewers));
client.on('hosted', (channel, username, viewers, autohost) => { if (!autohost) events.onHost(client, channel, username, viewers); });
client.on('redeem', (channel, username, rewardType) => { client.say(channel, `✨ @${username} just redeemed ${rewardType}! Thanks for the support!`); });
client.on('disconnected', (reason) => console.log(`⚠️ Disconnected: ${reason}. Reconnecting...`));
client.on('connected', (addr, port) => console.log(`✅ Reconnected to ${addr}:${port}`));

console.log('🤖 niklaus0x Twitch Bot starting...');
