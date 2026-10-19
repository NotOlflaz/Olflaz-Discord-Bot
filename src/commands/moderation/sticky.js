const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder
} = require('discord.js');
const db = require('../../utils/database');
const theme = require('../../utils/theme');
const {
  buildStickyEmbed,
  configureStickyMessage,
  removeStickyMessage
} = require('../../utils/stickyManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sticky')
    .setDescription('Configure, manage, or preview persistent sticky notices in channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Create or update a persistent sticky notice in a channel')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('The text channel to attach the sticky message to')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('title')
            .setDescription('Title for the sticky notice embed')
            .setRequired(true)
            .setMaxLength(100)
        )
        .addStringOption(opt =>
          opt
            .setName('description')
            .setDescription('Main message/rules text of the sticky notice')
            .setRequired(true)
            .setMaxLength(2000)
        )
        .addStringOption(opt =>
          opt
            .setName('color')
            .setDescription('Optional hex color code (e.g. #00D2D3)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove the active sticky notice from a channel')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('The channel to remove the sticky notice from')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('List all currently active sticky messages configured in this server')
    )
    .addSubcommand(sub =>
      sub
        .setName('preview')
        .setDescription('Preview what a sticky notice will look like without applying it')
        .addStringOption(opt =>
          opt
            .setName('title')
            .setDescription('Title of the sticky notice')
            .setRequired(true)
            .setMaxLength(100)
        )
        .addStringOption(opt =>
          opt
            .setName('description')
            .setDescription('Description of the sticky notice')
            .setRequired(true)
            .setMaxLength(2000)
        )
        .addStringOption(opt =>
          opt
            .setName('color')
            .setDescription('Optional hex color code')
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (subcommand === 'preview') {
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const color = interaction.options.getString('color');

      const embed = buildStickyEmbed({ title, description, color });

      return interaction.reply({
        content: '👀 **Sticky Message Preview (Not Saved Yet):**\n*This message demonstrates how the notice will appear near the latest chat messages.*',
        embeds: [embed],
        ephemeral: true
      });
    }

    if (subcommand === 'set') {
      await interaction.deferReply({ ephemeral: true });

      const channel = interaction.options.getChannel('channel');
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const color = interaction.options.getString('color');

      await configureStickyMessage({
        channel,
        guildId: guild.id,
        content: '',
        title,
        description,
        color
      });

      return interaction.editReply({
        content:
          `✅ **Sticky Message Configured in <#${channel.id}>!**\n\n` +
          `• **Title:** ${title}\n` +
          `• **Channel:** <#${channel.id}>\n` +
          `• **How it works:** When users chat in <#${channel.id}>, the bot automatically keeps this notice at the bottom after a short 4-second delay.\n` +
          `• *To remove it anytime, run \`/sticky remove channel:#${channel.name}\`.*`
      });
    }

    if (subcommand === 'remove') {
      await interaction.deferReply({ ephemeral: true });
      const channel = interaction.options.getChannel('channel');

      const removed = await removeStickyMessage(channel);

      if (!removed) {
        return interaction.editReply({
          content: `⚠️ No active sticky message was found for <#${channel.id}>.`
        });
      }

      return interaction.editReply({
        content: `✅ **Sticky notice removed from <#${channel.id}>!**`
      });
    }

    if (subcommand === 'list') {
      const stickies = db.getAllActiveStickyMessages(guild.id);

      if (!stickies || stickies.length === 0) {
        return interaction.reply({
          content: 'ℹ️ There are currently **no active sticky messages** configured in this server. Use `/sticky set` to create one!',
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setTitle('📌 Active Server Sticky Notices')
        .setColor(theme.colors.primary)
        .setDescription('Below are all channels where automated sticky messages are currently active:')
        .setTimestamp();

      for (const s of stickies) {
        embed.addFields({
          name: `💬 <#${s.channel_id}>`,
          value: `**${s.embed_title || 'Notice'}**\n${(s.embed_description || '').slice(0, 150)}...`,
          inline: false
        });
      }

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};
