'use strict';

const { MessageFlags } = require('discord.js');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    const client = interaction.client;

    try {
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        await command.execute(interaction);
        return;
      }

      if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (command?.autocomplete) await command.autocomplete(interaction);
        return;
      }

      if (interaction.isButton()) {
        // customId convention: "<commandName>:<...args>"
        const [commandName] = interaction.customId.split(':');
        const command = client.commands.get(commandName);
        if (command?.handleButton) await command.handleButton(interaction);
        return;
      }
    } catch (err) {
      console.error(`Error handling interaction (${interaction.commandName || interaction.customId}):`, err);
      const payload = {
        content: 'The court encountered a procedural error. The clerk has been notified.',
        flags: MessageFlags.Ephemeral,
      };
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(payload);
        } else if (interaction.isRepliable()) {
          await interaction.reply(payload);
        }
      } catch {
        /* interaction expired — nothing to do */
      }
    }
  },
};
