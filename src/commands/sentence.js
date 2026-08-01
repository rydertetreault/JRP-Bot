'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { computeSentence } = require('../lib/sentencing');
const registry = require('../lib/registry');
const { isJudicial, denyNonJudicial, jrpEmbed, clamp, sendTranscript } = require('../lib/util');
const { COLORS } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sentence')
    .setDescription('Issue a sentence under the JRP Bill of Rights (Judicial Party only).')
    .addUserOption((o) =>
      o.setName('defendant').setDescription('Who is being sentenced?').setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName('category')
        .setDescription('Classification of misconduct (Article IV §2)')
        .setRequired(true)
        .addChoices(
          { name: 'A — Public words NOT against a JRP member', value: 'A' },
          { name: 'B — Words used AGAINST a JRP member', value: 'B' }
        )
    )
    .addIntegerOption((o) =>
      o
        .setName('count')
        .setDescription('Number of times the word/slur was used')
        .setRequired(true)
        .setMinValue(1)
    )
    .addBooleanOption((o) =>
      o
        .setName('pejorative')
        .setDescription('Category A only: was it used as a pejorative? (Category B is inherently pejorative)')
    )
    .addStringOption((o) =>
      o.setName('summary').setDescription('Short description of the misconduct (optional)')
    ),

  async execute(interaction) {
    if (!isJudicial(interaction.member)) return denyNonJudicial(interaction);

    const defendant = interaction.options.getUser('defendant');
    const category = interaction.options.getString('category');
    const count = interaction.options.getInteger('count');
    // Category B is pejorative by definition (used AGAINST a member).
    const pejorative =
      category === 'B' ? true : interaction.options.getBoolean('pejorative') ?? false;
    const summary = interaction.options.getString('summary') || 'No summary provided.';

    // Tier is derived from the facts — Art. IV forbids contradictory tiers.
    const verdict = computeSentence(category, pejorative, count);

    const caseEntry = {
      years: verdict.years,
      category,
      tier: verdict.tier,
      count,
      pejorative,
      summary,
      basis: verdict.basis,
      judge: interaction.user.username,
      judgeId: interaction.user.id,
      timestamp: new Date().toISOString(),
    };

    const entry = registry.addCase(defendant, caseEntry);

    const embed = jrpEmbed(COLORS.VERDICT)
      .setTitle('⚖️ Sentence of the Judicial Party')
      .setThumbnail(defendant.displayAvatarURL())
      .setDescription(
        `Jeff Ray, acting as Judicial Party, issues the following sentence under the JRP Bill of Rights.`
      )
      .addFields(
        { name: 'Defendant', value: `${defendant}`, inline: true },
        { name: 'Category', value: `${category} — Tier ${verdict.tier}`, inline: true },
        { name: 'Count', value: `${count} use(s)`, inline: true },
        { name: 'Classification', value: clamp(`${verdict.categoryText}\n*${verdict.tierText}*`) },
        { name: 'Summary of Misconduct', value: clamp(summary) },
        { name: 'Sentence', value: `**${verdict.years} years** in JRP custody.` },
        {
          name: 'Cumulative Record',
          value: `${entry.totalYears} total years across ${entry.cases} case(s).`,
        },
        { name: 'Basis', value: clamp(verdict.basis) }
      );

    await interaction.reply({ embeds: [embed] });

    const transcript = jrpEmbed(COLORS.VERDICT)
      .setTitle('[SENTENCE]')
      .addFields(
        { name: 'Judge', value: `${interaction.user.username} (${interaction.user.id})` },
        { name: 'Defendant', value: `${defendant.username} (${defendant.id})` },
        {
          name: 'Details',
          value: clamp(
            `Category ${category}, Tier ${verdict.tier}, Count ${count}\n` +
              `Years: ${verdict.years}\nBasis: ${verdict.basis}\nSummary: ${summary}`
          ),
        }
      );
    await sendTranscript(interaction.client, transcript);
  },
};
