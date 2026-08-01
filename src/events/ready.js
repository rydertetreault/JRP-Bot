'use strict';

const voicetrack = require('../lib/voicetrack');
const vcstats = require('../lib/vcstats');
const config = require('../config');

const TICK_MS = 60 * 1000;

function sample(client) {
  const rosters = [];
  for (const [, guild] of client.guilds.cache) {
    const byChannel = new Map();
    for (const [, vs] of guild.voiceStates.cache) {
      if (!vs.channelId || !vs.member || vs.member.user.bot) continue;
      if (config.VC_STATS_EXCLUDED_CHANNELS.includes(vs.channelId)) continue;
      if (!byChannel.has(vs.channelId)) byChannel.set(vs.channelId, []);
      byChannel.get(vs.channelId).push(vs.id);
    }
    for (const [channelId, userIds] of byChannel) {
      rosters.push({ channelId, userIds });
    }
  }
  vcstats.tick(rosters, TICK_MS);
  vcstats.flush();
}

module.exports = {
  name: 'clientReady',
  once: true,
  execute(client) {
    console.log(`Logged in as ${client.user.tag}`);

    // Seed VC presence tracking in case the bot restarted mid-session.
    for (const [, guild] of client.guilds.cache) {
      voicetrack.seedFromGuild(guild);
    }

    // VC stats sampling ticker — credits a minute of presence per tick.
    setInterval(() => {
      try {
        sample(client);
      } catch (err) {
        console.error('VC stats tick error:', err);
      }
    }, TICK_MS);
  },
};
