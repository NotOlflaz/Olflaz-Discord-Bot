const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');
const theme = require('./theme');
const { createRolesPanelPayload } = require('../commands/setup/roles-panel');

/**
 * Returns starter messages and embeds tailored for each channel type
 * @param {string} starterKey - The key identifying the channel's starter template
 * @param {import('discord.js').Guild} guild - The Discord guild
 * @returns {{ embeds?: EmbedBuilder[], components?: any[] } | null}
 */
function getStarterMessagePayload(starterKey, guild) {
  const channels = guild ? guild.channels.cache : null;
  const findCh = (name) => {
    if (!channels) return `#${name}`;
    const ch = channels.find(c => c.name.includes(name) || c.name === name);
    return ch ? `<#${ch.id}>` : `#${name}`;
  };

  switch (starterKey) {
    case 'rules': {
      const embed = new EmbedBuilder()
        .setTitle(`${theme.emojis.rules} ${config.communityName} — Community Rules & Guidelines`)
        .setColor(theme.colors.primary)
        .setDescription(
          `Welcome to **${config.communityName}**! To ensure a fun, competitive, and welcoming environment for everyone, please read and follow our community rules below.`
        )
        .addFields(
          {
            name: '1️⃣ Respect & Sportsmanship',
            value:
              'Treat all members, staff, and YouTubers with respect. Toxicity, harassment, discrimination, hate speech, or excessive trash-talk will result in moderation action.',
            inline: false
          },
          {
            name: '2️⃣ Fair Play & Anti-Cheat',
            value:
              'Strictly **NO hacked clients, auto-clickers, reach modifications, macros, or unfair advantages** during any community matches, events, or tournaments. Play fair and respect the game.',
            inline: false
          },
          {
            name: '3️⃣ Chat & Spam Guidelines',
            value:
              '• Do not flood channels or repeat copy-pasted messages.\n' +
              '• Avoid mass-mentioning (@everyone / @here / multiple members).\n' +
              '• No unsolicited Discord invites or commercial advertising without staff permission.',
            inline: false
          },
          {
            name: '4️⃣ Channel Organization',
            value:
              `Keep conversations in their designated channels:\n` +
              `• General chatter in ${findCh('general-chat')}\n` +
              `• PvP setups & duel requests in ${findCh('pvp-chat')}\n` +
              `• UHC FFA discussions & callouts in ${findCh('uhc-ffa')}\n` +
              `• Community suggestions in ${findCh('suggestions')}\n` +
              `• Video ideas in ${findCh('video-ideas')}`,
            inline: false
          },
          {
            name: '5️⃣ Staff Discretion',
            value:
              'Moderators reserve the right to mute, kick, or ban members who disrupt community harmony, even for situations not explicitly listed above.',
            inline: false
          },
          {
            name: '👉 Next Step',
            value:
              `Visit ${findCh('choose-roles')} to pick your notification roles (**🎮 Minecraft**, **⚔️ PvP**, **🩸 UHC FFA**, **📢 YouTube Updates**, **🎉 Events**)!`,
            inline: false
          }
        )
        .setFooter({ text: theme.footers.standard })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_acknowledge_rules')
          .setLabel('Acknowledge Rules')
          .setEmoji('✅')
          .setStyle(ButtonStyle.Success)
      );

      return { embeds: [embed], components: [row] };
    }

    case 'announcements': {
      const embed = new EmbedBuilder()
        .setTitle(`${theme.emojis.announcements} Welcome to the ${config.communityName} Community Discord!`)
        .setColor(theme.colors.warning)
        .setDescription(
          `Welcome to the official home for the **${config.communityName}** Minecraft community!\n\n` +
          `This server connects players, viewers, and competitors who love Minecraft PvP, UHC Free-For-All, custom challenges, and YouTube updates.`
        )
        .addFields(
          {
            name: '⚔️ What You Will Find Here',
            value:
              `• **PvP Arena:** 1v1 duel setups, pack showcases, and practice sessions in ${findCh('pvp-chat')}.\n` +
              `• **UHC FFA:** Strategy breakdowns, clutch screenshots, and match callouts in ${findCh('uhc-ffa')}.\n` +
              `• **Tournaments & Events:** Competitive brackets and community game nights in ${findCh('events')}.\n` +
              `• **YouTube Alerts:** Instant notifications whenever new videos and streams drop in ${findCh('new-videos')}!`,
            inline: false
          },
          {
            name: '🔔 Get Notified',
            value:
              `Head over to ${findCh('choose-roles')} and select which roles you'd like pinged for.`,
            inline: false
          },
          {
            name: '💬 Say Hello',
            value:
              `Drop by ${findCh('general-chat')} to introduce yourself and meet your fellow Minecraft PvPers!`,
            inline: false
          }
        )
        .setFooter({ text: theme.footers.standard })
        .setTimestamp();

      return { embeds: [embed] };
    }

    case 'welcome': {
      const embed = new EmbedBuilder()
        .setTitle(`${theme.emojis.welcome} Welcome to ${config.communityName} — Getting Started Guide`)
        .setColor(theme.colors.primary)
        .setDescription(
          `Welcome! Whether you are a competitive Minecraft PvPer, a UHC warrior, or a fan of OlflazMC's YouTube content, we are thrilled to have you here.\n\n` +
          `Follow these quick steps to get set up:`
        )
        .addFields(
          {
            name: `${theme.emojis.rules} 1. Read the Rules`,
            value: `Check out ${findCh('rules')} to understand server standards and fair play expectations.`,
            inline: true
          },
          {
            name: `${theme.emojis.roles} 2. Pick Your Roles`,
            value: `Visit ${findCh('choose-roles')} and click buttons for **Minecraft**, **PvP**, **UHC FFA**, **Events**, and **YouTube**!`,
            inline: true
          },
          {
            name: `${theme.emojis.chat} 3. Jump into Chat`,
            value: `Introduce yourself in ${findCh('general-chat')} and share your best clips in ${findCh('media')}!`,
            inline: true
          },
          {
            name: `${theme.emojis.ticket} Support & Help`,
            value: `Need assistance or want to report a player? Visit ${findCh('open-a-ticket')} to speak privately with staff.`,
            inline: false
          }
        )
        .setFooter({ text: theme.footers.standard })
        .setTimestamp();

      return { embeds: [embed] };
    }

    case 'roles': {
      return createRolesPanelPayload();
    }

    case 'suggestions-panel': {
      const embed = new EmbedBuilder()
        .setTitle(`${theme.emojis.suggestions} Community Suggestions & Feature Requests`)
        .setColor(theme.colors.info)
        .setDescription(
          `Have an idea to improve the **${config.communityName}** Discord server, Minecraft events, or video content?\n\n` +
          `Click the button below to submit a suggestion. Community members can vote on suggestions using ${theme.emojis.upvote} and ${theme.emojis.downvote} buttons!`
        )
        .addFields(
          {
            name: '📋 How Suggestions Work',
            value:
              '1. Click **Submit Suggestion** below to open the submission form.\n' +
              '2. Fill out a concise title and detailed explanation.\n' +
              '3. Your suggestion will be posted with live community voting buttons.\n' +
              '4. Staff regularly review top-voted suggestions and update their status!',
            inline: false
          }
        )
        .setFooter({ text: theme.footers.suggestions });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_open_suggestion_modal')
          .setLabel('Submit Suggestion')
          .setEmoji(theme.emojis.ideas)
          .setStyle(ButtonStyle.Success)
      );

      return { embeds: [embed], components: [row] };
    }

    case 'pvp-chat': {
      const embed = new EmbedBuilder()
        .setTitle(`${theme.emojis.pvp} PvP Arena — Mechanics, Setups & Duels`)
        .setColor(theme.colors.primary)
        .setDescription(
          `Welcome to the **PvP Arena** discussion channel! This is the hub for all discussions regarding Minecraft combat mechanics, duel setups, and 1v1 practice.`
        )
        .addFields(
          {
            name: '🎯 Discussion Topics',
            value:
              `• **Combat Styles:** 1.8 rod duels, block-hitting, W-tapping, S-tapping, and modern combat\n` +
              `• **Setups:** Mouse DPI, CPS techniques (jitter, butterfly, normal), and keybinds\n` +
              `• **Kits:** Nodebuff, BuildUHC, Gapple, Classic, and Boxing practice\n` +
              `• **Resource Packs:** Texture packs, low-fire packs, and custom crosshairs`,
            inline: false
          },
          {
            name: '🤝 Looking for a Duel?',
            value:
              `Hop over to ${findCh('find-a-duel')} to challenge members or set up 1v1 scrimmages!`,
            inline: false
          }
        )
        .setFooter({ text: theme.footers.standard })
        .setTimestamp();

      return { embeds: [embed] };
    }

    case 'uhc-ffa': {
      const embed = new EmbedBuilder()
        .setTitle(`${theme.emojis.uhc} UHC FFA — Strategies, Matchups & Survival`)
        .setColor(theme.colors.uhc)
        .setDescription(
          `Welcome to the **UHC Free-For-All** battleground! No natural health regeneration—every heart counts. Discuss loadouts, match callouts, and victory strategies here.`
        )
        .addFields(
          {
            name: '🏹 Key Topics',
            value:
              `• **Pacing:** Fast surface rushing vs deep caving for diamond gear\n` +
              `• **Healing Economy:** Golden head crafting, absorption timing, and apple management\n` +
              `• **Utility Plays:** Water bucket MLGs, lava bucket offense, cobwebs, and bow snipes\n` +
              `• **Match Callouts:** Sharing active UHC matches and organizing custom FFA games`,
            inline: false
          },
          {
            name: '📸 Show Off Your Wins',
            value:
              `Share your win screens, clutch kill moments, and highlight screenshots over in ${findCh('media')}!`,
            inline: false
          }
        )
        .setFooter({ text: theme.footers.standard })
        .setTimestamp();

      return { embeds: [embed] };
    }

    case 'find-a-duel': {
      const embed = new EmbedBuilder()
        .setTitle(`${theme.emojis.duel} Find-A-Duel Matchmaking Hub`)
        .setColor(theme.colors.primary)
        .setDescription(
          `Looking for 1v1 practice, unranked sparring, or tournament warmups?\n\n` +
          `Click **Post Duel Challenge** below to issue an instant matchmaking request for BuildUHC, Nodebuff, Gapple, or Rod PvP!`
        )
        .addFields(
          {
            name: '📋 How Duel Matchmaking Works',
            value:
              '1. Click **Post Duel Challenge** to input your IGN, Kit/Mode, and Server.\n' +
              '2. Your challenge appears in this channel with an **Accept** button.\n' +
              '3. Once an opponent accepts, both fighters are tagged to jump in-game and fight!',
            inline: false
          }
        )
        .setFooter({ text: theme.footers.standard });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_open_duel_modal')
          .setLabel('Post Duel Challenge')
          .setEmoji('⚔️')
          .setStyle(ButtonStyle.Primary)
      );

      return { embeds: [embed], components: [row] };
    }

    case 'leaderboards': {
      const embed = new EmbedBuilder()
        .setTitle(`${theme.emojis.leaderboard} Community Hall of Fame & Leaderboards`)
        .setColor(theme.colors.warning)
        .setDescription(
          `Official records, tournament champion honors, and Hall of Fame for **${config.communityName}**.\n\n` +
          `Official tournament winners, seasonal MVP recognitions, and tournament brackets are archived in this channel.`
        )
        .addFields(
          {
            name: '🏆 Seasonal Champions',
            value: 'Tournament winners receive the exclusive **🌟 VIP** or **🏅 OG** badge and custom shoutouts in OlflazMC videos!',
            inline: false
          },
          {
            name: '📊 Network Statistics Notice',
            value:
              '• Live external network player stats (e.g. Hypixel/Minemen Club Elo) are not currently linked via live API.\n' +
              '• Official community tournament results and seasonal rankings are logged, verified, and updated directly by server staff.',
            inline: false
          }
        )
        .setFooter({ text: theme.footers.standard })
        .setTimestamp();

      return { embeds: [embed] };
    }

    case 'new-videos': {
      const embed = new EmbedBuilder()
        .setTitle(`${theme.emojis.videos} OlflazMC Official YouTube Uploads`)
        .setColor(theme.colors.youtube)
        .setDescription(
          `Subscribe to the official YouTube channel: **[youtube.com/@OlflazMC](${config.youtube.channelUrl})**\n\n` +
          `Whenever OlflazMC publishes a new Minecraft video, Short, or livestream, an automated alert will appear right here!`
        )
        .addFields(
          {
            name: '🔔 Role Notifications',
            value: `Select the **📢 YouTube Updates** role in ${findCh('choose-roles')} to get pinged the moment videos go live!`,
            inline: false
          }
        )
        .setFooter({ text: theme.footers.standard });

      return { embeds: [embed] };
    }

    case 'behind-the-scenes': {
      const embed = new EmbedBuilder()
        .setTitle(`${theme.emojis.behindScenes} Behind the Scenes & Teasers`)
        .setColor(theme.colors.events)
        .setDescription(
          `Exclusive previews, upcoming video thumbnails, recording bloopers, and creator updates from **OlflazMC**!`
        )
        .setFooter({ text: theme.footers.standard });

      return { embeds: [embed] };
    }

    case 'video-ideas': {
      const embed = new EmbedBuilder()
        .setTitle(`${theme.emojis.ideas} Minecraft Video Ideas & Concepts`)
        .setColor(theme.colors.warning)
        .setDescription(
          `Have a cool challenge, PvP scenario, or UHC mod concept you'd love to see OlflazMC tackle on YouTube?\n\n` +
          `Click **Pitch a Video Idea** below to submit your concept directly to the creator team!`
        )
        .addFields(
          {
            name: '💡 Idea Review & Community Voting',
            value:
              '• Pitched ideas are posted with a community upvote button.\n' +
              '• High-interest concepts are reviewed by OlflazMC and marked for upcoming video recordings!',
            inline: false
          }
        )
        .setFooter({ text: theme.footers.standard });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_open_video_idea_modal')
          .setLabel('Pitch a Video Concept')
          .setEmoji('💡')
          .setStyle(ButtonStyle.Success)
      );

      return { embeds: [embed], components: [row] };
    }

    case 'creator-chat': {
      const embed = new EmbedBuilder()
        .setTitle(`${theme.emojis.creator} Creator Studio Lounge`)
        .setColor(theme.colors.primary)
        .setDescription(
          `Welcome to the **OlflazMC Creator Lounge**! This channel is for verified content creators, YouTubers, and staff to collaborate on video projects and custom events.`
        )
        .setFooter({ text: theme.footers.standard });

      return { embeds: [embed] };
    }

    case 'ticket-panel': {
      const embed = new EmbedBuilder()
        .setTitle(`${theme.emojis.ticket} OlflazMC Support & Assistance Center`)
        .setColor(theme.colors.primary)
        .setDescription(
          `Need help, wish to report a player, or applying for creator rank? Open a private ticket with the OlflazMC staff team!\n\n` +
          `Please select the appropriate category below to start your private ticket:`
        )
        .addFields(
          {
            name: '🛠️ General Support',
            value: 'Questions regarding server rules, role issues, or general assistance.',
            inline: true
          },
          {
            name: '🚨 Player Report',
            value: 'Report rule-breakers, hackers, auto-clickers, or chat misconduct.',
            inline: true
          },
          {
            name: '🎥 Creator Application',
            value: 'Apply for the verified **YouTuber** or **YouTuber+** role.',
            inline: true
          },
          {
            name: '🔒 Ticket Privacy',
            value: 'Tickets create a private text channel visible only to you and authorized staff members. All closed tickets generate an archived transcript.',
            inline: false
          }
        )
        .setFooter({ text: theme.footers.tickets });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_create_support')
          .setLabel('Support')
          .setEmoji('🛠️')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('ticket_create_reports')
          .setLabel('Report Player')
          .setEmoji('🚨')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('ticket_create_applications')
          .setLabel('Creator Apply')
          .setEmoji('🎥')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('ticket_create_other')
          .setLabel('Other Inquiries')
          .setEmoji('❓')
          .setStyle(ButtonStyle.Secondary)
      );

      return { embeds: [embed], components: [row] };
    }

    case 'giveaways-info': {
      const embed = new EmbedBuilder()
        .setTitle(`${theme.emojis.giveaway} Community Giveaways & Rewards`)
        .setColor(theme.colors.warning)
        .setDescription(
          `Welcome to the **Giveaways** channel! Scheduled community giveaways for Minecraft ranks, custom capes, Discord Nitro, and perks will be published here.\n\n` +
          `• Click the **🎟️ Enter Giveaway** button on active giveaway messages to participate.\n` +
          `• Winners are selected automatically and verifiably when the timer concludes.`
        )
        .setFooter({ text: theme.footers.giveaways });

      return { embeds: [embed] };
    }

    case 'events-info': {
      const embed = new EmbedBuilder()
        .setTitle(`${theme.emojis.event} Community Events & Tournaments`)
        .setColor(theme.colors.events)
        .setDescription(
          `Stay tuned here for scheduled **1v1 PvP ladders**, **UHC FFA tournaments**, and **community stream game nights**!\n\n` +
          `When an event is posted, click **✅ Register** on the announcement to reserve your spot.`
        )
        .setFooter({ text: theme.footers.events });

      return { embeds: [embed] };
    }

    default:
      return null;
  }
}

module.exports = {
  getStarterMessagePayload
};
