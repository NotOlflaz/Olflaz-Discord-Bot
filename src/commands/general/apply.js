const { SlashCommandBuilder } = require('discord.js');
const applicationManager = require('../../utils/applicationManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('apply')
    .setDescription('Apply to join the OlflazMC Content Creator Team (YouTuber / YouTuber+)')
    .setDMPermission(false),

  async execute(interaction) {
    return interaction.showModal(applicationManager.buildApplicationModal());
  }
};
