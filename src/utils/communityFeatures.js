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
const theme = require('./theme');
const logger = require('./logger');

// In-memory tracking for active duels and video idea upvotes
const activeDuels = new Map();
const videoIdeaVotes = new Map();

/**
 * Builds the Duel Request Modal
 */
function buildDuelModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_find_duel')
    .setTitle('⚔️ Post a Duel Challenge');

  const ignInput = new TextInputBuilder()
    .setCustomId('duel_ign')
    .setLabel('Minecraft Username (IGN)')
    .setPlaceholder('e.g., OlflazPvP')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(2)
    .setMaxLength(16);

  const modeInput = new TextInputBuilder()
    .setCustomId('duel_mode')
    .setLabel('Game Mode / Kit')
    .setPlaceholder('e.g., BuildUHC, Nodebuff, Boxing, Gapple, Classic Rod')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(2)
    .setMaxLength(50);

  const serverInput = new TextInputBuilder()
    .setCustomId('duel_server')
    .setLabel('Server IP / Region')
    .setPlaceholder('e.g., minemen.club, lunar.gg, hypixel.net (NA / EU)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(2)
    .setMaxLength(60);

  const notesInput = new TextInputBuilder()
    .setCustomId('duel_notes')
    .setLabel('Match Format / Rules')
    .setPlaceholder('e.g., Best of 3, 1.8.9 version, no hacking')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(300);

  modal.addComponents(
    new ActionRowBuilder().addComponents(ignInput),
    new ActionRowBuilder().addComponents(modeInput),
    new ActionRowBuilder().addComponents(serverInput),
    new ActionRowBuilder().addComponents(notesInput)
  );

  return modal;
}

/**
 * Handles submission of Duel Request Modal
 */
async function handleDuelSubmit(interaction) {
  const { guild, user } = interaction;

  await interaction.deferReply({ ephemeral: true });

  const ign = interaction.fields.getTextInputValue('duel_ign').trim();
  const mode = interaction.fields.getTextInputValue('duel_mode').trim();
  const server = interaction.fields.getTextInputValue('duel_server').trim();
  const notes = interaction.fields.getTextInputValue('duel_notes')?.trim() || 'Standard competitive duel rules';

  const duelId = `duel_${Date.now()}_${user.id.slice(-4)}`;

  const duelChannel = guild.channels.cache.find(
    c => c.name === '🤝・find-a-duel' || c.name === 'find-a-duel'
  ) || interaction.channel;

  const duelEmbed = new EmbedBuilder()
    .setTitle(`⚔️ Duel Challenge Issued — ${mode}`)
    .setColor(theme.colors.primary)
    .setDescription(
      `**<@${user.id}>** (\`${ign}\`) is searching for a worthy opponent!\n\n` +
      `Click **Accept Challenge** below to accept this match.`
    )
    .addFields(
      { name: '👤 Challenger', value: `<@${user.id}> (\`${ign}\`)`, inline: true },
      { name: '🎯 Kit / Mode', value: `\`${mode}\``, inline: true },
      { name: '🌐 Server / Region', value: `\`${server}\``, inline: true },
      { name: '📋 Match Notes', value: notes, inline: false },
      { name: '🟢 Status', value: '`⏳ Waiting for an Opponent`', inline: true }
    )
    .setFooter({ text: 'OlflazMC Duel Matchmaking • Good luck!' })
    .setTimestamp();

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`duel_accept_${duelId}`)
      .setLabel('Accept Challenge')
      .setEmoji('⚔️')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`duel_cancel_${duelId}`)
      .setLabel('Cancel Request')
      .setEmoji('✖️')
      .setStyle(ButtonStyle.Danger)
  );

  try {
    const msg = await duelChannel.send({
      embeds: [duelEmbed],
      components: [actionRow]
    });

    activeDuels.set(duelId, {
      id: duelId,
      messageId: msg.id,
      channelId: duelChannel.id,
      challengerId: user.id,
      challengerTag: user.tag,
      ign,
      mode,
      server,
      status: 'waiting'
    });

    logger.info(`Duel challenge posted by ${user.tag} for ${mode} on ${server}`);

    return interaction.editReply({
      content: `✅ **Duel Challenge Posted!** View it in <#${duelChannel.id}>.`
    });
  } catch (err) {
    logger.error(`Error posting duel challenge: ${err.message}`);
    return interaction.editReply({
      content: `❌ Could not post duel challenge: ${err.message}`
    });
  }
}

/**
 * Handles accepting a duel challenge
 */
