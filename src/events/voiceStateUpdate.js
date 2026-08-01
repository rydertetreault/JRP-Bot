'use strict';

module.exports = {
  name: 'voiceStateUpdate',
  execute(oldState, newState) {
    const voicetrack = require('../lib/voicetrack');
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const oldCh = oldState.channelId;
    const newCh = newState.channelId;
    if (oldCh === newCh) return; // mute/deafen etc., not a move

    if (oldCh) voicetrack.onLeave(oldCh, member.id);
    if (newCh) voicetrack.onJoin(newCh, member.id);
  },
};
