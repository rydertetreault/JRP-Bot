'use strict';

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const trials = require('../lib/trials');
const voice = require('../lib/voice');
const { isJudicial, denyNonJudicial, jrpEmbed, clamp, sendTranscript } = require('../lib/util');
const config = require('../config');
const { COLORS } = config;

const OPENING_STATEMENT_MS = 2 * 60 * 1000; // Art. III §2 — strict two minutes

function voteRow(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('trial:vote:guilty')
      .setLabel('Guilty')
      .setEmoji('🔨')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('trial:vote:notguilty')
      .setLabel('Not Guilty')
      .setEmoji('🕊️')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled)
  );
}

function judgeRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('trial:close')
      .setLabel('Close Voting & Read Verdict')
      .setEmoji('⚖️')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('trial:veto')
      .setLabel('Veto → Straight to Sentencing')
      .setStyle(ButtonStyle.Secondary)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trial')
    .setDescription('Conduct a trial under Article III of the JRP Bill of Rights.')
    .addSubcommand((sc) =>
      sc
        .setName('start')
        .setDescription('Enact a trial (Judicial Party only; Art. III §1 conditions apply).')
        .addUserOption((o) =>
          o.setName('defendant').setDescription('Who stands accused?').setRequired(true)
        )
        .addStringOption((o) =>
          o
            .setName('accusation')
            .setDescription('The instance under review')
            .setRequired(true)
        )
        .addUserOption((o) =>
          o.setName('prosecutor').setDescription('Who brings the accusation? (defaults to you)')
        )
    )
    .addSubcommand((sc) =>
      sc.setName('status').setDescription('View the active trial.')
    )
    .addSubcommand((sc) =>
      sc.setName('cancel').setDescription('Cancel the active trial (Judicial Party only).')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') return this.start(interaction);
    if (sub === 'status') return this.status(interaction);
    if (sub === 'cancel') return this.cancel(interaction);
  },

  async start(interaction) {
    if (!isJudicial(interaction.member)) return denyNonJudicial(interaction);

    if (trials.getTrial(interaction.guildId)) {
      await interaction.reply({
        content: 'A trial is already in session. The court hears one case at a time.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Article III §1 — verify conditions A and B against live voice states
    const check = trials.checkConditions(
      interaction.member,
      config.JRP_ROLE_ID,
      config.JUDICIAL_ROLE_IDS,
      config.TRIAL_QUORUM
    );

    if (!check.ok) {
      await interaction.reply({
        embeds: [
          jrpEmbed(COLORS.TRIAL)
            .setTitle('⚖️ Trial Conditions Not Met')
            .setDescription(check.reason),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const defendant = interaction.options.getUser('defendant');
    const accusation = interaction.options.getString('accusation');
    const prosecutor = interaction.options.getUser('prosecutor') || interaction.user;

    // Art. III §2 — coin flip decides who opens first
    const flipWinner = trials.coinFlip();
    const firstSide = flipWinner === 'prosecution' ? prosecutor : defendant;
    const secondSide = flipWinner === 'prosecution' ? defendant : prosecutor;

    const trial = trials.startTrial(interaction.guildId, {
      judgeId: interaction.user.id,
      defendantId: defendant.id,
      prosecutorId: prosecutor.id,
      accusation,
      flipWinner,
      voiceChannelId: check.voiceChannel.id,
      jurorIds: check.jurors.map((m) => m.id),
      timers: [],
    });

    const embed = jrpEmbed(COLORS.TRIAL)
      .setTitle('⚖️ TRIAL IS NOW IN SESSION')
      .setDescription(
        `The conditions of **Article III §1** are satisfied. All rise.\n\n` +
          `_"For the JRP, by the JRP."_`
      )
      .addFields(
        { name: 'Presiding Judicial Figure', value: `${interaction.user}`, inline: true },
        { name: 'Defendant', value: `${defendant}`, inline: true },
        { name: 'Prosecution', value: `${prosecutor}`, inline: true },
        { name: 'Instance Under Review', value: clamp(accusation) },
        { name: 'Courtroom', value: `${check.voiceChannel}`, inline: true },
        {
          name: `Jury (${check.jurors.length} JRPs)`,
          value: check.jurors.map((m) => `${m}`).join(', '),
          inline: true,
        },
        {
          name: '🪙 Coin Flip',
          value:
            `The **${flipWinner}** wins the flip. ${firstSide} delivers opening statements ` +
            `first — **two minutes**, strictly held (Art. III §2). ${secondSide} follows.`,
        },
        {
          name: '📎 Evidence Rules (Art. II)',
          value:
            'Eye witness accounts are not sufficient. Clips admissible only if the judicial ' +
            'figure was present in VC and language is not heard; clips must be deleted once reviewed.',
        }
      );

    await interaction.reply({
      embeds: [embed],
      components: [voteRow(), judgeRow()],
    });

    const message = await interaction.fetchReply();
    trial.messageId = message.id;
    trial.channelId = message.channelId;

    // The bailiff calls the court to order.
    const firstMember = await interaction.guild.members.fetch(firstSide.id).catch(() => null);
    voice
      .speak(
        check.voiceChannel,
        `All rise! The J R P court is now in session, the honorable ` +
          `${interaction.member.displayName} presiding. The ${flipWinner} has won the coin flip. ` +
          `${firstMember?.displayName || 'the first party'}, you have two minutes for your ` +
          `opening statement, beginning now.`
      )
      .catch((err) => console.error('TTS error:', err.message));

    // Two-minute timers for opening statements, then voting opens
    const t1 = setTimeout(async () => {
      const t = trials.getTrial(interaction.guildId);
      if (!t) return;
      await interaction.followUp(
        `⏱️ Two minutes are up. ${secondSide}, your opening statement — **two minutes** (Art. III §2).`
      );
    }, OPENING_STATEMENT_MS);

    const t2 = setTimeout(async () => {
      const t = trials.getTrial(interaction.guildId);
      if (!t) return;
      t.phase = 'voting';
      await interaction.followUp(
        `⏱️ Opening statements concluded. Evidence and witnesses may now be presented one at a ` +
          `time, with the loser of the coin toss having priority (Art. III §2). Jury: cast your ` +
          `votes when ready. The Judicial Figure will close voting.`
      );
    }, OPENING_STATEMENT_MS * 2);

    trial.timers.push(t1, t2);
  },

  async status(interaction) {
    const trial = trials.getTrial(interaction.guildId);
    if (!trial) {
      await interaction.reply({ content: 'No trial is currently in session.', flags: MessageFlags.Ephemeral });
      return;
    }
    const { guilty, notGuilty } = trials.tallyVotes(trial);
    await interaction.reply({
      embeds: [
        jrpEmbed(COLORS.TRIAL)
          .setTitle('⚖️ Trial In Session')
          .addFields(
            { name: 'Defendant', value: `<@${trial.defendantId}>`, inline: true },
            { name: 'Judge', value: `<@${trial.judgeId}>`, inline: true },
            { name: 'Phase', value: trial.phase, inline: true },
            { name: 'Accusation', value: clamp(trial.accusation) },
            { name: 'Votes Cast', value: `${guilty + notGuilty} of ${trial.jurorIds.length} jurors` }
          ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },

  async cancel(interaction) {
    if (!isJudicial(interaction.member)) return denyNonJudicial(interaction);
    const trial = trials.endTrial(interaction.guildId);
    if (!trial) {
      await interaction.reply({ content: 'No trial is currently in session.', flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply({
      embeds: [
        jrpEmbed(COLORS.NEUTRAL)
          .setTitle('⚖️ Trial Adjourned')
          .setDescription(`The trial of <@${trial.defendantId}> has been cancelled by the Judicial Party.`),
      ],
    });
  },

  /** Button handler. customIds: trial:vote:guilty | trial:vote:notguilty | trial:close | trial:veto */
  async handleButton(interaction) {
    const trial = trials.getTrial(interaction.guildId);
    if (!trial) {
      await interaction.reply({ content: 'This trial has concluded.', flags: MessageFlags.Ephemeral });
      return;
    }

    const parts = interaction.customId.split(':');
    const action = parts[1];

    if (action === 'vote') {
      // Only impaneled jurors vote (the JRPs who were in VC when trial was enacted)
      if (!trial.jurorIds.includes(interaction.user.id)) {
        await interaction.reply({
          content:
            'Only impaneled jurors (JRPs present in the courtroom when trial was enacted) may vote.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const vote = parts[2] === 'guilty' ? 'guilty' : 'notguilty';
      trial.votes.set(interaction.user.id, vote);
      const { guilty, notGuilty } = trials.tallyVotes(trial);
      await interaction.reply({
        content: `Your vote has been recorded: **${vote === 'guilty' ? 'Guilty 🔨' : 'Not Guilty 🕊️'}**.`,
        flags: MessageFlags.Ephemeral,
      });

      // Auto-close when all jurors have voted
      if (trial.votes.size >= trial.jurorIds.length) {
        await this.readVerdict(interaction, trial, false);
      }
      return;
    }

    // close / veto — judge only
    if (interaction.user.id !== trial.judgeId && !isJudicial(interaction.member)) {
      await interaction.reply({
        content: 'Only the presiding Judicial Figure may do that.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (action === 'veto') {
      // Art. V §1 — overwhelming evidence: veto trial, straight to sentencing
      trials.endTrial(interaction.guildId);
      await interaction.update({ components: [] });
      await interaction.followUp({
        embeds: [
          jrpEmbed(COLORS.VERDICT)
            .setTitle('⚖️ TRIAL VETOED')
            .setDescription(
              `The evidence is overwhelming. Per **Article V §1**, the Judicial Party vetoes ` +
                `the trial and proceeds straight to sentencing.\n\n` +
                `Judge <@${trial.judgeId}>: issue the sentence with **/sentence** ` +
                `against <@${trial.defendantId}>.`
            ),
        ],
      });
      return;
    }

    if (action === 'close') {
      await this.readVerdict(interaction, trial, true);
    }
  },

  async readVerdict(interaction, trial, viaUpdate) {
    const { guilty, notGuilty } = trials.tallyVotes(trial);
    trials.endTrial(interaction.guildId);

    const isGuilty = guilty > notGuilty;
    const hung = guilty === notGuilty;

    let verdictText;
    let color;
    if (hung) {
      verdictText =
        `The jury is deadlocked (${guilty}–${notGuilty}). The decision rests with the ` +
        `Judicial Party per **Article III §2** and the sections of **Article IV**.`;
      color = COLORS.TRIAL;
    } else if (isGuilty) {
      verdictText =
        `The jury finds the defendant <@${trial.defendantId}> **GUILTY** (${guilty}–${notGuilty}).\n\n` +
        `Judge <@${trial.judgeId}>: issue the sentence with **/sentence**, per the ` +
        `classifications of **Article IV §2**.`;
      color = COLORS.VERDICT;
    } else {
      verdictText =
        `The jury finds the defendant <@${trial.defendantId}> **NOT GUILTY** (${notGuilty}–${guilty}). ` +
        `The defendant walks free.`;
      color = COLORS.MERCY;
    }

    const embed = jrpEmbed(color)
      .setTitle('⚖️ VERDICT')
      .setDescription(verdictText)
      .addFields({ name: 'Instance Under Review', value: clamp(trial.accusation) });

    if (viaUpdate) {
      await interaction.update({ components: [] });
      await interaction.followUp({ embeds: [embed] });
    } else {
      await interaction.followUp({ embeds: [embed] });
    }

    const transcript = jrpEmbed(color)
      .setTitle('[TRIAL VERDICT]')
      .addFields(
        { name: 'Judge', value: `<@${trial.judgeId}>`, inline: true },
        { name: 'Defendant', value: `<@${trial.defendantId}>`, inline: true },
        { name: 'Vote', value: `Guilty ${guilty} — Not Guilty ${notGuilty}`, inline: true },
        { name: 'Accusation', value: clamp(trial.accusation) }
      );
    await sendTranscript(interaction.client, transcript);
  },
};
