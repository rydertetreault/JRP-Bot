'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { deriveTier, computeSentence } = require('../src/lib/sentencing');

// Deterministic RNG: always returns min so ranges are verifiable.
const minRng = (min) => min;
const maxRng = (min, max) => max;

test('Category A, non-pejorative → Tier 1 (1–5 yrs)', () => {
  assert.strictEqual(deriveTier('A', false, 1).tier, 1);
  assert.strictEqual(deriveTier('A', false, 10).tier, 1); // no aggravated non-pejorative tier
  const s1 = computeSentence('A', false, 1, { rng: minRng });
  const s2 = computeSentence('A', false, 1, { rng: maxRng });
  assert.strictEqual(s1.years, 1);
  assert.strictEqual(s2.years, 5);
});

test('Category A, single pejorative use → Tier 2 (5–10 yrs)', () => {
  assert.strictEqual(deriveTier('A', true, 1).tier, 2);
  assert.strictEqual(computeSentence('A', true, 1, { rng: minRng }).years, 5);
  assert.strictEqual(computeSentence('A', true, 1, { rng: maxRng }).years, 10);
});

test('Category A, multiple pejorative uses → Tier 3 (10–20 yrs)', () => {
  assert.strictEqual(deriveTier('A', true, 2).tier, 3);
  assert.strictEqual(computeSentence('A', true, 3, { rng: minRng }).years, 10);
  assert.strictEqual(computeSentence('A', true, 3, { rng: maxRng }).years, 20);
});

test('Category B, single use → Tier 1 (15–25 yrs)', () => {
  assert.strictEqual(deriveTier('B', true, 1).tier, 1);
  assert.strictEqual(computeSentence('B', true, 1, { rng: minRng }).years, 15);
  assert.strictEqual(computeSentence('B', true, 1, { rng: maxRng }).years, 25);
});

test('Category B, 2–5 uses → Tier 2 (20–30 yrs)', () => {
  for (const count of [2, 3, 4, 5]) {
    assert.strictEqual(deriveTier('B', true, count).tier, 2, `count=${count}`);
  }
  assert.strictEqual(computeSentence('B', true, 5, { rng: minRng }).years, 20);
  assert.strictEqual(computeSentence('B', true, 5, { rng: maxRng }).years, 30);
});

test('Category B, >5 uses → Tier 3, Art. IV §3: 25 years per use', () => {
  assert.strictEqual(deriveTier('B', true, 6).tier, 3);
  assert.strictEqual(computeSentence('B', true, 6).years, 150);
  assert.strictEqual(computeSentence('B', true, 10).years, 250);
});

test('Art. IV §3 boundary: exactly 5 uses is NOT Tier 3', () => {
  // "required for slur to be used more than five times"
  assert.notStrictEqual(deriveTier('B', true, 5).tier, 3);
});

test('invalid inputs throw', () => {
  assert.throws(() => computeSentence('C', true, 1));
  assert.throws(() => computeSentence('A', true, 0));
  assert.throws(() => computeSentence('A', true, 1.5));
});

test('basis cites Article IV', () => {
  assert.match(computeSentence('B', true, 7).basis, /Art\. IV §3/);
  assert.match(computeSentence('A', false, 1).basis, /Art\. IV §2\.A Tier 1/);
});
