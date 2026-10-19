const { AuditLogEvent } = require('discord.js');
const { logModerationAction, fetchAuditLogEntry, sanitizeLogText } = require('../utils/modLogger');
const theme = require('../utils/theme');

module.exports = {
  name: 'messageDelete',
  async execute(message) {
    if (!message || !message.guild) return;
    if (message.author?.bot) return;

    try {
      const auditEntry = await fetchAuditLogEntry(
        message.guild,
        AuditLogEvent.MessageDelete,
        message.author?.id
      );

      const moderator = (auditEntry && auditEntry.executor && auditEntry.executor.id !== message.author?.id)
        ? auditEntry.executor
        : null;

      const snippet = message.content
        ? sanitizeLogText(message.content)
        : (message.attachments?.size > 0 ? `[Attached file: ${Array.from(message.attachments.values()).map(a => a.name).join(', ')}]` : '(No content or embed)');

      await logModerationAction(message.guild, {
        action: '🗑️ Message Deleted',
        targetUser: message.author,
        moderator,
        reason: auditEntry?.reason || (moderator ? 'Deleted by staff member' : 'Self-deleted or unknown'),
        actionTaken: `Message deleted in <#${message.channel.id}>`,
        color: theme.colors.warning,
        fields: [
          { name: '💬 Channel', value: `<#${message.channel.id}> (#${message.channel.name})`, inline: true },
          { name: '📝 Content', value: snippet.length > 500 ? snippet.slice(0, 500) + '...' : snippet, inline: false }
        ]
      });
    } catch {}
  }
};
