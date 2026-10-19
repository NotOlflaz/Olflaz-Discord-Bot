const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const ms = require('ms');
const config = require('../../config');
const { sendModLog } = require('../../utils/antiSpam');
const logger = require('../../utils/logger');

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // Discord limit: 28 days

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout (mute) a member in the OlflazMC server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption(option =>
      option
        .setName('target')
        .setDescription('The member to timeout')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('duration')
        .setDescription('Duration of timeout (e.g., 5m, 1h, 1d, 7d)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for the timeout')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('target');
    const durationInput = interaction.options.getString('duration');
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
        content: '❌ You cannot timeout yourself.',
        ephemeral: true
      });
    }

    if (targetMember.id === interaction.guild.ownerId) {
      return interaction.reply({
        content: '❌ You cannot timeout the server owner.',
        ephemeral: true
      });
    }

    // Parse duration
    let durationMs;
    try {
      durationMs = ms(durationInput);
    } catch {
      durationMs = null;
    }

    if (!durationMs || typeof durationMs !== 'number' || durationMs < 5000 || durationMs > MAX_TIMEOUT_MS) {
      return interaction.reply({
        content: '❌ Invalid duration. Please provide a valid duration between `5s` and `28d` (e.g. `10m`, `2h`, `1d`).',
        ephemeral: true
      });
    }

    if (interaction.member.roles.highest.position <= targetMember.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({
        content: '❌ You cannot timeout a member with an equal or higher role than yours.',
        ephemeral: true
      });
    }

    if (!targetMember.moderatable) {
      return interaction.reply({
        content: '❌ I cannot timeout that member. Their role is higher than mine or I lack permissions.',
        ephemeral: true
      });
    }

    try {
      await targetMember.timeout(durationMs, `${interaction.user.tag}: ${reason}`);
      logger.mod(`${interaction.user.tag} timed out ${targetUser.tag} for ${durationInput}. Reason: ${reason}`);

      // Mod log
      await sendModLog(interaction.guild, {
        action: '⏳ Member Timed Out',
        target: `${targetUser.tag} (${targetUser.id})`,
        moderator: `${interaction.user.tag} (${interaction.user.id})`,
        reason,
        actionTaken: `Timed out for ${durationInput}`,
        color: config.colors.warning
      });

      const embed = new EmbedBuilder()
        .setTitle('⏳ Member Timed Out')
        .setColor(config.colors.warning)
        .setDescription(`Successfully timed out **${targetUser.tag}** for **${durationInput}**.\n**Reason:** ${reason}`)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      logger.error(`Error timing out ${targetUser.tag}: ${err.message}`);
      return interaction.reply({
        content: `❌ Failed to timeout member: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
