const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  AttachmentBuilder
} = require('discord.js');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const theme = require('./theme');
const logger = require('./logger');
const db = require('./database');

// Ensure transcripts directory exists
const transcriptsDir = path.join(__dirname, '../../data/transcripts');
if (!fs.existsSync(transcriptsDir)) {
  fs.mkdirSync(transcriptsDir, { recursive: true });
}

// In-memory set to prevent race conditions on clicks
const activeOperations = new Set();

/**
 * Escapes characters for HTML to prevent injection
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Normalizes strings for resilient role and category matching
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
 * Generates an HTML transcript from channel message history
 */
async function generateHtmlTranscript(channel, ticket) {
  let messages = [];
  try {
    const fetched = await channel.messages.fetch({ limit: 100 });
    messages = Array.from(fetched.values()).reverse();
  } catch (err) {
    logger.warn(`Could not fetch all messages for transcript: ${err.message}`);
  }

  const title = `Ticket #${ticket.ticket_number} Transcript — ${ticket.ticket_type.toUpperCase()}`;
  const dateStr = new Date().toUTCString();

  let messageRows = '';
  for (const msg of messages) {
    const authorTag = escapeHtml(msg.author.tag);
    const authorId = msg.author.id;
    const timeStr = new Date(msg.createdTimestamp).toUTCString();
    const content = escapeHtml(msg.content);
    const isBot = msg.author.bot ? '<span class="bot-tag">BOT</span>' : '';

    let attachmentsHtml = '';
    if (msg.attachments.size > 0) {
      attachmentsHtml = '<div class="attachments">';
      for (const [_, att] of msg.attachments) {
        const url = escapeHtml(att.url);
        const name = escapeHtml(att.name);
        attachmentsHtml += `<a href="${url}" target="_blank" class="att-link">📎 ${name}</a> `;
      }
      attachmentsHtml += '</div>';
    }

    messageRows += `
      <div class="message">
        <div class="msg-header">
          <span class="author">${authorTag}</span> ${isBot}
          <span class="user-id">(${authorId})</span>
          <span class="timestamp">${timeStr}</span>
        </div>
        <div class="msg-content">${content || '<i>(No text content)</i>'}</div>
        ${attachmentsHtml}
      </div>
    `;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #1e1f22; color: #dbdee1; margin: 0; padding: 20px; }
    .header { background: #2b2d31; padding: 20px; border-radius: 8px; border-left: 6px solid #00d2d3; margin-bottom: 20px; }
    .header h1 { margin: 0 0 10px 0; color: #00d2d3; font-size: 22px; }
    .meta { font-size: 14px; color: #949ba4; line-height: 1.6; }
    .message { background: #2b2d31; padding: 12px 16px; border-radius: 6px; margin-bottom: 10px; border: 1px solid #35373c; }
    .msg-header { margin-bottom: 6px; font-size: 13px; }
    .author { font-weight: bold; color: #f2f3f5; font-size: 14px; }
    .bot-tag { background: #5865f2; color: #fff; font-size: 10px; padding: 2px 4px; border-radius: 3px; font-weight: bold; margin-left: 4px; }
    .user-id { color: #80848e; margin-left: 6px; }
    .timestamp { color: #80848e; float: right; font-size: 12px; }
    .msg-content { font-size: 14px; line-height: 1.5; color: #dbdee1; word-break: break-word; }
    .attachments { margin-top: 8px; }
    .att-link { color: #00a8ff; text-decoration: none; font-size: 13px; margin-right: 12px; }
    .att-link:hover { text-decoration: underline; }
    .footer { text-align: center; color: #80848e; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>⚔️ OlflazMC Support Ticket #${ticket.ticket_number}</h1>
    <div class="meta">
      <strong>Type:</strong> ${escapeHtml(ticket.ticket_type.toUpperCase())}<br>
      <strong>Requester:</strong> ${escapeHtml(ticket.user_tag)} (${ticket.user_id})<br>
      <strong>Closed By:</strong> ${escapeHtml(ticket.closed_by_tag || 'Staff')}<br>
      <strong>Date Generated:</strong> ${dateStr}
    </div>
  </div>
  <div class="messages">
    ${messageRows || '<p>No messages recorded.</p>'}
  </div>
  <div class="footer">Archived by OlflazMC Discord Bot • ${dateStr}</div>
</body>
</html>`;

  const fileName = `transcript-ticket-${ticket.ticket_number}-${Date.now()}.html`;
  const filePath = path.join(transcriptsDir, fileName);
  fs.writeFileSync(filePath, html, 'utf-8');
  return { filePath, fileName };
}

/**
 * Checks if a member has authorized staff permissions for ticket handling
 */
function isStaffMember(member) {
  if (!member || !member.roles) return false;
  // Guild owner is always staff
  if (member.guild?.ownerId === member.id) return true;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (member.permissions?.has(PermissionFlagsBits.ManageGuild)) return true;

  const roleList = member.roles.cache
    ? (typeof member.roles.cache.values === 'function' ? Array.from(member.roles.cache.values()) : Array.from(member.roles.cache))
    : [];

  return roleList.some(r =>
    config.staffPolicy.ticketAccessRoles.some(name => {
      const cleanTarget = normalizeString(name);
      const cleanRole = normalizeString(r.name);
      return cleanRole === cleanTarget ||
             cleanRole.includes(cleanTarget) ||
             cleanTarget.includes(cleanRole);
    })
  );
}

/**
 * Core function to create a private ticket channel and register it in SQLite
 */
async function createTicketChannel({ guild, member, ticketType }) {
  // 1. Resolve category: 「🎉」𝗘𝗩𝗘𝗡𝗧𝗦 & 𝗦𝗨𝗣𝗣𝗢𝗥𝗧
  const category = guild.channels.cache.find(
    c => c.type === ChannelType.GuildCategory &&
         (c.name.includes('𝗦𝗨𝗣𝗣𝗢𝗥𝗧') || c.name.toLowerCase().includes('support') || c.name.toLowerCase().includes('ticket'))
  ) || guild.channels.cache.find(c => c.type === ChannelType.GuildCategory);

  // 2. Resolve ticket number and channel name
  const ticketNumber = db.getNextTicketNumber(guild.id);
  const numPadded = String(ticketNumber).padStart(4, '0');
  const cleanUsername = member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
  const channelName = `ticket-${cleanUsername}-${numPadded}`;

  // 3. Configure permission overwrites
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

  // Add authorized staff roles
  for (const roleName of config.staffPolicy.ticketAccessRoles) {
    const cleanTarget = normalizeString(roleName);
    const staffRole = guild.roles.cache.find(r => {
      const cleanRole = normalizeString(r.name);
      return cleanRole === cleanTarget || cleanRole.includes(cleanTarget);
    });

    if (staffRole) {
      permissionOverwrites.push({
        id: staffRole.id,
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

  // 4. Create the channel in Discord
  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category ? category.id : undefined,
    permissionOverwrites,
    topic: `OlflazMC Support Ticket #${numPadded} | Requester: ${member.user.tag} (${member.id}) | Type: ${ticketType}`,
    reason: `Support ticket opened by ${member.user.tag}`
  });

  // 5. Record ticket in database
  const ticketId = db.createTicket({
    guildId: guild.id,
    channelId: ticketChannel.id,
    userId: member.id,
    userTag: member.user.tag,
    ticketType,
    ticketNumber
  });

  // 6. Post ticket starter controls in the new channel
  const typeNames = {
    support: 'General Support',
    reports: 'Player Report',
    applications: 'Creator Application',
    other: 'General Inquiry'
  };
  const displayType = typeNames[ticketType] || 'Support';

  const ticketEmbed = new EmbedBuilder()
    .setTitle(`${theme.emojis.ticket} Ticket #${numPadded} — ${displayType}`)
    .setColor(theme.colors.primary)
    .setDescription(
      `Welcome ${member}! Our staff team has been alerted and will assist you shortly.\n\n` +
      `**Please provide:**\n` +
      `• Detailed explanation of your inquiry or report\n` +
      `• Relevant Minecraft server, player IGN, and screenshots if applicable\n\n` +
      `*Authorized staff can claim or close this ticket using the controls below.*`
    )
    .addFields(
      { name: '👤 Requester', value: `<@${member.id}> (${member.user.tag})`, inline: true },
      { name: '🏷️ Category', value: `\`${displayType}\``, inline: true },
      { name: '🟢 Status', value: '`Open / Unclaimed`', inline: true }
    )
    .setFooter({ text: theme.footers.tickets })
    .setTimestamp();

  const controlsRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_claim_${ticketId}`)
      .setLabel('Claim Ticket')
      .setEmoji('📌')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`ticket_close_request_${ticketId}`)
      .setLabel('Close Ticket')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger)
  );

  await ticketChannel.send({
    content: `🔔 <@${member.id}> | Staff notification`,
    embeds: [ticketEmbed],
    components: [controlsRow]
  });

  logger.info(`Created ticket channel #${channelName} (ID: ${ticketId}) for ${member.user.tag}`);
  return { channel: ticketChannel, ticketId, ticketNumber };
}

/**
 * Handles creation of a ticket channel from button interaction
 */
async function handleTicketCreate(interaction, ticketType) {
  const { guild, member } = interaction;
  const lockKey = `create_${guild.id}_${member.id}`;

  if (activeOperations.has(lockKey)) {
    const msg = '⏳ Please wait, your ticket request is already being processed.';
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ content: msg }).catch(() => {});
    }
    return interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
  }

  activeOperations.add(lockKey);

  try {
    // 1. Prevent duplicate tickets of same type
    const existingTicket = db.getOpenTicket(guild.id, member.id, ticketType);
    if (existingTicket) {
      const activeChannel = guild.channels.cache.get(existingTicket.channel_id);
      if (activeChannel) {
        activeOperations.delete(lockKey);
        const duplicateMsg = `❌ You already have an active **${ticketType}** ticket open in <#${activeChannel.id}>!`;
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply({ content: duplicateMsg });
        }
        return interaction.reply({ content: duplicateMsg, ephemeral: true });
      } else {
        // Channel was deleted without proper close, mark old ticket closed
        db.closeTicket(existingTicket.id, 'System', 'Channel deleted manually', '', null);
      }
    }

    // Acknowledge interaction immediately
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }

    const { channel } = await createTicketChannel({ guild, member, ticketType });

    return interaction.editReply({
      content: `✅ Your private ticket has been created: <#${channel.id}>`
    });
  } catch (err) {
    logger.error(`Error creating ticket: ${err.message}`);
    const errorMsg = `❌ Could not create ticket channel: ${err.message}`;
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMsg }).catch(() => {});
    } else {
      await interaction.reply({ content: errorMsg, ephemeral: true }).catch(() => {});
    }
  } finally {
    activeOperations.delete(lockKey);
  }
}

/**
 * Handles Claim Button
 */
async function handleTicketClaim(interaction, ticketId) {
  const { member } = interaction;

  if (!isStaffMember(member)) {
    return interaction.reply({
      content: '❌ Only authorized staff members can claim support tickets.',
      ephemeral: true
    });
  }

  const ticket = db.getTicketById(ticketId);
  if (!ticket || ticket.status === 'closed') {
    return interaction.reply({
      content: '⚠️ This ticket is no longer active or does not exist.',
      ephemeral: true
    });
  }

  if (ticket.claimed_by_id) {
    return interaction.reply({
      content: `⚠️ This ticket has already been claimed by <@${ticket.claimed_by_id}>.`,
      ephemeral: true
    });
  }

  await interaction.deferUpdate();

  db.claimTicket(ticketId, member.id, member.user.tag);

  // Update starter embed
  try {
    const originalEmbed = interaction.message.embeds[0];
    if (originalEmbed) {
      const updatedEmbed = EmbedBuilder.from(originalEmbed);
      const fields = [...originalEmbed.fields];
      const statusIdx = fields.findIndex(f => f.name.includes('Status'));
      if (statusIdx !== -1) {
        fields[statusIdx] = { name: '🟡 Status', value: `\`Claimed by ${member.user.username}\``, inline: true };
        updatedEmbed.setFields(fields);
      }

      const updatedRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_claimed_${ticketId}`)
          .setLabel(`Claimed by ${member.user.username}`)
          .setEmoji('📌')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`ticket_close_request_${ticketId}`)
          .setLabel('Close Ticket')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.message.edit({
        embeds: [updatedEmbed],
        components: [updatedRow]
      });
    }
  } catch (err) {
    logger.warn(`Could not update ticket claim status in embed: ${err.message}`);
  }

  await interaction.channel.send({
    content: `📌 <@${member.id}> has claimed this ticket and will be assisting you!`
  });

  logger.info(`Ticket #${ticket.ticket_number} claimed by ${member.user.tag}`);
}

/**
 * Handles Close Request Button (Prompt Confirmation)
 */
async function handleTicketCloseRequest(interaction, ticketId) {
  const { member } = interaction;
  const ticket = db.getTicketById(ticketId);

  if (!ticket || ticket.status === 'closed') {
    return interaction.reply({
      content: '⚠️ This ticket is already closed.',
      ephemeral: true
    });
  }

  // Only ticket requester or staff can close
  const canClose = member.id === ticket.user_id || isStaffMember(member);
  if (!canClose) {
    return interaction.reply({
      content: '❌ Only the ticket requester or authorized staff can close this ticket.',
      ephemeral: true
    });
  }

  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_close_confirm_${ticketId}`)
      .setLabel('Confirm Close')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`ticket_close_cancel_${ticketId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
  );

  return interaction.reply({
    content: '⚠️ **Close Support Ticket?**\nClick **Confirm Close** below to archive this ticket and generate an HTML transcript.',
    components: [confirmRow]
  });
}

/**
 * Handles Cancel Close Button
 */
async function handleTicketCloseCancel(interaction, ticketId) {
  await interaction.message.delete().catch(() => {});
  return interaction.reply({
    content: '✅ Ticket closure cancelled. The ticket remains open.',
    ephemeral: true
  });
}

/**
 * Handles Confirm Close Button (Archive, Transcript, Logs, Delete)
 */
async function handleTicketCloseConfirm(interaction, ticketId) {
  const { member, channel, guild } = interaction;
  const ticket = db.getTicketById(ticketId);

  if (!ticket || ticket.status === 'closed') {
    return interaction.reply({
      content: '⚠️ This ticket has already been closed.',
      ephemeral: true
    });
  }

  const lockKey = `close_${ticketId}`;
  if (activeOperations.has(lockKey)) {
    return interaction.reply({
      content: '⏳ This ticket is currently being archived.',
      ephemeral: true
    });
  }
  activeOperations.add(lockKey);

  try {
    await interaction.reply({
      content: '🔒 **Closing ticket:** Generating private HTML transcript and archiving logs...'
    });

    // 1. Generate Transcript
    ticket.closed_by_id = member.id;
    ticket.closed_by_tag = member.user.tag;
    const { filePath, fileName } = await generateHtmlTranscript(channel, ticket);

    // 2. Update Database Record
    db.closeTicket(ticketId, member.id, member.user.tag, 'Resolved', filePath);

    // 3. Post Closure Summary to ticket-logs
    const ticketLogsChannel = guild.channels.cache.find(
      c => (c.name === '🎫・ticket-logs' || c.name === 'ticket-logs') && c.isTextBased()
    );

    if (ticketLogsChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle(`🎫 Ticket Closed — #${String(ticket.ticket_number).padStart(4, '0')}`)
        .setColor(theme.colors.danger)
        .addFields(
          { name: '🏷️ Type', value: `\`${ticket.ticket_type}\``, inline: true },
          { name: '👤 Requester', value: `<@${ticket.user_id}> (${ticket.user_tag})`, inline: true },
          { name: '🔒 Closed By', value: `<@${member.id}> (${member.user.tag})`, inline: true },
          { name: '📌 Claimed By', value: ticket.claimed_by_id ? `<@${ticket.claimed_by_id}>` : '`Unclaimed`', inline: true },
          { name: '⏱️ Duration', value: `<t:${Math.floor(ticket.created_at / 1000)}:R>`, inline: true }
        )
        .setFooter({ text: theme.footers.tickets })
        .setTimestamp();

      const attachment = new AttachmentBuilder(filePath, { name: fileName });
      await ticketLogsChannel.send({ embeds: [logEmbed], files: [attachment] }).catch(err => {
        logger.warn(`Could not send transcript to ticket-logs: ${err.message}`);
      });
    }

    // 4. Send DM to requester with transcript
    try {
      const requester = await guild.client.users.fetch(ticket.user_id).catch(() => null);
      if (requester) {
        const dmEmbed = new EmbedBuilder()
          .setTitle(`🎫 Ticket #${String(ticket.ticket_number).padStart(4, '0')} Closed`)
          .setColor(theme.colors.primary)
          .setDescription(`Your support ticket in **${guild.name}** has been resolved and closed by **${member.user.tag}**. An archived HTML transcript of your ticket is attached below.`)
          .setTimestamp();

        const dmAttachment = new AttachmentBuilder(filePath, { name: fileName });
        await requester.send({ embeds: [dmEmbed], files: [dmAttachment] }).catch(() => {});
      }
    } catch {}

    // 5. Delete Channel after 5 seconds
    await channel.send('🛑 This channel will be deleted in **5 seconds**...');
    setTimeout(async () => {
      await channel.delete('Ticket resolved and archived').catch(() => {});
    }, 5000);

    logger.info(`Closed ticket #${ticket.ticket_number} by ${member.user.tag}`);
  } catch (err) {
    logger.error(`Error closing ticket: ${err.message}`);
  } finally {
    activeOperations.delete(lockKey);
  }
}

module.exports = {
  createTicketChannel,
  handleTicketCreate,
  handleTicketClaim,
  handleClaimTicket: handleTicketClaim,
  handleTicketCloseRequest,
  handleCloseTicketRequest: handleTicketCloseRequest,
  handleTicketCloseCancel,
  handleCancelCloseTicket: handleTicketCloseCancel,
  handleTicketCloseConfirm,
  handleConfirmCloseTicket: handleTicketCloseConfirm,
  escapeHtml,
  isStaffMember
};
