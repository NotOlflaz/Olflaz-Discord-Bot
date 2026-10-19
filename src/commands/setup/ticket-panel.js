const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');
const { getStarterMessagePayload } = require('../../utils/starterMessages');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-panel')
    .setDescription('Deploy or refresh the interactive ticket creation panel with buttons')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addChannelOption(opt =>
      opt
        .setName('channel')
        .setDescription('Channel to post the ticket panel into (defaults to current channel)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const payload = getStarterMessagePayload('ticket-panel', interaction.guild);

    if (!payload) {
      return interaction.reply({
        content: '❌ Could not generate the ticket panel payload.',
        ephemeral: true
      });
    }

    try {
      await targetChannel.send(payload);
      return interaction.reply({
        content: `✅ Successfully deployed the interactive ticket panel to ${targetChannel}!`,
        ephemeral: true
      });
    } catch (err) {
      logger.error(`Failed to post ticket panel: ${err.message}`);
      return interaction.reply({
        content: `❌ Could not send ticket panel to ${targetChannel}: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
