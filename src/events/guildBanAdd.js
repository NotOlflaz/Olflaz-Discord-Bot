const { AuditLogEvent } = require('discord.js');
const { logModerationAction, fetchAuditLogEntry } = require('../utils/modLogger');
const theme = require('../utils/theme');

module.exports = {
  name: 'guildBanAdd',
  async execute(ban) {
    if (!ban || !ban.guild) return;

    try {
      const auditEntry = await fetchAuditLogEntry(
        ban.guild,
        AuditLogEvent.MemberBanAdd,
        ban.user.id
      );

      await logModerationAction(ban.guild, {
        action: '🔨 Member Banned',
        targetUser: ban.user,
        moderator: auditEntry?.executor || null,
        reason: ban.reason || auditEntry?.reason || 'No reason specified',
        actionTaken: 'Permanently Banned',
        color: theme.colors.danger
      });
    } catch {}
  }
};
