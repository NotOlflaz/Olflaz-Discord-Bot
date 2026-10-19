const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');
const db = require('../../utils/database');
const {
  buildLeaderboardEmbed,
  syncLeaderboardMessage
} = require('../../utils/leaderboardManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View and manage official OlflazMC community rankings & activity leaderboard')
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName('view')
        .setDescription('View the current community activity leaderboard')
    )
    .addSubcommand(sub =>
      sub
        .setName('post')
        .setDescription('Post or refresh the live leaderboard embed in #leaderboards (Staff Only)')
    )
    .addSubcommand(sub =>
      sub
        .setName('reset')
        .setDescription('Reset weekly activity points for a new season (Admin Only)')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (subcommand === 'view') {
      await interaction.deferReply({ ephemeral: false });
      const embed = await buildLeaderboardEmbed(guild);
      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'post') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({
          content: '❌ You must have `Manage Messages` permission to sync the leaderboard.',
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });
      const result = await syncLeaderboardMessage(guild);

      if (!result) {
        return interaction.editReply({
          content: '⚠️ Could not find a suitable `#leaderboards` channel in this server.'
        });
      }

      return interaction.editReply({
        content: `✅ **Leaderboard ${result.created ? 'posted' : 'refreshed in place'} in <#${result.message.channel.id}>!**`
      });
    }

    if (subcommand === 'reset') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: '❌ Only Server Administrators can reset weekly leaderboard points.',
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });
      db.resetWeeklyActivity(guild.id);
      await syncLeaderboardMessage(guild).catch(() => {});

      return interaction.editReply({
        content: '✅ **Weekly leaderboard points successfully reset for the new week!**'
      });
    }
  }
};
