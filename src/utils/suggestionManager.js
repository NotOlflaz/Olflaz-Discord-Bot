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

/**
 * Builds the Suggestion Submission Modal
 */
function buildSuggestionModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_submit_suggestion')
    .setTitle('💡 Submit a Server Suggestion');

  const titleInput = new TextInputBuilder()
    .setCustomId('suggestion_title')
    .setLabel('Title / Short Summary')
    .setPlaceholder('e.g., Add 1.8 Rod PvP Tournaments on Weekends')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(100);

  const contentInput = new TextInputBuilder()
    .setCustomId('suggestion_content')
    .setLabel('Detailed Suggestion')
    .setPlaceholder('Describe your idea in detail, how it works, and why it benefits the OlflazMC community.')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(15)
    .setMaxLength(1000);

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(contentInput)
  );

  return modal;
}

/**
 * Handles the submission of the Suggestion Modal
 */
async function handleSuggestionSubmit(interaction) {
  const { guild, user } = interaction;

  await interaction.deferReply({ ephemeral: true });

  const title = interaction.fields.getTextInputValue('suggestion_title').trim();
  const content = interaction.fields.getTextInputValue('suggestion_content').trim();

  if (!title || !content) {
    return interaction.editReply({
      content: '❌ Please provide both a title and description for your suggestion.'
    });
  }

  // Find suggestions channel
  const suggestionChannel = guild.channels.cache.find(
    c => c.name === '💡・suggestions' || c.name === 'suggestions'
  );

  if (!suggestionChannel) {
    return interaction.editReply({
      content: '❌ Could not find the suggestions channel. Please notify an administrator.'
    });
  }

  // Create suggestion in SQLite database
  const { id: suggestionId, number: suggestionNumber } = db.createSuggestion({
    messageId: 'pending',
    channelId: suggestionChannel.id,
    userId: user.id,
    userTag: user.tag,
    title,
    content
  });

  const embed = new EmbedBuilder()
    .setTitle(`💡 Suggestion #${suggestionNumber} — ${title}`)
    .setColor(theme.colors.suggestions)
    .setDescription(content)
    .addFields(
      { name: '👤 Submitted By', value: `<@${user.id}> (\`${user.tag}\`)`, inline: true },
      { name: '📊 Community Votes', value: '`🟢 0 Upvotes | 🔴 0 Downvotes`', inline: true },
      { name: '📌 Status', value: '`⏳ Pending Community Feedback`', inline: true }
    )
    .setFooter({ text: theme.footers.suggestions })
    .setTimestamp();

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`suggest_up_${suggestionId}`)
      .setLabel('0')
      .setEmoji('🟢')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`suggest_down_${suggestionId}`)
      .setLabel('0')
      .setEmoji('🔴')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`suggest_manage_${suggestionId}`)
      .setLabel('Staff Review')
      .setEmoji('⚙️')
      .setStyle(ButtonStyle.Secondary)
  );

  try {
    const post = await suggestionChannel.send({
      embeds: [embed],
      components: [actionRow]
    });

    // Update message ID in DB
    db.db.prepare('UPDATE suggestions SET message_id = ? WHERE id = ?').run(post.id, suggestionId);

    logger.info(`Suggestion #${suggestionNumber} created by ${user.tag} in #${suggestionChannel.name}`);

    return interaction.editReply({
      content: `✅ **Suggestion Submitted!** Your idea has been posted in <#${suggestionChannel.id}> for community voting!`
    });
  } catch (err) {
    logger.error(`Failed to post suggestion to #${suggestionChannel.name}: ${err.message}`);
    return interaction.editReply({
      content: `❌ An error occurred while posting your suggestion: ${err.message}`
    });
  }
}

/**
 * Handles Upvote and Downvote buttons
 */
async function handleSuggestionVote(interaction, voteType, suggestionId) {
  const { user } = interaction;

  const suggestion = db.getSuggestionById(suggestionId);
  if (!suggestion) {
    return interaction.reply({
      content: '❌ Suggestion not found in the database.',
      ephemeral: true
    });
  }

  // Defer update immediately
  await interaction.deferUpdate();

  // Perform vote update in SQLite
  const result = db.voteSuggestion(suggestionId, user.id, voteType);

  // Update embed
  const originalEmbed = interaction.message.embeds[0];
  if (!originalEmbed) return;

  const updatedEmbed = EmbedBuilder.from(originalEmbed);
  const fields = [...originalEmbed.fields];

  // Update votes field (index 1)
  const votesIndex = fields.findIndex(f => f.name.includes('Votes'));
  if (votesIndex !== -1) {
    fields[votesIndex] = {
      name: '📊 Community Votes',
      value: `\`🟢 ${result.upvotes} Upvotes | 🔴 ${result.downvotes} Downvotes\``,
      inline: true
    };
    updatedEmbed.setFields(fields);
  }

  // Update button labels
  const updatedRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`suggest_up_${suggestionId}`)
      .setLabel(String(result.upvotes))
      .setEmoji('🟢')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`suggest_down_${suggestionId}`)
      .setLabel(String(result.downvotes))
      .setEmoji('🔴')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`suggest_manage_${suggestionId}`)
      .setLabel('Staff Review')
      .setEmoji('⚙️')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.message.edit({
    embeds: [updatedEmbed],
    components: [updatedRow]
  }).catch(err => logger.warn(`Could not edit suggestion message: ${err.message}`));

  let feedback = '';
  if (result.action === 'added') {
    feedback = `✅ Recorded your **${voteType === 'up' ? 'upvote' : 'downvote'}**!`;
  } else if (result.action === 'switched') {
    feedback = `🔄 Switched your vote to **${voteType === 'up' ? 'upvote' : 'downvote'}**!`;
  } else if (result.action === 'removed') {
    feedback = `➖ Removed your vote.`;
  }

  return interaction.followUp({
    content: feedback,
    ephemeral: true
  });
}

