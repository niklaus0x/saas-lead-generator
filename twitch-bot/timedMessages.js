let recentMessageCount = 0;

function trackActivity(client, channel) {
  client.on('message', () => { recentMessageCount++; });
  setInterval(() => { recentMessageCount = 0; }, 60 * 1000);
}

function startTimedMessages(client, config) {
  const timedConfig = config.timedMessages || {};
  const messages = timedConfig.messages || [];
  const intervalMs = (timedConfig.intervalMinutes || 20) * 60 * 1000;
  const minActivity = timedConfig.minChatActivity || 3;
  const channel = `#${config.channel}`;
  if (!messages.length) return;
  trackActivity(client, channel);
  let messageIndex = 0;
  setInterval(() => {
    if (recentMessageCount < minActivity) { console.log('⏸ Skipping timed message — chat is quiet'); return; }
    const msg = messages[messageIndex % messages.length];
    client.say(channel, msg).catch(err => console.error('Timed message error:', err));
    console.log(`📢 Timed message: ${msg.substring(0, 50)}...`);
    messageIndex++;
  }, intervalMs);
  console.log(`⏰ Timed messages active — every ${timedConfig.intervalMinutes || 20} mins`);
}

module.exports = { startTimedMessages };
