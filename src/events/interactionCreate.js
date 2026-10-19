const { PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');
const ticketManager = require('../utils/ticketManager');
const applicationManager = require('../utils/applicationManager');
const suggestionManager = require('../utils/suggestionManager');
const giveawayManager = require('../utils/giveawayManager');
const eventManager = require('../utils/eventManager');
const communityFeatures = require('../utils/communityFeatures');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    const botClient = client || interaction.client;

    // -------------------------------------------------------------
    // 1. Slash Command Handling
    // -------------------------------------------------------------
    if (interaction.isChatInputCommand()) {
      let command = botClient.commands?.get(interaction.commandName);

      // Fallback: Dynamically search and load command from disk if not yet in memory
      if (!command) {
        try {
          const commandsPath = path.join(__dirname, '../commands');
          const commandFolders = fs.readdirSync(commandsPath);
          for (const folder of commandFolders) {
            const folderPath = path.join(commandsPath, folder);
            if (!fs.statSync(folderPath).isDirectory()) continue;
            const commandFiles = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
            for (const file of commandFiles) {
              const filePath = path.join(folderPath, file);
              delete require.cache[require.resolve(filePath)];
              const loadedCmd = require(filePath);
              if (loadedCmd?.data?.name === interaction.commandName && typeof loadedCmd.execute === 'function') {
                if (botClient.commands) {
                  botClient.commands.set(loadedCmd.data.name, loadedCmd);
                }
                command = loadedCmd;
                logger.info(`[Dynamic Command Loader] Loaded command /${interaction.commandName} from ${file}`);
                break;
              }
            }
            if (command) break;
          }
        } catch (loaderErr) {
          logger.warn(`Could not dynamically load command /${interaction.commandName}: ${loaderErr.message}`);
        }
      }

      if (!command) {
        logger.warn(`No command matching "${interaction.commandName}" was found in registered commands.`);
        return interaction.reply({
          content: `❌ Command \`/${interaction.commandName}\` is not recognized by the bot.`,
          ephemeral: true
        }).catch(() => {});
      }

      logger.info(`[Command] /${interaction.commandName} executed by ${interaction.user.tag} in ${interaction.guild ? `#${interaction.channel?.name || 'unknown'}` : 'DMs'}`);

      try {
        await command.execute(interaction, botClient);
      } catch (error) {
        // Safely handle DiscordAPIError[10062]: Unknown interaction (interaction expired on Discord's side)
        if (error.code === 10062 || error.message?.includes('Unknown interaction')) {
          logger.warn(`[Interaction] Interaction token for /${interaction.commandName} expired (DiscordAPIError 10062). Safely handled.`);
          return;
        }

        logger.error(`Error executing /${interaction.commandName}: ${error.stack || error}`);

        const errorMessage = {
          content: '❌ There was an error while executing this command!',
          ephemeral: true
        };

        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
          } else {
            await interaction.reply(errorMessage);
          }
        } catch (replyErr) {
          if (replyErr.code !== 10062) {
            logger.warn(`Could not deliver error feedback to user: ${replyErr.message}`);
          }
        }
      }
      return;
    }

    // -------------------------------------------------------------
    // 2. Autocomplete Handling
    // -------------------------------------------------------------
    if (interaction.isAutocomplete()) {
      const command = botClient.commands?.get(interaction.commandName);
      if (!command || !command.autocomplete) return;

      try {
        await command.autocomplete(interaction, botClient);
      } catch (error) {
        if (error.code !== 10062) {
          logger.error(`Autocomplete error for /${interaction.commandName}: ${error.message}`);
        }
      }
      return;
    }

    // -------------------------------------------------------------
    // 3. Modal Submissions
    // -------------------------------------------------------------
    if (interaction.isModalSubmit()) {
      try {
        if (interaction.customId === 'modal_creator_app') {
          return await applicationManager.handleApplicationSubmit(interaction);
        }

        if (interaction.customId === 'modal_submit_suggestion') {
          return await suggestionManager.handleSuggestionSubmit(interaction);
        }

        if (interaction.customId === 'modal_find_duel') {
          return await communityFeatures.handleDuelSubmit(interaction);
        }

        if (interaction.customId === 'modal_submit_video_idea') {
          return await communityFeatures.handleVideoIdeaSubmit(interaction);
        }

        if (interaction.customId.startsWith('modal_app_info_')) {
          const appId = interaction.customId.replace('modal_app_info_', '');
          return await applicationManager.handleApplicationInfoModal(interaction, appId);
        }

        if (interaction.customId.startsWith('modal_app_reject_')) {
          const appId = interaction.customId.replace('modal_app_reject_', '');
          return await applicationManager.handleApplicationRejectModal(interaction, appId);
        }

        if (interaction.customId.startsWith('modal_app_note_')) {
          const appId = interaction.customId.replace('modal_app_note_', '');
          return await applicationManager.handleApplicationNoteModal(interaction, appId);
        }
      } catch (modalErr) {
        if (modalErr.code === 10062) return;
        logger.error(`Error handling modal submission ${interaction.customId}: ${modalErr.message}`);
        const errMsg = `❌ An error occurred processing your submission: ${modalErr.message}`;
        if (interaction.deferred || interaction.replied) {
          return interaction.followUp({ content: errMsg, ephemeral: true }).catch(() => {});
        }
        return interaction.reply({ content: errMsg, ephemeral: true }).catch(() => {});
      }
      return;
    }

    // -------------------------------------------------------------
    // 4. Button Interactions
    // -------------------------------------------------------------
    if (interaction.isButton()) {
      const { customId, guild, member } = interaction;

      try {
        // --- 4.1 Modal Triggers ---
        if (customId === 'btn_open_suggestion_modal') {
          return await interaction.showModal(suggestionManager.buildSuggestionModal());
        }

        if (customId === 'btn_open_duel_modal') {
          return await interaction.showModal(communityFeatures.buildDuelModal());
        }

        if (customId === 'btn_open_video_idea_modal') {
          return await interaction.showModal(communityFeatures.buildVideoIdeaModal());
        }

        if (customId === 'btn_acknowledge_rules') {
          return await communityFeatures.handleRulesAcknowledge(interaction);
        }

        // --- 4.2 Ticket Creation Buttons ---
        if (customId === 'ticket_create_applications') {
          // Open Creator Application Modal
          return await interaction.showModal(applicationManager.buildApplicationModal());
        }

        if (customId.startsWith('ticket_create_')) {
          const ticketType = customId.replace('ticket_create_', '');
          return await ticketManager.handleTicketCreate(interaction, ticketType);
        }

        // --- 4.3 Ticket Action Controls ---
        if (customId.startsWith('ticket_claim_')) {
          const ticketId = customId.replace('ticket_claim_', '');
          return await ticketManager.handleTicketClaim(interaction, ticketId);
        }

        if (customId.startsWith('ticket_close_request_')) {
          const ticketId = customId.replace('ticket_close_request_', '');
          return await ticketManager.handleTicketCloseRequest(interaction, ticketId);
        }

        if (customId.startsWith('ticket_close_confirm_') || customId.startsWith('ticket_confirm_close_')) {
          const ticketId = customId.replace('ticket_close_confirm_', '').replace('ticket_confirm_close_', '');
          return await ticketManager.handleTicketCloseConfirm(interaction, ticketId);
        }

        if (customId.startsWith('ticket_close_cancel_') || customId.startsWith('ticket_cancel_close_')) {
          const ticketId = customId.replace('ticket_close_cancel_', '').replace('ticket_cancel_close_', '');
          return await ticketManager.handleTicketCloseCancel(interaction, ticketId);
        }

        // --- 4.4 Duel Matchmaking Buttons ---
        if (customId.startsWith('duel_accept_')) {
          const duelId = customId.replace('duel_accept_', '');
          return await communityFeatures.handleDuelAccept(interaction, duelId);
        }

        if (customId.startsWith('duel_cancel_')) {
          const duelId = customId.replace('duel_cancel_', '');
          return await communityFeatures.handleDuelCancel(interaction, duelId);
        }

        // --- 4.5 Video Ideas Buttons ---
        if (customId.startsWith('idea_upvote_')) {
          const ideaId = customId.replace('idea_upvote_', '');
          return await communityFeatures.handleVideoIdeaUpvote(interaction, ideaId);
        }

        if (customId.startsWith('idea_plan_')) {
          const ideaId = customId.replace('idea_plan_', '');
          return await communityFeatures.handleVideoIdeaPlan(interaction, ideaId);
        }

        // --- 4.6 Creator Application Review Buttons ---
        if (customId.startsWith('app_accept_')) {
          const appId = customId.replace('app_accept_', '');
          return await applicationManager.handleApplicationAction(interaction, 'accept', appId);
        }

        if (customId.startsWith('app_reject_')) {
          const appId = customId.replace('app_reject_', '');
          return await applicationManager.handleApplicationAction(interaction, 'reject', appId);
        }

        if (customId.startsWith('app_info_')) {
          const appId = customId.replace('app_info_', '');
          return await applicationManager.handleApplicationAction(interaction, 'info', appId);
        }

        if (customId.startsWith('app_note_')) {
          const appId = customId.replace('app_note_', '');
          return await applicationManager.handleApplicationAction(interaction, 'note', appId);
        }

        // --- 4.7 Suggestion Voting & Staff Controls ---
        if (customId.startsWith('suggest_up_')) {
          const suggestionId = customId.replace('suggest_up_', '');
          return await suggestionManager.handleSuggestionVote(interaction, 'up', suggestionId);
        }

        if (customId.startsWith('suggest_down_')) {
          const suggestionId = customId.replace('suggest_down_', '');
          return await suggestionManager.handleSuggestionVote(interaction, 'down', suggestionId);
        }

        if (customId.startsWith('suggest_manage_')) {
          const suggestionId = customId.replace('suggest_manage_', '');
          return await suggestionManager.handleSuggestionManage(interaction, suggestionId);
        }

        if (customId.startsWith('suggest_status_')) {
          const parts = customId.split('_');
          const suggestionId = parts[2];
          const newStatus = parts[3];
          return await suggestionManager.handleSuggestionStatusUpdate(interaction, suggestionId, newStatus);
        }

        // --- 4.8 Giveaway Entry Button ---
        if (customId.startsWith('giveaway_enter_')) {
          const giveawayId = customId.replace('giveaway_enter_', '');
          return await giveawayManager.handleGiveawayEnter(interaction, giveawayId);
        }

        // --- 4.9 Event RSVP Button ---
        if (customId.startsWith('event_rsvp_')) {
          const eventId = customId.replace('event_rsvp_', '');
          return await eventManager.handleEventRSVP(interaction, eventId);
        }

        // --- 4.10 Self-Role Selection Buttons ---
        const roleItem = config.selfRoles.find(r => r.id === customId);
        if (roleItem) {
          // Security check: Whitelist strictly to config.selfRoles
          const isAllowedSelfRole = config.selfRoles.some(r => r.id === roleItem.id);
          if (!isAllowedSelfRole) {
            return interaction.reply({
              content: '❌ This role cannot be self-assigned.',
              ephemeral: true
            }).catch(() => {});
          }

          if (!guild || !member) {
            return interaction.reply({
              content: '❌ Roles can only be assigned inside the server.',
              ephemeral: true
            }).catch(() => {});
          }

          // Check bot permissions
          const botMember = guild.members.me;
          if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.reply({
              content: '❌ The bot lacks `Manage Roles` permission to assign roles. Please ask an admin.',
              ephemeral: true
            }).catch(() => {});
          }

          // Find the role in the guild cache (supports Unicode emoji prefix and legacy name)
          const targetRole = guild.roles.cache.find(
            r => r.name.toLowerCase() === roleItem.name.toLowerCase() ||
                 (roleItem.lookupNames && roleItem.lookupNames.includes(r.name.toLowerCase()))
          );

          if (!targetRole) {
            return interaction.reply({
              content: `❌ The role **@${roleItem.name}** does not exist yet on this server. Please ask an admin to run \`/setup\`!`,
              ephemeral: true
            }).catch(() => {});
          }

          // Check role hierarchy (bot's highest role must be above the target role)
          if (botMember.roles.highest.position <= targetRole.position) {
            return interaction.reply({
              content: `❌ The bot cannot assign **@${targetRole.name}** because the bot's role is below it in server settings. Please ask an admin to drag the bot's role higher!`,
              ephemeral: true
            }).catch(() => {});
          }

          const hasRole = member.roles.cache.has(targetRole.id);

          if (hasRole) {
            await member.roles.remove(targetRole);
            logger.info(`Removed role @${targetRole.name} from ${member.user.tag}`);
            return interaction.reply({
              content: `➖ Removed the **@${targetRole.name}** role. You will no longer receive pings for it.`,
              ephemeral: true
            });
          } else {
            await member.roles.add(targetRole);
            logger.info(`Added role @${targetRole.name} to ${member.user.tag}`);
            return interaction.reply({
              content: `➕ Added the **@${targetRole.name}** role! You will now be notified for ${roleItem.description.toLowerCase()}.`,
              ephemeral: true
            });
          }
        }
      } catch (btnErr) {
        if (btnErr.code === 10062) return;
        logger.error(`Error handling button interaction ${customId}: ${btnErr.message}`);
        const errMsg = `❌ An unexpected error occurred: ${btnErr.message}`;
        if (interaction.deferred || interaction.replied) {
          return interaction.followUp({ content: errMsg, ephemeral: true }).catch(() => {});
        }
        return interaction.reply({ content: errMsg, ephemeral: true }).catch(() => {});
      }
    }
  }
};
