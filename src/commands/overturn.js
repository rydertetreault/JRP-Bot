'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const registry = require('../lib/registry');
const { isJudicial, denyNonJudicial, jrpEmbed, discordTime, clamp, sendTranscript } = require('../lib/util');
const { COLORS } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('overturn')
    .setDescription('Overturn the last sentence given to a user (Judicial Party only).')
    .addUserOption((o) =>
      o
        .setName('user')
        .setDescription('Whose last sentence should be overturned?')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!isJudicial(interaction.member)) return denyNonJudicial(interaction);

    const target = interaction.options.getUser('user');
    const result = registry.overturnLast(target.id);

    if (!result) {
      await interaction.reply({
        content: `No prior sentences found for ${target}. There is nothing to overturn.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const { lastCase, entry } = result;
    const classification =
      lastCase.category === 'V'
        ? `Article V — ${lastCase.penaltyForm || 'Penalty'}`
        : `Category ${lastCase.category}, Tier ${lastCase.tier}, ${lastCase.count} use(s)`;

    const embed = jrpEmbed(COLORS.MERCY)
      .setTitle('🕊️ Sentence Overturned')
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: 'Defendant', value: `${target}`, inline: true },
        { name: 'Years Vacated', value: `${lastCase.years}`, inline: true },
        { name: 'Classification', value: classification, inline: true },
        {
          name: 'Overturned Case',
          value: clamp(
            `**Summary:** ${lastCase.summary}\n` +
              `**Judge:** ${lastCase.judge} • ${discordTime(lastCase.timestamp)}`
          ),
        },
        {
          name: 'Updated Record',
          value: `${entry.totalYears} years across ${entry.cases} case(s).`,
        }
      );

    await interaction.reply({ embeds: [embed] });

    const transcript = jrpEmbed(COLORS.MERCY)
      .setTitle('[OVERTURN]')
      .addFields(
        { name: 'Judge', value: `${interaction.user.username} (${interaction.user.id})` },
        { name: 'Target', value: `${target.username} (${target.id})` },
        {
          name: 'Details',
          value: clamp(
            `Vacated ${lastCase.years} years (${classification})\n` +
              `New total: ${entry.totalYears} years across ${entry.cases} case(s)`
          ),
        }
      );
    await sendTranscript(interaction.client, transcript);
  },
};