async function handleDuelAccept(interaction, duelId) {
  const { user } = interaction;
  const duel = activeDuels.get(duelId);

  if (!duel) {
    return interaction.reply({
      content: '⚠️ This duel challenge has expired or is no longer available.',
      ephemeral: true
    });
  }

  if (duel.status !== 'waiting') {
    return interaction.reply({
      content: '⚠️ This duel has already been accepted or cancelled.',
      ephemeral: true
    });
  }

  if (duel.challengerId === user.id) {
    return interaction.reply({
      content: '❌ You cannot accept your own duel challenge!',
      ephemeral: true
    });
  }

  await interaction.deferUpdate();

  duel.status = 'matched';
  duel.opponentId = user.id;
  duel.opponentTag = user.tag;

  const originalEmbed = interaction.message.embeds[0];
  const updatedEmbed = EmbedBuilder.from(originalEmbed)
    .setColor(theme.colors.success)
    .spliceFields(4, 1, {
      name: '🟢 Status',
      value: `\`🤝 Matched with \` <@${user.id}>! Fight in progress!`,
      inline: true
    });

  const disabledRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`duel_done_${duelId}`)
      .setLabel(`Matched with ${user.username}`)
      .setEmoji('🤝')
      .setStyle(ButtonStyle.Success)
      .setDisabled(true)
  );

  await interaction.message.edit({
    embeds: [updatedEmbed],
    components: [disabledRow]
  }).catch(() => {});

  // Post match alert tagging both fighters
  await interaction.channel.send({
    content: `🔔 **DUEL ACCEPTED!** <@${duel.challengerId}> vs <@${user.id}>\n` +
      `• **Mode:** \`${duel.mode}\`\n` +
      `• **Server:** \`${duel.server}\`\n` +
      `Jump on the server, send the duel request in-game, and good luck!`
  });

  logger.info(`Duel ${duelId} accepted: ${duel.challengerTag} vs ${user.tag}`);
}

/**
 * Handles cancelling a duel challenge
 */
async function handleDuelCancel(interaction, duelId) {
  const { user, member } = interaction;
  const duel = activeDuels.get(duelId);

  if (!duel) {
    return interaction.reply({
      content: '⚠️ This duel challenge is no longer active.',
      ephemeral: true
    });
  }

  const isChallenger = duel.challengerId === user.id;
  const isStaff = member.permissions.has(PermissionFlagsBits.ManageMessages);

  if (!isChallenger && !isStaff) {
    return interaction.reply({
      content: '❌ Only the challenger or a staff member can cancel this duel.',
      ephemeral: true
    });
  }

  await interaction.deferUpdate();

  duel.status = 'cancelled';

  const originalEmbed = interaction.message.embeds[0];
  const updatedEmbed = EmbedBuilder.from(originalEmbed)
    .setColor(theme.colors.neutral)
    .spliceFields(4, 1, {
      name: '🔴 Status',
      value: `\`✖️ Cancelled by \` <@${user.id}>`,
      inline: true
    });

  const disabledRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`duel_cancelled_${duelId}`)
      .setLabel('Duel Cancelled')
      .setEmoji('✖️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );

  await interaction.message.edit({
    embeds: [updatedEmbed],
    components: [disabledRow]
  }).catch(() => {});

  activeDuels.delete(duelId);
  logger.info(`Duel ${duelId} cancelled by ${user.tag}`);
}

/**
 * Builds the Video Idea Modal
 */
function buildVideoIdeaModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_submit_video_idea')
    .setTitle('💡 Pitch a YouTube Video Idea');

  const titleInput = new TextInputBuilder()
    .setCustomId('idea_title')
    .setLabel('Video Title / Concept')
    .setPlaceholder('e.g., 100 Players UHC With Custom Golden Head Crafts')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(100);

  const categoryInput = new TextInputBuilder()
    .setCustomId('idea_category')
    .setLabel('Video Format / Game Mode')
    .setPlaceholder('e.g., UHC FFA, 1.8 Duel Challenge, Trapping, Montage, Modded')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(2)
    .setMaxLength(60);

  const detailsInput = new TextInputBuilder()
    .setCustomId('idea_details')
    .setLabel('Concept Details & Custom Rules')
    .setPlaceholder('Describe the challenge mechanics, how players participate, and what makes it exciting for YouTube.')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(15)
    .setMaxLength(1000);

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(categoryInput),
    new ActionRowBuilder().addComponents(detailsInput)
  );

  return modal;
}

/**
 * Handles Video Idea Submission
 */
