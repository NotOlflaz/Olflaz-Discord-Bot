const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const config = require('../../config');

/**
 * Constructs the Embed and ActionRow containing the 5 role selection buttons
 */
function createRolesPanelPayload() {
  const embed = new EmbedBuilder()
    .setTitle(`⚔️ ${config.communityName} — Role Selector`)
    .setColor(config.colors.primary)
    .setDescription(
      `Welcome to **${config.communityName}**!\n\n` +
      `Click the buttons below to toggle your notification roles.\n` +
      `Customize your pings so you only get alerted for activities you care about!\n\n` +
      `⚔️ **PvP** — Pinged for 1v1 duels, arena matches, and practice calls.\n` +
      `🩸 **UHC FFA** — Pinged for UHC Free-For-All games and custom matches.\n` +
      `🎉 **Events** — Pinged for server tournaments, special streams, and giveaways.\n` +
      `🎮 **Minecraft** — Pinged for general Minecraft game nights and community news.\n` +
      `📢 **YouTube Updates** — Pinged when new OlflazMC videos, clips, and live streams drop.\n\n` +
      `*💡 Tip: Clicking a button toggles the role on or off instantly.*`
    )
    .setFooter({ text: `${config.communityName} • Click a button to toggle your roles` })
    .setTimestamp();

  const buttonStyleMap = {
    Primary: ButtonStyle.Primary,
    Success: ButtonStyle.Success,
    Secondary: ButtonStyle.Secondary,
    Danger: ButtonStyle.Danger
  };

  const row = new ActionRowBuilder();

  for (const roleItem of config.selfRoles) {
    const style = buttonStyleMap[roleItem.style] || ButtonStyle.Primary;
    const button = new ButtonBuilder()
      .setCustomId(roleItem.id)
      .setLabel(roleItem.name)
      .setStyle(style);

    if (roleItem.emoji) {
      button.setEmoji(roleItem.emoji);
    }

    row.addComponents(button);
  }

  return { embeds: [embed], components: [row] };
}

module.exports = {
  createRolesPanelPayload,
  data: new SlashCommandBuilder()
    .setName('roles-panel')
    .setDescription('Post the interactive PvP, UHC FFA, Events, Minecraft, and YouTube role buttons')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(false),

  async execute(interaction) {
    const payload = createRolesPanelPayload();
    await interaction.channel.send(payload);
    await interaction.reply({
      content: '✅ Role selection panel successfully deployed to this channel!',
      ephemeral: true
    });
  }
};
