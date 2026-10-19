const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');
const theme = require('./theme');
const logger = require('./logger');
const db = require('./database');

/**
 * Creates and posts a new community event
 */
async function createCommunityEvent({ guild, channel, title, description, location, eventTime, host }) {
  const embed = new EmbedBuilder()
    .setTitle(`📅 Community Event — ${title}`)
    .setColor(theme.colors.events)
    .setDescription(
      `${description}\n\n` +
      `• **Date & Time:** <t:${Math.floor(eventTime / 1000)}:F> (<t:${Math.floor(eventTime / 1000)}:R>)\n` +
      `• **Location / Server:** \`${location || 'OlflazMC Minecraft Server'}\`\n` +
      `• **Host:** <@${host.id}>`
    )
    .addFields(
      { name: '👥 Registered Attendees', value: '`0`', inline: true },
      { name: '📍 Venue', value: `\`${location || 'OlflazMC Events'}\``, inline: true }
    )
    .setFooter({ text: 'OlflazMC Events • Click the button below to RSVP' })
    .setTimestamp(eventTime);

  const initialRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('event_rsvp_temp')
      .setLabel('RSVP / Register (0)')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success)
  );

  const msg = await channel.send({
    embeds: [embed],
    components: [initialRow]
  });

  const eventId = db.createEvent({
    messageId: msg.id,
    channelId: channel.id,
    guildId: guild.id,
    title,
    description,
    location: location || 'OlflazMC Server',
    eventTime,
    hostId: host.id,
    hostTag: host.tag
  });

  const actualRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`event_rsvp_${eventId}`)
      .setLabel('RSVP / Register (0)')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success)
  );

  await msg.edit({ components: [actualRow] });

  logger.info(`Event #${eventId} ("${title}") created by ${host.tag}`);
  return { id: eventId, message: msg };
}

/**
 * Handles RSVP button click (toggle registration)
 */
async function handleEventRSVP(interaction, eventId) {
  const { user } = interaction;

  const ev = db.getEventById(eventId);
  if (!ev) {
    return interaction.reply({
      content: '❌ Event not found in the database.',
      ephemeral: true
    });
  }

  if (ev.status === 'cancelled') {
    return interaction.reply({
      content: '🔒 This event has been cancelled.',
      ephemeral: true
    });
  }

  await interaction.deferUpdate();

  const { action, count } = db.toggleEventRegistration(eventId, user.id);

  try {
    const originalEmbed = interaction.message.embeds[0];
    if (originalEmbed) {
      const updatedEmbed = EmbedBuilder.from(originalEmbed);
      const fields = [...originalEmbed.fields];
      const attendeesIdx = fields.findIndex(f => f.name.includes('Attendees'));
      if (attendeesIdx !== -1) {
        fields[attendeesIdx] = { name: '👥 Registered Attendees', value: `\`${count}\``, inline: true };
        updatedEmbed.setFields(fields);
      }

      const updatedRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`event_rsvp_${eventId}`)
          .setLabel(`RSVP / Register (${count})`)
          .setEmoji('✅')
          .setStyle(ButtonStyle.Success)
      );

      await interaction.message.edit({
        embeds: [updatedEmbed],
        components: [updatedRow]
      });
    }
  } catch (err) {
    logger.warn(`Could not update event RSVP counter: ${err.message}`);
  }

  return interaction.followUp({
    content: action === 'registered'
      ? `✅ **RSVP Confirmed!** You are now registered for **${ev.title}**! See you on <t:${Math.floor(ev.event_time / 1000)}:F>!`
      : `❌ **Registration Cancelled.** You are no longer registered for **${ev.title}**.`,
    ephemeral: true
  });
}

/**
 * Cancels an event
 */
async function cancelEventInternal(client, eventId) {
  const ev = db.getEventById(eventId);
  if (!ev) throw new Error('Event not found.');

  db.cancelEvent(eventId);

  const channel = await client.channels.fetch(ev.channel_id).catch(() => null);
  if (channel) {
    try {
      const msg = await channel.messages.fetch(ev.message_id);
      if (msg && msg.embeds[0]) {
        const updatedEmbed = EmbedBuilder.from(msg.embeds[0])
          .setTitle(`❌ EVENT CANCELLED — ${ev.title}`)
          .setColor(theme.colors.error)
          .setFooter({ text: 'OlflazMC Events • Cancelled' });

        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`event_cancelled_${eventId}`)
            .setLabel('Event Cancelled')
            .setEmoji('❌')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true)
        );

        await msg.edit({
          embeds: [updatedEmbed],
          components: [disabledRow]
        });
      }
    } catch (err) {
      logger.warn(`Could not update cancelled event message: ${err.message}`);
    }
  }

  logger.info(`Event #${eventId} was cancelled.`);
  return ev;
}

module.exports = {
  createCommunityEvent,
  handleEventRSVP,
  cancelEventInternal
};
