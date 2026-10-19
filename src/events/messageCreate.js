const { handleAntiSpam } = require('../utils/antiSpam');
const logger = require('../utils/logger');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    try {
      await handleAntiSpam(message);
    } catch (err) {
      logger.error(`Error in messageCreate anti-spam handler: ${err.message}`);
    }
  }
};
