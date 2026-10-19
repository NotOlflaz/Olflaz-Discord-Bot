const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { sendModLog } = require('../../utils/antiSpam');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the OlflazMC server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addUserOption(option =>
      option
        .setName('target')
        .setDescription('The user to ban')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('The reason for banning this user')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName('purge_days')
        .setDescription('Days of messages to delete (0 to 7)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const purgeDays = interaction.options.getInteger('purge_days') ?? 0;
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({
        content: '❌ You cannot ban yourself.',
        ephemeral: true
      });
    }

    if (targetUser.id === interaction.guild.ownerId) {
      return interaction.reply({
        content: '❌ You cannot ban the server owner.',
        ephemeral: true
      });
    }

    if (targetMember) {
      if (interaction.member.roles.highest.position <= targetMember.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
        return interaction.reply({
          content: '❌ You cannot ban a member with an equal or higher role than yours.',
          ephemeral: true
        });
      }

      if (!targetMember.bannable) {
        return interaction.reply({
          content: '❌ I cannot ban that member. Their role is higher than mine or I lack permissions.',
          ephemeral: true
        });
      }
    }

    try {
      // Optional DM notification
      await targetUser.send({
        content: `🔨 You have been banned from **${interaction.guild.name}**.\n**Reason:** ${reason}`
      }).catch(() => {});

      await interaction.guild.members.ban(targetUser.id, {
        deleteMessageSeconds: purgeDays * 86400,
        reason: `${interaction.user.tag}: ${reason}`
      });

      logger.mod(`${interaction.user.tag} banned ${targetUser.tag}. Reason: ${reason}`);

      // Mod log
      await sendModLog(interaction.guild, {
        action: '🔨 Member Banned',
        target: `${targetUser.tag} (${targetUser.id})`,
        moderator: `${interaction.user.tag} (${interaction.user.id})`,
        reason,
        actionTaken: `Banned (Purged ${purgeDays}d messages)`,
        color: config.colors.danger
      });

      const embed = new EmbedBuilder()
        .setTitle('🔨 Member Banned')
        .setColor(config.colors.danger)
        .setDescription(`Successfully banned **${targetUser.tag}**.\n**Reason:** ${reason}\n**Purged messages:** ${purgeDays} day(s)`)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      logger.error(`Error banning ${targetUser.tag}: ${err.message}`);
      return interaction.reply({
        content: `❌ Failed to ban user: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
