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
const registry = require('../lib/registry');
const { computeSentence } = require('../lib/sentencing');
const { jrpEmbed, clamp, sendTranscript } = require('../lib/util');
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
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('trial:close')
      .setLabel('Close Voting (trial caller)')
      .setEmoji('⚖️')
      .setStyle(ButtonStyle.Primary)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trial')
    .setDescription('Call a trial before Judge Jeff Ray (Article III).')
    .addSubcommand((sc) =>
      sc
        .setName('start')
        .setDescription(`Call a trial — requires ${'3'} members in your voice channel.`)
        .addUserOption((o) =>
          o.setName('defendant').setDescription('Who stands accused?').setRequired(true)
        )
        .addStringOption((o) =>
          o.setName('accusation').setDescription('The instance under review').setRequired(true)
        )
        .addStringOption((o) =>
          o
            .setName('category')
            .setDescription('If found guilty: classification for sentencing (default A)')
            .addChoices(
              { name: 'A — public words, not against a member', value: 'A' },
              { name: 'B — words used against a member', value: 'B' }
            )
        )
        .addIntegerOption((o) =>
          o
            .setName('count')
            .setDescription('If found guilty: number of uses (default 1)')
            .setMinValue(1)
        )
    )
    .addSubcommand((sc) => sc.setName('status').setDescription('View the active trial.'))
    .addSubcommand((sc) =>
      sc.setName('cancel').setDescription('Adjourn the active trial (trial caller only).')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'start') return this.start(interaction);
    if (sub === 'status') return this.status(interaction);
    if (sub === 'cancel') return this.cancel(interaction);
  },

  async start(interaction) {
    if (trials.getTrial(interaction.guildId)) {
      await interaction.reply({
        content: 'A trial is already in session. Judge Jeff Ray hears one case at a time.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const check = trials.checkConditions(interaction.member, config.TRIAL_MIN_USERS);
    if (!check.ok) {
      await interaction.reply({
        embeds: [
          jrpEmbed(COLORS.TRIAL).setTitle('⚖️ Court Cannot Convene').setDescription(check.reason),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const defendant = interaction.options.getUser('defendant');
    const accusation = interaction.options.getString('accusation');
    const category = interaction.options.getString('category') || 'A';
    const count = interaction.options.getInteger('count') || 1;
    const prosecutor = interaction.user;

    // Jury: every human in the VC except the defendant.
    const jurors = check.humans.filter((m) => m.id !== defendant.id);

    // Art. III §2 — coin flip decides who opens first
    const flipWinner = trials.coinFlip();
    const firstSide = flipWinner === 'prosecution' ? prosecutor : defendant;
    const secondSide = flipWinner === 'prosecution' ? defendant : prosecutor;

    const trial = trials.startTrial(interaction.guildId, {
      callerId: interaction.user.id,
      defendantId: defendant.id,
      prosecutorId: prosecutor.id,
      accusation,
      category,
      count,
      flipWinner,
      voiceChannelId: check.voiceChannel.id,
      jurorIds: jurors.map((m) => m.id),
      timers: [],
    });

    const embed = jrpEmbed(COLORS.TRIAL)
      .setTitle('⚖️ THE COURT OF JUDGE JEFF RAY IS NOW IN SESSION')
      .setDescription(`All rise.\n\n_"For the JRP, by the JRP."_`)
      .addFields(
        { name: 'Presiding Judge', value: 'Jeff Ray 🤖', inline: true },
        { name: 'Defendant', value: `${defendant}`, inline: true },
        { name: 'Prosecution', value: `${prosecutor}`, inline: true },
        { name: 'Instance Under Review', value: clamp(accusation) },
        { name: 'Courtroom', value: `${check.voiceChannel}`, inline: true },
        {
          name: `Jury (${jurors.length})`,
          value: clamp(jurors.map((m) => `${m}`).join(', ')),
          inline: true,
        },
        {
          name: '🪙 Coin Flip',
          value:
            `The **${flipWinner}** opens. ${firstSide} has **two minutes** for opening ` +
            `statements (Art. III §2), then ${secondSide}. Voting opens after statements — ` +
            `all jurors vote, or the trial caller closes voting early.`,
        }
      );

    await interaction.reply({ embeds: [embed], components: [voteRow()] });

    voice
      .speak(
        check.voiceChannel,
        `All rise! The court of Judge Jeff Ray is now in session. ` +
          `${interaction.member.displayName} brings an accusation. The ${flipWinner} has won ` +
          `the coin flip and will open. You have two minutes, beginning now.`
      )
      .catch((err) => console.error('TTS error:', err.message));

    const t1 = setTimeout(() => {
      if (!trials.getTrial(interaction.guildId)) return;
      interaction
        .followUp(`⏱️ Two minutes are up. ${secondSide}, your opening statement — **two minutes**.`)
        .catch(() => {});
    }, OPENING_STATEMENT_MS);

    const t2 = setTimeout(() => {
      const t = trials.getTrial(interaction.guildId);
      if (!t) return;
      t.phase = 'voting';
      interaction
        .followUp(
          '⏱️ Statements concluded. Jurors, cast your votes. The verdict reads when all votes ' +
            'are in, or when the trial caller closes voting.'
        )
        .catch(() => {});
    }, OPENING_STATEMENT_MS * 2);

    trial.timers.push(t1, t2);
  },

  async status(interaction) {
    const trial = trials.getTrial(interaction.guildId);
    if (!trial) {
      await interaction.reply({
        content: 'No trial is currently in session.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const { guilty, notGuilty } = trials.tallyVotes(trial);
    await interaction.reply({
      embeds: [
        jrpEmbed(COLORS.TRIAL)
          .setTitle('⚖️ Trial In Session')
          .addFields(
            { name: 'Defendant', value: `<@${trial.defendantId}>`, inline: true },
            { name: 'Called By', value: `<@${trial.callerId}>`, inline: true },
            { name: 'Phase', value: trial.phase, inline: true },
            { name: 'Accusation', value: clamp(trial.accusation) },
            {
              name: 'Votes Cast',
              value: `${guilty + notGuilty} of ${trial.jurorIds.length} jurors`,
            }
          ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },

  async cancel(interaction) {
    const trial = trials.getTrial(interaction.guildId);
    if (!trial) {
      await interaction.reply({
        content: 'No trial is currently in session.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (interaction.user.id !== trial.callerId) {
      await interaction.reply({
        content: 'Only the member who called the trial may adjourn it.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    trials.endTrial(interaction.guildId);
    await interaction.reply({
      embeds: [
        jrpEmbed(COLORS.NEUTRAL)
          .setTitle('⚖️ Trial Adjourned')
          .setDescription(`The trial of <@${trial.defendantId}> has been adjourned.`),
      ],
    });
  },

  /** Buttons: trial:vote:guilty | trial:vote:notguilty | trial:close */
  async handleButton(interaction) {
    const trial = trials.getTrial(interaction.guildId);
    if (!trial) {
      await interaction.reply({
        content: 'This trial has concluded.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const parts = interaction.customId.split(':');
    const action = parts[1];

    if (action === 'vote') {
      if (interaction.user.id === trial.defendantId) {
        await interaction.reply({
          content: 'The defendant does not vote on their own verdict.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (!trial.jurorIds.includes(interaction.user.id)) {
        await interaction.reply({
          content: 'Only jurors (members in the courtroom VC when trial was called) may vote.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const vote = parts[2] === 'guilty' ? 'guilty' : 'notguilty';
      trial.votes.set(interaction.user.id, vote);
      await interaction.reply({
        content: `Vote recorded: **${vote === 'guilty' ? 'Guilty 🔨' : 'Not Guilty 🕊️'}**.`,
        flags: MessageFlags.Ephemeral,
      });

      if (trial.votes.size >= trial.jurorIds.length) {
        await this.readVerdict(interaction, trial, false);
      }
      return;
    }

    if (action === 'close') {
      if (interaction.user.id !== trial.callerId) {
        await interaction.reply({
          content: 'Only the member who called the trial may close voting.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (trial.votes.size === 0) {
        await interaction.reply({
          content: 'No votes have been cast yet.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await this.readVerdict(interaction, trial, true);
    }
  },

  async readVerdict(interaction, trial, viaUpdate) {
    const { guilty, notGuilty } = trials.tallyVotes(trial);
    trials.endTrial(interaction.guildId);

    // Deadlock: Judge Jeff Ray breaks the tie himself.
    let jeffBrokeTie = false;
    let isGuilty = guilty > notGuilty;
    if (guilty === notGuilty) {
      jeffBrokeTie = true;
      isGuilty = Math.random() < 0.5;
    }

    const defendant = await interaction.client.users.fetch(trial.defendantId);
    const defendantMember = await interaction.guild.members
      .fetch(trial.defendantId)
      .catch(() => null);
    const name = defendantMember?.displayName || defendant.username;

    let embed;
    let spokenLine;

    if (isGuilty) {
      // Judge Jeff Ray executes sentencing (Art. IV).
      const verdict = computeSentence(trial.category, true, trial.count);
      const entry = registry.addCase(defendant, {
        years: verdict.years,
        category: trial.category,
        tier: verdict.tier,
        count: trial.count,
        pejorative: true,
        summary: `Convicted at trial: ${trial.accusation}`,
        basis: verdict.basis,
        judge: 'Jeff Ray (trial verdict)',
        judgeId: interaction.client.user.id,
        timestamp: new Date().toISOString(),
      });

      embed = jrpEmbed(COLORS.VERDICT)
        .setTitle('⚖️ VERDICT: GUILTY')
        .setDescription(
          `The jury finds <@${trial.defendantId}> **GUILTY** ` +
            `(${guilty}–${notGuilty}${jeffBrokeTie ? ', tie broken by Judge Jeff Ray' : ''}).\n\n` +
            `Judge Jeff Ray sentences the defendant to **${verdict.years} years** in JRP custody.`
        )
        .addFields(
          { name: 'Instance Under Review', value: clamp(trial.accusation) },
          { name: 'Basis', value: clamp(verdict.basis) },
          {
            name: 'Cumulative Record',
            value: `${entry.totalYears} years across ${entry.cases} case(s).`,
          }
        );

      spokenLine =
        `Order! The jury has spoken${jeffBrokeTie ? ', and this judge has broken the tie' : ''}. ` +
        `This court finds ${name}... guilty! By a vote of ${guilty} to ${notGuilty}. ` +
        `I hereby sentence the defendant to ${verdict.years} years in J R P custody. ` +
        `For the J R P, by the J R P. Court is adjourned.`;
    } else {
      embed = jrpEmbed(COLORS.MERCY)
        .setTitle('⚖️ VERDICT: NOT GUILTY')
        .setDescription(
          `The jury finds <@${trial.defendantId}> **NOT GUILTY** ` +
            `(${notGuilty}–${guilty}${jeffBrokeTie ? ', tie broken by Judge Jeff Ray' : ''}). ` +
            `The defendant walks free.`
        )
        .addFields({ name: 'Instance Under Review', value: clamp(trial.accusation) });

      spokenLine =
        `Order! The jury has spoken${jeffBrokeTie ? ', and this judge has broken the tie' : ''}. ` +
        `This court finds ${name}... not guilty, by a vote of ${notGuilty} to ${guilty}. ` +
        `The defendant walks free. Court is adjourned.`;
    }

    if (viaUpdate) {
      await interaction.update({ components: [] });
      await interaction.followUp({ embeds: [embed] });
    } else {
      await interaction.followUp({ embeds: [embed] });
    }

    try {
      const courtroom = await interaction.guild.channels.fetch(trial.voiceChannelId);
      if (courtroom?.isVoiceBased() && courtroom.members.size > 0) {
        voice.speak(courtroom, spokenLine).catch((err) => console.error('TTS error:', err.message));
      }
    } catch {
      /* courtroom gone */
    }

    const transcript = jrpEmbed(isGuilty ? COLORS.VERDICT : COLORS.MERCY)
      .setTitle('[TRIAL VERDICT]')
      .addFields(
        { name: 'Judge', value: 'Jeff Ray', inline: true },
        { name: 'Defendant', value: `<@${trial.defendantId}>`, inline: true },
        { name: 'Vote', value: `Guilty ${guilty} — Not Guilty ${notGuilty}`, inline: true },
        { name: 'Accusation', value: clamp(trial.accusation) }
      );
    await sendTranscript(interaction.client, transcript);
  },
};
