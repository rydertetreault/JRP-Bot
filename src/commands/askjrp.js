'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { oracleAnswers, oracleReasons, getRandom } = require('../lib/flavor');
const { jrpEmbed } = require('../lib/util');
const { COLORS } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('askjrp')
    .setDescription('Ask Jeff Ray a yes/no question.')
    .addStringOption((o) =>
      o.setName('question').setDescription('The question you want to ask Jeff Ray')
    ),

  async execute(interaction) {
    const question = interaction.options.getString('question');
    const answer = getRandom(oracleAnswers);
    const reason = getRandom(oracleReasons[answer]);
    const label = answer.toUpperCase();

    const embed = jrpEmbed(COLORS.ORACLE)
      .setTitle('🔮 The Oracle of Jeff Ray')
      .setDescription(`# ${label}\n${reason}`);

    if (question) embed.addFields({ name: 'Question', value: question.slice(0, 1024) });

    await interaction.reply({ embeds: [embed] });
  },
};
