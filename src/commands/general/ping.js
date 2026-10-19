const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot latency and WebSocket response time'),

  async execute(interaction) {
    const sent = await interaction.reply({
      content: '🏓 Pinging...',
      fetchReply: true
    });

    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const wsPing = interaction.client.ws.ping;

    const embed = new EmbedBuilder()
      .setTitle('🏓 Pong!')
      .setColor(config.colors.primary)
      .addFields(
        { name: '📡 Roundtrip Latency', value: `\`${roundtrip}ms\``, inline: true },
        { name: '💓 WebSocket Heartbeat', value: `\`${wsPing}ms\``, inline: true }
      )
      .setFooter({ text: `${config.communityName} Bot` })
      .setTimestamp();

    await interaction.editReply({ content: null, embeds: [embed] });
  }
};
