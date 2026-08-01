'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { LAWBOOK, findEntry } = require('../lib/lawbook');
const { jrpEmbed } = require('../lib/util');
const { COLORS, BILL_OF_RIGHTS_CHANNEL_ID } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lawbook')
    .setDescription('Consult the JRP Bill of Rights.')
    .addStringOption((o) =>
      o
        .setName('section')
        .setDescription('Which article/section to read (leave empty for the index)')
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const q = interaction.options.getFocused().toLowerCase();
    const matches = LAWBOOK.filter(
      (e) => e.title.toLowerCase().includes(q) || e.text.toLowerCase().includes(q)
    ).slice(0, 25);
    await interaction.respond(matches.map((e) => ({ name: e.title.slice(0, 100), value: e.id })));
  },

  async execute(interaction) {
    const sectionId = interaction.options.getString('section');

    if (!sectionId) {
      const index = LAWBOOK.map((e) => `• **${e.title}**`).join('\n');
      await interaction.reply({
        embeds: [
          jrpEmbed(COLORS.LAW)
            .setTitle('📜 JRP Bill of Rights — Index')
            .setDescription(
              `${index}\n\nUse \`/lawbook section:\` to read a section, or see <#${BILL_OF_RIGHTS_CHANNEL_ID}>.`
            ),
        ],
      });
      return;
    }

    const entry = findEntry(sectionId);
    if (!entry) {
      await interaction.reply({ content: 'That section was not found in the lawbook.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply({
      embeds: [
        jrpEmbed(COLORS.LAW).setTitle(`📜 ${entry.title}`).setDescription(entry.text),
      ],
    });
  },
};
