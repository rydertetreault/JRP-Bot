'use strict';

/**
 * Article III — Trial engine.
 *
 * Lifecycle:
 *   /trial start  → verify Art. III §1 conditions:
 *       A. Judicial figure (invoker, 𝙅𝙍𝙋𝙨 role) is in an active voice channel.
 *       B. At least three JRPs, outside the judicial party, present in that VC.
 *       C. Evidence reminder (Art. II) — enforced socially, displayed in embed.
 *   → coin flip decides which side gives opening statements first (Art. III §2)
 *   → two-minute opening statement timers per side (Art. III §2)
 *   → jury (the JRPs in VC) votes guilty / not guilty via buttons
 *   → guilty verdict → judicial party issues sentence via /sentence,
 *     or the judge can veto & go straight to sentencing (Art. V §1).
 *
 * One active trial per guild at a time (the Bill contemplates a sole
 * judicial figure).
 */

const trials = new Map(); // guildId -> trial state

function getTrial(guildId) {
  return trials.get(guildId) || null;
}

function startTrial(guildId, state) {
  trials.set(guildId, {
    phase: 'opening', // opening -> statements -> voting -> done
    votes: new Map(), // userId -> 'guilty' | 'notguilty'
    createdAt: Date.now(),
    ...state,
  });
  return trials.get(guildId);
}

function endTrial(guildId) {
  const t = trials.get(guildId);
  if (t?.timers) t.timers.forEach((h) => clearTimeout(h));
  trials.delete(guildId);
  return t || null;
}

/**
 * Article III §1 condition check.
 * @param {import('discord.js').GuildMember} judge
 * @param {string} jrpRoleId
 * @param {string[]} judicialRoleIds
 * @returns {{ok: boolean, reason?: string, voiceChannel?: any, jurors?: any[]}}
 */
function checkConditions(judge, jrpRoleId, judicialRoleIds, quorum = 3) {
  // Condition A — judicial figure in an active voice channel
  const voiceChannel = judge.voice?.channel;
  if (!voiceChannel) {
    return {
      ok: false,
      reason:
        'Article III §1(A): the Judicial Figure must be present in an active voice channel.',
    };
  }

  // Condition B — three JRPs outside the judicial party present
  // "outside of the judicial party" — the presiding judge IS the judicial party
  // for this trial. In this server 𝙅𝙍𝙋𝙨 is both the member role and the judicial
  // role, so we exclude only the presiding judge (and bots).
  const jurors = [...voiceChannel.members.values()].filter(
    (m) => !m.user.bot && m.id !== judge.id && m.roles.cache.has(jrpRoleId)
  );

  if (jurors.length < 3) {
    return {
      ok: false,
      reason:
        `Article III §1(B): three JRPs outside of the judicial party must be present. ` +
        `Currently in ${voiceChannel}: ${jurors.length}.`,
      voiceChannel,
      jurors,
    };
  }

  return { ok: true, voiceChannel, jurors };
}

function coinFlip() {
  return Math.random() < 0.5 ? 'prosecution' : 'defense';
}

function tallyVotes(trial) {
  let guilty = 0;
  let notGuilty = 0;
  for (const v of trial.votes.values()) {
    if (v === 'guilty') guilty++;
    else notGuilty++;
  }
  return { guilty, notGuilty };
}

module.exports = { getTrial, startTrial, endTrial, checkConditions, coinFlip, tallyVotes };
