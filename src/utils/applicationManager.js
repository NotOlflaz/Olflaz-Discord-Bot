const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');
const config = require('../config');
const theme = require('./theme');
const logger = require('./logger');
const db = require('./database');
const { logModerationAction } = require('./modLogger');

/**
 * Normalizes strings for role and category matching
 */
function normalizeString(str) {
  if (!str) return '';
  return str
    .normalize('NFKD')
    .replace(/[^\w\s]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Checks if member is authorized to review creator applications
 */
function isApplicationReviewer(member) {
  if (!member) return false;
  if (member.guild?.ownerId === member.id) return true;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (member.permissions?.has(PermissionFlagsBits.ManageGuild)) return true;

  const allowedRoles = config.staffPolicy?.applicationReviewRoles || ['👑 Owner', '🛡️ Admin'];
  const memberRoles = member.roles?.cache
    ? (typeof member.roles.cache.values === 'function' ? Array.from(member.roles.cache.values()) : Array.from(member.roles.cache))
    : [];

  return memberRoles.some(r =>
    allowedRoles.some(allowed => {
      const cleanTarget = normalizeString(allowed);
      const cleanRole = normalizeString(r.name);
      return cleanRole === cleanTarget || cleanRole.includes(cleanTarget);
    })
  );
}

/**
 * Builds the Creator Application Modal with 5 standardized fields
 */
function buildApplicationModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_creator_app')
    .setTitle('🎥 Creator Application');

  const platformInput = new TextInputBuilder()
    .setCustomId('app_platform')
    .setLabel('Primary Platform')
    .setPlaceholder('e.g., YouTube, Twitch, TikTok, Kick')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(2)
    .setMaxLength(30);

  const channelInput = new TextInputBuilder()
    .setCustomId('app_channel_link')
    .setLabel('Channel Link or Handle')
    .setPlaceholder('https://youtube.com/@YourHandle or @YourUsername')
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
    .setCustomId('app_audience_size')
    .setLabel('Audience Size & Recent Performance')
    .setPlaceholder('e.g., 2,500 subscribers / followers, ~1,500 views per video')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(2)
    .setMaxLength(80);

  const reasonInput = new TextInputBuilder()
    .setCustomId('app_reason')
    .setLabel('Why Join the OlflazMC Creator Team?')
    .setPlaceholder('Tell us about your upload schedule, goals, and why you want to represent OlflazMC.')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(15)
    .setMaxLength(1000);

  modal.addComponents(
    new ActionRowBuilder().addComponents(platformInput),
    new ActionRowBuilder().addComponents(channelInput),
    new ActionRowBuilder().addComponents(contentInput),
    new ActionRowBuilder().addComponents(statsInput),
    new ActionRowBuilder().addComponents(reasonInput)
  );

  return modal;
}

/**
 * Creates a dedicated, private creator application ticket channel
 */
async function createCreatorApplicationChannel({ guild, member, appId, platform, channelLink }) {
  // 1. Resolve dedicated category: 「📝」𝗖𝗥𝗘𝗔𝗧𝗢𝗥 𝗔𝗣𝗣𝗟𝗜𝗖𝗔𝗧𝗜𝗢𝗡𝗦
  let category = guild.channels.cache.find(
    c => c.type === ChannelType.GuildCategory && (
      c.name.includes('𝗖𝗥𝗘𝗔𝗧𝗢𝗥') ||
      c.name.includes('APPLICATIONS') ||
      c.name.toLowerCase().includes('creator application') ||
      c.name.toLowerCase().includes('applications')
    )
  );

  // If not found, look under Staff category or create on the fly
  if (!category) {
    category = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name.includes('𝗦𝗧𝗔𝗙𝗙')
    );
  }

  const cleanUsername = member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
  const numPadded = String(appId).padStart(4, '0');
  const channelName = `app-${cleanUsername}-${numPadded}`;

  // 2. Strict least-privilege permission overwrites: applicant, reviewers, and bot
  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ReadMessageHistory
      ]
    },
    {
      id: guild.members.me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ReadMessageHistory
      ]
    }
  ];

  // Add reviewer roles
  const allowedRoles = config.staffPolicy?.applicationReviewRoles || ['👑 Owner', '🛡️ Admin'];
  for (const rName of allowedRoles) {
    const roleTarget = normalizeString(rName);
    const rObj = guild.roles.cache.find(r => {
      const c = normalizeString(r.name);
      return c === roleTarget || c.includes(roleTarget);
    });
    if (rObj) {
      permissionOverwrites.push({
        id: rObj.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ReadMessageHistory
        ]
      });
    }
  }

  const appChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category ? category.id : undefined,
    permissionOverwrites,
    topic: `OlflazMC Creator Application #${numPadded} | Applicant: ${member.user.tag} (${member.id}) | Platform: ${platform}`,
    reason: `Creator application channel opened by ${member.user.tag}`
  });

  return appChannel;
}

