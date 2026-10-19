const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');
const config = require('../config');
const theme = require('./theme');
const logger = require('./logger');
const db = require('./database');
const ticketManager = require('./ticketManager');

/**
 * Builds the Creator Application Modal
 */
function buildApplicationModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_creator_app')
    .setTitle('🎥 Creator Application');

  const channelInput = new TextInputBuilder()
    .setCustomId('app_channel_link')
    .setLabel('YouTube Channel Link / Handle')
    .setPlaceholder('https://youtube.com/@OlflazMC or @YourHandle')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(100);

  const contentInput = new TextInputBuilder()
    .setCustomId('app_content_type')
    .setLabel('Content Focus / Game Modes')
    .setPlaceholder('e.g., Minecraft 1.8 PvP, UHC FFA, Highlights, Tutorials')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(80);

  const statsInput = new TextInputBuilder()
    .setCustomId('app_subs_views')
    .setLabel('Subscriber Count & Average Views')
    .setPlaceholder('e.g., 2,500 subscribers, ~1,500 views per video')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(2)
    .setMaxLength(80);

  const reasonInput = new TextInputBuilder()
    .setCustomId('app_reason')
    .setLabel('Why do you want to join our Creator Team?')
    .setPlaceholder('Tell us about your upload schedule, goals, and why you want to represent OlflazMC.')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(15)
    .setMaxLength(1000);

  modal.addComponents(
    new ActionRowBuilder().addComponents(channelInput),
    new ActionRowBuilder().addComponents(contentInput),
    new ActionRowBuilder().addComponents(statsInput),
    new ActionRowBuilder().addComponents(reasonInput)
  );

  return modal;
}

/**
 * Handles the submission of the Creator Application Modal
 */
async function handleApplicationSubmit(interaction) {
  const { guild, member, user } = interaction;

  // Immediately defer response to avoid 3-second timeout
  await interaction.deferReply({ ephemeral: true });

  const channelLink = interaction.fields.getTextInputValue('app_channel_link').trim();
  const contentType = interaction.fields.getTextInputValue('app_content_type').trim();
  const subsViews = interaction.fields.getTextInputValue('app_subs_views').trim();
  const reason = interaction.fields.getTextInputValue('app_reason').trim();

  // Basic validation
  if (!channelLink || !contentType || !reason) {
    return interaction.editReply({
      content: '❌ Please complete all fields with valid information.'
    });
  }

  // Prevent multiple pending applications from the same user
  const existingApp = db.db.prepare(
    "SELECT * FROM applications WHERE user_id = ? AND status = 'pending'"
  ).get(user.id);

  if (existingApp) {
    return interaction.editReply({
      content: '⚠️ You already have an active Creator Application pending review by our staff team. Please wait for an outcome before submitting another.'
    });
  }

  // Find applications-review channel
  const reviewChannel = guild.channels.cache.find(
    c => c.name === '📝・applications-review' || c.name === 'applications-review'
  );

  // 1. Create a private support ticket for this applicant
  let ticketResult = null;
  try {
    ticketResult = await ticketManager.createTicketChannel({ guild, member, ticketType: 'applications' });
  } catch (err) {
    logger.warn(`Could not create ticket channel for creator app: ${err.message}`);
  }

  // 2. Save application in DB
  const appId = db.createApplication({
    userId: user.id,
    userTag: user.tag,
    channelLink,
    contentType: `${contentType} (${subsViews})`,
    reason,
    messageId: null,
    channelId: reviewChannel ? reviewChannel.id : null
  });

  // 3. Post to applications-review channel if available
  if (reviewChannel) {
    const reviewEmbed = new EmbedBuilder()
      .setTitle(`📝 New Creator Application #${appId}`)
      .setColor(theme.colors.accent)
      .setDescription(
        `A new creator application has been submitted by <@${user.id}>.\n` +
        `Staff members can review the submission and accept or decline below.`
      )
      .addFields(
        { name: '👤 Applicant', value: `<@${user.id}> (\`${user.tag}\` / \`${user.id}\`)`, inline: true },
        { name: '📺 Channel Link', value: `${channelLink}`, inline: true },
        { name: '🎯 Content Focus', value: `${contentType}`, inline: true },
        { name: '📊 Channel Stats', value: `${subsViews}`, inline: true },
        { name: '🎫 Private Ticket', value: ticketResult && ticketResult.channel ? `<#${ticketResult.channel.id}>` : '`None`', inline: true },
        { name: '⏳ Status', value: '`Pending Staff Review`', inline: true },
        { name: '💡 Creator Pitch / Motivation', value: reason, inline: false }
      )
      .setFooter({ text: theme.footers.standard })
      .setTimestamp();

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`app_accept_${appId}`)
        .setLabel('Accept Application')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`app_reject_${appId}`)
        .setLabel('Reject Application')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger)
    );

    try {
      const msg = await reviewChannel.send({
        embeds: [reviewEmbed],
        components: [actionRow]
      });

      // Update message ID in DB
      db.db.prepare('UPDATE applications SET message_id = ? WHERE id = ?').run(msg.id, appId);
    } catch (err) {
      logger.error(`Failed to post application to review channel: ${err.message}`);
    }
  }

  // If a ticket channel was created, notify in the ticket channel as well
  if (ticketResult && ticketResult.channel) {
    try {
      const appNoticeEmbed = new EmbedBuilder()
        .setTitle('🎥 Creator Application Logged')
        .setColor(theme.colors.accent)
        .setDescription(
          `Your application (Application #${appId}) has been successfully submitted and forwarded to our staff review team in <#${reviewChannel?.id || 'applications-review'}>.\n\n` +
          `Staff will evaluate your channel and communicate directly with you here in this private ticket channel!`
        )
        .addFields(
          { name: '📺 Submitted Channel', value: channelLink, inline: true },
          { name: '🎯 Content Focus', value: contentType, inline: true }
        )
        .setTimestamp();

      await ticketResult.channel.send({ embeds: [appNoticeEmbed] });
    } catch (err) {
      logger.warn(`Could not send application notice to ticket channel: ${err.message}`);
    }
  }

  logger.info(`Creator application #${appId} submitted by ${user.tag} (${user.id})`);

  return interaction.editReply({
    content:
      `✅ **Application Submitted!** Your Creator Application (#${appId}) has been delivered to the OlflazMC staff team.\n` +
      (ticketResult && ticketResult.channel
        ? `A private ticket channel has also been created for you: <#${ticketResult.channel.id}>`
        : 'Our staff will review your channel and reach out to you soon!')
  });
}

