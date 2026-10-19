const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('./database');
const theme = require('./theme');
const logger = require('./logger');

// Concurrency locks and debounce timers per channel ID
const channelLocks = new Set();
const debounceTimers = new Map();
const DEBOUNCE_DELAY_MS = 4000; // 4 seconds delay to prevent rate limits during rapid chatting

/**
 * Builds standard Embed for sticky message
 */
function buildStickyEmbed({ title, description, color }) {
  const embed = new EmbedBuilder()
    .setTitle(title ? `📌 ${title}` : '📌 Community Notice')
    .setDescription(description || 'Please follow server guidelines.')
    .setColor(color ? parseInt(color.replace('#', ''), 16) || theme.colors.primary : theme.colors.primary)
    .setFooter({ text: '📌 Sticky Notice • Automatically kept near the bottom of this channel' })
    .setTimestamp();

  return embed;
}

/**
 * Checks and schedules sticky message repost after qualifying message
 */
async function handleStickyMessageOnActivity(message) {
  if (!message || !message.guild || !message.channel || message.author?.bot) return;

  const channelId = message.channel.id;
  const stickyConfig = db.getStickyMessage(channelId);
  if (!stickyConfig || !stickyConfig.is_active) return;

  // Clear existing debounce timer for this channel and schedule fresh one
  if (debounceTimers.has(channelId)) {
    clearTimeout(debounceTimers.get(channelId));
  }

  const timer = setTimeout(async () => {
    debounceTimers.delete(channelId);
    await executeStickyRepost(message.channel, stickyConfig);
  }, DEBOUNCE_DELAY_MS);

  debounceTimers.set(channelId, timer);
}

/**
 * Executes the safe repost of the sticky message in a channel
 */
async function executeStickyRepost(channel, stickyConfig) {
  if (!channel || !channel.isTextBased()) return;
  const channelId = channel.id;

  // Concurrency lock
  if (channelLocks.has(channelId)) return;
  channelLocks.add(channelId);

  try {
    // 1. Fetch latest messages to check if sticky message is already the latest message
    const recentMessages = await channel.messages.fetch({ limit: 1 }).catch(() => null);
    if (!recentMessages || recentMessages.size === 0) return;

    const latestMessage = recentMessages.first();

    // If the latest message in the channel is already our tracked sticky message, skip!
    if (stickyConfig.last_message_id && latestMessage.id === stickyConfig.last_message_id) {
      return;
    }

    // 2. Safely delete the previously tracked sticky message (only bot's own message)
    if (stickyConfig.last_message_id) {
      try {
        const oldMessage = await channel.messages.fetch(stickyConfig.last_message_id).catch(() => null);
        if (oldMessage && oldMessage.author.id === channel.client.user.id && oldMessage.deletable) {
          await oldMessage.delete().catch(() => {});
        }
      } catch (delErr) {
        logger.warn(`Could not delete old sticky message in #${channel.name}: ${delErr.message}`);
      }
    }

    // 3. Build and send the new sticky message
    const embed = buildStickyEmbed({
      title: stickyConfig.embed_title,
      description: stickyConfig.embed_description,
      color: stickyConfig.embed_color
    });

    const payload = { embeds: [embed] };
    if (stickyConfig.content) {
      payload.content = stickyConfig.content;
    }

    const newSticky = await channel.send(payload);

    // 4. Update the tracked message ID in database
    db.updateStickyLastMessage(channelId, newSticky.id);
  } catch (err) {
    logger.warn(`Error during sticky repost in #${channel.name}: ${err.message}`);
  } finally {
    channelLocks.delete(channelId);
  }
}

/**
 * Staff command helper to set or update a sticky message for a channel
 */
async function configureStickyMessage({ channel, guildId, content, title, description, color }) {
  const channelId = channel.id;

  // 1. Save in database
  db.setStickyMessage({
    channelId,
    guildId,
    content: content || '',
    embedTitle: title || 'Notice',
    embedDescription: description || '',
    embedColor: color || '',
    lastMessageId: null,
    isActive: 1
  });

  const config = db.getStickyMessage(channelId);

  // 2. Post immediately
  await executeStickyRepost(channel, config);
  return config;
}

/**
 * Staff command helper to remove a sticky message
 */
async function removeStickyMessage(channel) {
  const channelId = channel.id;
  const config = db.getStickyMessage(channelId);

  if (!config) return false;

  // Delete previous tracked message if present
  if (config.last_message_id) {
    try {
      const oldMsg = await channel.messages.fetch(config.last_message_id).catch(() => null);
      if (oldMsg && oldMsg.deletable) {
        await oldMsg.delete().catch(() => {});
      }
    } catch {}
  }

  db.deleteStickyMessage(channelId);
  if (debounceTimers.has(channelId)) {
    clearTimeout(debounceTimers.get(channelId));
    debounceTimers.delete(channelId);
  }

  return true;
}

module.exports = {
  buildStickyEmbed,
  handleStickyMessageOnActivity,
  executeStickyRepost,
  configureStickyMessage,
  removeStickyMessage
};
