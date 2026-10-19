const { ActivityType } = require('discord.js');
const logger = require('../utils/logger');
const config = require('../config');
const giveawayManager = require('../utils/giveawayManager');
const youtubeMonitor = require('../utils/youtubeMonitor');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    logger.success(`Logged in as ${client.user.tag} (ID: ${client.user.id})`);
    logger.info(`Serving in ${client.guilds.cache.size} server(s)`);

    // Set bot presence
    client.user.setPresence({
      activities: [
        {
          name: `${config.communityName} | /help`,
          type: ActivityType.Watching
        }
      ],
      status: 'online'
    });

    logger.info('Bot status and activity configured.');

    // Initialize Giveaways & reconcile timers
    try {
      giveawayManager.initGiveaways(client);
    } catch (err) {
      logger.error(`Error initializing giveaways: ${err.message}`);
    }

    // Start YouTube RSS monitor for @OlflazMC
    try {
      youtubeMonitor.startYouTubeMonitor(client);
    } catch (err) {
      logger.error(`Error initializing YouTube monitor: ${err.message}`);
    }

    // Auto-sync slash commands to guild(s) on startup
    try {
      const commandData = client.commands.map(cmd => cmd.data.toJSON());
      if (commandData.length > 0) {
        const guildId = process.env.GUILD_ID;
        if (guildId && guildId !== 'your_guild_id_here') {
          const targetGuild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
          if (targetGuild) {
            await targetGuild.commands.set(commandData);
            logger.success(`Auto-synced ${commandData.length} slash commands to guild: "${targetGuild.name}" (${guildId})`);
          }
        } else {
          for (const [id, guild] of client.guilds.cache) {
            await guild.commands.set(commandData);
            logger.success(`Auto-synced ${commandData.length} slash commands to guild: "${guild.name}" (${id})`);
          }
        }
      }
    } catch (err) {
      logger.warn(`Startup slash command sync notice: ${err.message}`);
    }
  }
};
