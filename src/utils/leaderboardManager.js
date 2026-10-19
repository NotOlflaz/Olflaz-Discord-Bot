const { EmbedBuilder } = require('discord.js');
const db = require('./database');
const theme = require('./theme');
const logger = require('./logger');
const config = require('../config');

// In-memory cooldown map to prevent rapid chat score manipulation (1 point per 60 seconds)
const userActivityCooldowns = new Map();
const COOLDOWN_MS = 60 * 1000;

/**
 * Records activity point for a non-bot member message with cooldown protection
 */
function recordMessageActivity(message) {
  if (!message || !message.guild || !message.author || message.author.bot) return;

  const key = `${message.guild.id}_${message.author.id}`;
  const now = Date.now();
  const lastActive = userActivityCooldowns.get(key) || 0;

  if (now - lastActive < COOLDOWN_MS) {
    // Under cooldown; still update lastActive but don't add point
    return;
  }

  userActivityCooldowns.set(key, now);
  db.recordUserActivity(message.author.id, message.guild.id, 1);
}

/**
 * Resolves the configured leaderboards channel in a guild
 */
function getLeaderboardChannel(guild) {
  if (!guild) return null;

  const configuredId = db.getSetting(`leaderboard_channel_${guild.id}`) || db.getSetting('leaderboards_channel_id');
  if (configuredId) {
    const channel = guild.channels.cache.get(configuredId);
    if (channel && channel.isTextBased()) return channel;
  }

  const canonicalMap = db.getCanonicalChannelMap(guild.id);
  const mappedId = canonicalMap['🏆・leaderboards'] || canonicalMap['leaderboards'];
  if (mappedId) {
    const channel = guild.channels.cache.get(mappedId);
    if (channel && channel.isTextBased()) return channel;
  }

  return guild.channels.cache.find(
    c => (c.name.includes('leaderboards') || c.name === 'leaderboard') && c.isTextBased()
  ) || null;
}

/**
 * Builds the rich leaderboard embed with real verified data
 */
async function buildLeaderboardEmbed(guild, limit = 10) {
  const topRows = db.getTopActivityLeaderboard(guild.id, limit);

  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${config.communityName} Weekly Activity & Community Leaderboard`)
    .setColor(theme.colors.warning)
    .setDescription(
      `Recognizing our most engaged community contributors and active players!\n\n` +
      `**📊 How Scoring Works (Fair & Verified Metric):**\n` +
      `• **Chat Participation:** \`1 point\` per active minute of genuine conversation (60s anti-spam cooldown).\n` +
      `• **Accepted Suggestions:** \`5 points\` for community ideas adopted by staff.\n` +
      `• **Spam Protection:** Bot accounts, duplicate messages, and spam are automatically excluded.\n\n` +
      `*Weekly rankings reset every Sunday at midnight UTC.*`
    )
    .setFooter({ text: `${config.communityName} Leaderboards • Verified Activity Tracking` })
    .setTimestamp();

  if (topRows.length === 0) {
    embed.addFields({
      name: '🌱 Leaderboard Warming Up',
      value: 'No activity points recorded yet for this period. Start chatting in community channels to earn the top spot!',
      inline: false
    });
  } else {
    const medals = ['🥇', '🥈', '🥉'];
    const rows = [];

    for (let i = 0; i < topRows.length; i++) {
      const row = topRows[i];
      const rank = medals[i] || `\`#${i + 1}\``;
      let displayName = `<@${row.user_id}>`;

      // Try fetching member to verify they are still in server
      try {
        const member = guild.members.cache.get(row.user_id) || await guild.members.fetch(row.user_id).catch(() => null);
        if (member) {
          displayName = `<@${row.user_id}> (${member.user.username})`;
        } else {
          displayName = `\`Former Member\` (<@${row.user_id}>)`;
        }
      } catch {}

      rows.push(
        `${rank} **${displayName}** — **${row.weekly_points}** pts ` +
        `\`(${row.message_count} messages • ${row.suggestions_accepted || 0} suggestions)\``
      );
    }

    embed.addFields({
      name: `🏅 Top ${topRows.length} Contributors`,
      value: rows.join('\n'),
      inline: false
    });
  }

  embed.addFields({
    name: '⚔️ External In-Game Minecraft Stats Notice',
    value:
      '• In-game Minecraft PvP / Elo stats (e.g. Hypixel, Minemen Club) are currently **offline/disabled** because no server RCON or verified API token is linked.\n' +
      '• To integrate live Minecraft statistics, connect a server MySQL database or Hypixel API key.',
    inline: false
  });

  return embed;
}

/**
 * Updates or posts the leaderboard message in place to avoid duplicate spam
 */
async function syncLeaderboardMessage(guild) {
  const channel = getLeaderboardChannel(guild);
  if (!channel) return null;

  const embed = await buildLeaderboardEmbed(guild);
  const trackedMsgId = db.getSetting(`leaderboard_msg_${guild.id}`);

  if (trackedMsgId) {
    try {
      const msg = await channel.messages.fetch(trackedMsgId).catch(() => null);
      if (msg && msg.author.id === channel.client.user.id) {
        await msg.edit({ embeds: [embed] });
        return { message: msg, created: false };
      }
    } catch (err) {
      logger.warn(`Could not edit existing leaderboard message: ${err.message}`);
    }
  }

  // Send new message and track ID
  const newMsg = await channel.send({ embeds: [embed] });
  db.setSetting(`leaderboard_msg_${guild.id}`, newMsg.id);
  return { message: newMsg, created: true };
}

module.exports = {
  recordMessageActivity,
  getLeaderboardChannel,
  buildLeaderboardEmbed,
  syncLeaderboardMessage
};
