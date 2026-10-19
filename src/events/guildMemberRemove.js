const { AuditLogEvent } = require('discord.js');
const { logModerationAction, fetchAuditLogEntry } = require('../utils/modLogger');
const theme = require('../utils/theme');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    if (!member || !member.guild) return;

    try {
      // 1. Check if member was kicked via audit log
      const kickEntry = await fetchAuditLogEntry(
        member.guild,
        AuditLogEvent.MemberKick,
        member.id
      );

      if (kickEntry) {
        return await logModerationAction(member.guild, {
          action: '👢 Member Kicked',
          targetUser: member.user,
          moderator: kickEntry.executor,
          reason: kickEntry.reason || 'No reason specified in audit log',
          actionTaken: 'Kicked from server',
          color: theme.colors.warning
        });
      }

      // 2. Check if member was banned via audit log
      const banEntry = await fetchAuditLogEntry(
        member.guild,
        AuditLogEvent.MemberBanAdd,
        member.id
      );

      if (banEntry) {
        return await logModerationAction(member.guild, {
          action: '🔨 Member Banned',
          targetUser: member.user,
          moderator: banEntry.executor,
          reason: banEntry.reason || 'No reason specified in audit log',
          actionTaken: 'Banned from server',
          color: theme.colors.danger
        });
      }

      // 3. Otherwise member left voluntarily
      const joinedAtStr = member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown';
      await logModerationAction(member.guild, {
        action: '👋 Member Left Server',
        targetUser: member.user,
        moderator: null,
        reason: 'Voluntary leave',
        actionTaken: 'Left server',
        color: 0x95A5A6,
        fields: [
          { name: '📥 Joined Server', value: joinedAtStr, inline: true },
          { name: '👥 Member Count', value: `#${member.guild.memberCount}`, inline: true }
        ]
      });
    } catch {}
  }
};
