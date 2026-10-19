const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { sendModLog } = require('../../utils/antiSpam');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Remove a timeout from a member in the OlflazMC server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption(option =>
      option
        .setName('target')
        .setDescription('The member to remove timeout from')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for removing timeout')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'Timeout removed by moderator';
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      return interaction.reply({
        content: '❌ That user is not currently in this server.',
        ephemeral: true
      });
    }

    if (!targetMember.isCommunicationDisabled()) {
      return interaction.reply({
        content: '❌ That member is not currently timed out.',
        ephemeral: true
      });
    }

    if (!targetMember.moderatable) {
      return interaction.reply({
        content: '❌ I cannot modify that member. Their role is higher than mine or I lack permissions.',
        ephemeral: true
      });
    }

    try {
      await targetMember.timeout(null, `${interaction.user.tag}: ${reason}`);
      logger.mod(`${interaction.user.tag} removed timeout from ${targetUser.tag}.`);

      await sendModLog(interaction.guild, {
        action: '🔓 Member Timeout Removed',
        target: `${targetUser.tag} (${targetUser.id})`,
        moderator: `${interaction.user.tag} (${interaction.user.id})`,
        reason,
        actionTaken: 'Timeout lifted',
        color: config.colors.success
      });

      const embed = new EmbedBuilder()
        .setTitle('🔓 Timeout Removed')
        .setColor(config.colors.success)
        .setDescription(`Successfully removed timeout from **${targetUser.tag}**.`)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      logger.error(`Error untiming out ${targetUser.tag}: ${err.message}`);
      return interaction.reply({
        content: `❌ Failed to remove timeout: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
