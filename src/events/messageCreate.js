const { handleAntiSpam } = require('../utils/antiSpam');
const { handleStickyMessageOnActivity } = require('../utils/stickyManager');
const { recordMessageActivity } = require('../utils/leaderboardManager');
const logger = require('../utils/logger');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (!message || !message.guild || message.author?.bot) return;

    try {
      // 1. Anti-spam inspection
      const isSpam = await handleAntiSpam(message);
      if (isSpam) {
        return; // Ignore spam from further processing
      }

      // 2. Sticky notice check and debounced repost
      await handleStickyMessageOnActivity(message);

      // 3. Verified community activity tracking
      recordMessageActivity(message);
    } catch (err) {
      logger.error(`Error in messageCreate handler: ${err.message}`);
    }
  }
};
