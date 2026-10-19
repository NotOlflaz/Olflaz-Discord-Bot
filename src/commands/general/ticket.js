const {
  SlashCommandBuilder
} = require('discord.js');
const ticketManager = require('../../utils/ticketManager');
const applicationManager = require('../../utils/applicationManager');
const db = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Create or manage your support tickets')
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName('open')
        .setDescription('Open a private support ticket')
        .addStringOption(opt =>
          opt
            .setName('type')
            .setDescription('Type of ticket')
            .setRequired(true)
            .addChoices(
              { name: '🛠️ General Support', value: 'support' },
              { name: '🚨 Player Report', value: 'reports' },
              { name: '🎥 Creator Application', value: 'applications' },
              { name: '❓ Other Inquiries', value: 'other' }
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('close')
        .setDescription('Close the current ticket channel')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'open') {
      const ticketType = interaction.options.getString('type');

      if (ticketType === 'applications') {
        return interaction.showModal(applicationManager.buildApplicationModal());
      }

      return ticketManager.handleTicketCreate(interaction, ticketType);
    }

    if (subcommand === 'close') {
      const ticket = db.getTicketByChannel(interaction.channelId);

      if (!ticket) {
        return interaction.reply({
          content: '❌ This command can only be used inside an active ticket channel.',
          ephemeral: true
        });
      }

      return ticketManager.handleTicketCloseRequest(interaction, ticket.id);
    }
  }
};
