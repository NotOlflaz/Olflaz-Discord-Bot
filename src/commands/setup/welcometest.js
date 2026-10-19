const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');
const { buildWelcomePayload, getWelcomeChannel } = require('../../events/guildMemberAdd');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcometest')
    .setDescription('Simulate and preview the official welcome message for a member (Staff Only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addUserOption(opt =>
      opt
        .setName('target')
        .setDescription('The member to preview welcome message for (defaults to you)')
        .setRequired(false)
    )
    .addBooleanOption(opt =>
      opt
        .setName('send_to_channel')
        .setDescription('If true, posts to the live welcome channel. If false, shows ephemeral preview.')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('target') || interaction.user;
    const sendToChannel = interaction.options.getBoolean('send_to_channel') ?? false;
    const guild = interaction.guild;

    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null) || interaction.member;

    const payload = buildWelcomePayload({ member: targetMember, guild });

    if (!sendToChannel) {
      return interaction.reply({
        content: '👀 **Welcome Message Preview (Ephemeral - Only you can see this):**',
        embeds: payload.embeds,
        components: payload.components,
        ephemeral: true
      });
    }

    // Send to live welcome channel
    await interaction.deferReply({ ephemeral: true });
    const welcomeChannel = getWelcomeChannel(guild);

    if (!welcomeChannel) {
      return interaction.editReply({
        content: '❌ Could not find a suitable `#welcome` channel in this server.'
      });
    }

    try {
      const msg = await welcomeChannel.send(payload);
      return interaction.editReply({
        content: `✅ **Live test welcome message sent to <#${welcomeChannel.id}>!** [Jump to message](${msg.url})`
      });
    } catch (err) {
      return interaction.editReply({
        content: `❌ Failed to send welcome message: ${err.message}`
      });
    }
  }
};