async function handleVideoIdeaSubmit(interaction) {
  const { guild, user } = interaction;

  await interaction.deferReply({ ephemeral: true });

  const title = interaction.fields.getTextInputValue('idea_title').trim();
  const category = interaction.fields.getTextInputValue('idea_category').trim();
  const details = interaction.fields.getTextInputValue('idea_details').trim();

  const ideaId = `idea_${Date.now()}_${user.id.slice(-4)}`;

  const ideasChannel = guild.channels.cache.find(
    c => c.name === '💡・video-ideas' || c.name === 'video-ideas'
  ) || interaction.channel;

  const ideaEmbed = new EmbedBuilder()
    .setTitle(`🎬 Video Concept: ${title}`)
    .setColor(theme.colors.warning)
    .setDescription(details)
    .addFields(
      { name: '👤 Pitched By', value: `<@${user.id}> (\`${user.tag}\`)`, inline: true },
      { name: '🏷️ Format', value: `\`${category}\``, inline: true },
      { name: '📊 Community Support', value: '`👍 0 Upvotes`', inline: true },
      { name: '📌 Status', value: '`👀 Open for Creator Review`', inline: false }
    )
    .setFooter({ text: 'OlflazMC Video Studio • Drop an upvote if you want to see this video!' })
    .setTimestamp();

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`idea_upvote_${ideaId}`)
      .setLabel('0')
      .setEmoji('👍')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`idea_plan_${ideaId}`)
      .setLabel('Creator Mark')
      .setEmoji('🎬')
      .setStyle(ButtonStyle.Secondary)
  );

  try {
    await ideasChannel.send({
      embeds: [ideaEmbed],
      components: [actionRow]
    });

    videoIdeaVotes.set(ideaId, new Set());

    logger.info(`Video idea pitched by ${user.tag}: "${title}"`);

    return interaction.editReply({
      content: `✅ **Video Idea Submitted!** Your concept has been posted in <#${ideasChannel.id}> for community support and creator review!`
    });
  } catch (err) {
    logger.error(`Error posting video idea: ${err.message}`);
    return interaction.editReply({
      content: `❌ Could not post video idea: ${err.message}`
    });
  }
}

/**
 * Handles Video Idea Upvote
 */
async function handleVideoIdeaUpvote(interaction, ideaId) {
  const { user } = interaction;

  let voters = videoIdeaVotes.get(ideaId);
  if (!voters) {
    voters = new Set();
    videoIdeaVotes.set(ideaId, voters);
  }

  await interaction.deferUpdate();

  let action = '';
  if (voters.has(user.id)) {
    voters.delete(user.id);
    action = 'removed';
  } else {
    voters.add(user.id);
    action = 'added';
  }

  const count = voters.size;
  const originalEmbed = interaction.message.embeds[0];
  if (originalEmbed) {
    const updatedEmbed = EmbedBuilder.from(originalEmbed);
    const fields = [...originalEmbed.fields];
    const voteIdx = fields.findIndex(f => f.name.includes('Support'));
    if (voteIdx !== -1) {
      fields[voteIdx] = { name: '📊 Community Support', value: `\`👍 ${count} Upvotes\``, inline: true };
      updatedEmbed.setFields(fields);
    }

    const updatedRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`idea_upvote_${ideaId}`)
        .setLabel(String(count))
        .setEmoji('👍')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`idea_plan_${ideaId}`)
        .setLabel('Creator Mark')
        .setEmoji('🎬')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.message.edit({
      embeds: [updatedEmbed],
      components: [updatedRow]
    }).catch(() => {});
  }

  return interaction.followUp({
    content: action === 'added' ? '👍 Upvoted this video idea!' : '➖ Removed your upvote.',
    ephemeral: true
  });
}

/**
 * Handles Creator Mark for Video Idea
 */
async function handleVideoIdeaPlan(interaction, ideaId) {
  const { member, user } = interaction;

  // Only authorized staff or creator can mark video ideas
  const isStaff = member.permissions.has(PermissionFlagsBits.ManageGuild) ||
    member.permissions.has(PermissionFlagsBits.ManageMessages) ||
    member.roles.cache.some(r =>
      r.name.toLowerCase().includes('youtuber') ||
      r.name.toLowerCase().includes('admin') ||
      r.name.toLowerCase().includes('owner')
    );

  if (!isStaff) {
    return interaction.reply({
      content: '❌ Only verified YouTubers and staff members can mark video concepts as planned.',
      ephemeral: true
    });
  }

  await interaction.deferUpdate();

  const originalEmbed = interaction.message.embeds[0];
  if (originalEmbed) {
    const updatedEmbed = EmbedBuilder.from(originalEmbed)
      .setColor(theme.colors.success)
      .spliceFields(3, 1, {
        name: '📌 Status',
        value: `\`🎬 SELECTED BY OLFLAZMC / PLANNED FOR RECORDING!\` (Marked by <@${user.id}>)`,
        inline: false
      });

    await interaction.message.edit({
      embeds: [updatedEmbed]
    }).catch(() => {});
  }

  return interaction.followUp({
    content: '🎬 **Video Idea Marked!** This concept is now marked as planned for an upcoming OlflazMC recording!',
    ephemeral: true
  });
}

/**
 * Handles Rules Acknowledgement button
 */
async function handleRulesAcknowledge(interaction) {
  return interaction.reply({
    content: '✅ **Rules Acknowledged!** Thank you for taking the time to read the OlflazMC community rules. Enjoy the fights and have fun!',
    ephemeral: true
  });
}

module.exports = {
  buildDuelModal,
  handleDuelSubmit,
  handleDuelAccept,
  handleDuelCancel,
  buildVideoIdeaModal,
  handleVideoIdeaSubmit,
  handleVideoIdeaUpvote,
  handleVideoIdeaPlan,
  handleRulesAcknowledge
};
