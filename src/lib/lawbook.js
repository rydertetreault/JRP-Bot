'use strict';

/**
 * JRP Bill of Rights — full text, structured for /lawbook.
 * Source: "JRP - Bill of Rights.pdf" (Jeff Ray P Server).
 */

const PREAMBLE =
  'Here we abide by laws set by the common JRP, no JRP is above any law. ' +
  'These laws are set to maintain peace, freedom, justice, and security to our empire. ' +
  'Any infractions of these laws will result in duly acted punishment, in which sentencing ' +
  'will match crime enacted. We hold these laws imperative to uphold the prosperity of our empire.\n\n' +
  '_"For the JRP, by the JRP."_';

const LAWBOOK = [
  {
    id: 'preamble',
    title: 'Preamble',
    text: PREAMBLE,
  },
  {
    id: 'art1s1',
    title: 'Article I §1 — Setting: Locale',
    text:
      'All instances that are deemed reviewable for sentencing must occur in the JRP discord, ' +
      'otherwise the instance occurred is null.',
  },
  {
    id: 'art2s1',
    title: 'Article II §1 — Evidence',
    text: 'Eye witness accounts are not sufficient evidence for prosecution or guilt.',
  },
  {
    id: 'art2s2',
    title: 'Article II §2 — Evidence: Deletion',
    text:
      'Clipping will only be admissible when the sole judicial figure is present and active in a ' +
      'JRP voice channel and only when language is not heard. Must be deleted once reviewed for ' +
      'a sentence to be levied.',
  },
  {
    id: 'art3s1',
    title: 'Article III §1 — Trial: Conditions',
    text:
      'Trial shall only take place if judicial figure deems suitable in which the situation must ' +
      'satisfy three conditions:\n' +
      '**A.** Judicial Figure must be present in an active voice channel.\n' +
      '**B.** Must be three JRPs, outside of the judicial party, present to enact the trial.\n' +
      '**C.** Evidence given must follow laws written within the section of Article II.',
  },
  {
    id: 'art3s2',
    title: 'Article III §2 — Trial: Proceedings',
    text:
      'Once trial is enacted, each member shall verbally declare their position on the instance ' +
      'under review. After declaration of positions, trial will begin. Opening statements are ' +
      'given to each side starting with the side of the winning coin flip. Opening statements ' +
      'will be held to a strict time limit of **two minutes**. Following opening statements the ' +
      'judicial party will ask for evidence and witnesses to be identified for each party. ' +
      'Evidence and/or witnesses will be given one at a time and each side will have their ' +
      'chance to talk about the subject with the loser of the coin toss having priority. Once ' +
      'all has been discussed the judicial party will make a decision based on the sections ' +
      'found in Article IV.',
  },
  {
    id: 'art3s3',
    title: 'Article III §3 — Trial: Etiquette',
    text:
      'All JRPs present and active in trial are expected to hold themselves to a standard which ' +
      'requires each member to act properly within the trial. Behaviors that work to undermine ' +
      'the integrity of the trial will be considered contempt of trial and receive a penalty ' +
      'discussed in sections under Article V.',
  },
  {
    id: 'art4s1',
    title: 'Article IV §1 — Sentencing: Standards and Limitations',
    text:
      'Sentences shall be held to a maximum that shall not be infringed by the judicial party. ' +
      'Each sentence will be fitting to the committed misconduct. Furthermore, instances ' +
      'committed must be present within sections listed below to receive sentencing.',
  },
  {
    id: 'art4s2',
    title: 'Article IV §2 — Classification of Misconduct',
    text:
      'Sentences shall be levied to each category of offenses listed below.\n\n' +
      '**Part A** — Words not suitable for the public ear but not against a JRP Member:\n' +
      '• Tier 1: Slang use of slur but not as a pejorative. (1–5 yrs)\n' +
      '• Tier 2: Slang use of slur as a pejorative. (5–10 yrs)\n' +
      '• Tier 3: Multiple slang uses of slur as a pejorative. (10–20 yrs)\n\n' +
      '**Part B** — Words not suitable for the public ear used against a JRP Member:\n' +
      '• Tier 1: Slang use of slur as a pejorative. (15–25 yrs)\n' +
      '• Tier 2: Multiple slang uses of slur as a pejorative. (20–30 yrs)\n' +
      '• Tier 3: Continued abuse of slur greater than five. (25–100 yrs)',
  },
  {
    id: 'art4s3',
    title: 'Article IV §3 — Interpretation of Severe Misconduct',
    text:
      'For tier three instances in Part B of Section 2 in Article IV it is required for slur to ' +
      'be used **more than five times** in negatively charged nature to be sentenced. Slurs used ' +
      'more than five times are subject to counts that are **twenty-five years per use**.\n\n' +
      'Judicial Party will be held to precedences set by previous trials held that will be ' +
      'worded into case law.',
  },
  {
    id: 'art5s1',
    title: 'Article V §1 — Forms of Penalties',
    text:
      'Contempt, Gaslighting, Baiting, Fraud, Begging judicial party for sentencing.\n\n' +
      '*If evidence is overwhelming the judicial party can veto the trial and go straight to ' +
      'sentencing.*',
  },
];

function findEntry(id) {
  return LAWBOOK.find((e) => e.id === id) || null;
}

function search(query) {
  const q = query.toLowerCase();
  return LAWBOOK.filter(
    (e) => e.title.toLowerCase().includes(q) || e.text.toLowerCase().includes(q)
  );
}

module.exports = { LAWBOOK, findEntry, search };
