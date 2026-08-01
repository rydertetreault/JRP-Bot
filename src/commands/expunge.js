'use strict';

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const registry = require('../lib/registry');
const { isJudicial, denyNonJudicial, jrpEmbed, sendTranscript } = require('../lib/util');
const { COLORS } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('expunge')
    .setDescription("Completely clear a user's JRP record (Judicial Party only).")
    .addUserOption((o) =>
      o.setName('user').setDescription('Whose record should be expunged?').setRequired(true)
    ),

  async execute(interaction) {
    if (!isJudicial(interaction.member)) return denyNonJudicial(interaction);

    const target = interaction.options.getUser('user');
    const entry = registry.getEntry(target.id);

    if (!entry) {
      await interaction.reply({
        content: `No JRP record found for ${target}. There is nothing to expunge.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`expunge:confirm:${target.id}`)
        .setLabel('Confirm Expungement')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('expunge:cancel:0')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [
        jrpEmbed(COLORS.MERCY)
          .setTitle('⚠️ Confirm Expungement')
          .setDescription(
            `You are about to erase **${entry.totalYears} years** across ` +
              `**${entry.cases} case(s)** for ${target}.\nThis cannot be undone.`
          ),
      ],
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  },

  /** customId: expunge:confirm:<userId> | expunge:cancel:0 */
  async handleButton(interaction) {
    if (!isJudicial(interaction.member)) return denyNonJudicial(interaction);

    const [, action, userId] = interaction.customId.split(':');

    if (action === 'cancel') {
      await interaction.update({
        embeds: [jrpEmbed(COLORS.NEUTRAL).setTitle('Expungement cancelled.')],
        components: [],
      });
      return;
    }

    const existed = registry.expunge(userId);
    const target = await interaction.client.users.fetch(userId);

    await interaction.update({
      embeds: [
        jrpEmbed(COLORS.MERCY)
          .setTitle('🕊️ Record Expunged')
          .setDescription(
            existed
              ? `All JRP records for ${target} have been expunged. Their slate is clean.`
              : `No record found for ${target}.`
          ),
      ],
      components: [],
    });

    if (existed) {
      // announce publicly since the confirm flow was ephemeral
      await interaction.followUp({
        embeds: [
          jrpEmbed(COLORS.MERCY)
            .setTitle('🕊️ Record Expunged')
            .setDescription(`All JRP records for ${target} have been expunged by the Judicial Party.`),
        ],
      });

      const transcript = jrpEmbed(COLORS.MERCY)
        .setTitle('[EXPUNGE]')
        .addFields(
          { name: 'Judge', value: `${interaction.user.username} (${interaction.user.id})` },
          { name: 'Target', value: `${target.username} (${target.id})` },
          { name: 'Action', value: 'Full record expunged.' }
        );
      await sendTranscript(interaction.client, transcript);
    }
  },
};
