const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const theme = require('./theme');
const logger = require('./logger');
const db = require('./database');

let monitorInterval = null;
const announcedVideoIds = new Set();

/**
 * Resolves the YouTube channel ID to monitor
 */
function getTargetYouTubeChannelId() {
  return (
    db.getSetting('youtube_channel_id') ||
    process.env.YOUTUBE_CHANNEL_ID ||
    config.youtube?.channelId ||
    'UCl4u_M9jzMV14y-TfrJ0-aQ' // Verified authentic channel ID of @OlflazMC
  );
}

/**
 * Resolves the destination Discord channel for video announcements in a guild
 */
function getAnnounceChannel(guild) {
  if (!guild) return null;

  // 1. Direct setting from DB
  const configuredId =
    db.getSetting(`youtube_announce_channel_${guild.id}`) ||
    db.getSetting('youtube_announce_channel_id') ||
    process.env.YOUTUBE_ANNOUNCE_CHANNEL_ID;

  if (configuredId) {
    const ch = guild.channels.cache.get(configuredId);
    if (ch && ch.isTextBased()) return ch;
  }

  // 2. Canonical map lookup
  const canonicalMap = db.getCanonicalChannelMap(guild.id);
  const mappedId = canonicalMap['📺・new-videos'] || canonicalMap['new-videos'];
  if (mappedId) {
    const ch = guild.channels.cache.get(mappedId);
    if (ch && ch.isTextBased()) return ch;
  }

  // 3. Fallback to channel search by name
  return guild.channels.cache.find(
    c => (c.name.includes('new-videos') || c.name === 'new-videos') && c.isTextBased()
  ) || null;
}

/**
 * Checks the YouTube RSS feed for new public video uploads
 * @param {import('discord.js').Client} client
 * @param {boolean} forceAnnounce If true, announces even if already checkpointed (for manual test)
 */
async function checkYouTubeFeed(client, forceAnnounce = false) {
  const channelId = getTargetYouTubeChannelId();
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

  try {
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) OlflazMC-Bot/1.0'
      }
    });

    if (!response.ok) {
      logger.warn(`YouTube RSS feed returned HTTP ${response.status}: ${response.statusText}`);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const xml = await response.text();
    const entryMatches = Array.from(xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g));

    if (entryMatches.length === 0) {
      return { success: true, newUpload: false, reason: 'Feed returned no entries' };
    }

    // Extract newest video entry
    const newestXml = entryMatches[0][1];
    const videoId = newestXml.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1];
    const rawTitle = newestXml.match(/<title>(.*?)<\/title>/)?.[1];
    const published = newestXml.match(/<published>(.*?)<\/published>/)?.[1];

    if (!videoId) {
      return { success: false, error: 'Could not extract videoId from entry' };
    }

    // Decode HTML entities in title
    const title = (rawTitle || 'New Video')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    const lastVideoId = db.getSetting('youtube_last_video_id');

    // Cold start safety: Store checkpoint on first run without backfilling old videos
    if (!lastVideoId && !forceAnnounce) {
      db.setSetting('youtube_last_video_id', videoId);
      announcedVideoIds.add(videoId);
      logger.info(`YouTube RSS monitor initialized. Cold-start checkpoint set to latest video: ${videoId} ("${title}")`);
      return { success: true, newUpload: false, videoId, title, initialized: true };
    }

    // Check if video was already announced
    if (lastVideoId === videoId && !forceAnnounce) {
      return { success: true, newUpload: false, videoId, title };
    }

    if (announcedVideoIds.has(videoId) && !forceAnnounce) {
      return { success: true, newUpload: false, videoId, title };
    }

    // New upload detected!
    logger.info(`New YouTube video detected from OlflazMC: "${title}" (${videoId})`);

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    const pubTimestamp = published ? Math.floor(Date.parse(published) / 1000) : Math.floor(Date.now() / 1000);

    let postedCount = 0;

    // Broadcast announcement across all guilds the bot serves
    for (const [_, guild] of client.guilds.cache) {
      const videoChannel = getAnnounceChannel(guild);
      if (!videoChannel) continue;

      // Find opt-in YouTube role (never @everyone)
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
        await videoChannel.send({ content, embeds: [embed] });
        postedCount++;
        logger.info(`Posted new-video announcement for "${title}" in #${videoChannel.name} (${guild.name})`);
      } catch (postErr) {
        logger.error(`Could not post video announcement to #${videoChannel.name}: ${postErr.message}`);
      }
    }

    // Persist checkpoint to database
    db.setSetting('youtube_last_video_id', videoId);
    announcedVideoIds.add(videoId);

    return { success: true, newUpload: true, videoId, title, postedCount };
  } catch (err) {
    logger.warn(`Error polling YouTube RSS feed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Starts the periodic YouTube monitor with safe interval timer
 */
function startYouTubeMonitor(client) {
  const intervalMs = config.youtube?.pollingIntervalMs || 10 * 60 * 1000;

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
  getTargetYouTubeChannelId,
  getAnnounceChannel,
  checkYouTubeFeed,
  startYouTubeMonitor,
  stopYouTubeMonitor
};
