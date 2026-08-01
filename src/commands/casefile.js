'use strict';

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const registry = require('../lib/registry');
const { jrpEmbed, discordTime, clamp } = require('../lib/util');
const { COLORS } = require('../config');

const PAGE_SIZE = 5;

function buildPage(target, entry, page) {
  const totalCases = entry.history.length;
  const totalPages = Math.max(1, Math.ceil(totalCases / PAGE_SIZE));
  const p = Math.min(Math.max(page, 0), totalPages - 1);

  // newest first
  const ordered = [...entry.history].reverse();
  const slice = ordered.slice(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE);

  const embed = jrpEmbed(COLORS.NEUTRAL)
    .setTitle('🗂️ JRP Casefile')
    .setThumbnail(target.displayAvatarURL())
    .setDescription(
      `Casefile for ${target}\n**${entry.totalYears} years** across **${entry.cases} case(s)**`
    );

  slice.forEach((c, i) => {
    const caseNum = totalCases - (p * PAGE_SIZE + i);
    const classification =
      c.category === 'V'
        ? `Article V — ${c.penaltyForm || 'Penalty'}`
        : `Category ${c.category}, Tier ${c.tier}, ${c.count} use(s)`;
    embed.addFields({
      name: `Case #${caseNum} — ${c.years} years`,
      value: clamp(
        `${classification}\n` +
          `**Summary:** ${c.summary}\n` +
          `**Judge:** ${c.judge} • ${discordTime(c.timestamp)}`
      ),
    });
  });

  embed.setFooter({ text: `Page ${p + 1}/${totalPages} • For the JRP, by the JRP.` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`casefile:${target.id}:${p - 1}`)
      .setLabel('◀ Prev')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(p === 0),
    new ButtonBuilder()
      .setCustomId(`casefile:${target.id}:${p + 1}`)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(p >= totalPages - 1)
  );

  return { embeds: [embed], components: totalPages > 1 ? [row] : [] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('casefile')
    .setDescription('View the detailed JRP case history for a user.')
    .addUserOption((o) =>
      o.setName('user').setDescription('Whose casefile should be viewed?').setRequired(true)
    ),

  buildPage,

  async execute(interaction) {
    const target = interaction.options.getUser('user');
    const entry = registry.getEntry(target.id);

    if (!entry || !entry.history.length) {
      await interaction.reply({
        embeds: [
          jrpEmbed(COLORS.NEUTRAL)
            .setTitle('🗂️ JRP Casefile')
            .setDescription(`No JRP case history found for ${target}.`),
        ],
      });
      return;
    }

    await interaction.reply(buildPage(target, entry, 0));
  },

  /** Pagination button handler. customId: casefile:<userId>:<page> */
  async handleButton(interaction) {
    const [, userId, pageStr] = interaction.customId.split(':');
    const entry = registry.getEntry(userId);
    if (!entry || !entry.history.length) {
      await interaction.update({ components: [] });
      return;
    }
    const target = await interaction.client.users.fetch(userId);
    await interaction.update(buildPage(target, entry, parseInt(pageStr, 10)));
  },
};
