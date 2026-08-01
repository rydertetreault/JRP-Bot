'use strict';

const fs = require('fs');
const path = require('path');

const STATS_PATH = path.join(__dirname, '..', '..', 'jrp_vcstats.json');

/**
 * Persistent VC time stats, accumulated by a 60s sampling ticker.
 *
 * Shape:
 * {
 *   users: {
 *     [userId]: {
 *       totalMs: number,
 *       channels: { [channelId]: ms },   // favorite hangout
 *       partners: { [userId]: ms },      // co-presence time
 *     }
 *   },
 *   since: ISO string                     // when tracking began
 * }
 */

let cache = null;
let dirty = false;

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(STATS_PATH, 'utf8'));
  } catch {
    cache = { users: {}, since: new Date().toISOString() };
  }
  if (!cache.users) cache.users = {};
  if (!cache.since) cache.since = new Date().toISOString();
  return cache;
}

function flush() {
  if (!dirty) return;
  try {
    const tmp = `${STATS_PATH}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(load()), 'utf8');
    fs.renameSync(tmp, STATS_PATH);
    dirty = false;
  } catch (err) {
    console.error('Error saving VC stats:', err);
  }
}

function ensureUser(userId) {
  const s = load();
  if (!s.users[userId]) s.users[userId] = { totalMs: 0, channels: {}, partners: {} };
  return s.users[userId];
}

/**
 * Credit one sampling tick.
 * @param {{channelId: string, userIds: string[]}[]} rosters — non-bot, non-AFK
 * @param {number} ms — tick duration
 */
function tick(rosters, ms) {
  for (const { channelId, userIds } of rosters) {
    for (const uid of userIds) {
      const u = ensureUser(uid);
      u.totalMs += ms;
      u.channels[channelId] = (u.channels[channelId] || 0) + ms;
      for (const other of userIds) {
        if (other === uid) continue;
        u.partners[other] = (u.partners[other] || 0) + ms;
      }
    }
  }
  if (rosters.some((r) => r.userIds.length)) dirty = true;
}

function getUser(userId) {
  return load().users[userId] || null;
}

/** Rank of a user by total time (1-based), or null. */
function rankOf(userId) {
  const sorted = Object.entries(load().users).sort((a, b) => b[1].totalMs - a[1].totalMs);
  const idx = sorted.findIndex(([id]) => id === userId);
  return idx === -1 ? null : idx + 1;
}

function leaderboard(limit) {
  return Object.entries(load().users)
    .map(([userId, u]) => ({ userId, totalMs: u.totalMs }))
    .filter((e) => e.totalMs > 0)
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, limit);
}

/** Top co-presence pairs server-wide (deduped, a<b). */
function topDuos(limit) {
  const pairs = [];
  const users = load().users;
  for (const [uid, u] of Object.entries(users)) {
    for (const [pid, ms] of Object.entries(u.partners)) {
      if (uid < pid) pairs.push({ a: uid, b: pid, ms });
    }
  }
  return pairs.sort((x, y) => y.ms - x.ms).slice(0, limit);
}

/** Top partner for one user. */
function topPartner(userId) {
  const u = getUser(userId);
  if (!u) return null;
  const entries = Object.entries(u.partners).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;
  return { userId: entries[0][0], ms: entries[0][1] };
}

/** Favorite channel for one user. */
function favoriteChannel(userId) {
  const u = getUser(userId);
  if (!u) return null;
  const entries = Object.entries(u.channels).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;
  return { channelId: entries[0][0], ms: entries[0][1] };
}

function since() {
  return load().since;
}

/** "3d 4h 12m" style formatting. */
function formatMs(ms) {
  const minutes = Math.floor(ms / 60000);
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

module.exports = {
  tick,
  flush,
  getUser,
  rankOf,
  leaderboard,
  topDuos,
  topPartner,
  favoriteChannel,
  since,
  formatMs,
};
