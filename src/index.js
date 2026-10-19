require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const logger = require('./utils/logger');
const config = require('./config');

// 1. Validate environment configuration
const token = process.env.DISCORD_TOKEN;

if (!token || token === 'your_bot_token_here') {
  logger.error('===============================================================');
  logger.error('DISCORD_TOKEN is missing or not set in your .env file!');
  logger.error('Please open .env and replace "your_bot_token_here" with your');
  logger.error('actual Discord Bot Token from the Discord Developer Portal.');
  logger.error('===============================================================');
  process.exit(1);
}

// 2. Initialize Discord Client with required Gateway Intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,        // Needed for welcome messages and role assignments
    GatewayIntentBits.GuildMessages,       // Needed for anti-spam monitoring
    GatewayIntentBits.MessageContent       // Needed for analyzing spam content & mentions
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction
  ]
});

client.commands = new Collection();

// 3. Dynamically load all Slash Commands from subfolders
const commandsPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
  const folderPath = path.join(commandsPath, folder);
  if (!fs.statSync(folderPath).isDirectory()) continue;

  const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(folderPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      logger.info(`Loaded command: /${command.data.name}`);
    } else {
      logger.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
  }
}

// 4. Dynamically load all Event Handlers
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
  logger.info(`Registered event: ${event.name}`);
}

// 5. Global Error Handlers (Prevents crashes from unexpected Discord API errors)
process.on('unhandledRejection', (error) => {
  logger.error(`Unhandled Promise Rejection: ${error?.stack || error}`);
});

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error?.stack || error}`);
});

// 6. Connect to Discord Gateway
logger.info(`Starting ${config.communityName} Discord Bot...`);
client.login(token).catch((err) => {
  logger.error(`Failed to login to Discord: ${err.message}`);
  logger.error('Please verify that your DISCORD_TOKEN in .env is valid.');
  process.exit(1);
});
