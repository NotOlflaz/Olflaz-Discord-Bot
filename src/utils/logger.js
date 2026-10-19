/**
 * OlflazMC Bot Structured Logger
 */
function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
}

const logger = {
  info: (message, ...args) => {
    console.log(`\x1b[36m[${getTimestamp()}] [INFO]\x1b[0m ${message}`, ...args);
  },
  success: (message, ...args) => {
    console.log(`\x1b[32m[${getTimestamp()}] [SUCCESS]\x1b[0m ${message}`, ...args);
  },
  warn: (message, ...args) => {
    console.warn(`\x1b[33m[${getTimestamp()}] [WARN]\x1b[0m ${message}`, ...args);
  },
  error: (message, ...args) => {
    console.error(`\x1b[31m[${getTimestamp()}] [ERROR]\x1b[0m ${message}`, ...args);
  },
  mod: (message, ...args) => {
    console.log(`\x1b[35m[${getTimestamp()}] [MODERATION]\x1b[0m ${message}`, ...args);
  }
};

module.exports = logger;