/**
 * Handles the submission of the Creator Application Modal
 */
async function handleApplicationSubmit(interaction) {
  const { guild, member, user } = interaction;

  // Immediately defer response to avoid 3-second timeout
  await interaction.deferReply({ ephemeral: true });

  const platform = interaction.fields.getTextInputValue('app_platform').trim();
  const channelLink = interaction.fields.getTextInputValue('app_channel_link').trim();
  const contentType = interaction.fields.getTextInputValue('app_content_type').trim();
  const audienceSize = interaction.fields.getTextInputValue('app_audience_size').trim();
  const reason = interaction.fields.getTextInputValue('app_reason').trim();

  // Validate inputs
  if (!platform || !channelLink || !contentType || !reason) {
    return interaction.editReply({
      content: '❌ Please complete all required fields with valid information.'
    });
  }

  // Prevent duplicate active pending applications
  const existingApp = db.db.prepare(
    "SELECT * FROM applications WHERE user_id = ? AND status = 'pending'"
  ).get(user.id);

  if (existingApp) {
    return interaction.editReply({
      content: '⚠️ You already have an active Creator Application pending review by our staff team. Please wait for an outcome before submitting another.'
    });
  }

  // Find staff applications-review channel
  const reviewChannel = guild.channels.cache.find(
    c => (c.name === '📝・applications-review' || c.name === 'applications-review') && c.isTextBased()
  );

  // 1. Create temporary DB record to obtain Application ID
  const appId = db.createApplication({
    userId: user.id,
    userTag: user.tag,
    channelLink: `[${platform}] ${channelLink}`,
    contentType: `${contentType} (${audienceSize})`,
    reason,
    messageId: null,
    channelId: reviewChannel ? reviewChannel.id : null
  });

  // Record initial audit entry
  db.addApplicationAudit({
    appId,
    action: 'submitted',
    actorId: user.id,
    actorTag: user.tag,
    notes: `Submitted ${platform} creator application`
  });

  // 2. Create dedicated private application channel
  let appChannel = null;
  try {
    appChannel = await createCreatorApplicationChannel({
      guild,
      member,
      appId,
      platform,
      channelLink
    });
  } catch (err) {
    logger.warn(`Could not create dedicated creator application channel: ${err.message}`);
  }

  // 3. Post to staff applications-review channel
  if (reviewChannel) {
    const reviewEmbed = new EmbedBuilder()
      .setTitle(`📝 New Creator Application #${appId}`)
      .setColor(theme.colors.accent)
      .setDescription(
        `A new creator application has been submitted by <@${user.id}>.\n` +
        `Authorized reviewers can evaluate the submission and take action using the controls below.`
      )
      .addFields(
        { name: '👤 Applicant', value: `<@${user.id}> (\`${user.tag}\` • \`${user.id}\`)`, inline: true },
        { name: '📺 Platform & Link', value: `**${platform}**: ${channelLink}`, inline: true },
        { name: '🎯 Content Focus', value: contentType, inline: true },
        { name: '📊 Audience & Stats', value: audienceSize, inline: true },
        { name: '🔒 Private Channel', value: appChannel ? `<#${appChannel.id}>` : '`Not Created`', inline: true },
        { name: '⏳ Status', value: '`Pending Staff Review`', inline: true },
        { name: '💡 Creator Pitch / Motivation', value: reason, inline: false }
      )
      .setFooter({ text: `${config.communityName} • Creator Applications` })
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
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`app_info_${appId}`)
        .setLabel('Request More Info')
        .setEmoji('💬')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`app_note_${appId}`)
        .setLabel('Add Note')
        .setEmoji('📝')
        .setStyle(ButtonStyle.Secondary)
    );

    try {
      const reviewMsg = await reviewChannel.send({
        embeds: [reviewEmbed],
        components: [actionRow]
      });

      // Update message ID in DB
      db.db.prepare('UPDATE applications SET message_id = ? WHERE id = ?').run(reviewMsg.id, appId);
    } catch (err) {
      logger.error(`Failed to post application #${appId} to review channel: ${err.message}`);
    }
  }

  // 4. Send starter embed in the applicant's private application channel
  if (appChannel) {
    try {
      const welcomeEmbed = new EmbedBuilder()
        .setTitle(`🎥 Creator Application #${appId} — Welcome ${user.username}`)
        .setColor(theme.colors.accent)
        .setDescription(
          `Thank you for applying to the **${config.communityName} Creator Program**!\n\n` +
          `Your application has been received and forwarded to our staff review team. ` +
          `Staff will evaluate your channel and reach out directly here if any additional questions or verifications are required.\n\n` +
          `**Submitted Details:**\n` +
          `• **Platform:** ${platform}\n` +
          `• **Channel:** ${channelLink}\n` +
          `• **Content:** ${contentType}\n` +
          `• **Stats:** ${audienceSize}\n\n` +
          `*Please keep this channel open until an evaluation outcome is reached.*`
        )
        .setFooter({ text: theme.footers.standard })
        .setTimestamp();

      await appChannel.send({
        content: `👋 <@${user.id}> | Staff notification`,
        embeds: [welcomeEmbed]
      });
    } catch (err) {
      logger.warn(`Could not send starter message to application channel: ${err.message}`);
    }
  }

  logger.info(`Creator application #${appId} submitted by ${user.tag} (${user.id})`);

  return interaction.editReply({
    content:
      `✅ **Application Submitted!** Your Creator Application (#${appId}) has been delivered to the staff team.\n` +
      (appChannel
        ? `A dedicated private channel has been opened for your application: <#${appChannel.id}>`
        : 'Our staff will review your channel and communicate with you soon!')
  });
}

