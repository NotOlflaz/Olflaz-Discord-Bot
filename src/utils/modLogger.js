const {
  EmbedBuilder,
  PermissionFlagsBits,
  AuditLogEvent
} = require('discord.js');
const config = require('../config');
const theme = require('./theme');
const logger = require('./logger');
const db = require('./database');

/**
 * Strips potential tokens, private keys, or passwords from string before logging
 */
function sanitizeLogText(str) {
  if (!str) return '';
  return String(str)
    .replace(/[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27}/g, '[REDACTED_DISCORD_TOKEN]')
    .replace(/mfa\.[A-Za-z0-9_-]{20,}/g, '[REDACTED_MFA_TOKEN]')
    .replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, '[REDACTED_BEARER_TOKEN]')
    .slice(0, 1024);
}

/**
 * Resolves the configured moderation logs channel in a guild
 */
function getModLogsChannel(guild) {
  if (!guild) return null;

  // 1. Direct setting from database
  const configuredId = db.getSetting(`mod_logs_channel_${guild.id}`) || db.getSetting('mod_logs_channel_id');
  if (configuredId) {
    const channel = guild.channels.cache.get(configuredId);
    if (channel && channel.isTextBased()) return channel;
  }

  // 2. Canonical map lookup
  const canonicalMap = db.getCanonicalChannelMap(guild.id);
  const mappedId = canonicalMap['📋・mod-logs'] || canonicalMap['mod-logs'];
  if (mappedId) {
    const channel = guild.channels.cache.get(mappedId);
    if (channel && channel.isTextBased()) return channel;
  }

  // 3. Fallback to channel cache search
  return guild.channels.cache.find(
    c => (c.name.includes('mod-logs') || c.name === 'mod-logs') && c.isTextBased()
  ) || null;
}

/**
 * Resolves the configured ticket logs channel in a guild
 */
function getTicketLogsChannel(guild) {
  if (!guild) return null;

  // 1. Direct setting from database
  const configuredId = db.getSetting(`ticket_logs_channel_${guild.id}`) || db.getSetting('ticket_logs_channel_id');
  if (configuredId) {
    const channel = guild.channels.cache.get(configuredId);
    if (channel && channel.isTextBased()) return channel;
  }

  // 2. Canonical map lookup
  const canonicalMap = db.getCanonicalChannelMap(guild.id);
  const mappedId = canonicalMap['🎫・ticket-logs'] || canonicalMap['ticket-logs'];
  if (mappedId) {
    const channel = guild.channels.cache.get(mappedId);
    if (channel && channel.isTextBased()) return channel;
  }

  // 3. Fallback to channel cache search
  return guild.channels.cache.find(
    c => (c.name.includes('ticket-logs') || c.name === 'ticket-logs') && c.isTextBased()
  ) || null;
}

/**
 * Logs a moderation action (warn, timeout, kick, ban, clear, anti-spam, etc.)
 */
async function logModerationAction(guild, {
  action,
  targetUser,
  moderator,
  reason = 'No reason specified',
  actionTaken = '',
  duration = '',
  fields = [],
  color = null
}) {
  try {
    const channel = getModLogsChannel(guild);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle(sanitizeLogText(action))
      .setColor(color || theme.colors.warning)
      .setTimestamp()
      .setFooter({ text: `${config.communityName} • Moderation Audit Log` });

    if (targetUser) {
      const tag = targetUser.tag || targetUser.username || targetUser.id;
      embed.addFields({
        name: '👤 Target Member',
        value: `<@${targetUser.id}> (\`${tag}\` • \`${targetUser.id}\`)`,
        inline: true
      });
      if (typeof targetUser.displayAvatarURL === 'function') {
        embed.setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 128 }));
      }
    }

    if (moderator) {
      const modTag = moderator.tag || moderator.username || moderator.id || 'System';
      embed.addFields({
        name: '🛡️ Responsible Moderator',
        value: moderator.id ? `<@${moderator.id}> (\`${modTag}\`)` : `\`${modTag}\``,
        inline: true
      });
    }

    if (duration) {
      embed.addFields({ name: '⏱️ Duration', value: sanitizeLogText(duration), inline: true });
    }

    if (actionTaken) {
      embed.addFields({ name: '📋 Action Taken', value: sanitizeLogText(actionTaken), inline: false });
    }

    embed.addFields({ name: '📄 Reason / Context', value: sanitizeLogText(reason), inline: false });

    for (const f of fields) {
      if (f && f.name && f.value) {
        embed.addFields({
          name: sanitizeLogText(f.name),
          value: sanitizeLogText(f.value),
          inline: f.inline ?? false
        });
      }
    }

    await channel.send({ embeds: [embed] }).catch(err => {
      logger.warn(`Could not send moderation log: ${err.message}`);
    });
  } catch (err) {
    logger.warn(`Error in logModerationAction: ${err.message}`);
  }
}

