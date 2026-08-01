'use strict';

const { SlashCommandBuilder } = require('discord.js');
const registry = require('../lib/registry');
const { jrpEmbed } = require('../lib/util');
const { COLORS } = require('../config');

const MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('topcriminals')
    .setDescription('View the top JRP offenders by total jail time.')
    .addIntegerOption((o) =>
      o
        .setName('limit')
        .setDescription('How many top offenders to show (1–25)')
        .setMinValue(1)
        .setMaxValue(25)
    ),

  async execute(interaction) {
    const limit = interaction.options.getInteger('limit') || 10;
    const entries = registry.topOffenders(limit);

    if (!entries.length) {
      await interaction.reply({
        embeds: [
          jrpEmbed(COLORS.GOLD)
            .setTitle('🏆 JRP Most Wanted')
            .setDescription('There are currently no JRP offenders on record. The empire is at peace.'),
        ],
      });
      return;
    }

    const lines = entries.map((e, i) => {
      const rank = MEDALS[i] || `**#${i + 1}**`;
      return `${rank} <@${e.userId}> — **${e.totalYears} years** across ${e.cases} case(s)`;
    });

    await interaction.reply({
      embeds: [
        jrpEmbed(COLORS.GOLD)
          .setTitle('🏆 JRP Most Wanted')
          .setDescription(lines.join('\n')),
      ],
      allowedMentions: { users: [] },
    });
  },
};
