'use strict';

/**
 * Voice presence tracker.
 *
 * Jeff Ray cannot (and should not) transcribe what people say in VC — but he
 * CAN know exactly who was present, in which channel, at any moment. That is
 * precisely the context the Bill of Rights cares about:
 *
 *  - Art. II §1: eye witness accounts are not sufficient — so VC reports are
 *    filed to the docket as ALLEGATIONS with the live roster attached, never
 *    auto-sentenced.
 *  - Art. II §2: clips are admissible only when the judicial figure was
 *    present in the VC — Jeff Ray records whether that was true at report time.
 *
 * In-memory session log: channelId -> Map<userId, joinedAt>.
 */

const sessions = new Map(); // channelId -> Map<userId, joinTimestamp>

function onJoin(channelId, userId) {
  if (!sessions.has(channelId)) sessions.set(channelId, new Map());
  sessions.get(channelId).set(userId, Date.now());
}

function onLeave(channelId, userId) {
  const ch = sessions.get(channelId);
  if (!ch) return;
  ch.delete(userId);
  if (ch.size === 0) sessions.delete(channelId);
}

/** Current roster of a channel from live tracking. */
function roster(channelId) {
  const ch = sessions.get(channelId);
  if (!ch) return [];
  return [...ch.entries()].map(([userId, joinedAt]) => ({ userId, joinedAt }));
}

/** Seed state at startup from cached voice states (bot restart mid-session). */
function seedFromGuild(guild) {
  for (const [, vs] of guild.voiceStates.cache) {
    if (vs.channelId && vs.member && !vs.member.user.bot) {
      onJoin(vs.channelId, vs.id);
    }
  }
}

module.exports = { onJoin, onLeave, roster, seedFromGuild };
