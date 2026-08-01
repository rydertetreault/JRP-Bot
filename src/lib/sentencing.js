'use strict';

/**
 * JRP Bill of Rights — Article IV: Sentencing
 *
 * Classification of Misconduct (Article IV, Section 2):
 *
 *  Part A — Words not suitable for the public ear, NOT against a JRP member.
 *    Tier 1: Slang use of slur but not as a pejorative.        (1–5 yrs)
 *    Tier 2: Slang use of slur as a pejorative.                (5–10 yrs)
 *    Tier 3: Multiple slang uses of slur as a pejorative.      (10–20 yrs)
 *
 *  Part B — Words not suitable for the public ear, USED AGAINST a JRP member.
 *    Tier 1: Slang use of slur as a pejorative.                (15–25 yrs)
 *    Tier 2: Multiple slang uses of slur as a pejorative.      (20–30 yrs)
 *    Tier 3: Continued abuse of slur greater than five.        (25–100 yrs)
 *
 * Interpretation of Severe Misconduct (Article IV, Section 3):
 *    B Tier 3 REQUIRES more than five pejorative uses, and each use is
 *    sentenced at twenty-five years per use.
 *
 * Tiers are therefore DERIVED from the facts (category, pejorative, count),
 * never chosen by hand — the old bot let judges pick contradictory
 * tier/count combinations, which Article IV forbids.
 */

const SENTENCING_TABLE = {
  A: {
    1: { range: [1, 5], text: 'Slang use of slur but not as a pejorative.' },
    2: { range: [5, 10], text: 'Slang use of slur as a pejorative.' },
    3: { range: [10, 20], text: 'Multiple slang uses of slur as a pejorative.' },
  },
  B: {
    1: { range: [15, 25], text: 'Slang use of slur as a pejorative.' },
    2: { range: [20, 30], text: 'Multiple slang uses of slur as a pejorative.' },
    3: { range: [25, 100], text: 'Continued abuse of slur greater than five.' },
  },
};

const CATEGORY_TEXT = {
  A: 'Words not suitable for the public ear, not directed at a JRP member (Art. IV §2.A).',
  B: 'Words not suitable for the public ear, used against a JRP member (Art. IV §2.B).',
};

/** Article V, Section 1 — Forms of Penalties (years are judicial discretion). */
const PENALTY_FORMS = [
  'Contempt of Trial',
  'Gaslighting',
  'Baiting',
  'Fraud',
  'Begging Judicial Party for Sentencing',
];

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Derive the tier from the facts of the case.
 *
 * @param {'A'|'B'} category
 * @param {boolean} pejorative — was the slur used as a pejorative?
 *   (Category B is inherently pejorative: the words were used AGAINST someone.)
 * @param {number} count — number of uses (>= 1)
 * @returns {{tier: number, basis: string}}
 */
function deriveTier(category, pejorative, count) {
  if (category === 'A') {
    if (!pejorative) {
      // The law defines no aggravated tier for non-pejorative use.
      return { tier: 1, basis: 'Art. IV §2.A Tier 1' };
    }
    if (count === 1) return { tier: 2, basis: 'Art. IV §2.A Tier 2' };
    return { tier: 3, basis: 'Art. IV §2.A Tier 3' };
  }

  // Category B — pejorative by definition.
  if (count === 1) return { tier: 1, basis: 'Art. IV §2.B Tier 1' };
  if (count <= 5) return { tier: 2, basis: 'Art. IV §2.B Tier 2' };
  // Art. IV §3: Tier 3 requires MORE than five uses.
  return { tier: 3, basis: 'Art. IV §2.B Tier 3, per Art. IV §3' };
}

/**
 * Compute a full sentence per the Bill of Rights.
 *
 * @param {'A'|'B'} category
 * @param {boolean} pejorative
 * @param {number} count
 * @param {{ rng?: (min:number,max:number)=>number }} [opts] injectable RNG for tests
 * @returns {{tier:number, years:number, basis:string, tierText:string, categoryText:string}}
 */
function computeSentence(category, pejorative, count, opts = {}) {
  if (!SENTENCING_TABLE[category]) throw new Error(`Unknown category: ${category}`);
  if (!Number.isInteger(count) || count < 1) throw new Error(`Invalid count: ${count}`);

  const rng = opts.rng || getRandomInt;
  const { tier, basis } = deriveTier(category, pejorative, count);
  const { range, text } = SENTENCING_TABLE[category][tier];

  let years;
  let fullBasis = basis;

  if (category === 'B' && tier === 3) {
    // Art. IV §3: twenty-five years per use.
    years = 25 * count;
    fullBasis = `${basis} — ${count} uses × 25 years per use.`;
  } else {
    years = rng(range[0], range[1]);
    fullBasis = `${basis} (${range[0]}–${range[1]} yrs).`;
  }

  return {
    tier,
    years,
    basis: fullBasis,
    tierText: text,
    categoryText: CATEGORY_TEXT[category],
  };
}

module.exports = {
  SENTENCING_TABLE,
  CATEGORY_TEXT,
  PENALTY_FORMS,
  deriveTier,
  computeSentence,
  getRandomInt,
};
