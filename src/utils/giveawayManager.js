const {
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

const activeTimers = new Map();

/**
 * Initializes and reconciles all active giveaways from the database on bot startup.
 */
function initGiveaways(client) {
  try {
    const active = db.getActiveGiveaways();
    logger.info(`Reconciling ${active.length} active giveaway(s) from database.`);

    for (const gw of active) {
      const now = Date.now();
      const timeLeft = gw.ends_at - now;

      if (timeLeft <= 0) {
        // Should have ended while offline
        endGiveawayInternal(client, gw).catch(err => {
          logger.warn(`Could not resolve expired giveaway #${gw.id}: ${err.message}`);
        });
      } else {
        // Schedule auto-ending
        const timer = setTimeout(() => {
          endGiveawayInternal(client, gw).catch(err => {
            logger.error(`Error auto-ending giveaway #${gw.id}: ${err.message}`);
          });
        }, timeLeft);

        activeTimers.set(gw.id, timer);
      }
    }
  } catch (err) {
    logger.error(`Failed to initialize active giveaways: ${err.message}`);
  }
}

/**
 * Internal function to end a giveaway fairly and update Discord message
 */
async function endGiveawayInternal(client, giveaway) {
  // Clear any existing timer
  if (activeTimers.has(giveaway.id)) {
    clearTimeout(activeTimers.get(giveaway.id));
    activeTimers.delete(giveaway.id);
  }

  let channel = null;
  try {
    channel = await client.channels.fetch(giveaway.channel_id);
  } catch {
    channel = null;
  }

  const entrants = db.getGiveawayEntrants(giveaway.id);
  let winners = [];

  if (entrants.length > 0) {
    // Fair Fisher-Yates shuffle
    const shuffled = [...entrants];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const count = Math.min(giveaway.winner_count, shuffled.length);
    winners = shuffled.slice(0, count);
  }

  // Update in SQLite
  db.endGiveaway(giveaway.id, JSON.stringify(winners), 'ended');

  if (!channel) {
    logger.warn(`Could not find channel ${giveaway.channel_id} to conclude giveaway #${giveaway.id}`);
    return winners;
  }

  try {
    const msg = await channel.messages.fetch(giveaway.message_id);
    if (msg) {
      const winnerDisplay = winners.length > 0
        ? winners.map(id => `<@${id}>`).join(', ')
        : '`No valid entries`';

      const endedEmbed = new EmbedBuilder()
        .setTitle(`🎉 GIVEAWAY ENDED — ${giveaway.prize}`)
        .setColor(winners.length > 0 ? theme.colors.gold : theme.colors.neutral)
        .setDescription(
          `**Prize:** ${giveaway.prize}\n` +
          `**Hosted By:** <@${giveaway.host_id}>\n` +
          `**Ended:** <t:${Math.floor(Date.now() / 1000)}:R>`
        )
        .addFields(
          { name: '🏆 Winner(s)', value: winnerDisplay, inline: false },
          { name: '🎟️ Total Entries', value: `\`${entrants.length}\``, inline: true }
        )
        .setFooter({ text: 'OlflazMC Giveaways • Concluded' })
        .setTimestamp();

      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`giveaway_ended_${giveaway.id}`)
          .setLabel(`Giveaway Ended (${entrants.length})`)
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );

      await msg.edit({
        embeds: [endedEmbed],
        components: [disabledRow]
      });

      if (winners.length > 0) {
        await channel.send({
          content: `🎉 **Congratulations** ${winnerDisplay}! You won the **${giveaway.prize}**! Please contact <@${giveaway.host_id}> to claim your reward.`
        });
      } else {
        await channel.send({
          content: `⚠️ The giveaway for **${giveaway.prize}** ended, but there were no valid entries.`
        });
      }
    }
  } catch (err) {
    logger.warn(`Could not edit giveaway message #${giveaway.message_id}: ${err.message}`);
  }

  logger.info(`Giveaway #${giveaway.id} (${giveaway.prize}) ended. Winners: ${winners.join(', ') || 'None'}`);
  return winners;
}

/**
 * Handles user entering / leaving a giveaway via button click
 */
