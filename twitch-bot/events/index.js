const defaultMessages = {
  follow: (username) => `💜 Welcome @${username}! Thanks for the follow! You're awesome!`,
  sub: (username) => `🎉 HUGE thank you to @${username} for subscribing! Welcome to the squad! 🙏`,
  resub: (username, months) => `🔁 @${username} has been subscribed for ${months} months! Legends only! 💪`,
  giftSub: (gifter, recipient) => `🎁 @${gifter} just gifted a sub to @${recipient}! So generous! 💜`,
  bits: (username, amount) => `💎 @${username} just cheered ${amount} bits! You're incredible! Thank you! 🙏`,
  raid: (raider, viewers) => `🚀 RAID! Welcome @${raider} and their ${viewers} raiders! Let's gooo! 🔥🔥🔥`,
  host: (hoster, viewers) => `📡 @${hoster} is hosting with ${viewers} viewers! Thank you! 💜`,
};

function onFollow(client, channel, username, customMessages = {}) {
  client.say(channel, customMessages.follow ? customMessages.follow(username) : defaultMessages.follow(username));
  console.log(`💜 Follow: ${username}`);
}
function onSub(client, channel, username, customMessages = {}) {
  client.say(channel, customMessages.sub ? customMessages.sub(username) : defaultMessages.sub(username));
  console.log(`🎉 Sub: ${username}`);
}
function onResub(client, channel, username, months, customMessages = {}) {
  client.say(channel, customMessages.resub ? customMessages.resub(username, months) : defaultMessages.resub(username, months));
  console.log(`🔁 Resub: ${username} (${months} months)`);
}
function onGiftSub(client, channel, gifter, recipient, customMessages = {}) {
  client.say(channel, customMessages.giftSub ? customMessages.giftSub(gifter, recipient) : defaultMessages.giftSub(gifter, recipient));
  console.log(`🎁 Gift sub: ${gifter} → ${recipient}`);
}
function onBits(client, channel, username, amount, customMessages = {}) {
  client.say(channel, customMessages.bits ? customMessages.bits(username, amount) : defaultMessages.bits(username, amount));
  console.log(`💎 Bits: ${username} (${amount})`);
}
function onRaid(client, channel, raider, viewers, customMessages = {}) {
  client.say(channel, customMessages.raid ? customMessages.raid(raider, viewers) : defaultMessages.raid(raider, viewers));
  console.log(`🚀 Raid: ${raider} (${viewers} viewers)`);
}
function onHost(client, channel, hoster, viewers, customMessages = {}) {
  client.say(channel, customMessages.host ? customMessages.host(hoster, viewers) : defaultMessages.host(hoster, viewers));
  console.log(`📡 Host: ${hoster} (${viewers} viewers)`);
}

module.exports = { onFollow, onSub, onResub, onGiftSub, onBits, onRaid, onHost, defaultMessages };
