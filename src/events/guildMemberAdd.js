'use strict';

const { PermissionsBitField } = require('discord.js');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    try {
      let channel = member.guild.systemChannel;

      if (!channel) {
        channel = member.guild.channels.cache.find(
          (ch) =>
            ch.isTextBased() &&
            ch.viewable &&
            ch
              .permissionsFor(member.guild.members.me)
              ?.has(PermissionsBitField.Flags.SendMessages)
        );
      }

      if (!channel) return;

      await channel.send(
        `Welcome to the empire, ${member}. "For the JRP, by the JRP."\n` +
          `Consult the law with \`/lawbook\`, ask the oracle with \`/askjrp\`, and mind ` +
          `Article IV — the Judicial Party is always watching. (\`/record\` shows your rap sheet.)`
      );
    } catch (err) {
      console.error('Error sending welcome message:', err);
    }
  },
};
