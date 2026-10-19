const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType
} = require('discord.js');
const theme = require('../../utils/theme');
const db = require('../../utils/database');
const eventManager = require('../../utils/eventManager');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('Manage community tournaments and events')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Schedule a new Minecraft PvP tournament or community event')
        .addStringOption(opt =>
          opt
            .setName('title')
            .setDescription('Event title (e.g., Weekend 1.8 BuildUHC Tournament)')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('description')
            .setDescription('Details regarding rules, prizes, and game format')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('time')
            .setDescription('Event date/time in UTC (e.g., "2026-10-25 18:00 UTC" or Unix timestamp)')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('location')
            .setDescription('Minecraft server IP or Discord voice channel')
            .setRequired(false)
        )
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Channel to post the event announcement (default: current channel)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('cancel')
        .setDescription('Cancel a scheduled event by message ID')
        .addStringOption(opt =>
          opt
            .setName('message_id')
            .setDescription('The Discord message ID of the event')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('List all scheduled community events')
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'create') {
      const title = interaction.options.getString('title').trim();
      const description = interaction.options.getString('description').trim();
      const timeStr = interaction.options.getString('time').trim();
      const location = interaction.options.getString('location');
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

      // Parse time
      let eventTime = Date.parse(timeStr);
      if (isNaN(eventTime)) {
        // Try parsing as unix seconds or milliseconds
        const asNum = parseInt(timeStr, 10);
        if (!isNaN(asNum)) {
          eventTime = asNum < 10000000000 ? asNum * 1000 : asNum;
        }
      }

      if (isNaN(eventTime) || eventTime < Date.now()) {
        return interaction.reply({
          content: '❌ Invalid event time. Please provide a future date and time (e.g., `2026-10-25 18:00 UTC` or standard ISO format).',
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });

      try {
        const { id } = await eventManager.createCommunityEvent({
          guild: interaction.guild,
          channel: targetChannel,
          title,
          description,
          location,
          eventTime,
          host: interaction.user
        });

        return interaction.editReply({
          content: `✅ **Event Scheduled!** Event #${id} ("${title}") has been published in <#${targetChannel.id}>.`
        });
      } catch (err) {
        logger.error(`Failed to create event: ${err.message}`);
        return interaction.editReply({
          content: `❌ Could not create event: ${err.message}`
        });
      }
    }

    if (subcommand === 'cancel') {
      const messageId = interaction.options.getString('message_id').trim();
      const ev = db.getEventByMessage(messageId);

      if (!ev) {
        return interaction.reply({
          content: `❌ Could not find an event with Message ID \`${messageId}\`.`,
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });

      try {
        await eventManager.cancelEventInternal(client, ev.id);
        return interaction.editReply({
          content: `✅ Event #${ev.id} ("${ev.title}") has been cancelled.`
        });
      } catch (err) {
        return interaction.editReply({
          content: `❌ Could not cancel event: ${err.message}`
        });
      }
    }

    if (subcommand === 'list') {
      const active = db.getActiveEvents();

      if (active.length === 0) {
        return interaction.reply({
          content: 'ℹ️ There are currently no scheduled events.',
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setTitle('📅 Scheduled Community Events')
        .setColor(theme.colors.events)
        .setDescription(`Upcoming community events in OlflazMC:`)
        .setFooter({ text: theme.footers.standard });

      for (const ev of active) {
        const attendees = db.getEventAttendees(ev.id);
        embed.addFields({
          name: `⚔️ ${ev.title} (ID: #${ev.id})`,
          value:
            `• **Time:** <t:${Math.floor(ev.event_time / 1000)}:F> (<t:${Math.floor(ev.event_time / 1000)}:R>)\n` +
            `• **Channel:** <#${ev.channel_id}>\n` +
            `• **Attendees:** \`${attendees.length}\`\n` +
            `• **Message ID:** \`${ev.message_id}\``,
          inline: false
        });
      }

      return interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }
  }
};
