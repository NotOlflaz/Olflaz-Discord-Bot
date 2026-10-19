const { AuditLogEvent } = require('discord.js');
const { logModerationAction, fetchAuditLogEntry } = require('../utils/modLogger');
const theme = require('../utils/theme');

module.exports = {
  name: 'guildBanRemove',
  async execute(ban) {
    if (!ban || !ban.guild) return;

    try {
      const auditEntry = await fetchAuditLogEntry(
        ban.guild,
        AuditLogEvent.MemberBanRemove,
        ban.user.id
      );

      await logModerationAction(ban.guild, {
        action: '🔓 Member Unbanned',
        targetUser: ban.user,
        moderator: auditEntry?.executor || null,
        reason: auditEntry?.reason || 'Ban revoked by staff',
        actionTaken: 'Unbanned from server',
        color: theme.colors.success
      });
    } catch {}
  }
};