/**
 * Handles Accept, Reject, Request Info, and Add Note actions for creator applications
 */
async function handleApplicationAction(interaction, action, appId) {
  const { guild, member, user } = interaction;

  // Verify staff reviewer authorization
  if (!isApplicationReviewer(member)) {
    return interaction.reply({
      content: '❌ Only authorized application reviewers (Owner / Admin) can review creator applications.',
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

  // Prevent multiple final decisions
  if (action === 'accept' || action === 'reject') {
    if (app.status !== 'pending') {
      return interaction.reply({
        content: `⚠️ This application has already been **${app.status.toUpperCase()}** by ${app.reviewed_by_tag || 'staff'}.`,
        ephemeral: true
      });
    }
  }

  // ---------------------------------------------------------------
  // Action: REQUEST MORE INFO
  // ---------------------------------------------------------------
  if (action === 'info') {
    const modal = new ModalBuilder()
      .setCustomId(`modal_app_info_${appId}`)
      .setTitle(`Request Info: Application #${appId}`);

    const promptInput = new TextInputBuilder()
      .setCustomId('info_request_text')
      .setLabel('Message to Applicant')
      .setPlaceholder('e.g., Please provide a link to your recent Minecraft stream, or verify channel ownership.')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(800);

    modal.addComponents(new ActionRowBuilder().addComponents(promptInput));
    return interaction.showModal(modal);
  }

  // ---------------------------------------------------------------
  // Action: ADD STAFF NOTE
  // ---------------------------------------------------------------
  if (action === 'note') {
    const modal = new ModalBuilder()
      .setCustomId(`modal_app_note_${appId}`)
      .setTitle(`Add Staff Note: Application #${appId}`);

    const noteInput = new TextInputBuilder()
      .setCustomId('staff_note_text')
      .setLabel('Internal Staff Note')
      .setPlaceholder('Enter internal review notes or observations about this creator...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMinLength(5)
      .setMaxLength(800);

    modal.addComponents(new ActionRowBuilder().addComponents(noteInput));
    return interaction.showModal(modal);
  }

  // ---------------------------------------------------------------
  // Action: REJECT APPLICATION (Modal for custom feedback)
  // ---------------------------------------------------------------
  if (action === 'reject') {
    const modal = new ModalBuilder()
      .setCustomId(`modal_app_reject_${appId}`)
      .setTitle(`Reject Application #${appId}`);

    const reasonInput = new TextInputBuilder()
      .setCustomId('reject_reason_text')
      .setLabel('Reason / Feedback for Applicant')
      .setValue('Thank you for applying. Currently your channel does not meet our minimum activity or subscriber requirements.')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(800);

    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
    return interaction.showModal(modal);
  }

  // ---------------------------------------------------------------
  // Action: ACCEPT APPLICATION
  // ---------------------------------------------------------------
  if (action === 'accept') {
    await interaction.deferUpdate();

    // 1. Update in Database
    db.updateApplicationStatus(appId, 'approved', user.id, user.tag, 'Approved by staff');
    db.addApplicationAudit({
      appId,
      action: 'approved',
      actorId: user.id,
      actorTag: user.tag,
      notes: 'Approved for Creator Team'
    });

    // 2. Update Review Embed
    try {
      const originalEmbed = interaction.message.embeds[0];
      const updatedEmbed = EmbedBuilder.from(originalEmbed)
        .setColor(theme.colors.success)
        .spliceFields(
          5, // Status field
          1,
          {
            name: '✅ Decision',
            value: `**APPROVED** by <@${user.id}> (<t:${Math.floor(Date.now() / 1000)}:R>)`,
            inline: true
          }
        );

      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`app_done_${appId}`)
          .setLabel(`Approved by ${user.username}`)
          .setEmoji('✅')
          .setStyle(ButtonStyle.Success)
          .setDisabled(true)
      );

      await interaction.message.edit({
        embeds: [updatedEmbed],
        components: [disabledRow]
      });
    } catch (editErr) {
      logger.warn(`Could not update application review message: ${editErr.message}`);
    }

    // 3. Notify applicant via DM
    let dmSent = false;
    try {
      const applicantUser = await interaction.client.users.fetch(app.user_id).catch(() => null);
      if (applicantUser) {
        const dmEmbed = new EmbedBuilder()
          .setTitle('🎉 Creator Application Approved!')
          .setColor(theme.colors.success)
          .setDescription(
            `Congratulations **${applicantUser.username}**!\n\n` +
            `Your Creator Application for the **${config.communityName} Community** has been **APPROVED** by staff member **${user.tag}**.\n\n` +
            `*A staff member will assign your verified YouTuber / YouTuber+ role in the server shortly.* Welcome to the creator team!`
          )
          .setFooter({ text: theme.footers.standard })
          .setTimestamp();

        await applicantUser.send({ embeds: [dmEmbed] });
        dmSent = true;
      }
    } catch (dmErr) {
      logger.warn(`Could not deliver acceptance DM to applicant (${app.user_id}): ${dmErr.message}`);
    }

    // 4. Send notification in applicant's private ticket channel if it exists
    const appChannel = guild.channels.cache.find(
      c => c.name.includes(`app-`) && c.name.includes(String(appId).padStart(4, '0'))
    );
    if (appChannel) {
      try {
        await appChannel.send({
          content: `🎉 <@${app.user_id}> **Congratulations!** Your creator application has been **APPROVED** by <@${user.id}>. A staff member will assign your creator role shortly.`
        });
      } catch {}
    }

    // 5. Log moderation action
    await logModerationAction(guild, {
      action: '📝 Creator Application Approved',
      targetUser: { id: app.user_id, tag: app.user_tag },
      moderator: user,
      reason: 'Application criteria met and verified',
      actionTaken: `Application #${appId} Approved`,
      color: theme.colors.success
    });

    logger.info(`Creator application #${appId} was approved by ${user.tag}`);

    return interaction.followUp({
      content:
        `✅ **Application #${appId} Approved!**\n` +
        `• Applicant: <@${app.user_id}>\n` +
        `• DM Notification: ${dmSent ? '✅ Delivered' : '⚠️ User has DMs disabled'}\n` +
        `• *Reminder: Please assign the YouTuber or YouTuber+ role to the creator.*`,
      ephemeral: true
    });
  }
}

/**
 * Handles submission of Request Info Modal
 */
async function handleApplicationInfoModal(interaction, appId) {
  const { guild, user } = interaction;
  const promptText = interaction.fields.getTextInputValue('info_request_text').trim();

  await interaction.deferReply({ ephemeral: true });

  const app = db.getApplicationById(appId);
  if (!app) {
    return interaction.editReply({ content: '❌ Application not found.' });
  }

  // Record audit
  db.addApplicationAudit({
    appId,
    action: 'info_requested',
    actorId: user.id,
    actorTag: user.tag,
    notes: promptText
  });

  // Post in applicant's private application channel
  const appChannel = guild.channels.cache.find(
    c => c.name.includes(`app-`) && c.name.includes(String(appId).padStart(4, '0'))
  );

  let postedInChannel = false;
  if (appChannel) {
    try {
      const infoEmbed = new EmbedBuilder()
        .setTitle('💬 Staff Information Request')
        .setColor(theme.colors.info)
        .setDescription(
          `Staff reviewer <@${user.id}> has requested additional information regarding your creator application:\n\n` +
          `>>> **${promptText}**\n\n` +
          `*Please reply directly in this channel with the requested details.*`
        )
        .setTimestamp();

      await appChannel.send({
        content: `🔔 <@${app.user_id}>`,
        embeds: [infoEmbed]
      });
      postedInChannel = true;
    } catch (err) {
      logger.warn(`Could not post info request to channel: ${err.message}`);
    }
  }

  // DM applicant
  let dmSent = false;
  try {
    const applicantUser = await interaction.client.users.fetch(app.user_id).catch(() => null);
    if (applicantUser) {
      await applicantUser.send({
        content: `💬 **Creator Application Update (${guild.name})**\nStaff member **${user.tag}** has requested more information regarding your application. Please check your private channel in the server.`
      });
      dmSent = true;
    }
  } catch {}

  return interaction.editReply({
    content:
      `✅ **Information Request Sent for Application #${appId}!**\n` +
      `• Channel Post: ${postedInChannel ? '✅ Delivered' : '⚠️ Channel not found'}\n` +
      `• DM Alert: ${dmSent ? '✅ Delivered' : '⚠️ User has DMs disabled'}`
  });
}

/**
 * Handles submission of Reject Modal
 */
async function handleApplicationRejectModal(interaction, appId) {
  const { guild, user } = interaction;
  const rejectReason = interaction.fields.getTextInputValue('reject_reason_text').trim();

  await interaction.deferReply({ ephemeral: true });

  const app = db.getApplicationById(appId);
  if (!app) {
    return interaction.editReply({ content: '❌ Application not found.' });
  }

  // 1. Update DB
  db.updateApplicationStatus(appId, 'rejected', user.id, user.tag, rejectReason);
  db.addApplicationAudit({
    appId,
    action: 'rejected',
    actorId: user.id,
    actorTag: user.tag,
    notes: rejectReason
  });

  // 2. Update review message if accessible
  if (app.channel_id && app.message_id) {
    try {
      const reviewChannel = guild.channels.cache.get(app.channel_id);
      if (reviewChannel) {
        const reviewMsg = await reviewChannel.messages.fetch(app.message_id).catch(() => null);
        if (reviewMsg && reviewMsg.embeds[0]) {
          const updatedEmbed = EmbedBuilder.from(reviewMsg.embeds[0])
            .setColor(theme.colors.error)
            .spliceFields(5, 1, {
              name: '❌ Decision',
              value: `**REJECTED** by <@${user.id}> (<t:${Math.floor(Date.now() / 1000)}:R>)\n*Reason:* ${rejectReason.slice(0, 200)}`,
              inline: false
            });

          const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`app_done_${appId}`)
              .setLabel(`Rejected by ${user.username}`)
              .setEmoji('❌')
              .setStyle(ButtonStyle.Danger)
              .setDisabled(true)
          );

          await reviewMsg.edit({ embeds: [updatedEmbed], components: [disabledRow] });
        }
      }
    } catch (editErr) {
      logger.warn(`Could not edit review message: ${editErr.message}`);
    }
  }

  // 3. Notify applicant via DM
  let dmSent = false;
  try {
    const applicantUser = await interaction.client.users.fetch(app.user_id).catch(() => null);
    if (applicantUser) {
      const dmEmbed = new EmbedBuilder()
        .setTitle('📝 Creator Application Update')
        .setColor(theme.colors.error)
        .setDescription(
          `Hello **${applicantUser.username}**,\n\n` +
          `Thank you for applying to the OlflazMC Creator Program. After reviewing your channel, our staff team has decided to **decline** your application at this time.\n\n` +
          `**Feedback / Reason:**\n>>> ${rejectReason}\n\n` +
          `You are welcome to re-apply in the future as your channel continues to grow and publish new Minecraft content!`
        )
        .setFooter({ text: theme.footers.standard })
        .setTimestamp();

      await applicantUser.send({ embeds: [dmEmbed] });
      dmSent = true;
    }
  } catch {}

  // 4. Notify in private channel
  const appChannel = guild.channels.cache.find(
    c => c.name.includes(`app-`) && c.name.includes(String(appId).padStart(4, '0'))
  );
  if (appChannel) {
    try {
      await appChannel.send({
        content: `❌ **Application Declined:** <@${app.user_id}>, your creator application was declined by <@${user.id}>.\nReason: ${rejectReason}\n*This channel will be archived.*`
      });
    } catch {}
  }

  // 5. Log moderation action
  await logModerationAction(guild, {
    action: '📝 Creator Application Rejected',
    targetUser: { id: app.user_id, tag: app.user_tag },
    moderator: user,
    reason: rejectReason,
    actionTaken: `Application #${appId} Rejected`,
    color: theme.colors.danger
  });

  logger.info(`Application #${appId} was rejected by ${user.tag}`);

  return interaction.editReply({
    content:
      `✅ **Application #${appId} Marked as REJECTED**.\n` +
      `• Applicant: <@${app.user_id}>\n` +
      `• DM Notification: ${dmSent ? '✅ Delivered' : '⚠️ User has DMs disabled'}\n` +
      `• Reason: \`${rejectReason.slice(0, 100)}\``
  });
}

/**
 * Handles submission of Add Staff Note Modal
 */
async function handleApplicationNoteModal(interaction, appId) {
  const { user } = interaction;
  const noteText = interaction.fields.getTextInputValue('staff_note_text').trim();

  await interaction.deferReply({ ephemeral: true });

  const app = db.getApplicationById(appId);
  if (!app) {
    return interaction.editReply({ content: '❌ Application not found.' });
  }

  db.addApplicationAudit({
    appId,
    action: 'staff_note',
    actorId: user.id,
    actorTag: user.tag,
    notes: noteText
  });

  return interaction.editReply({
    content: `✅ **Staff note added to Application #${appId}!**\nNote: "${noteText}"`
  });
}

module.exports = {
  buildApplicationModal,
  handleApplicationSubmit,
  handleApplicationAction,
  handleApplicationInfoModal,
  handleApplicationRejectModal,
  handleApplicationNoteModal,
  isApplicationReviewer
};
