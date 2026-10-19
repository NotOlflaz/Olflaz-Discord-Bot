const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    const { guild, user } = member;

    logger.info(`New member joined: ${user.tag} (${user.id}) in ${guild.name}`);

    // 1. Auto-assign default Member role if it exists and hierarchy allows
    try {
      const defaultRole = guild.roles.cache.find(
        r => (r.name.toLowerCase() === 'member' || r.name.toLowerCase() === '👤 member') && !r.managed
      );
      if (defaultRole && guild.members.me.roles.highest.position > defaultRole.position) {
        await member.roles.add(defaultRole);
        logger.info(`Auto-assigned @Member role to ${user.tag}`);
      }
    } catch (err) {
      logger.warn(`Could not auto-assign @Member role: ${err.message}`);
    }

    // 2. Find target welcome channel
    const welcomeChannel = guild.channels.cache.find(
      c => (c.name.includes('welcome') || c.name === 'general-chat') && c.isTextBased()
    ) || guild.systemChannel;

    if (!welcomeChannel) return;

    // 3. Find navigation channels to guide user
    const rulesChannel = guild.channels.cache.find(
      c => c.name.includes('rules') && c.isTextBased()
    );

    const rolesChannel = guild.channels.cache.find(
      c => (c.name.includes('choose-roles') || c.name.includes('roles')) && c.isTextBased()
    );

    const generalChannel = guild.channels.cache.find(
      c => c.name.includes('general') && c.isTextBased()
    );

    // 4. Create Rich Welcome Embed
    const welcomeEmbed = new EmbedBuilder()
      .setTitle(`⚔️ Welcome to ${config.communityName}, ${user.username}!`)
      .setColor(config.colors.primary)
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(
        `Hey ${member}, welcome to the official **${config.communityName}** Minecraft community!\n\n` +
        `Ready to jump into competitive PvP, UHC matches, and community events? Here is how to get started:\n\n` +
        `• 📜 **Step 1:** Read the rules in ${rulesChannel ? `<#${rulesChannel.id}>` : '#rules'}\n` +
        `• 🎭 **Step 2:** Pick your ping roles in ${rolesChannel ? `<#${rolesChannel.id}>` : '#choose-roles'} (**PvP**, **UHC FFA**, **Events**, **Minecraft**, **YouTube Updates**)\n` +
        `• 💬 **Step 3:** Say hello to everyone in ${generalChannel ? `<#${generalChannel.id}>` : '#general-chat'}!\n\n` +
        `Have fun and enjoy the fights!`
      )
      .addFields(
        { name: '👤 Member', value: `${user.tag}`, inline: true },
        { name: '👥 Member Count', value: `#${guild.memberCount}`, inline: true }
      )
      .setFooter({ text: `${config.communityName} • Community Member #${guild.memberCount}` })
      .setTimestamp();

    try {
      await welcomeChannel.send({
        content: `👋 Welcome ${member}!`,
        embeds: [welcomeEmbed]
      });
    } catch (err) {
      logger.error(`Failed to send welcome message: ${err.message}`);
    }
  }
};
