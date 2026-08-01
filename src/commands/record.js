'use strict';

const { SlashCommandBuilder } = require('discord.js');
const registry = require('../lib/registry');
const { jrpEmbed } = require('../lib/util');
const { COLORS } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('record')
    .setDescription('View JRP jail-time record.')
    .addUserOption((o) =>
      o.setName('user').setDescription('Whose record should be viewed? (defaults to you)')
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const entry = registry.getEntry(target.id);

    const embed = jrpEmbed(COLORS.NEUTRAL)
      .setTitle('📋 JRP Record')
      .setThumbnail(target.displayAvatarURL());

    if (!entry || entry.totalYears === 0) {
      embed.setDescription(
        `${target} has ${entry ? 'served their time —' : ''} **0 years** in JRP custody. A model citizen of the empire.`
      );
      if (entry) embed.addFields({ name: 'Lifetime Cases', value: `${entry.cases}`, inline: true });
    } else {
      embed
        .setDescription(`Record for ${target}`)
        .addFields(
          { name: 'Total Years in Custody', value: `${entry.totalYears}`, inline: true },
          { name: 'Cases', value: `${entry.cases}`, inline: true },
          { name: 'Last Known Username', value: entry.username || 'unknown', inline: true }
        );
    }

    await interaction.reply({ embeds: [embed] });
  },
};