/**
 * Handles Accept/Reject buttons on creator applications
 */
async function handleApplicationAction(interaction, action, appId) {
  const { guild, member, user } = interaction;

  // Check staff permissions
  const isOwner = guild.ownerId === user.id;
  const isStaff = isOwner ||
    member.permissions.has(PermissionFlagsBits.ManageGuild) ||
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.roles.cache.some(r =>
      config.staffPolicy.ticketAccessRoles.some(name =>
        r.name.toLowerCase().includes(name.toLowerCase().replace(/^[^\w\s]+\s*/, ''))
      )
    );

  if (!isStaff) {
    return interaction.reply({
      content: '❌ Only authorized staff members can review creator applications.',
      ephemeral: true
    });
  }

  const app = db.getApplicationById(appId);
  if (!app) {
    return interaction.reply({
      content: '❌ Application not found in the database.',
      ephemeral: true
    });
  }

  if (app.status !== 'pending') {
    return interaction.reply({
      content: `⚠️ This application has already been **${app.status.toUpperCase()}** by ${app.reviewed_by_tag || 'staff'}.`,
      ephemeral: true
    });
  }

  // Immediately defer update
  await interaction.deferUpdate();

  const isAccepted = action === 'accept';
  const newStatus = isAccepted ? 'accepted' : 'rejected';

  // Update in SQLite
  db.updateApplicationStatus(appId, newStatus, user.id, user.tag, '');

  // Update review embed
  const originalEmbed = interaction.message.embeds[0];
  const updatedEmbed = EmbedBuilder.from(originalEmbed)
    .setColor(isAccepted ? theme.colors.success : theme.colors.error)
    .spliceFields(
      5, // Status field index
      1,
      {
        name: isAccepted ? '✅ Decision' : '❌ Decision',
        value: `**${isAccepted ? 'ACCEPTED' : 'REJECTED'}** by <@${user.id}> (<t:${Math.floor(Date.now() / 1000)}:R>)`,
        inline: true
      }
    );

  const disabledRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`app_done_${appId}`)
      .setLabel(isAccepted ? `Accepted by ${user.username}` : `Rejected by ${user.username}`)
      .setEmoji(isAccepted ? '✅' : '❌')
      .setStyle(isAccepted ? ButtonStyle.Success : ButtonStyle.Danger)
      .setDisabled(true)
  );

  await interaction.message.edit({
    embeds: [updatedEmbed],
    components: [disabledRow]
  }).catch(err => logger.warn(`Could not update application review message: ${err.message}`));

  // Attempt to notify applicant via DM
  let dmSent = false;
  try {
    const applicantUser = await interaction.client.users.fetch(app.user_id);
    if (applicantUser) {
      const dmEmbed = new EmbedBuilder()
        .setTitle(isAccepted ? '🎉 Creator Application Accepted!' : '📝 Creator Application Update')
        .setColor(isAccepted ? theme.colors.success : theme.colors.error)
        .setDescription(
          isAccepted
            ? `Congratulations **${applicantUser.username}**!\n\n` +
              `Your Creator Application for the **OlflazMC Community** has been **ACCEPTED** by staff member **${user.tag}**.\n\n` +
              `*A staff member will assign your verified YouTuber / YouTuber+ role in the server shortly.* Welcome to the creator team!`
            : `Hello **${applicantUser.username}**,\n\n` +
              `Thank you for applying to the OlflazMC Creator Program. After reviewing your channel, our staff team has decided to **decline** your application at this time.\n\n` +
              `You are welcome to re-apply in the future as your channel continues to grow and publish new Minecraft content!`
        )
        .setFooter({ text: theme.footers.standard })
        .setTimestamp();

      await applicantUser.send({ embeds: [dmEmbed] });
      dmSent = true;
    }
  } catch (dmErr) {
    logger.warn(`Could not deliver application DM to applicant (${app.user_id}): ${dmErr.message}`);
  }

  logger.info(`Application #${appId} was ${newStatus} by ${user.tag}`);

  // Send ephemeral confirmation
  return interaction.followUp({
    content:
      `✅ **Application #${appId} Marked as ${newStatus.toUpperCase()}**.\n` +
      `• Applicant: <@${app.user_id}>\n` +
      `• DM Notification: ${dmSent ? '✅ Delivered' : '⚠️ User has DMs disabled'}\n` +
      (isAccepted
        ? '💡 *Reminder: Please manually assign the appropriate YouTuber or YouTuber+ role to the user in server settings.*'
        : ''),
    ephemeral: true
  });
}

module.exports = {
  buildApplicationModal,
  handleApplicationSubmit,
  handleApplicationAction
};
