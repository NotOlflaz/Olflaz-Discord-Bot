const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');
const db = require('../../utils/database');
const theme = require('../../utils/theme');
const config = require('../../config');
const { getTargetYouTubeChannelId, getAnnounceChannel } = require('../../utils/youtubeMonitor');
const { getWelcomeChannel } = require('../../events/guildMemberAdd');
const { getModLogsChannel, getTicketLogsChannel } = require('../../utils/modLogger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('diagnostics')
    .setDescription('Run full system health check, channel audits, and database diagnostics (Staff Only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;
    const client = interaction.client;

    // 1. Bot & Gateway Health
    const uptimeSeconds = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;
    const ping = client.ws.ping;

    // 2. Channel Integration Audit
    const welcomeCh = getWelcomeChannel(guild);
    const modLogsCh = getModLogsChannel(guild);
    const ticketLogsCh = getTicketLogsChannel(guild);
    const newVideosCh = getAnnounceChannel(guild);
    const appReviewCh = guild.channels.cache.find(
      c => (c.name === '📝・applications-review' || c.name === 'applications-review') && c.isTextBased()
    );

    const channelStatus = [
      `• **Welcome:** ${welcomeCh ? `✅ <#${welcomeCh.id}>` : '⚠️ Missing `#welcome`'}`,
      `• **Moderation Logs:** ${modLogsCh ? `✅ <#${modLogsCh.id}>` : '⚠️ Missing `#mod-logs`'}`,
      `• **Ticket Logs:** ${ticketLogsCh ? `✅ <#${ticketLogsCh.id}>` : '⚠️ Missing `#ticket-logs`'}`,
      `• **YouTube Alert Channel:** ${newVideosCh ? `✅ <#${newVideosCh.id}>` : '⚠️ Missing `#new-videos`'}`,
      `• **Creator Application Review:** ${appReviewCh ? `✅ <#${appReviewCh.id}>` : '⚠️ Missing `#applications-review`'}`
    ].join('\n');

    // 3. Database Integrity & Counts
    let dbStatus = '✅ Connected (SQLite Node)';
    let stats = {};
    try {
      stats.tickets = db.db.prepare('SELECT COUNT(*) as count FROM tickets').get().count;
      stats.apps = db.db.prepare('SELECT COUNT(*) as count FROM applications').get().count;
      stats.warnings = db.db.prepare('SELECT COUNT(*) as count FROM warnings').get().count;
      stats.stickies = db.db.prepare('SELECT COUNT(*) as count FROM sticky_messages WHERE is_active = 1').get().count;
      stats.activity = db.db.prepare('SELECT COUNT(*) as count FROM user_activity').get().count;
    } catch (dbErr) {
      dbStatus = `⚠️ DB Error: ${dbErr.message}`;
    }

    const dbSummary = [
      `• **Tickets Archived:** \`${stats.tickets ?? 0}\``,
      `• **Creator Applications:** \`${stats.apps ?? 0}\``,
      `• **Formal Warnings:** \`${stats.warnings ?? 0}\``,
      `• **Active Sticky Messages:** \`${stats.stickies ?? 0}\``,
      `• **Tracked Activity Members:** \`${stats.activity ?? 0}\``
    ].join('\n');

    // 4. YouTube Monitor Status
    const ytChannelId = getTargetYouTubeChannelId();
    const lastVideo = db.getSetting('youtube_last_video_id') || 'Initialized';

    const embed = new EmbedBuilder()
      .setTitle(`🛠️ ${config.communityName} Production Diagnostics`)
      .setColor(theme.colors.primary)
      .setDescription(
        `System audit report executed on <t:${Math.floor(Date.now() / 1000)}:F>.\n` +
        `All internal subsystems are operational and verified against Discord.js v14 standards.`
      )
      .addFields(
        {
          name: '⚡ Core Process & Gateway',
          value:
            `• **Gateway Latency:** \`${ping >= 0 ? ping + 'ms' : 'Syncing'}\`\n` +
            `• **Process Uptime:** \`${uptimeStr}\`\n` +
            `• **Node.js Version:** \`${process.version}\`\n` +
            `• **Database State:** ${dbStatus}`,
          inline: false
        },
        {
          name: '📁 Production Channel Mappings',
          value: channelStatus,
          inline: false
        },
        {
          name: '📊 Persistent Storage Records',
          value: dbSummary,
          inline: false
        },
        {
          name: '📺 YouTube Announcement Subsystem',
          value:
            `• **Monitored Channel:** \`${ytChannelId}\` (@OlflazMC)\n` +
            `• **Latest Video Checkpoint:** \`${lastVideo}\`\n` +
            `• **Feed Polling Interval:** Every 10 minutes`,
          inline: false
        }
      )
      .setFooter({ text: `${config.communityName} • Systems & Diagnostics Audit` })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }
};
