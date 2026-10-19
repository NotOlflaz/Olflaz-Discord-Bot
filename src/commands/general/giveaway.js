const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType
} = require('discord.js');
const ms = require('ms');
const config = require('../../config');
const theme = require('../../utils/theme');
const db = require('../../utils/database');
const giveawayManager = require('../../utils/giveawayManager');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Manage server giveaways and rewards')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Create and launch a new community giveaway')
        .addStringOption(opt =>
          opt
            .setName('prize')
            .setDescription('The prize being given away (e.g., Discord Nitro, VIP Rank, Diamond Kit)')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('duration')
            .setDescription('Duration of giveaway (e.g., 30m, 2h, 1d, 3d)')
            .setRequired(true)
        )
        .addIntegerOption(opt =>
          opt
            .setName('winners')
            .setDescription('Number of winners to select (default: 1)')
            .setMinValue(1)
            .setMaxValue(20)
            .setRequired(false)
        )
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Channel to post the giveaway in (default: current channel)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('end')
        .setDescription('End an active giveaway early and pick winners immediately')
        .addStringOption(opt =>
          opt
            .setName('message_id')
            .setDescription('The Discord Message ID of the active giveaway')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('reroll')
        .setDescription('Reroll new winner(s) for a completed giveaway')
        .addStringOption(opt =>
          opt
            .setName('message_id')
            .setDescription('The Discord Message ID of the ended giveaway')
            .setRequired(true)
        )
        .addIntegerOption(opt =>
          opt
            .setName('winners')
            .setDescription('Number of winners to pick on reroll (default: 1)')
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('View all currently active community giveaways')
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'create') {
      const prize = interaction.options.getString('prize');
      const durationStr = interaction.options.getString('duration');
      const winnerCount = interaction.options.getInteger('winners') || 1;
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

      const durationMs = ms(durationStr);
      if (!durationMs || durationMs < 10000 || durationMs > 30 * 24 * 60 * 60 * 1000) {
        return interaction.reply({
          content: '❌ Invalid duration. Please provide a duration between 10 seconds and 30 days (e.g., `10m`, `1h`, `2d`).',
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });

      try {
        const { id, message } = await giveawayManager.startGiveaway({
          client,
          guild: interaction.guild,
          channel: targetChannel,
          prize,
          durationMs,
          winnerCount,
          host: interaction.user
        });

        return interaction.editReply({
          content: `✅ **Giveaway Launched!** Giveaway #${id} for **${prize}** has been posted in <#${targetChannel.id}>.`
        });
      } catch (err) {
        logger.error(`Failed to launch giveaway: ${err.message}`);
        return interaction.editReply({
          content: `❌ Could not create giveaway: ${err.message}`
        });
      }
    }

    if (subcommand === 'end') {
      const messageId = interaction.options.getString('message_id').trim();
      const gw = db.getGiveawayByMessage(messageId);

      if (!gw) {
        return interaction.reply({
          content: `❌ Could not find an active giveaway with Message ID \`${messageId}\`.`,
          ephemeral: true
        });
      }

      if (gw.status !== 'active') {
        return interaction.reply({
          content: `⚠️ This giveaway has already ended with status \`${gw.status}\`.`,
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });

      try {
        const winners = await giveawayManager.endGiveawayInternal(client, gw);
        return interaction.editReply({
          content: `✅ Giveaway #${gw.id} ended early. Winner(s): ${winners.length > 0 ? winners.map(id => `<@${id}>`).join(', ') : 'None'}.`
        });
      } catch (err) {
        return interaction.editReply({
          content: `❌ Failed to end giveaway: ${err.message}`
        });
      }
    }

    if (subcommand === 'reroll') {
      const messageId = interaction.options.getString('message_id').trim();
      const count = interaction.options.getInteger('winners') || 1;

      await interaction.deferReply({ ephemeral: true });

      try {
        const newWinners = await giveawayManager.rerollGiveaway(client, messageId, count);
        return interaction.editReply({
          content: `✅ Rerolled winner(s): ${newWinners.map(id => `<@${id}>`).join(', ')}!`
        });
      } catch (err) {
        return interaction.editReply({
          content: `❌ Could not reroll giveaway: ${err.message}`
        });
      }
    }

    if (subcommand === 'list') {
      const active = db.getActiveGiveaways();

      if (active.length === 0) {
        return interaction.reply({
          content: 'ℹ️ There are currently no active giveaways running in the server.',
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setTitle('🎉 Active Community Giveaways')
        .setColor(theme.colors.events)
        .setDescription(`There are currently **${active.length}** active giveaway(s):`)
        .setFooter({ text: theme.footers.standard });

      for (const gw of active) {
        embed.addFields({
          name: `🎁 ${gw.prize} (ID: #${gw.id})`,
          value:
            `• Channel: <#${gw.channel_id}>\n` +
            `• Winners: \`${gw.winner_count}\`\n` +
            `• Ends: <t:${Math.floor(gw.ends_at / 1000)}:R>\n` +
            `• Message ID: \`${gw.message_id}\``,
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
