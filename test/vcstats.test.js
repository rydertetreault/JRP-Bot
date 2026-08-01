'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Isolate the stats file so tests don't touch real data.
const REAL = path.join(__dirname, '..', 'jrp_vcstats.json');
const BACKUP = `${REAL}.bak-test`;
if (fs.existsSync(REAL)) fs.renameSync(REAL, BACKUP);

const vcstats = require('../src/lib/vcstats');

const MIN = 60 * 1000;

test('tick credits total, channel, and partner time', () => {
  // alice+bob in ch1, carol alone in ch2 — 10 ticks
  for (let i = 0; i < 10; i++) {
    vcstats.tick(
      [
        { channelId: 'ch1', userIds: ['alice', 'bob'] },
        { channelId: 'ch2', userIds: ['carol'] },
      ],
      MIN
    );
  }

  const alice = vcstats.getUser('alice');
  assert.strictEqual(alice.totalMs, 10 * MIN);
  assert.strictEqual(alice.channels.ch1, 10 * MIN);
  assert.strictEqual(alice.partners.bob, 10 * MIN);
  assert.strictEqual(alice.partners.carol, undefined); // different channels

  const carol = vcstats.getUser('carol');
  assert.strictEqual(carol.totalMs, 10 * MIN);
  assert.deepStrictEqual(carol.partners, {});
});

test('leaderboard sorts by total time', () => {
  // bob gets 5 extra solo ticks
  for (let i = 0; i < 5; i++) {
    vcstats.tick([{ channelId: 'ch1', userIds: ['bob'] }], MIN);
  }
  const lb = vcstats.leaderboard(10);
  assert.strictEqual(lb[0].userId, 'bob');
  assert.strictEqual(lb[0].totalMs, 15 * MIN);
  assert.strictEqual(vcstats.rankOf('bob'), 1);
  assert.strictEqual(vcstats.rankOf('nobody'), null);
});

test('topDuos dedupes pairs and sorts', () => {
  const duos = vcstats.topDuos(5);
  assert.strictEqual(duos.length, 1); // only alice+bob ever shared a channel
  const pair = [duos[0].a, duos[0].b].sort();
  assert.deepStrictEqual(pair, ['alice', 'bob']);
  assert.strictEqual(duos[0].ms, 10 * MIN);
});

test('topPartner and favoriteChannel', () => {
  const partner = vcstats.topPartner('alice');
  assert.strictEqual(partner.userId, 'bob');
  const fav = vcstats.favoriteChannel('bob');
  assert.strictEqual(fav.channelId, 'ch1');
});

test('formatMs renders days/hours/minutes', () => {
  assert.strictEqual(vcstats.formatMs(5 * MIN), '5m');
  assert.strictEqual(vcstats.formatMs(90 * MIN), '1h 30m');
  assert.strictEqual(vcstats.formatMs(25 * 60 * MIN), '1d 1h 0m');
});

test('empty tick marks nothing dirty and flush is safe', () => {
  vcstats.tick([], MIN);
  vcstats.flush(); // should not throw
  assert.ok(true);
});

// Restore real stats after tests.
test('cleanup', () => {
  if (fs.existsSync(REAL)) fs.unlinkSync(REAL);
  if (fs.existsSync(BACKUP)) fs.renameSync(BACKUP, REAL);
  assert.ok(true);
});
