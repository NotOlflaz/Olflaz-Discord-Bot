const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Display detailed statistics and information about this server'),

  async execute(interaction) {
    await interaction.deferReply();
    const { guild } = interaction;
    await guild.fetch();

    const owner = await guild.fetchOwner();
    const channels = guild.channels.cache;
    const textChannels = channels.filter(c => c.type === ChannelType.GuildText).size;
    const voiceChannels = channels.filter(c => c.type === ChannelType.GuildVoice).size;
    const categories = channels.filter(c => c.type === ChannelType.GuildCategory).size;

    const embed = new EmbedBuilder()
      .setTitle(`🏰 ${guild.name} — Server Information`)
      .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
      .setColor(config.colors.primary)
      .addFields(
        { name: '👑 Server Owner', value: `${owner.user.tag} (<@${owner.id}>)`, inline: true },
        { name: '🆔 Server ID', value: `\`${guild.id}\``, inline: true },
        { name: '📅 Created On', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
        { name: '👥 Members', value: `**${guild.memberCount}** members`, inline: true },
        { name: '🛡️ Roles', value: `**${guild.roles.cache.size}** roles`, inline: true },
        { name: '💬 Channels', value: `📁 ${categories} Categories\n💬 ${textChannels} Text\n🔊 ${voiceChannels} Voice`, inline: true }
      )
      .setFooter({ text: `${config.communityName} Community` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
