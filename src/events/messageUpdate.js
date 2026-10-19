const { logModerationAction, sanitizeLogText } = require('../utils/modLogger');
const theme = require('../utils/theme');

module.exports = {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage) {
    if (!newMessage || !newMessage.guild) return;
    if (newMessage.author?.bot) return;

    // Ignore if content didn't change (e.g. embed preview or pin)
    if (oldMessage.content === newMessage.content) return;

    try {
      const oldSnippet = oldMessage.content ? sanitizeLogText(oldMessage.content) : '(Unknown / Not in cache)';
      const newSnippet = newMessage.content ? sanitizeLogText(newMessage.content) : '(Empty)';

      await logModerationAction(newMessage.guild, {
        action: '✏️ Message Edited',
        targetUser: newMessage.author,
        moderator: null,
        reason: 'User edited message',
        actionTaken: `Message edited in <#${newMessage.channel.id}>`,
        color: theme.colors.info,
        fields: [
          { name: '💬 Channel', value: `<#${newMessage.channel.id}> (#${newMessage.channel.name})`, inline: true },
          { name: '🔗 Jump to Message', value: `[Click Here](${newMessage.url})`, inline: true },
          { name: '⏮️ Before', value: oldSnippet.length > 400 ? oldSnippet.slice(0, 400) + '...' : oldSnippet, inline: false },
          { name: '⏭️ After', value: newSnippet.length > 400 ? newSnippet.slice(0, 400) + '...' : newSnippet, inline: false }
        ]
      });
    } catch {}
  }
};
