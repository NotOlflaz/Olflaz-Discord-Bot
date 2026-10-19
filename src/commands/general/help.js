const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const theme = require('../../utils/theme');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('List all available OlflazMC bot commands and features'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle(`⚔️ ${config.communityName} Bot — Command & Systems Guide`)
      .setColor(theme.colors.primary)
      .setDescription(
        `Welcome to the **${config.communityName}** bot assistant!\n` +
        `Below are all the commands and interactive systems available:`
      )
      .addFields(
        {
          name: '🛠️ Server Setup & Roles',
          value:
            '`/setup [preview]` — Configure categories, channels, 17-role hierarchy & starter embeds.\n' +
            '`/roles-panel` — Deploy the 5 community self-role buttons (Minecraft, PvP, UHC FFA, YouTube, Events).\n' +
            '`/ticket-panel [channel]` — Deploy the interactive ticket buttons panel (Support, Reports, Creator Apply).'
        },
        {
          name: '🎉 Giveaways & Events',
          value:
            '`/giveaway create <prize> <duration> [winners] [channel]` — Launch a giveaway with 🎟️ buttons.\n' +
            '`/giveaway end <message_id>` — Conclude an active giveaway early.\n' +
            '`/giveaway reroll <message_id> [winners]` — Pick new winner(s) fairly.\n' +
            '`/giveaway list` — List all active giveaways.\n' +
            '`/event create <title> <desc> <time> [loc] [channel]` — Schedule a PvP event with RSVP buttons.\n' +
            '`/event cancel <message_id>` — Cancel a scheduled event.\n' +
            '`/event list` — View all upcoming community events.'
        },
        {
          name: '🛡️ Moderation Commands',
          value:
            '`/warn <user> <reason>` — Issue an official warning logged in database & `#mod-logs`.\n' +
            '`/warnings view <user>` — View warning history for a member.\n' +
            '`/warnings clear <user>` — Clear warning records for a member.\n' +
            '`/timeout <user> <duration> [reason]` — Timeout a member (e.g. `10m`, `1h`, `1d`).\n' +
            '`/untimeout <user>` — Remove a member\'s active timeout.\n' +
            '`/kick <user> [reason]` — Kick a member from the server.\n' +
            '`/ban <user> [reason] [purge_days]` — Ban a member and purge messages.\n' +
            '`/clear <amount> [user]` — Bulk delete up to 100 messages.'
        },
        {
          name: '🎫 Support Tickets & Creator Applications',
          value:
            '`/ticket open <type>` — Open a private support ticket directly via slash command.\n' +
            '`/ticket close` — Close the current ticket and generate an archived transcript.\n' +
            '• **Ticket Panel:** Click buttons in `#🎫・open-a-ticket` to open private tickets.\n' +
            '• **Creator Applications:** Modals capture channel links & pitch; sent to `applications-review`.\n' +
            '• **HTML Transcripts:** Fully XSS-escaped transcripts generated and logged upon ticket closure.'
        },
        {
          name: '💡 Suggestions & YouTube RSS',
          value:
            '• **Suggestions:** Modal submission and live 🟢/🔴 community vote tracking in `suggestions`.\n' +
            '• **YouTube RSS:** Automated checks for `@OlflazMC` uploads announced in `new-videos`.'
        },
        {
          name: 'ℹ️ General & Info',
          value:
            '`/ping` — Test bot connection and latency.\n' +
            '`/serverinfo` — View server statistics.\n' +
            '`/help` — Display this guide.'
        }
      )
      .setFooter({ text: theme.footers.standard })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
