'use strict';

const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, '..', '..', 'jrp_registry.json');

// Load once at startup; every mutation flushes to disk atomically
// (write temp file, then rename). This removes the read-modify-write race
// the old implementation had on every command.
let registry = null;

function load() {
  if (registry) return registry;
  try {
    registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch {
    registry = {};
  }
  return registry;
}

function flush() {
  try {
    const tmp = `${REGISTRY_PATH}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(registry, null, 2), 'utf8');
    fs.renameSync(tmp, REGISTRY_PATH);
  } catch (err) {
    console.error('Error saving registry:', err);
  }
}

function getEntry(userId) {
  return load()[userId] || null;
}

function ensureEntry(user) {
  const reg = load();
  if (!reg[user.id]) {
    reg[user.id] = {
      userId: user.id,
      username: user.username,
      totalYears: 0,
      cases: 0,
      history: [],
    };
  }
  const entry = reg[user.id];
  if (!Array.isArray(entry.history)) entry.history = [];
  entry.username = user.username;
  return entry;
}

/**
 * Record a case against a user.
 * @returns the updated entry
 */
function addCase(user, caseEntry) {
  const entry = ensureEntry(user);
  entry.totalYears += caseEntry.years;
  entry.cases += 1;
  entry.history.push(caseEntry);
  flush();
  return entry;
}

function expunge(userId) {
  const reg = load();
  if (!reg[userId]) return false;
  delete reg[userId];
  flush();
  return true;
}

function reduce(userId, years) {
  const entry = getEntry(userId);
  if (!entry) return null;
  const original = entry.totalYears;
  const applied = Math.min(years, original);
  entry.totalYears = original - applied;
  flush();
  return { original, applied, newTotal: entry.totalYears };
}

function overturnLast(userId) {
  const entry = getEntry(userId);
  if (!entry || !entry.history.length) return null;
  const lastCase = entry.history.pop();
  entry.totalYears = Math.max(0, entry.totalYears - lastCase.years);
  entry.cases = Math.max(0, entry.cases - 1);
  flush();
  return { lastCase, entry };
}

function topOffenders(limit) {
  return Object.values(load())
    .filter((e) => e.totalYears > 0)
    .sort((a, b) => b.totalYears - a.totalYears)
    .slice(0, limit);
}

module.exports = {
  getEntry,
  ensureEntry,
  addCase,
  expunge,
  reduce,
  overturnLast,
  topOffenders,
};
