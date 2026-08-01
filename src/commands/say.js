'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const voice = require('../lib/voice');
const { isJudicial, denyNonJudicial } = require('../lib/util');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Have Jeff Ray speak in your voice channel (Judicial Party only).')
    .addStringOption((o) =>
      o
        .setName('text')
        .setDescription('What should Jeff Ray say?')
        .setRequired(true)
        .setMaxLength(500)
    ),

  async execute(interaction) {
    if (!isJudicial(interaction.member)) return denyNonJudicial(interaction);

    const vc = interaction.member.voice?.channel;
    if (!vc) {
      await interaction.reply({
        content: 'You must be in a voice channel for Jeff Ray to speak.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const text = interaction.options.getString('text');

    await interaction.reply({
      content: `🎙️ Jeff Ray clears his throat in ${vc}...`,
      flags: MessageFlags.Ephemeral,
    });

    try {
      await voice.speak(vc, text);
    } catch (err) {
      console.error('TTS error:', err.message);
      await interaction.followUp({
        content: 'Jeff Ray lost his voice (audio error). Try again.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
