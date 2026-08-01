'use strict';

const { SlashCommandBuilder } = require('discord.js');
const vcstats = require('../lib/vcstats');
const { jrpEmbed, discordTime } = require('../lib/util');
const { COLORS } = require('../config');

const MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vcleaderboard')
    .setDescription('Voice channel leaderboards.')
    .addStringOption((o) =>
      o
        .setName('board')
        .setDescription('Which leaderboard?')
        .addChoices(
          { name: 'Total time — who lives in VC', value: 'total' },
          { name: 'Duos — most time together', value: 'duos' }
        )
    )
    .addIntegerOption((o) =>
      o.setName('limit').setDescription('How many to show (1–20)').setMinValue(1).setMaxValue(20)
    ),

  async execute(interaction) {
    const board = interaction.options.getString('board') || 'total';
    const limit = interaction.options.getInteger('limit') || 10;

    if (board === 'duos') {
      const duos = vcstats.topDuos(limit);
      const embed = jrpEmbed(COLORS.GOLD).setTitle('👥 JRP Duos — Most Time Together');

      if (!duos.length) {
        embed.setDescription('No duo time recorded yet. Get in VC together.');
      } else {
        embed.setDescription(
          duos
            .map((d, i) => {
              const rank = MEDALS[i] || `**#${i + 1}**`;
              return `${rank} <@${d.a}> + <@${d.b}> — **${vcstats.formatMs(d.ms)}**`;
            })
            .join('\n')
        );
        embed.addFields({ name: 'Tracking Since', value: discordTime(vcstats.since()) });
      }

      await interaction.reply({ embeds: [embed], allowedMentions: { users: [] } });
      return;
    }

    const entries = vcstats.leaderboard(limit);
    const embed = jrpEmbed(COLORS.GOLD).setTitle('🎙️ JRP VC Leaderboard — Total Time');

    if (!entries.length) {
      embed.setDescription('No voice time recorded yet. The channels are silent.');
    } else {
      embed.setDescription(
        entries
          .map((e, i) => {
            const rank = MEDALS[i] || `**#${i + 1}**`;
            return `${rank} <@${e.userId}> — **${vcstats.formatMs(e.totalMs)}**`;
          })
          .join('\n')
      );
      embed.addFields({ name: 'Tracking Since', value: discordTime(vcstats.since()) });
    }

    await interaction.reply({ embeds: [embed], allowedMentions: { users: [] } });
  },
};
