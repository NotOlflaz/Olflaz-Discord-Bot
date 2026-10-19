const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { sendModLog } = require('../../utils/antiSpam');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Bulk delete messages from the current channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('Number of messages to delete (1 to 100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .addUserOption(option =>
      option
        .setName('target')
        .setDescription('Only delete messages sent by this specific user')
        .setRequired(false)
    ),

  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');
    const targetUser = interaction.options.getUser('target');
    const channel = interaction.channel;

    await interaction.deferReply({ ephemeral: true });

    try {
      let messages = await channel.messages.fetch({ limit: amount });

      if (targetUser) {
        messages = messages.filter(m => m.author.id === targetUser.id);
      }

      if (messages.size === 0) {
        return interaction.editReply({
          content: '⚠️ No matching messages found to delete (or messages are older than 14 days).'
        });
      }

      const deleted = await channel.bulkDelete(messages, true);
      logger.mod(`${interaction.user.tag} cleared ${deleted.size} messages in #${channel.name}`);

      await sendModLog(interaction.guild, {
        action: '🧹 Messages Cleared',
        target: targetUser ? `${targetUser.tag}` : 'All Users',
        moderator: `${interaction.user.tag}`,
        reason: `Channel purge in #${channel.name}`,
        actionTaken: `Deleted ${deleted.size} message(s)`,
        color: config.colors.info
      });

      const embed = new EmbedBuilder()
        .setTitle('🧹 Messages Cleared')
        .setColor(config.colors.success)
        .setDescription(
          `Successfully deleted **${deleted.size}** message(s) in <#${channel.id}>` +
          (targetUser ? ` from **${targetUser.tag}**.` : '.')
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error(`Error clearing messages: ${err.message}`);
      return interaction.editReply({
        content: `❌ Could not delete messages: ${err.message}`
      });
    }
  }
};
