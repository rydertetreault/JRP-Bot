'use strict';

const { SlashCommandBuilder } = require('discord.js');
const vcstats = require('../lib/vcstats');
const { jrpEmbed, discordTime } = require('../lib/util');
const { COLORS } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vctime')
    .setDescription('View voice channel time stats for a member.')
    .addUserOption((o) =>
      o.setName('user').setDescription('Whose stats? (defaults to you)')
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const stats = vcstats.getUser(target.id);

    const embed = jrpEmbed(COLORS.NEUTRAL)
      .setTitle('🎙️ VC Time')
      .setThumbnail(target.displayAvatarURL());

    if (!stats || stats.totalMs === 0) {
      embed.setDescription(
        `${target} has no recorded voice time yet. The empire awaits their voice.\n` +
          `*Tracking since ${discordTime(vcstats.since())}*`
      );
      await interaction.reply({ embeds: [embed] });
      return;
    }

    const rank = vcstats.rankOf(target.id);
    const fav = vcstats.favoriteChannel(target.id);
    const partner = vcstats.topPartner(target.id);

    embed.setDescription(`Voice stats for ${target}`).addFields(
      { name: 'Total VC Time', value: `**${vcstats.formatMs(stats.totalMs)}**`, inline: true },
      { name: 'Server Rank', value: rank ? `#${rank}` : '—', inline: true }
    );

    if (fav) {
      embed.addFields({
        name: 'Favorite Hangout',
        value: `<#${fav.channelId}> (${vcstats.formatMs(fav.ms)})`,
        inline: true,
      });
    }

    if (partner) {
      embed.addFields({
        name: 'Duo Partner',
        value: `<@${partner.userId}> — ${vcstats.formatMs(partner.ms)} together`,
      });
    }

    embed.addFields({
      name: 'Tracking Since',
      value: discordTime(vcstats.since()),
    });

    await interaction.reply({ embeds: [embed], allowedMentions: { users: [] } });
  },
};
