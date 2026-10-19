const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const theme = require('./theme');
const logger = require('./logger');
const db = require('./database');

let monitorInterval = null;

/**
 * Checks the YouTube RSS feed for new video uploads from @OlflazMC
 */
async function checkYouTubeFeed(client) {
  const channelId = config.youtube?.channelId || 'UCl4u_M9jzMV14y-TfrJ0-aQ';
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

  try {
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) OlflazMC-Bot/1.0'
      }
    });

    if (!response.ok) {
      logger.warn(`YouTube RSS feed returned HTTP ${response.status}: ${response.statusText}`);
      return;
    }

    const xml = await response.text();
    const entryMatches = Array.from(xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g));

    if (entryMatches.length === 0) {
      return;
    }

    // Extract newest video entry
    const newestXml = entryMatches[0][1];
    const videoId = newestXml.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1];
    const rawTitle = newestXml.match(/<title>(.*?)<\/title>/)?.[1];
    const published = newestXml.match(/<published>(.*?)<\/published>/)?.[1];

    if (!videoId) return;

    // Decode HTML entities in title
    const title = (rawTitle || 'New Video')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    const lastVideoId = db.getSetting('youtube_last_video_id');

    // Initial run: Save checkpoint without announcing old video
    if (!lastVideoId) {
      db.setSetting('youtube_last_video_id', videoId);
      logger.info(`YouTube RSS monitor initialized. Checkpoint set to latest video: ${videoId} ("${title}")`);
      return;
    }

    // No new uploads
    if (lastVideoId === videoId) {
      return;
    }

    // New upload detected!
    logger.info(`New YouTube video detected: ${title} (${videoId})`);

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    const pubTimestamp = published ? Math.floor(Date.parse(published) / 1000) : Math.floor(Date.now() / 1000);

    // Broadcast to all configured guilds
    for (const [guildId, guild] of client.guilds.cache) {
      const videoChannel = guild.channels.cache.find(
        c => c.name === '📺・new-videos' || c.name === 'new-videos'
      );

      if (!videoChannel) continue;

      // Find YouTube Updates role if present
      const ytRole = guild.roles.cache.find(
        r => r.name.toLowerCase().includes('youtube updates') || r.name.toLowerCase() === 'youtube updates'
      );

      const embed = new EmbedBuilder()
        .setTitle(`📺 New OlflazMC Upload: ${title}`)
        .setURL(videoUrl)
        .setColor(theme.colors.youtube)
        .setDescription(
          `**OlflazMC** just uploaded a brand new Minecraft video!\n\n` +
          `⚔️ **Title:** **${title}**\n` +
          `🔗 **Watch Here:** [${videoUrl}](${videoUrl})\n` +
          `📅 **Uploaded:** <t:${pubTimestamp}:R>`
        )
        .setImage(thumbnailUrl)
        .setFooter({ text: 'YouTube • OlflazMC Channel Uploads' })
        .setTimestamp(published ? new Date(published) : new Date());

      const content = ytRole ? `<@&${ytRole.id}>` : undefined;

      try {
        await videoChannel.send({
          content,
          embeds: [embed]
        });
        logger.info(`Posted new-video announcement for "${title}" in #${videoChannel.name} (${guild.name})`);
      } catch (postErr) {
        logger.error(`Could not post video announcement to #${videoChannel.name}: ${postErr.message}`);
      }
    }

    // Update checkpoint
    db.setSetting('youtube_last_video_id', videoId);
  } catch (err) {
    logger.warn(`Error polling YouTube RSS feed: ${err.message}`);
  }
}

/**
 * Starts the periodic YouTube monitor
 */
function startYouTubeMonitor(client) {
  const intervalMs = config.youtube?.checkIntervalMs || 10 * 60 * 1000;

  // Run initial check
  checkYouTubeFeed(client).catch(err => {
    logger.warn(`Initial YouTube RSS check failed: ${err.message}`);
  });

  if (monitorInterval) clearInterval(monitorInterval);

  monitorInterval = setInterval(() => {
    checkYouTubeFeed(client).catch(err => {
      logger.warn(`YouTube monitor interval error: ${err.message}`);
    });
  }, intervalMs);

  logger.info(`YouTube RSS monitor started (Polling every ${Math.round(intervalMs / 60000)} minutes for @OlflazMC)`);
}

function stopYouTubeMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}

module.exports = {
  checkYouTubeFeed,
  startYouTubeMonitor,
  stopYouTubeMonitor
};
