'use strict';

const _path = require('path');
// Load .env, and fall back to env.txt (Discloud strips dotfiles like .env from uploads)
require('dotenv').config({ path: _path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: _path.join(__dirname, '..', 'env.txt') });

const required = ['TOKEN', 'CLIENT_ID', 'GUILD_ID'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in .env`);
    process.exit(1);
  }
}

module.exports = {
  TOKEN: process.env.TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  GUILD_ID: process.env.GUILD_ID,

  // Channels (Jeff Ray P server)
  COURT_CHANNEL_ID: process.env.COURT_CHANNEL_ID || null, // court-transcripts
  SENTENCING_CHANNEL_ID: process.env.SENTENCING_CHANNEL_ID || '1447091280394846278',
  BILL_OF_RIGHTS_CHANNEL_ID: process.env.BILL_OF_RIGHTS_CHANNEL_ID || '1447092187287523378',

  // Roles
  // Only members holding a judicial role may sentence, penalize, run trials,
  // or wipe records (expunge / reduce / overturn).
  JUDICIAL_ROLE_IDS: (process.env.JUDICIAL_ROLE_IDS || '1261610967717122110') // 𝙅𝙍𝙋𝙨
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // Members counted as "JRPs" for Article III quorum purposes.
  JRP_ROLE_ID: process.env.JRP_ROLE_ID || '1261610967717122110',

  // Jurors required besides the judge (Art. III §1.B as written says three;
  // the court operates with a reduced bench by decree of the LORD).
  // Default 1 → a trial works with just judge + 1 juror in VC.
  TRIAL_QUORUM: parseInt(process.env.TRIAL_QUORUM || '1', 10),

  // Channels excluded from VC stat tracking (AFK etc.)
  VC_STATS_EXCLUDED_CHANNELS: (process.env.VC_STATS_EXCLUDED_CHANNELS || '944297000847954013') // 𝘼𝙁𝙆💤
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  COLORS: {
    VERDICT: 0xc0392b, // red — sentences
    MERCY: 0x27ae60, // green — reductions, expungements, acquittals
    GOLD: 0xf1c40f, // leaderboard
    ORACLE: 0x8e44ad, // askjrp
    NEUTRAL: 0x2c3e50, // records / casefiles
    TRIAL: 0x2980b9, // trials
    LAW: 0xd35400, // lawbook
  },
};
