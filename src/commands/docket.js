'use strict';

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const docket = require('../lib/docket');
const { isJudicial, denyNonJudicial, jrpEmbed, discordTime, clamp, sendTranscript } = require('../lib/util');
const { COLORS } = require('../config');

function incidentEmbed(incident) {
  const embed = jrpEmbed(COLORS.TRIAL)
    .setTitle(`🗄️ Incident #${incident.id} — ${incident.status.toUpperCase()}`)
    .addFields(
      { name: 'Accused', value: `<@${incident.accusedId}>`, inline: true },
      {
        name: 'Source',
        value: incident.source === 'text-auto' ? 'Automatic (text)' : 'VC report',
        inline: true,
      },
      { name: 'Filed', value: discordTime(incident.filedAt), inline: true },
      { name: 'Description', value: clamp(incident.description) }
    );

  if (incident.reportedByTag) {
    embed.addFields({ name: 'Reported By', value: incident.reportedByTag, inline: true });
  }
  if (incident.totalCount) {
    embed.addFields({ name: 'Detected Uses', value: `${incident.totalCount}`, inline: true });
  }
  if (incident.messageLink) {
    embed.addFields({ name: 'Evidence', value: `[Message link](${incident.messageLink})` });
  }
  if (incident.witnesses?.length) {
    embed.addFields({
      name: `Witnesses Present (${incident.witnesses.length})`,
      value: clamp(incident.witnesses.map((w) => `<@${w.id}>`).join(', ')),
    });
    embed.addFields({
      name: 'Art. II Advisory',
      value: incident.judicialPresent
        ? '✅ Judicial Figure was present (clips may be admissible, Art. II §2).'
        : '⚠️ No Judicial Figure present — witness accounts alone are insufficient (Art. II §1).',
    });
  }
  if (incident.suggestedCategory) {
    embed.addFields({
      name: 'Suggested Classification',
      value: `Category **${incident.suggestedCategory}**`,
      inline: true,
    });
  }
  if (incident.resolvedBy) {
    embed.addFields({
      name: 'Resolved',
      value: `${incident.status} by ${incident.resolvedBy} • ${discordTime(incident.resolvedAt)}`,
    });
  }
  return embed;
}

function reviewRow(incidentId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`docket:charge:${incidentId}`)
      .setLabel('Charge (→ /sentence)')
      .setEmoji('⚖️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`docket:dismiss:${incidentId}`)
      .setLabel('Dismiss')
      .setEmoji('🕊️')
      .setStyle(ButtonStyle.Secondary)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('docket')
    .setDescription('The docket of pending Bill of Rights incidents.')
    .addSubcommand((sc) => sc.setName('list').setDescription('List pending incidents.'))
    .addSubcommand((sc) =>
      sc
        .setName('review')
        .setDescription('Review an incident (Judicial Party only).')
        .addIntegerOption((o) =>
          o
            .setName('id')
            .setDescription('Incident number (defaults to oldest pending)')
            .setMinValue(1)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      const items = docket.pending();
      if (!items.length) {
        await interaction.reply({
          embeds: [
            jrpEmbed(COLORS.NEUTRAL)
              .setTitle('🗄️ The Docket')
              .setDescription('The docket is clear. The empire is at peace.'),
          ],
        });
        return;
      }
      const lines = items
        .slice(0, 15)
        .map(
          (i) =>
            `**#${i.id}** — <@${i.accusedId}> • ` +
            `${i.source === 'text-auto' ? '📝 auto' : '🎙️ VC report'} • ${discordTime(i.filedAt)}`
        );
      await interaction.reply({
        embeds: [
          jrpEmbed(COLORS.TRIAL)
            .setTitle(`🗄️ The Docket — ${items.length} pending`)
            .setDescription(lines.join('\n'))
            .addFields({ name: 'Review', value: 'Judicial Party: `/docket review id:<n>`' }),
        ],
        allowedMentions: { users: [] },
      });
      return;
    }

    // review
    if (!isJudicial(interaction.member)) return denyNonJudicial(interaction);

    let incident;
    const id = interaction.options.getInteger('id');
    if (id) {
      incident = docket.getIncident(id);
    } else {
      incident = docket.pending()[0] || null;
    }

    if (!incident) {
      await interaction.reply({
        content: id ? `Incident #${id} not found.` : 'The docket is clear.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      embeds: [incidentEmbed(incident)],
      components: incident.status === 'pending' ? [reviewRow(incident.id)] : [],
      allowedMentions: { users: [] },
    });
  },

  /** customId: docket:charge:<id> | docket:dismiss:<id> */
  async handleButton(interaction) {
    if (!isJudicial(interaction.member)) return denyNonJudicial(interaction);

    const [, action, idStr] = interaction.customId.split(':');
    const id = parseInt(idStr, 10);

    if (action === 'dismiss') {
      const incident = docket.resolve(id, 'dismissed', interaction.user.username);
      if (!incident) {
        await interaction.reply({
          content: 'That incident is no longer pending.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.update({ embeds: [incidentEmbed(incident)], components: [] });

      const transcript = jrpEmbed(COLORS.MERCY)
        .setTitle(`[DOCKET] Incident #${id} dismissed`)
        .setDescription(
          `Dismissed by ${interaction.user.username}. Accused: <@${incident.accusedId}>.`
        );
      await sendTranscript(interaction.client, transcript);
      return;
    }

    if (action === 'charge') {
      const incident = docket.resolve(id, 'charged', interaction.user.username);
      if (!incident) {
        await interaction.reply({
          content: 'That incident is no longer pending.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.update({ embeds: [incidentEmbed(incident)], components: [] });

      const cat = incident.suggestedCategory || 'A';
      const count = incident.totalCount || 1;
      await interaction.followUp({
        embeds: [
          jrpEmbed(COLORS.VERDICT)
            .setTitle(`⚖️ Incident #${id} — Charges Filed`)
            .setDescription(
              `The Judicial Party proceeds against <@${incident.accusedId}>.\n\n` +
                `Issue the sentence:\n` +
                `\`/sentence defendant:@${incident.accusedTag} category:${cat} count:${count}\`\n\n` +
                `Or convene a trial first: \`/trial start\` (Art. III conditions apply).`
            ),
        ],
        allowedMentions: { users: [] },
      });

      const transcript = jrpEmbed(COLORS.VERDICT)
        .setTitle(`[DOCKET] Incident #${id} charged`)
        .setDescription(
          `Charged by ${interaction.user.username}. Accused: <@${incident.accusedId}>.`
        );
      await sendTranscript(interaction.client, transcript);
    }
  },
};