async function handleGiveawayEnter(interaction, giveawayId) {
  const { user } = interaction;

  const gw = db.db.prepare('SELECT * FROM giveaways WHERE id = ?').get(giveawayId);
  if (!gw) {
    return interaction.reply({
      content: '❌ Giveaway not found in the database.',
      ephemeral: true
    });
  }

  if (gw.status !== 'active') {
    return interaction.reply({
      content: '🔒 This giveaway has already ended!',
      ephemeral: true
    });
  }

  await interaction.deferUpdate();

  const { action, count } = db.enterGiveaway(giveawayId, user.id);

  // Update button label and embed entrant count
  try {
    const originalEmbed = interaction.message.embeds[0];
    if (originalEmbed) {
      const updatedEmbed = EmbedBuilder.from(originalEmbed);
      const fields = [...originalEmbed.fields];
      const entrantsIdx = fields.findIndex(f => f.name.includes('Entrants'));
      if (entrantsIdx !== -1) {
        fields[entrantsIdx] = { name: '🎟️ Entrants', value: `\`${count}\``, inline: true };
        updatedEmbed.setFields(fields);
      }

      const updatedRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`giveaway_enter_${giveawayId}`)
          .setLabel(`Enter Giveaway (${count})`)
          .setEmoji('🎟️')
          .setStyle(ButtonStyle.Success)
      );

      await interaction.message.edit({
        embeds: [updatedEmbed],
        components: [updatedRow]
      });
    }
  } catch (err) {
    logger.warn(`Could not update giveaway entry counter: ${err.message}`);
  }

  return interaction.followUp({
    content: action === 'entered'
      ? `🎟️ **Entry Confirmed!** You have entered the giveaway for **${gw.prize}**! Good luck!`
      : `❌ **Entry Removed.** You have left the giveaway for **${gw.prize}**.`,
    ephemeral: true
  });
}

/**
 * Creates and starts a new giveaway
 */
async function startGiveaway({ client, guild, channel, prize, durationMs, winnerCount, host }) {
  const endsAt = Date.now() + durationMs;

  const embed = new EmbedBuilder()
    .setTitle(`🎉 GIVEAWAY — ${prize}`)
    .setColor(theme.colors.events)
    .setDescription(
      `Click the 🎟️ button below to enter the giveaway!\n\n` +
      `• **Prize:** **${prize}**\n` +
      `• **Winners:** \`${winnerCount}\`\n` +
      `• **Hosted By:** <@${host.id}>\n` +
      `• **Ends:** <t:${Math.floor(endsAt / 1000)}:R> (<t:${Math.floor(endsAt / 1000)}:F>)`
    )
    .addFields(
      { name: '🎟️ Entrants', value: '`0`', inline: true },
      { name: '🏆 Winners', value: `\`${winnerCount}\``, inline: true }
    )
    .setFooter({ text: 'OlflazMC Giveaways • Click 🎟️ to enter or leave' })
    .setTimestamp(endsAt);

  const initialRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('giveaway_enter_temp')
      .setLabel('Enter Giveaway (0)')
      .setEmoji('🎟️')
      .setStyle(ButtonStyle.Success)
  );

  const msg = await channel.send({
    embeds: [embed],
    components: [initialRow]
  });

  const giveawayId = db.createGiveaway({
    messageId: msg.id,
    channelId: channel.id,
    guildId: guild.id,
    prize,
    winnerCount,
    hostId: host.id,
    hostTag: host.tag,
    endsAt
  });

  // Update button with actual giveawayId
  const actualRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`giveaway_enter_${giveawayId}`)
      .setLabel('Enter Giveaway (0)')
      .setEmoji('🎟️')
      .setStyle(ButtonStyle.Success)
  );

  await msg.edit({ components: [actualRow] });

  // Schedule timer
  const gwRecord = db.getGiveawayByMessage(msg.id);
  const timer = setTimeout(() => {
    endGiveawayInternal(client, gwRecord).catch(err => {
      logger.error(`Error ending giveaway #${giveawayId}: ${err.message}`);
    });
  }, durationMs);

  activeTimers.set(giveawayId, timer);

  logger.info(`Giveaway #${giveawayId} started by ${host.tag} for "${prize}" (duration: ${durationMs}ms)`);
  return { id: giveawayId, message: msg };
}

/**
 * Rerolls winners for an ended giveaway
 */
async function rerollGiveaway(client, messageId, winnerCount = 1) {
  const gw = db.getGiveawayByMessage(messageId);
  if (!gw) {
    throw new Error('Giveaway message not found in the database.');
  }

  if (gw.status !== 'ended') {
    throw new Error('This giveaway has not ended yet.');
  }

  const entrants = db.getGiveawayEntrants(gw.id);
  if (entrants.length === 0) {
    throw new Error('There were no entrants in this giveaway to reroll.');
  }

  // Shuffle entrants
  const shuffled = [...entrants];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const count = Math.min(winnerCount, shuffled.length);
  const newWinners = shuffled.slice(0, count);

  // Update DB
  db.endGiveaway(gw.id, JSON.stringify(newWinners), 'ended');

  // Announce in channel
  const channel = await client.channels.fetch(gw.channel_id).catch(() => null);
  if (channel) {
    const winnerDisplay = newWinners.map(id => `<@${id}>`).join(', ');
    await channel.send({
      content: `🎉 **Giveaway Rerolled!**\nNew Winner(s) for **${gw.prize}**: ${winnerDisplay}! Contact <@${gw.host_id}> to claim your prize!`
    });
  }

  return newWinners;
}

module.exports = {
  initGiveaways,
  startGiveaway,
  handleGiveawayEnter,
  endGiveawayInternal,
  rerollGiveaway,
  activeTimers
};
