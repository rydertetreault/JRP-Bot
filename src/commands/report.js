'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const docket = require('../lib/docket');
const voicetrack = require('../lib/voicetrack');
const { jrpEmbed, clamp, sendTranscript } = require('../lib/util');
const config = require('../config');
const { COLORS } = config;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('report')
    .setDescription('Report a Bill of Rights violation you witnessed in a voice channel.')
    .addUserOption((o) =>
      o.setName('accused').setDescription('Who violated the Bill of Rights?').setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName('description')
        .setDescription('What happened? (words used, context, who it was directed at)')
        .setRequired(true)
    )
    .addBooleanOption((o) =>
      o
        .setName('against_member')
        .setDescription('Were the words directed AGAINST a JRP member? (Category B)')
    ),

  async execute(interaction) {
    // Only JRPs may file VC reports — they are the eligible witnesses/jurors class.
    if (!interaction.member.roles.cache.has(config.JRP_ROLE_ID)) {
      await interaction.reply({
        content: 'Only JRPs may file incident reports.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const accused = interaction.options.getUser('accused');
    const description = interaction.options.getString('description');
    const againstMember = interaction.options.getBoolean('against_member') ?? false;

    // The reporter must be in a VC — Art. I §1: the instance must occur in the
    // JRP discord, and a VC report must come from someone actually present.
    const vc = interaction.member.voice?.channel;
    if (!vc) {
      await interaction.reply({
        content:
          'You must be in the voice channel where the violation occurred to file a report ' +
          '(Article I §1 — instances outside the JRP discord are null).',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Capture the live roster — who can corroborate (or refute) this report.
    const present = [...vc.members.values()].filter((m) => !m.user.bot);
    const witnesses = present.map((m) => ({ id: m.id, username: m.user.username }));

    // Art. II §2 admissibility signal: was a judicial figure present in the VC?
    const judicialPresent = present.some((m) =>
      config.JUDICIAL_ROLE_IDS.some((rid) => m.roles.cache.has(rid))
    );

    // The accused being in the VC strengthens the report; note it either way.
    const accusedPresent = present.some((m) => m.id === accused.id);

    const incident = docket.fileIncident({
      accusedId: accused.id,
      accusedTag: accused.username,
      source: 'vc-report',
      description,
      reportedById: interaction.user.id,
      reportedByTag: interaction.user.username,
      channelId: vc.id,
      witnesses,
      judicialPresent,
      accusedPresent,
      suggestedCategory: againstMember ? 'B' : 'A',
    });

    const embed = jrpEmbed(COLORS.TRIAL)
      .setTitle(`🚨 Incident #${incident.id} — VC Report Filed`)
      .addFields(
        { name: 'Accused', value: `${accused}${accusedPresent ? '' : ' *(not in VC at filing)*'}`, inline: true },
        { name: 'Reported By', value: `${interaction.user}`, inline: true },
        { name: 'Location', value: `${vc}`, inline: true },
        { name: 'Description', value: clamp(description) },
        {
          name: `Present at Filing (${witnesses.length})`,
          value: clamp(present.map((m) => `${m}`).join(', ') || 'none'),
        },
        {
          name: 'Article II Advisory',
          value: judicialPresent
            ? '✅ A Judicial Figure was present in the VC — clips may be admissible (Art. II §2).'
            : '⚠️ No Judicial Figure present — remember: eye witness accounts alone are ' +
              '**not sufficient** for guilt (Art. II §1). Corroborating evidence will be required.',
        },
        { name: 'Suggested Classification', value: `Category **${incident.suggestedCategory}**` },
        { name: 'Next Step', value: 'Judicial Party: `/docket review` to charge or dismiss.' }
      );

    await interaction.reply({ embeds: [embed] });
    await sendTranscript(interaction.client, embed);
  },
};
