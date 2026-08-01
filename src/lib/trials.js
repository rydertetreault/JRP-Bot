'use strict';

/**
 * Article III — Trial engine. Jeff Ray presides.
 *
 * The court convenes when any member calls a trial from a voice channel
 * holding at least TRIAL_MIN_USERS humans (any role). Everyone present
 * except the defendant is impaneled as a juror. Jeff Ray is the judge:
 * he runs proceedings, breaks deadlocks, and executes sentencing on a
 * guilty verdict.
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
 * Check trial conditions: starter in a VC with at least minUsers humans.
 * @param {import('discord.js').GuildMember} starter
 * @param {number} minUsers — minimum humans (any role) in the VC
 * @returns {{ok: boolean, reason?: string, voiceChannel?: any, humans?: any[]}}
 */
function checkConditions(starter, minUsers) {
  const voiceChannel = starter.voice?.channel;
  if (!voiceChannel) {
    return {
      ok: false,
      reason: 'The court convenes in voice. Join a voice channel to call a trial.',
    };
  }

  const humans = [...voiceChannel.members.values()].filter((m) => !m.user.bot);

  if (humans.length < minUsers) {
    return {
      ok: false,
      reason:
        `A trial requires at least ${minUsers} members present in the voice channel. ` +
        `Currently in ${voiceChannel}: ${humans.length}.`,
      voiceChannel,
      humans,
    };
  }

  return { ok: true, voiceChannel, humans };
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
