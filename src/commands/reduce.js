'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const registry = require('../lib/registry');
const { isJudicial, denyNonJudicial, jrpEmbed, clamp, sendTranscript } = require('../lib/util');
const { COLORS } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reduce')
    .setDescription("Reduce a user's JRP jail time (Judicial Party only).")
    .addUserOption((o) =>
      o.setName('user').setDescription('Whose record should be reduced?').setRequired(true)
    )
    .addIntegerOption((o) =>
      o
        .setName('years')
        .setDescription('How many years to subtract from their record')
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption((o) => o.setName('reason').setDescription('Reason for reduction (optional)')),

  async execute(interaction) {
    if (!isJudicial(interaction.member)) return denyNonJudicial(interaction);

    const target = interaction.options.getUser('user');
    const years = interaction.options.getInteger('years');
    const reason = interaction.options.getString('reason') || 'No reason provided.';

    const result = registry.reduce(target.id, years);
    if (!result) {
      await interaction.reply({
        content: `No JRP record found for ${target}. There is nothing to reduce.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const embed = jrpEmbed(COLORS.MERCY)
      .setTitle('🕊️ Sentence Reduction')
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: 'Beneficiary', value: `${target}`, inline: true },
        { name: 'Original Total', value: `${result.original} years`, inline: true },
        { name: 'Reduction Applied', value: `${result.applied} years`, inline: true },
        { name: 'New Total', value: `**${result.newTotal} years**`, inline: true },
        { name: 'Reason', value: clamp(reason) }
      );

    await interaction.reply({ embeds: [embed] });

    const transcript = jrpEmbed(COLORS.MERCY)
      .setTitle('[REDUCE]')
      .addFields(
        { name: 'Judge', value: `${interaction.user.username} (${interaction.user.id})` },
        { name: 'Target', value: `${target.username} (${target.id})` },
        {
          name: 'Details',
          value: clamp(
            `Original: ${result.original} → New: ${result.newTotal} ` +
              `(applied ${result.applied} of ${years} requested)\nReason: ${reason}`
          ),
        }
      );
    await sendTranscript(interaction.client, transcript);
  },
};
