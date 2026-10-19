const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const theme = require('../../utils/theme');
const db = require('../../utils/database');
const { sendModLog } = require('../../utils/antiSpam');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a formal warning to a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption(option =>
      option
        .setName('target')
        .setDescription('The member to warn')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('The reason for this warning')
        .setRequired(true)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason');
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({
        content: '❌ You cannot warn yourself.',
        ephemeral: true
      });
    }

    if (targetUser.bot) {
      return interaction.reply({
        content: '❌ You cannot warn a bot.',
        ephemeral: true
      });
    }

    if (targetMember) {
      if (targetMember.id === interaction.guild.ownerId) {
        return interaction.reply({
          content: '❌ You cannot warn the server owner.',
          ephemeral: true
        });
      }

      if (
        interaction.user.id !== interaction.guild.ownerId &&
        targetMember.roles.highest.position >= interaction.member.roles.highest.position
      ) {
        return interaction.reply({
          content: '❌ You cannot warn a member with an equal or higher role than yours.',
          ephemeral: true
        });
      }
    }

    // Persist warning in SQLite database
    const warningId = db.addWarning({
      guildId: interaction.guild.id,
      userId: targetUser.id,
      userTag: targetUser.tag,
      moderatorId: interaction.user.id,
      moderatorTag: interaction.user.tag,
      reason
    });

    const userWarnings = db.getUserWarnings(interaction.guild.id, targetUser.id);

    // Try sending DM to user
    let dmDelivered = true;
    try {
      await targetUser.send({
        content: `⚠️ **Official Warning from ${interaction.guild.name}**\n**Reason:** ${reason}\n*Warning #${userWarnings.length}. Please abide by our community rules to avoid a timeout or ban.*`
      });
    } catch {
      dmDelivered = false;
    }

    logger.mod(`${interaction.user.tag} warned ${targetUser.tag}. Reason: ${reason} (Total warnings: ${userWarnings.length})`);

    // Mod log
    await sendModLog(interaction.guild, {
      action: '⚠️ Formal Warning Issued',
      target: `${targetUser.tag} (${targetUser.id})`,
      moderator: `${interaction.user.tag} (${interaction.user.id})`,
      reason,
      actionTaken: `Warning #${userWarnings.length} logged (${dmDelivered ? 'DM sent' : 'DM blocked'})`,
      color: theme.colors.warning
    });

    const embed = new EmbedBuilder()
      .setTitle('⚠️ Formal Warning Issued')
      .setColor(theme.colors.warning)
      .setDescription(
        `Issued formal warning to **${targetUser.tag}**.\n\n` +
        `• **Reason:** ${reason}\n` +
        `• **Total Warnings:** \`${userWarnings.length}\`\n` +
        `• **User DM Status:** ${dmDelivered ? '✅ Delivered' : '⚠️ User has DMs disabled'}`
      )
      .setFooter({ text: theme.footers.standard })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
