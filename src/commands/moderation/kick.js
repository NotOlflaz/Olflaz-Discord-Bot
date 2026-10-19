const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { sendModLog } = require('../../utils/antiSpam');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the OlflazMC server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDMPermission(false)
    .addUserOption(option =>
      option
        .setName('target')
        .setDescription('The member to kick')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('The reason for kicking this member')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      return interaction.reply({
        content: '❌ That user is not currently in this server.',
        ephemeral: true
      });
    }

    if (targetMember.id === interaction.user.id) {
      return interaction.reply({
        content: '❌ You cannot kick yourself.',
        ephemeral: true
      });
    }

    if (targetMember.id === interaction.guild.ownerId) {
      return interaction.reply({
        content: '❌ You cannot kick the server owner.',
        ephemeral: true
      });
    }

    // Role hierarchy checks
    if (interaction.member.roles.highest.position <= targetMember.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({
        content: '❌ You cannot kick a member with an equal or higher role than yours.',
        ephemeral: true
      });
    }

    if (!targetMember.kickable) {
      return interaction.reply({
        content: '❌ I cannot kick that member. Their role is higher than mine or I lack permissions.',
        ephemeral: true
      });
    }

    try {
      // Optional DM to member before kicking
      await targetUser.send({
        content: `👢 You have been kicked from **${interaction.guild.name}**.\n**Reason:** ${reason}`
      }).catch(() => {});

      await targetMember.kick(`${interaction.user.tag}: ${reason}`);
      logger.mod(`${interaction.user.tag} kicked ${targetUser.tag}. Reason: ${reason}`);

      // Mod log
      await sendModLog(interaction.guild, {
        action: '👢 Member Kicked',
        target: `${targetUser.tag} (${targetUser.id})`,
        moderator: `${interaction.user.tag} (${interaction.user.id})`,
        reason,
        actionTaken: 'Kicked from server',
        color: config.colors.warning
      });

      const embed = new EmbedBuilder()
        .setTitle('👢 Member Kicked')
        .setColor(config.colors.warning)
        .setDescription(`Successfully kicked **${targetUser.tag}**.\n**Reason:** ${reason}`)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      logger.error(`Error kicking ${targetUser.tag}: ${err.message}`);
      return interaction.reply({
        content: `❌ Failed to kick member: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
