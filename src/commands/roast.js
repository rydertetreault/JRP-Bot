'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { roasts, getRandom } = require('../lib/flavor');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roast')
    .setDescription('Ask Jeff Ray to roast someone.')
    .addUserOption((o) =>
      o.setName('user').setDescription('Who should be roasted? (defaults to you)')
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    await interaction.reply({
      content: `${target} ${getRandom(roasts)}`,
      allowedMentions: { users: [target.id] },
    });
  },
};
