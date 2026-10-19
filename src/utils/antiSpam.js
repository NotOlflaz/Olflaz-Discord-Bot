const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config');
const logger = require('./logger');

// In-memory tracking for users
const userMessageHistory = new Map();
const userWarnings = new Map();

// Periodic garbage collection to prevent memory leaks (every 60s)
setInterval(() => {
  const now = Date.now();
  for (const [userId, record] of userMessageHistory.entries()) {
    record.timestamps = record.timestamps.filter(ts => now - ts < 15000);
    record.duplicates = record.duplicates.filter(entry => now - entry.time < 30000);
    if (record.timestamps.length === 0 && record.duplicates.length === 0) {
      userMessageHistory.delete(userId);
    }
  }
}, 60000);

/**
 * Handle anti-spam inspection for incoming messages
 * @param {import('discord.js').Message} message
 * @returns {Promise<boolean>} True if message was flagged and handled as spam
 */
async function handleAntiSpam(message) {
  // Ignore bots, DMs, or if disabled
  if (!config.antiSpam.enabled) return false;
  if (message.author.bot || !message.guild || !message.member) return false;

  // Ignore staff members who have moderate/admin privileges
  if (
    message.member.permissions.has(PermissionFlagsBits.Administrator) ||
    message.member.permissions.has(PermissionFlagsBits.ManageMessages)
  ) {
    return false;
  }

  const userId = message.author.id;
  const now = Date.now();

  if (!userMessageHistory.has(userId)) {
    userMessageHistory.set(userId, {
      timestamps: [],
      duplicates: []
    });
  }

  const userRecord = userMessageHistory.get(userId);
  userRecord.timestamps.push(now);

  // Clean old timestamps outside the window
  userRecord.timestamps = userRecord.timestamps.filter(
    ts => now - ts <= config.antiSpam.windowMs
  );

  // Track duplicate message content
  const cleanContent = message.content.trim().toLowerCase();
  if (cleanContent.length > 0) {
    userRecord.duplicates.push({ content: cleanContent, time: now });
  }
  userRecord.duplicates = userRecord.duplicates.filter(
    entry => now - entry.time <= config.antiSpam.duplicateWindowMs
  );

  // Check 1: Message Flooding (Rate Limit)
  if (userRecord.timestamps.length > config.antiSpam.maxMessagesPerWindow) {
    await punishSpammer(message, 'Flooding (sending messages too fast)');
    return true;
  }

  // Check 2: Duplicate Message Spam
  if (cleanContent.length > 3) {
    const identicalCount = userRecord.duplicates.filter(
      d => d.content === cleanContent
    ).length;

    if (identicalCount >= config.antiSpam.duplicateThreshold) {
      await punishSpammer(message, 'Duplicate Message Spam (repeating the same text)');
      return true;
    }
  }

  // Check 3: Mass Mentions
  const mentionsCount = message.mentions.users.size + message.mentions.roles.size;
  if (mentionsCount > config.antiSpam.maxMentions) {
    await punishSpammer(message, `Mass Mentions (${mentionsCount} mentions in one message)`);
    return true;
  }

  return false;
}

/**
 * Punish member for spamming: delete message, warn, timeout if threshold exceeded
 */
async function punishSpammer(message, reason) {
  const { member, channel, guild, author } = message;

  // 1. Delete offending message
  try {
    if (message.deletable) {
      await message.delete();
    }
  } catch (err) {
    logger.warn(`Could not delete spam message: ${err.message}`);
  }

  // 2. Increment warning count
  const currentWarns = (userWarnings.get(author.id) || 0) + 1;
  userWarnings.set(author.id, currentWarns);

  // Reset user message queue to prevent duplicate triggers
  userMessageHistory.delete(author.id);

  logger.mod(`Spam detected by ${author.tag} (${author.id}): ${reason}. Warning #${currentWarns}`);

  // 3. Send friendly warning in channel
  try {
    const warningMsg = await channel.send({
      content: `⚠️ ${author}, please slow down! Stop spamming: **${reason}**.`
    });
    setTimeout(() => warningMsg.delete().catch(() => {}), 6000);
  } catch (err) {
    // Channel permissions might prevent sending
  }

  let actionTaken = `Message deleted & warned (${currentWarns}/${config.antiSpam.warnThresholdForTimeout})`;

  // 4. Check if timeout threshold reached
  if (currentWarns >= config.antiSpam.warnThresholdForTimeout) {
    try {
      if (member.moderatable) {
        await member.timeout(config.antiSpam.timeoutDurationMs, `Automated Anti-Spam: ${reason}`);
        actionTaken = `Timed out for 5 minutes (Reached ${currentWarns} spam warnings)`;
        userWarnings.delete(author.id); // Reset warnings after penalty
        logger.mod(`Timed out ${author.tag} for 5 minutes due to repeated spam`);
      }
    } catch (err) {
      logger.warn(`Failed to timeout ${author.tag}: ${err.message}`);
    }
  }

  // 5. Send report to #mod-logs
  await sendModLog(guild, {
    action: '🤖 Auto Anti-Spam Triggered',
    target: `${author.tag} (${author.id})`,
    reason,
    actionTaken,
    color: config.colors.danger
  });
}

/**
 * Send an incident report to the #mod-logs channel if it exists
 */
async function sendModLog(guild, { action, target, reason, actionTaken, moderator = 'OlflazMC Anti-Spam', color }) {
  try {
    const modLogChannel = guild.channels.cache.find(
      c => (c.name.includes('mod-logs') || c.name === 'mod-logs') && c.isTextBased()
    );

    if (!modLogChannel) return;

    const embed = new EmbedBuilder()
      .setTitle(action)
      .setColor(color || config.colors.warning)
      .addFields(
        { name: 'Target User', value: target, inline: true },
        { name: 'Moderator / System', value: moderator, inline: true },
        { name: 'Action Taken', value: actionTaken, inline: false },
        { name: 'Reason', value: reason, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: `${config.communityName} Moderation Logs` });

    await modLogChannel.send({ embeds: [embed] });
  } catch (err) {
    logger.warn(`Could not send mod log: ${err.message}`);
  }
}

module.exports = {
  handleAntiSpam,
  sendModLog
};