/**
 * Handles Staff Management button for suggestions
 */
async function handleSuggestionManage(interaction, suggestionId) {
  const { guild, member, user } = interaction;

  // Check staff permissions
  const isOwner = guild.ownerId === user.id;
  const isStaff = isOwner ||
    member.permissions.has(PermissionFlagsBits.ManageGuild) ||
    member.permissions.has(PermissionFlagsBits.ManageMessages) ||
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.roles.cache.some(r =>
      config.staffPolicy.ticketAccessRoles.some(name =>
        r.name.toLowerCase().includes(name.toLowerCase().replace(/^[^\w\s]+\s*/, ''))
      )
    );

  if (!isStaff) {
    return interaction.reply({
      content: '❌ Only staff members can manage suggestion status.',
      ephemeral: true
    });
  }

  const suggestion = db.getSuggestionById(suggestionId);
  if (!suggestion) {
    return interaction.reply({
      content: '❌ Suggestion not found in database.',
      ephemeral: true
    });
  }

  const staffControlRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`suggest_status_${suggestionId}_accepted`)
      .setLabel('Accept / Approved')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`suggest_status_${suggestionId}_review`)
      .setLabel('Under Review')
      .setEmoji('🔍')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`suggest_status_${suggestionId}_declined`)
      .setLabel('Decline')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger)
  );

  return interaction.reply({
    content: `⚙️ **Staff Controls for Suggestion #${suggestion.suggestion_number}**\nCurrent Status: \`${suggestion.status}\`\nSelect a new status below:`,
    components: [staffControlRow],
    ephemeral: true
  });
}

/**
 * Handles Staff Status Change on a Suggestion
 */
async function handleSuggestionStatusUpdate(interaction, suggestionId, newStatus) {
  const { guild, member, user } = interaction;

  const isOwner = guild.ownerId === user.id;
  const isStaff = isOwner ||
    member.permissions.has(PermissionFlagsBits.ManageGuild) ||
    member.permissions.has(PermissionFlagsBits.ManageMessages) ||
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.roles.cache.some(r =>
      config.staffPolicy.ticketAccessRoles.some(name =>
        r.name.toLowerCase().includes(name.toLowerCase().replace(/^[^\w\s]+\s*/, ''))
      )
    );

  if (!isStaff) {
    return interaction.reply({
      content: '❌ Only authorized staff members can update suggestion status.',
      ephemeral: true
    });
  }

  const suggestion = db.getSuggestionById(suggestionId);
  if (!suggestion) {
    return interaction.reply({
      content: '❌ Suggestion not found in database.',
      ephemeral: true
    });
  }

  await interaction.deferUpdate();

  // Update in SQLite
  db.updateSuggestionStatus(suggestionId, newStatus, user.id, '');

  // Find suggestion message to update embed
  const suggestionChannel = guild.channels.cache.get(suggestion.channel_id);
  if (suggestionChannel) {
    try {
      const msg = await suggestionChannel.messages.fetch(suggestion.message_id);
      if (msg && msg.embeds[0]) {
        const updatedEmbed = EmbedBuilder.from(msg.embeds[0]);

        let color = theme.colors.suggestions;
        let statusText = '`⏳ Pending Community Feedback`';

        if (newStatus === 'accepted') {
          color = theme.colors.success;
          statusText = `\`✅ Accepted by ${user.tag}\``;
        } else if (newStatus === 'review') {
          color = theme.colors.info;
          statusText = `\`🔍 Under Review by ${user.tag}\``;
        } else if (newStatus === 'declined') {
          color = theme.colors.error;
          statusText = `\`❌ Declined by ${user.tag}\``;
        }

        updatedEmbed.setColor(color);
        const fields = [...msg.embeds[0].fields];
        const statusIdx = fields.findIndex(f => f.name.includes('Status'));
        if (statusIdx !== -1) {
          fields[statusIdx] = { name: '📌 Status', value: statusText, inline: true };
          updatedEmbed.setFields(fields);
        }

        await msg.edit({ embeds: [updatedEmbed] });
      }
    } catch (err) {
      logger.warn(`Could not edit suggestion message embed: ${err.message}`);
    }
  }

  logger.info(`Suggestion #${suggestion.suggestion_number} marked as ${newStatus} by ${user.tag}`);

  return interaction.followUp({
    content: `✅ Suggestion #${suggestion.suggestion_number} updated to **${newStatus.toUpperCase()}**!`,
    ephemeral: true
  });
}

module.exports = {
  buildSuggestionModal,
  handleSuggestionSubmit,
  handleSuggestionVote,
  handleSuggestionManage,
  handleSuggestionStatusUpdate
};
