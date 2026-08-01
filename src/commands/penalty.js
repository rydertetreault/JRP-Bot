'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { PENALTY_FORMS } = require('../lib/sentencing');
const registry = require('../lib/registry');
const { isJudicial, denyNonJudicial, jrpEmbed, clamp, sendTranscript } = require('../lib/util');
const { COLORS } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('penalty')
    .setDescription('Issue an Article V penalty (Judicial Party only).')
    .addUserOption((o) =>
      o.setName('offender').setDescription('Who committed the offense?').setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName('form')
        .setDescription('Form of penalty (Article V §1)')
        .setRequired(true)
        .addChoices(...PENALTY_FORMS.map((f) => ({ name: f, value: f })))
    )
    .addIntegerOption((o) =>
      o
        .setName('years')
        .setDescription('Years assessed (judicial discretion, Art. IV §1 limits apply)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addStringOption((o) =>
      o.setName('summary').setDescription('Description of the offense (optional)')
    ),

  async execute(interaction) {
    if (!isJudicial(interaction.member)) return denyNonJudicial(interaction);

    const offender = interaction.options.getUser('offender');
    const form = interaction.options.getString('form');
    const years = interaction.options.getInteger('years');
    const summary = interaction.options.getString('summary') || 'No summary provided.';

    const caseEntry = {
      years,
      category: 'V',
      tier: null,
      count: 1,
      penaltyForm: form,
      summary,
      basis: `Article V §1 — ${form}.`,
      judge: interaction.user.username,
      judgeId: interaction.user.id,
      timestamp: new Date().toISOString(),
    };

    const entry = registry.addCase(offender, caseEntry);

    const embed = jrpEmbed(COLORS.VERDICT)
      .setTitle('⚖️ Article V Penalty')
      .setThumbnail(offender.displayAvatarURL())
      .addFields(
        { name: 'Offender', value: `${offender}`, inline: true },
        { name: 'Form of Penalty', value: form, inline: true },
        { name: 'Penalty', value: `**${years} years** in JRP custody.` },
        { name: 'Summary', value: clamp(summary) },
        {
          name: 'Cumulative Record',
          value: `${entry.totalYears} total years across ${entry.cases} case(s).`,
        },
        { name: 'Basis', value: `Article V §1 — ${form}.` }
      );

    await interaction.reply({ embeds: [embed] });

    const transcript = jrpEmbed(COLORS.VERDICT)
      .setTitle('[PENALTY]')
      .addFields(
        { name: 'Judge', value: `${interaction.user.username} (${interaction.user.id})` },
        { name: 'Offender', value: `${offender.username} (${offender.id})` },
        { name: 'Details', value: clamp(`Form: ${form}\nYears: ${years}\nSummary: ${summary}`) }
      );
    await sendTranscript(interaction.client, transcript);
  },
};