/**
 * Logs ticket lifecycle events (open, claim, close, reopen) to #ticket-logs
 */
async function logTicketEvent(guild, {
  event,
  ticket,
  channel,
  actor,
  reason = '',
  files = []
}) {
  try {
    const logChannel = getTicketLogsChannel(guild);
    if (!logChannel) return;

    const eventColors = {
      opened: theme.colors.success,
      claimed: theme.colors.primary,
      closed: theme.colors.danger,
      reopened: theme.colors.warning
    };

    const numStr = ticket?.ticket_number ? `#${String(ticket.ticket_number).padStart(4, '0')}` : '';
    const embed = new EmbedBuilder()
      .setTitle(`🎫 Ticket Event: ${event.toUpperCase()} ${numStr}`)
      .setColor(eventColors[event] || theme.colors.primary)
      .setTimestamp()
      .setFooter({ text: `${config.communityName} • Ticket Audit Log` });

    embed.addFields(
      { name: '🎫 Ticket', value: channel ? `<#${channel.id}> (${channel.name})` : (numStr || 'Ticket Channel'), inline: true },
      { name: '🏷️ Category / Type', value: `\`${ticket?.ticket_type || 'Support'}\``, inline: true },
      { name: '👤 Requester', value: ticket?.user_id ? `<@${ticket.user_id}> (\`${ticket.user_tag || ticket.user_id}\`)` : '`Unknown`', inline: true }
    );

    if (actor) {
      embed.addFields({
        name: '🛡️ Staff Member',
        value: actor.id ? `<@${actor.id}> (\`${actor.user?.tag || actor.tag || actor.id}\`)` : `\`${actor}\``,
        inline: true
      });
    }

    if (ticket?.claimed_by_id) {
      embed.addFields({
        name: '📌 Claimed By',
        value: `<@${ticket.claimed_by_id}> (\`${ticket.claimed_by_tag || ticket.claimed_by_id}\`)`,
        inline: true
      });
    }

    if (reason) {
      embed.addFields({ name: '📄 Reason / Details', value: sanitizeLogText(reason), inline: false });
    }

    if (ticket?.created_at) {
      embed.addFields({
        name: '⏱️ Created',
        value: `<t:${Math.floor(ticket.created_at / 1000)}:R>`,
        inline: true
      });
    }

    await logChannel.send({ embeds: [embed], files }).catch(err => {
      logger.warn(`Could not deliver ticket event to ticket-logs: ${err.message}`);
    });
  } catch (err) {
    logger.warn(`Error in logTicketEvent: ${err.message}`);
  }
}

/**
 * Safely fetches recent audit log entry matching target and action
 */
async function fetchAuditLogEntry(guild, actionType, targetId) {
  try {
    if (!guild || !guild.members?.me?.permissions?.has(PermissionFlagsBits.ViewAuditLog)) {
      return null;
    }

    const auditLogs = await guild.fetchAuditLogs({
      type: actionType,
      limit: 5
    }).catch(() => null);

    if (!auditLogs || !auditLogs.entries) return null;

    const now = Date.now();
    const entry = auditLogs.entries.find(e => {
      const isTarget = e.target?.id === targetId || e.targetId === targetId;
      const isRecent = Math.abs(now - e.createdTimestamp) < 15000;
      return isTarget && isRecent;
    });

    return entry || null;
  } catch (err) {
    logger.warn(`Audit log fetch notice: ${err.message}`);
    return null;
  }
}

module.exports = {
  sanitizeLogText,
  getModLogsChannel,
  getTicketLogsChannel,
  logModerationAction,
  logTicketEvent,
  fetchAuditLogEntry
};
