const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const config = require('../config');
const theme = require('../utils/theme');
const logger = require('../utils/logger');
const db = require('../utils/database');

// Deduplication cache for member joins within 10 seconds
const recentJoins = new Map();

/**
 * Resolves the destination welcome channel in a guild
 */
function getWelcomeChannel(guild) {
  if (!guild) return null;

  const configuredId =
    db.getSetting(`welcome_channel_${guild.id}`) ||
    db.getSetting('welcome_channel_id');

  if (configuredId) {
    const ch = guild.channels.cache.get(configuredId);
    if (ch && ch.isTextBased()) return ch;
  }

  const canonicalMap = db.getCanonicalChannelMap(guild.id);
  const mappedId = canonicalMap['👋・welcome'] || canonicalMap['welcome'];
  if (mappedId) {
    const ch = guild.channels.cache.get(mappedId);
    if (ch && ch.isTextBased()) return ch;
  }

  return guild.channels.cache.find(
    c => (c.name.includes('welcome') || c.name === 'welcome') && c.isTextBased()
  ) || guild.systemChannel || null;
}

/**
 * Constructs the official polished welcome payload for a member
 */
function buildWelcomePayload({ member, guild }) {
  const user = member.user;
  const displayName = member.displayName || user.username;

  // Find navigation channels
  const canonicalMap = db.getCanonicalChannelMap(guild.id);

  const findNavChannel = (keys, fallbackNames) => {
    for (const key of keys) {
      if (canonicalMap[key]) {
        const ch = guild.channels.cache.get(canonicalMap[key]);
        if (ch) return ch;
      }
    }
    return guild.channels.cache.find(
      c => fallbackNames.some(name => c.name.includes(name)) && c.isTextBased()
    );
  };

  const rulesChannel = findNavChannel(['📜・rules', 'rules'], ['rules']);
  const rolesChannel = findNavChannel(['🎭・choose-roles', 'roles'], ['choose-roles', 'roles']);
  const generalChannel = findNavChannel(['💬・general-chat', 'general-chat'], ['general-chat', 'general']);

  const memberCount = guild.memberCount || 'Community Member';

  const welcomeEmbed = new EmbedBuilder()
    .setTitle(`⚔️ Welcome to ${config.communityName}, ${displayName}!`)
    .setColor(theme.colors.primary)
    .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setDescription(
      `Hey ${member}, welcome to the official **${config.communityName}** Minecraft & PvP community!\n\n` +
      `We're thrilled to have you here. Jump into competitive duels, UHC matches, events, and creator discussions.\n\n` +
      `**🚀 Getting Started:**\n` +
      `• 📜 **Rules:** Please read our community guidelines in ${rulesChannel ? `<#${rulesChannel.id}>` : '#rules'}.\n` +
      `• 🎭 **Roles:** Pick your ping roles in ${rolesChannel ? `<#${rolesChannel.id}>` : '#choose-roles'} (*PvP, UHC FFA, Events, YouTube*).\n` +
      `• 💬 **Chat:** Introduce yourself to everyone in ${generalChannel ? `<#${generalChannel.id}>` : '#general-chat'}!\n\n` +
      `*Enjoy your stay and good luck in the arena!*`
    )
    .addFields(
      { name: '👤 Member', value: `<@${user.id}> (\`${user.username}\`)`, inline: true },
      { name: '👥 Server Member Count', value: `\`#${memberCount}\``, inline: true }
    )
    .setFooter({ text: `${config.communityName} • Member #${memberCount}` })
    .setTimestamp();

  const components = [];
  const actionRow = new ActionRowBuilder();

  if (rulesChannel) {
    actionRow.addComponents(
      new ButtonBuilder()
        .setLabel('Read Server Rules')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/channels/${guild.id}/${rulesChannel.id}`)
        .setEmoji('📜')
    );
  }

  if (rolesChannel) {
    actionRow.addComponents(
      new ButtonBuilder()
        .setLabel('Pick Ping Roles')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/channels/${guild.id}/${rolesChannel.id}`)
        .setEmoji('🎭')
    );
  }

  if (actionRow.components.length > 0) {
    components.push(actionRow);
  }

  return {
    content: `👋 Welcome <@${user.id}> to **${config.communityName}**!`,
    embeds: [welcomeEmbed],
    components
  };
}

module.exports = {
  name: 'guildMemberAdd',
  getWelcomeChannel,
  buildWelcomePayload,

  async execute(member) {
    if (!member || !member.guild) return;
    const { guild, user } = member;

    // Deduplication check
    const now = Date.now();
    const lastJoin = recentJoins.get(user.id) || 0;
    if (now - lastJoin < 10000) return;
    recentJoins.set(user.id, now);

    logger.info(`New member joined: ${user.tag} (${user.id}) in ${guild.name}`);

    // 1. Auto-assign default Member role if available and permitted
    try {
      const defaultRole = guild.roles.cache.find(
        r => (r.name.toLowerCase() === 'member' || r.name.toLowerCase() === '👤 member') && !r.managed
      );
      if (defaultRole && guild.members.me?.roles.highest.position > defaultRole.position) {
        await member.roles.add(defaultRole);
        logger.info(`Auto-assigned @Member role to ${user.tag}`);
      }
    } catch (err) {
      logger.warn(`Could not auto-assign @Member role: ${err.message}`);
    }

    // 2. Resolve destination welcome channel
    const welcomeChannel = getWelcomeChannel(guild);
    if (!welcomeChannel) {
      logger.warn(`No welcome channel found in ${guild.name} for incoming member ${user.tag}`);
      return;
    }

    // 3. Send rich welcome payload
    try {
      const payload = buildWelcomePayload({ member, guild });
      await welcomeChannel.send(payload);
    } catch (err) {
      logger.error(`Failed to send welcome message in #${welcomeChannel.name}: ${err.message}`);
    }
  }
};
