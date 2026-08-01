'use strict';

const oracleAnswers = ['yes', 'no', 'perhaps'];

const oracleReasons = {
  yes: [
    'because the vibes are immaculate.',
    'because Jeff Ray P. has spoken.',
    'because destiny is on your side.',
    'because even RNG could not say no to that.',
    'because the timeline where you lose was deleted.',
  ],
  no: [
    'because that would break the sacred JRP timeline.',
    'because the universe said no.',
    'because your luck stat is currently at 3.',
    'because Jeff Ray revoked that request.',
    'because even Game Pass cannot save that idea.',
  ],
  perhaps: [
    'because the outcome is clouded.',
    'because it depends on who is in the lobby.',
    'because the prophecy has not finished downloading.',
    'because even Jeff Ray is still thinking about it.',
    'because the JRP courts are still in recess.',
  ],
};

const roasts = [
  'is living proof that ping is not the only reason we lose.',
  'just queued up and instantly lowered team morale.',
  'has the aim of a stormtrooper and the confidence of a pro.',
  'tries their best, and that is the scary part.',
  'got carried so hard they should pay baggage fees.',
  'has Wi-Fi powered by hopes and prayers.',
  'is the reason the mute button exists.',
  'could sell that performance as a tutorial on what not to do.',
];

const compliments = [
  'is the backbone of this server.',
  'has main-character energy every time they join.',
  'makes the lobby better just by showing up.',
  'could hard-carry even with a bad connection.',
  'has S-tier vibes.',
  'is the kind of friend you actually queue ranked with.',
  'improves the mood more than any patch note.',
  'is proof that the JRP buff is real.',
];

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = { oracleAnswers, oracleReasons, roasts, compliments, getRandom };
