'use strict';

const { EmbedBuilder, MessageFlags } = require('discord.js');
const config = require('../config');

/** Is this member part of the Judicial Party (𝙅𝙍𝙋𝙨 role)? */
function isJudicial(member) {
  if (!member) return false;
  return config.JUDICIAL_ROLE_IDS.some((id) => member.roles.cache.has(id));
}

/** Reply ephemerally that the user lacks judicial authority. */
async function denyNonJudicial(interaction) {
  await interaction.reply({
    content:
      'Only the Judicial Party (𝙅𝙍𝙋𝙨) may perform this action. ' +
      '"For the JRP, by the JRP."',
    flags: MessageFlags.Ephemeral,
  });
}

/** Standard embed factory with JRP footer. */
function jrpEmbed(color) {
  return new EmbedBuilder()
    .setColor(color)
    .setFooter({ text: 'For the JRP, by the JRP.' })
    .setTimestamp();
}

/** Discord relative timestamp from ISO string or Date. */
function discordTime(ts) {
  const unix = Math.floor(new Date(ts).getTime() / 1000);
  return `<t:${unix}:f> (<t:${unix}:R>)`;
}

/** Truncate a string to a max length with ellipsis (embed field safety). */
function clamp(str, max = 1024) {
  if (!str) return str;
  return str.length <= max ? str : `${str.slice(0, max - 1)}…`;
}

/** Send an embed to the court transcripts channel, if configured. */
async function sendTranscript(client, embed) {
  if (!config.COURT_CHANNEL_ID) return;
  try {
    const channel = await client.channels.fetch(config.COURT_CHANNEL_ID);
    if (channel && channel.isTextBased()) {
      await channel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error('Error sending court transcript:', err);
  }
}

module.exports = { isJudicial, denyNonJudicial, jrpEmbed, discordTime, clamp, sendTranscript };
