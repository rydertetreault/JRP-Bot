'use strict';

const fs = require('fs');
const path = require('path');

const DOCKET_PATH = path.join(__dirname, '..', '..', 'jrp_docket.json');

/**
 * The Docket — pending incident reports awaiting judicial review.
 *
 * Incidents are NOT sentences. They are alleged violations of the Bill of
 * Rights, filed by a JRP witnessing
 * misconduct in a voice channel. The Judicial Party reviews the docket and
 * either charges (→ /sentence) or dismisses each incident.
 */

let cache = null;

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(DOCKET_PATH, 'utf8'));
  } catch {
    cache = { nextId: 1, incidents: [] };
  }
  return cache;
}

function flush() {
  try {
    const tmp = `${DOCKET_PATH}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(cache, null, 2), 'utf8');
    fs.renameSync(tmp, DOCKET_PATH);
  } catch (err) {
    console.error('Error saving docket:', err);
  }
}

/**
 * File an incident.
 * @param {object} data
 *  - accusedId, accusedTag
 *  - source: 'text-auto' | 'vc-report'
 *  - description
 *  - reportedById / reportedByTag (or 'Jeff Ray (automatic)')
 *  - matchedTerms?: {term,count}[]         (text-auto)
 *  - messageLink?: string                  (text-auto)
 *  - channelId?: string
 *  - witnesses?: {id, username}[]          (vc-report: live VC roster)
 *  - judicialPresent?: boolean             (Art. II §2 admissibility signal)
 *  - suggestedCategory?: 'A' | 'B'
 */
function fileIncident(data) {
  const docket = load();
  const incident = {
    id: docket.nextId++,
    status: 'pending', // pending | charged | dismissed
    filedAt: new Date().toISOString(),
    ...data,
  };
  docket.incidents.push(incident);
  // keep the docket from growing unbounded — retain last 200 resolved
  const resolved = docket.incidents.filter((i) => i.status !== 'pending');
  if (resolved.length > 200) {
    const cutoff = resolved.slice(0, resolved.length - 200).map((i) => i.id);
    docket.incidents = docket.incidents.filter((i) => !cutoff.includes(i.id));
  }
  flush();
  return incident;
}

function getIncident(id) {
  return load().incidents.find((i) => i.id === id) || null;
}

function pending() {
  return load().incidents.filter((i) => i.status === 'pending');
}

function resolve(id, status, judgeTag) {
  const incident = getIncident(id);
  if (!incident || incident.status !== 'pending') return null;
  incident.status = status;
  incident.resolvedAt = new Date().toISOString();
  incident.resolvedBy = judgeTag;
  flush();
  return incident;
}

module.exports = { fileIncident, getIncident, pending, resolve };
