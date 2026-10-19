const { PermissionFlagsBits, ChannelType } = require('discord.js');
const theme = require('./utils/theme');

module.exports = {
  // Brand details
  communityName: theme.brandName,
  tagline: theme.tagline,

  // Colors
  colors: theme.colors,

  // YouTube Channel to monitor (only @OlflazMC)
  youtube: {
    channelHandle: '@OlflazMC',
    channelUrl: 'https://www.youtube.com/@OlflazMC',
    channelId: 'UCl4u_M9jzMV14y-TfrJ0-aQ',
    feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCl4u_M9jzMV14y-TfrJ0-aQ',
    pollingIntervalMs: 10 * 60 * 1000 // 10 minutes
  },

  // Centralized Staff Policy for Tickets and Reviews
  staffPolicy: {
    ticketAccessRoles: ['👑 Owner', '🛡️ Admin', '🔨 Moderator', '🤝 Helper'],
    applicationReviewRoles: ['👑 Owner', '🛡️ Admin'],
    giveawayManageRoles: ['👑 Owner', '🛡️ Admin', '🔨 Moderator'],
    eventManageRoles: ['👑 Owner', '🛡️ Admin', '🔨 Moderator', '🤝 Helper']
  },

  // 5 Community Self-Assignable Roles (Restricted Whitelist)
  selfRoles: [
    {
      id: 'role_minecraft',
      name: '🎮 Minecraft',
      lookupNames: ['🎮 minecraft', 'minecraft'],
      emoji: '🎮',
      description: 'General Minecraft discussions, survival news, and community gameplay',
      color: 0x2ECC71,
      style: 'Success'
    },
    {
      id: 'role_pvp',
      name: '⚔️ PvP',
      lookupNames: ['⚔️ pvp', 'pvp'],
      emoji: '⚔️',
      description: 'Get notified for PvP duels, tournaments, and practice sessions',
      color: 0x00D2D3,
      style: 'Primary'
    },
    {
      id: 'role_uhc',
      name: '🩸 UHC FFA',
      lookupNames: ['🩸 uhc ffa', 'uhc ffa', 'uhc'],
      emoji: '🩸',
      description: 'Get pinged when UHC FFA matches & custom games start',
      color: 0xE67E22,
      style: 'Danger'
    },
    {
      id: 'role_youtube',
      name: '📢 YouTube Updates',
      lookupNames: ['📢 youtube updates', 'youtube updates', '🎥 youtube updates'],
      emoji: '📢',
      description: 'Get notified whenever OlflazMC uploads new videos or goes live',
      color: 0xE74C3C,
      style: 'Primary'
    },
    {
      id: 'role_events',
      name: '🎉 Events',
      lookupNames: ['🎉 events', 'events', '🏆 events'],
      emoji: '🎉',
      description: 'Get notified for community events, streams, and special tournaments',
      color: 0x9B59B6,
      style: 'Secondary'
    }
  ],

  // Complete Server Role Hierarchy (ordered from highest rank to lowest rank)
  roles: [
    // 1. Staff Roles (Hierarchy Top)
    {
      name: '👑 Owner',
      category: 'Staff',
      legacyNames: ['owner / youtuber', 'owner', '👑 owner', 'server owner', '𝗼𝘄𝗻𝗲𝗿'],
      color: 0xF1C40F, // Gold
      hoist: true,
      mentionable: false,
      permissions: [PermissionFlagsBits.Administrator],
      description: 'Server Owner & Head Creator (Full Administrative Control)'
    },
    {
      name: '🛡️ Admin',
      category: 'Staff',
      legacyNames: ['admin', 'administrator', '🛡️ admin', 'admins'],
      color: 0xE74C3C, // Crimson Red
      hoist: true,
      mentionable: false,
      permissions: [
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageGuild,
        PermissionFlagsBits.ManageRoles,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ViewAuditLog,
        PermissionFlagsBits.KickMembers,
        PermissionFlagsBits.BanMembers,
        PermissionFlagsBits.ModerateMembers,
        PermissionFlagsBits.MentionEveryone,
        PermissionFlagsBits.MuteMembers,
        PermissionFlagsBits.DeafenMembers,
        PermissionFlagsBits.MoveMembers,
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ],
      description: 'Server Administrator (Server operations & member safety)'
    },
    {
      name: '🔨 Moderator',
      category: 'Staff',
      legacyNames: ['moderator', 'mod'],
      color: 0x3498DB, // Lapis Blue
      hoist: true,
      mentionable: true,
      permissions: [
        PermissionFlagsBits.ModerateMembers,
        PermissionFlagsBits.KickMembers,
        PermissionFlagsBits.BanMembers,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ViewAuditLog,
        PermissionFlagsBits.MuteMembers,
        PermissionFlagsBits.DeafenMembers,
        PermissionFlagsBits.MoveMembers,
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ],
      description: 'Community Moderator (Dispute resolution & chat enforcement)'
    },
    {
      name: '🤝 Helper',
      category: 'Staff',
      legacyNames: ['helper', 'support'],
      color: 0x1ABC9C, // Sea Green / Teal
      hoist: true,
      mentionable: true,
      permissions: [
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ModerateMembers,
        PermissionFlagsBits.MuteMembers,
        PermissionFlagsBits.DeafenMembers,
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ],
      description: 'Community Helper (User assistance & spam mitigation)'
    },

    // 2. Creator and Supporter Roles
    {
      name: '💎 YouTuber+',
      category: 'Creator & Supporter',
      legacyNames: ['youtuber+', 'partner'],
      color: 0x00D2D3, // Diamond Cyan
      hoist: true,
      mentionable: true,
      permissions: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.UseExternalEmojis,
        PermissionFlagsBits.AddReactions,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.PrioritySpeaker
      ],
      description: 'Partnered YouTubers & Major Content Creators'
    },
    {
      name: '🎥 YouTuber Rank',
      category: 'Creator & Supporter',
      legacyNames: ['youtuber rank', 'youtuber', 'creator', '🎥 youtuber', '🎥 youtuber rank'],
      color: 0xFF4757, // YouTube Red
      hoist: true,
      mentionable: true,
      permissions: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.UseExternalEmojis,
        PermissionFlagsBits.AddReactions,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.PrioritySpeaker
      ],
      description: 'Minecraft Content Creators & Streamers'
    },
    {
      name: '🚀 Server Booster',
      category: 'Creator & Supporter',
      legacyNames: ['server booster', 'booster', 'nitro booster'],
      color: 0xFD79A8, // Nitro Pink
      hoist: true,
      mentionable: false,
      isBoosterRole: true,
      permissions: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.UseExternalEmojis,
        PermissionFlagsBits.AddReactions,
        PermissionFlagsBits.ChangeNickname,
        PermissionFlagsBits.ReadMessageHistory
      ],
      description: 'Official Server Nitro Boosters'
    },
    {
      name: '🌟 VIP',
      category: 'Creator & Supporter',
      legacyNames: ['vip'],
      color: 0xFFA502, // Amber Gold
      hoist: true,
      mentionable: false,
      permissions: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.UseExternalEmojis,
        PermissionFlagsBits.AddReactions,
        PermissionFlagsBits.ChangeNickname,
        PermissionFlagsBits.ReadMessageHistory
      ],
      description: 'Distinguished Community VIP Members'
    },
    {
      name: '🏅 OG',
      category: 'Creator & Supporter',
      legacyNames: ['og', 'veteran'],
      color: 0xE67E22, // Bronze Orange
      hoist: true,
      mentionable: false,
      permissions: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.UseExternalEmojis,
        PermissionFlagsBits.AddReactions,
        PermissionFlagsBits.ChangeNickname,
        PermissionFlagsBits.ReadMessageHistory
      ],
      description: 'Founding & Long-Time Community Members'
    },
    {
      name: '💜 Active Member',
      category: 'Creator & Supporter',
      legacyNames: ['active member', 'active'],
      color: 0x8854D0, // Enchantment Purple
      hoist: false,
      mentionable: false,
      permissions: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.UseExternalEmojis,
        PermissionFlagsBits.AddReactions,
        PermissionFlagsBits.ReadMessageHistory
      ],
      description: 'Highly Engaged Community Contributors'
    },

    // 3. Community and Utility Roles
    {
      name: '🤖 Bot',
      category: 'Community & Utility',
      legacyNames: ['bot', 'bots'],
      color: 0x70A1FF, // Steel Slate Blue
      hoist: true,
      mentionable: false,
      permissions: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak
      ],
      description: 'Automated Bot Integrations'
    },
    {
      name: '👤 Member',
      category: 'Community & Utility',
      legacyNames: ['member'],
      color: 0x747D8C, // Bedrock Grey
      hoist: false,
      mentionable: false,
      permissions: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AddReactions,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak
      ],
      description: 'Standard Verified Community Members'
    },
    {
      name: '🎮 Minecraft',
      category: 'Community & Utility',
      legacyNames: ['minecraft'],
      color: 0x2ECC71, // Emerald Green
      hoist: false,
      mentionable: true,
      permissions: [],
      description: 'Opt-in Ping Role: Minecraft Discussions & News'
    },
    {
      name: '⚔️ PvP',
      category: 'Community & Utility',
      legacyNames: ['pvp'],
      color: 0x00D2D3, // Diamond Cyan
      hoist: false,
      mentionable: true,
      permissions: [],
      description: 'Opt-in Ping Role: PvP Duels & Practice Calls'
    },
    {
      name: '🩸 UHC FFA',
      category: 'Community & Utility',
      legacyNames: ['uhc ffa', 'uhc'],
      color: 0xE67E22, // Lava Orange
      hoist: false,
      mentionable: true,
      permissions: [],
      description: 'Opt-in Ping Role: UHC Free-For-All Matches'
    },
    {
      name: '📢 YouTube Updates',
      category: 'Community & Utility',
      legacyNames: ['youtube updates', 'youtube'],
      color: 0xE74C3C, // Nether Red
      hoist: false,
      mentionable: true,
      permissions: [],
      description: 'Opt-in Ping Role: YouTube Video & Stream Alerts'
    },
    {
      name: '🎉 Events',
      category: 'Community & Utility',
      legacyNames: ['events'],
      color: 0x9B59B6, // Enchantment Violet
      hoist: false,
      mentionable: true,
      permissions: [],
      description: 'Opt-in Ping Role: Tournaments & Game Nights'
    }
  ],

  // Complete Channel & Category Layout
  structure: [
    {
      name: '「📌」𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗧𝗜𝗢𝗡',
      type: ChannelType.GuildCategory,
      legacyNames: ['📌 information & rules', 'information & rules', 'information', 'info'],
      channels: [
        {
          name: '👋・welcome',
          type: ChannelType.GuildText,
          topic: 'Welcome to OlflazMC! New members arrive here.',
          readOnly: true,
          starterKey: 'welcome',
          legacyNames: ['welcome', 'welcome-and-rules']
        },
        {
          name: '📜・rules',
          type: ChannelType.GuildText,
          topic: 'Official OlflazMC community rules, guidelines, and Minecraft PvP conduct.',
          readOnly: true,
          starterKey: 'rules',
          legacyNames: ['rules']
        },
        {
          name: '📢・announcements',
          type: ChannelType.GuildText,
          topic: 'Official updates, news, and important notices for the OlflazMC community.',
          readOnly: true,
          starterKey: 'announcements',
          legacyNames: ['announcements', 'announcement']
        },
        {
          name: '🎭・choose-roles',
          type: ChannelType.GuildText,
          topic: 'Click the interactive buttons below to pick your ping roles (Minecraft, PvP, UHC FFA, etc.).',
          readOnly: true,
          starterKey: 'roles',
          legacyNames: ['roles', 'choose-roles', 'self-roles']
        }
      ]
    },
    {
      name: '「💬」𝗖𝗢𝗠𝗠𝗨𝗡𝗜𝗧𝗬',
      type: ChannelType.GuildCategory,
      legacyNames: ['💬 community', 'community'],
      channels: [
        {
          name: '💬・general-chat',
          type: ChannelType.GuildText,
          topic: 'General chatter and hangout for all OlflazMC community members.',
          legacyNames: ['general-chat', 'general']
        },
        {
          name: '😂・memes',
          type: ChannelType.GuildText,
          topic: 'Minecraft memes, jokes, and funny gameplay moments.',
          legacyNames: ['memes', 'meme']
        },
        {
          name: '📸・media',
          type: ChannelType.GuildText,
          topic: 'Share your best Minecraft clips, screenshots, clutch plays, and pack showcases!',
          legacyNames: ['media-and-clips', 'media', 'clips']
        },
        {
          name: '💡・suggestions',
          type: ChannelType.GuildText,
          topic: 'Submit and vote on ideas to improve the OlflazMC community and server!',
          starterKey: 'suggestions-panel',
          legacyNames: ['suggestions', 'suggestion']
        }
      ]
    },
    {
      name: '「⚔️」𝗣𝗩𝗣 𝗔𝗥𝗘𝗡𝗔',
      type: ChannelType.GuildCategory,
      legacyNames: ['⚔️ minecraft modes', 'minecraft modes', 'pvp arena', 'pvp'],
      channels: [
        {
          name: '⚔️・pvp-chat',
          type: ChannelType.GuildText,
          topic: 'PvP discussions, 1v1 duel setups, kit tactics, and combat mechanics.',
          starterKey: 'pvp-chat',
          legacyNames: ['pvp-arena', 'pvp-chat', 'pvp']
        },
        {
          name: '🩸・uhc-ffa',
          type: ChannelType.GuildText,
          topic: 'UHC Free-For-All match callouts, golden head strategies, and win screenshots.',
          starterKey: 'uhc-ffa',
          legacyNames: ['uhc-ffa', 'uhc']
        },
        {
          name: '🤝・find-a-duel',
          type: ChannelType.GuildText,
          topic: 'Find 1v1 duel partners and practice scrims across your favorite Minecraft servers.',
          starterKey: 'find-a-duel',
          legacyNames: ['find-a-duel', 'duels', '1v1']
        },
        {
          name: '🏆・leaderboards',
          type: ChannelType.GuildText,
          topic: 'Community tournament standings, leaderboards, and seasonal champions.',
          readOnly: true,
          starterKey: 'leaderboards',
          legacyNames: ['leaderboards', 'leaderboard', 'stats']
        }
      ]
    },
    {
      name: '「🎥」𝗢𝗟𝗙𝗟𝗔𝗭𝗠𝗖 𝗦𝗧𝗨𝗗𝗜𝗢',
      type: ChannelType.GuildCategory,
      legacyNames: ['olflazmc studio', 'studio', 'creator studio', 'youtube'],
      channels: [
        {
          name: '📺・new-videos',
          type: ChannelType.GuildText,
          topic: 'Automated alerts whenever new OlflazMC YouTube videos and streams go live!',
          readOnly: true,
          starterKey: 'new-videos',
          legacyNames: ['new-videos', 'youtube-uploads', 'videos']
        },
        {
          name: '🎬・behind-the-scenes',
          type: ChannelType.GuildText,
          topic: 'Sneak peeks, upcoming video teasers, and creator updates.',
          readOnly: true,
          starterKey: 'behind-the-scenes',
          legacyNames: ['behind-the-scenes', 'bts']
        },
        {
          name: '💡・video-ideas',
          type: ChannelType.GuildText,
          topic: 'Suggest video concepts, challenge ideas, and YouTube content you want to see!',
          starterKey: 'video-ideas',
          legacyNames: ['video-ideas', 'ideas']
        },
        {
          name: '🤝・creator-chat',
          type: ChannelType.GuildText,
          topic: 'Chat channel for verified YouTubers, creators, and staff.',
          starterKey: 'creator-chat',
          legacyNames: ['creator-chat', 'creators']
        }
      ]
    },
    {
      name: '「🎉」𝗘𝗩𝗘𝗡𝗧𝗦 & 𝗦𝗨𝗣𝗣𝗢𝗥𝗧',
      type: ChannelType.GuildCategory,
      legacyNames: ['events & support', 'events', 'support', 'tickets', 'tournaments & events', '「🏆」𝗲𝘃𝗲𝗻𝘁𝘀'],
      channels: [
        {
          name: '🎫・open-a-ticket',
          type: ChannelType.GuildText,
          topic: 'Open a private ticket for Support, Player Reports, or Creator Applications.',
          readOnly: true,
          starterKey: 'ticket-panel',
          legacyNames: ['open-a-ticket', 'tickets', 'ticket', 'support']
        },
        {
          name: '🎉・giveaways',
          type: ChannelType.GuildText,
          topic: 'Official community giveaways, game codes, and subscriber perks!',
          starterKey: 'giveaways-info',
          legacyNames: ['giveaways', 'giveaway']
        },
        {
          name: '📅・events',
          type: ChannelType.GuildText,
          topic: 'Community tournament schedules, stream dates, and voice game nights.',
          starterKey: 'events-info',
          legacyNames: ['events', 'tournaments', 'events-and-tournaments', '🏆・tournaments']
        }
      ]
    },
    {
      name: '「🛡️」𝗦𝗧𝗔𝗙𝗙',
      type: ChannelType.GuildCategory,
      isStaffOnly: true,
      legacyNames: ['staff', '🛡️ staff only', 'staff only', 'staff zone', '「🛡️」𝘀𝘁𝗮𝗳𝗳 𝘇𝗼𝗻𝗲'],
      channels: [
        {
          name: '🔒・staff-chat',
          type: ChannelType.GuildText,
          topic: 'Private coordination channel for OlflazMC moderators and staff.',
          legacyNames: ['staff-chat', 'staff']
        },
        {
          name: '📋・mod-logs',
          type: ChannelType.GuildText,
          topic: 'Automated audit logs, anti-spam alerts, and moderator action reports.',
          legacyNames: ['mod-logs', 'logs', '🛡️・mod-logs']
        },
        {
          name: '🎫・ticket-logs',
          type: ChannelType.GuildText,
          topic: 'Archive logs and transcripts of resolved community support tickets.',
          legacyNames: ['ticket-logs']
        },
        {
          name: '📝・applications-review',
          type: ChannelType.GuildText,
          topic: 'Review panel for creator applications (YouTuber / YouTuber+).',
          legacyNames: ['applications-review', 'apps', 'applications']
        }
      ]
    },
    {
      name: '「🔊」𝗩𝗢𝗜𝗖𝗘 𝗟𝗢𝗨𝗡𝗚𝗘',
      type: ChannelType.GuildCategory,
      legacyNames: ['🔊 voice channels', 'voice channels', 'voice', '「🔊」𝘃𝗼𝗶𝗰𝗲 𝗹𝗼𝘂𝗻𝗴𝗲'],
      channels: [
        {
          name: '🔊・Lounge 1',
          type: ChannelType.GuildVoice,
          legacyNames: ['lounge 1']
        },
        {
          name: '🔊・Lounge 2',
          type: ChannelType.GuildVoice,
          legacyNames: ['lounge 2']
        },
        {
          name: '⚔️・PvP Duo 1',
          type: ChannelType.GuildVoice,
          userLimit: 2,
          legacyNames: ['pvp duo 1']
        },
        {
          name: '⚔️・PvP Duo 2',
          type: ChannelType.GuildVoice,
          userLimit: 2,
          legacyNames: ['pvp duo 2']
        },
        {
          name: '🩸・UHC Squad',
          type: ChannelType.GuildVoice,
          userLimit: 4,
          legacyNames: ['uhc squad']
        }
      ]
    }
  ],

  // Anti-spam configuration
  antiSpam: {
    enabled: true,
    maxMessagesPerWindow: 5,
    windowMs: 5000,
    duplicateThreshold: 3,
    duplicateWindowMs: 10000,
    maxMentions: 4,
    warnThresholdForTimeout: 3,
    timeoutDurationMs: 5 * 60 * 1000 // 5 minutes timeout
  }
};
