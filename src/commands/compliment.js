'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { compliments, getRandom } = require('../lib/flavor');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('compliment')
    .setDescription('Ask Jeff Ray to compliment someone.')
    .addUserOption((o) =>
      o.setName('user').setDescription('Who should be complimented? (defaults to you)')
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    await interaction.reply({
      content: `${target} ${getRandom(compliments)}`,
      allowedMentions: { users: [target.id] },
    });
  },
};
