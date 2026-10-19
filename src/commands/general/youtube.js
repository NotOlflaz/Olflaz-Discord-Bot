const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder
} = require('discord.js');
const db = require('../../utils/database');
const theme = require('../../utils/theme');
const config = require('../../config');
const {
  getTargetYouTubeChannelId,
  getAnnounceChannel,
  checkYouTubeFeed
} = require('../../utils/youtubeMonitor');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('youtube')
    .setDescription('Inspect or configure official OlflazMC YouTube channel announcements')
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('View current YouTube monitoring configuration, feed status, and channel ID')
    )
    .addSubcommand(sub =>
      sub
        .setName('check')
        .setDescription('Trigger an immediate live poll of the YouTube RSS feed (Staff Only)')
    )
    .addSubcommand(sub =>
      sub
        .setName('set-channel')
        .setDescription('Update the monitored YouTube Channel ID (Admin Only)')
        .addStringOption(opt =>
          opt
            .setName('channel_id')
            .setDescription('The YouTube Channel ID (starts with UC...)')
            .setRequired(true)
            .setMinLength(15)
            .setMaxLength(35)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('set-destination')
        .setDescription('Set the Discord channel where new video announcements appear (Admin Only)')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('The text channel for video alerts')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (subcommand === 'status') {
      const channelId = getTargetYouTubeChannelId();
      const announceChannel = getAnnounceChannel(guild);
      const lastVideoId = db.getSetting('youtube_last_video_id') || 'None recorded yet';

      const embed = new EmbedBuilder()
        .setTitle('📺 OlflazMC YouTube Announcement Status')
        .setColor(theme.colors.youtube)
        .setDescription(
          `The bot continuously checks the official YouTube RSS feed for new video uploads from **OlflazMC**.\n\n` +
          `• **Monitored YouTube Channel ID:** \`${channelId}\`\n` +
          `• **Official Channel URL:** [youtube.com/@OlflazMC](${config.youtube.channelUrl})\n` +
          `• **Announcement Channel:** ${announceChannel ? `<#${announceChannel.id}>` : '⚠️ `#new-videos` not found'}\n` +
          `• **Last Checkpointed Video:** \`${lastVideoId}\`\n` +
          `• **Polling Interval:** Every 10 minutes\n` +
          `• **Ping Role:** \`@📢 YouTube Updates\` (Opt-in only, no @everyone)`
        )
        .setFooter({ text: 'OlflazMC YouTube Monitor' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === 'check') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({
          content: '❌ You need `Manage Messages` permission to trigger a feed check.',
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });
      const result = await checkYouTubeFeed(interaction.client);

      if (!result.success) {
        return interaction.editReply({
          content: `⚠️ Failed to poll YouTube feed: ${result.error}`
        });
      }

      return interaction.editReply({
        content:
          `✅ **YouTube Feed Polled Successfully!**\n` +
          `• Latest Video in Feed: \`${result.videoId || 'None'}\` ("${result.title || 'N/A'}")\n` +
          `• Status: ${result.newUpload ? '🎉 New video announced!' : (result.initialized ? 'Initial checkpoint set.' : 'No new uploads since last check.')}`
      });
    }

    if (subcommand === 'set-channel') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: '❌ Only Administrators can change the YouTube channel ID.',
          ephemeral: true
        });
      }

      const newId = interaction.options.getString('channel_id').trim();
      db.setSetting('youtube_channel_id', newId);

      return interaction.reply({
        content: `✅ **Monitored YouTube Channel ID updated to:** \`${newId}\``,
        ephemeral: true
      });
    }

    if (subcommand === 'set-destination') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: '❌ Only Administrators can change the announcement channel.',
          ephemeral: true
        });
      }

      const channel = interaction.options.getChannel('channel');
      db.setSetting(`youtube_announce_channel_${guild.id}`, channel.id);
      db.setSetting('youtube_announce_channel_id', channel.id);

      return interaction.reply({
        content: `✅ **New video announcements destination set to:** <#${channel.id}>`,
        ephemeral: true
      });
    }
  }
};
