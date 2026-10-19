require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');

/**
 * Loads all slash command data objects from the commands directory
 */
function loadCommandDefinitions() {
  const commands = [];
  const commandsPath = path.join(__dirname, 'commands');

  if (!fs.existsSync(commandsPath)) {
    logger.warn(`Commands directory not found at ${commandsPath}`);
    return commands;
  }

  const commandFolders = fs.readdirSync(commandsPath);

  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);
      // Delete from require cache to ensure fresh commands during reload
      delete require.cache[require.resolve(filePath)];
      const command = require(filePath);
      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        logger.info(`Loaded command definition: /${command.data.name}`);
      } else {
        logger.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
      }
    }
  }

  return commands;
}

/**
 * Deploys slash commands to Discord
 */
async function deployCommands(options = {}) {
  const token = options.token || process.env.DISCORD_TOKEN;
  let clientId = options.clientId || process.env.CLIENT_ID;
  const configuredGuildId = options.guildId || process.env.GUILD_ID;

  if (!token || token === 'your_bot_token_here') {
    throw new Error('Missing DISCORD_TOKEN in .env! Please update your .env file with your Discord bot token.');
  }

  const rest = new REST({ version: '10' }).setToken(token);

  // Auto-resolve Client ID from Discord OAuth2 API if not provided or placeholder
  if (!clientId || clientId === 'your_client_id_here') {
    logger.info('CLIENT_ID not specified in .env, resolving Application ID via Discord API...');
    try {
      const app = await rest.get(Routes.oauth2CurrentApplication());
      clientId = app.id;
      logger.info(`Resolved Application ID: ${clientId}`);
    } catch (err) {
      throw new Error(`Failed to resolve Application ID: ${err.message}`);
    }
  }

  const commands = options.commands || loadCommandDefinitions();
  logger.info(`Started refreshing ${commands.length} application (/) commands.`);

  const results = {
    guilds: [],
    global: null
  };

  // Determine target guild(s)
  const targetGuildIds = [];

  if (configuredGuildId && configuredGuildId !== 'your_guild_id_here') {
    targetGuildIds.push(configuredGuildId);
  } else {
    // Auto-discover guilds the bot is currently in
    logger.info('No specific GUILD_ID configured. Discovering bot servers from Discord API...');
    try {
      const guilds = await rest.get(Routes.userGuilds());
      for (const g of guilds) {
        targetGuildIds.push(g.id);
        logger.info(`Discovered server: "${g.name}" (${g.id})`);
      }
    } catch (err) {
      logger.warn(`Could not auto-discover bot guilds: ${err.message}`);
    }
  }

  // Deploy to target guild(s) for immediate availability
  if (targetGuildIds.length > 0) {
    for (const gid of targetGuildIds) {
      try {
        const data = await rest.put(
          Routes.applicationGuildCommands(clientId, gid),
          { body: commands }
        );
        logger.success(`Successfully registered ${data.length} slash commands to GUILD: ${gid} (Instant update)`);
        results.guilds.push({ guildId: gid, count: data.length, success: true });
      } catch (err) {
        logger.error(`Failed to register commands to guild ${gid}: ${err.message}`);
        results.guilds.push({ guildId: gid, error: err.message, success: false });
      }
    }
  }

  // Also deploy globally (propagates globally across Discord)
  try {
    const globalData = await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );
    logger.success(`Successfully registered ${globalData.length} GLOBAL application (/) commands!`);
    results.global = { count: globalData.length, success: true };
  } catch (err) {
    logger.warn(`Notice: Global command sync returned: ${err.message}`);
    results.global = { error: err.message, success: false };
  }

  return results;
}

// Standalone execution
if (require.main === module) {
  (async () => {
    try {
      await deployCommands();
      logger.success('Slash command deployment completed successfully!');
      process.exit(0);
    } catch (error) {
      logger.error(`Failed to deploy commands: ${error.message}`);
      if (error.rawError) {
        console.error(error.rawError);
      }
      process.exit(1);
    }
  })();
}

module.exports = {
  deployCommands,
  loadCommandDefinitions
};
