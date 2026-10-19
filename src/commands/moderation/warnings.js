const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const theme = require('../../utils/theme');
const db = require('../../utils/database');
const { sendModLog } = require('../../utils/antiSpam');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View or clear formal moderation warnings for a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName('view')
        .setDescription('View the warning history for a member')
        .addUserOption(opt =>
          opt
            .setName('target')
            .setDescription('The member whose warnings to inspect')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('clear')
        .setDescription('Clear all warnings for a member')
        .addUserOption(opt =>
          opt
            .setName('target')
            .setDescription('The member whose warnings to clear')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('target');

    if (subcommand === 'view') {
      const warnings = db.getUserWarnings(interaction.guild.id, targetUser.id);

      if (warnings.length === 0) {
        return interaction.reply({
          content: `ℹ️ **${targetUser.tag}** has no recorded warnings in this server.`,
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(`📋 Warnings for ${targetUser.tag}`)
        .setColor(theme.colors.warning)
        .setDescription(`Found **${warnings.length}** warning(s) on record for <@${targetUser.id}>:`)
        .setFooter({ text: theme.footers.standard });

      // Show up to the last 15 warnings
      const recent = warnings.slice(0, 15);
      for (const w of recent) {
        embed.addFields({
          name: `⚠️ Warning #${w.id} — <t:${Math.floor(w.created_at / 1000)}:d>`,
          value:
            `• **Reason:** ${w.reason}\n` +
            `• **Moderator:** ${w.moderator_tag} (<@${w.moderator_id}>)\n` +
            `• **Time:** <t:${Math.floor(w.created_at / 1000)}:R>`,
          inline: false
        });
      }

      return interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }

    if (subcommand === 'clear') {
      // Clearing warnings requires ManageMessages or ManageGuild
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) &&
          !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: '❌ You need `Manage Server` permission to clear member warnings.',
          ephemeral: true
        });
      }

      const existing = db.getUserWarnings(interaction.guild.id, targetUser.id);
      if (existing.length === 0) {
        return interaction.reply({
          content: `ℹ️ **${targetUser.tag}** has no warnings to clear.`,
          ephemeral: true
        });
      }

      db.clearUserWarnings(interaction.guild.id, targetUser.id);
      logger.mod(`${interaction.user.tag} cleared ${existing.length} warnings for ${targetUser.tag}`);

      await sendModLog(interaction.guild, {
        action: '🧹 Warnings Cleared',
        target: `${targetUser.tag} (${targetUser.id})`,
        moderator: `${interaction.user.tag} (${interaction.user.id})`,
        reason: `Cleared all previous warnings`,
        actionTaken: `Removed ${existing.length} warning record(s)`,
        color: theme.colors.info
      });

      return interaction.reply({
        content: `✅ Successfully cleared **${existing.length}** warning(s) for **${targetUser.tag}**.`,
        ephemeral: true
      });
    }
  }
};
