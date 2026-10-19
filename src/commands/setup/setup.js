const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType
} = require('discord.js');
const config = require('../../config');
const theme = require('../../utils/theme');
const logger = require('../../utils/logger');
const db = require('../../utils/database');
const { getStarterMessagePayload } = require('../../utils/starterMessages');

/**
 * Normalizes Unicode fonts (mathematical bold/italic), emojis, and casing for resilient matching
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
 * Safely converts an iterable, Collection, Map, or Array of channels into a flat Array
 * @param {import('discord.js').Collection | Array | Iterable} channels
 * @returns {Array}
 */
function toChannelArray(channels) {
  if (!channels) return [];
  if (Array.isArray(channels)) return channels.filter(Boolean);
  if (typeof channels.values === 'function') {
    return Array.from(channels.values()).filter(Boolean);
  }
  if (typeof channels[Symbol.iterator] === 'function') {
    return Array.from(channels).filter(Boolean);
  }
  return [];
}

/**
 * Finds the canonical category match using DB map, exact name, NFKD normalization,
 * and legacy aliases, prioritizing active categories with children over empty duplicates.
 * Safely handles missing categories, duplicate names, and flags ambiguous matches.
 */
function findCanonicalCategoryMatch({
  catDef,
  existingChannels,
  claimedCatIds = new Set(),
  canonicalMap = {}
}) {
  if (!catDef || !catDef.name) return null;

  const channelList = toChannelArray(existingChannels);
  const claimed = claimedCatIds instanceof Set ? claimedCatIds : new Set(claimedCatIds || []);
  const catMap = canonicalMap || {};

  // 1. Direct database ID lookup
  const mappedId = catMap['cat_' + catDef.name];
  if (mappedId && !claimed.has(mappedId)) {
    const matched = channelList.find(c => c && c.id === mappedId && c.type === ChannelType.GuildCategory);
    if (matched && matched.id) {
      claimed.add(matched.id);
      return {
        category: matched,
        needsRename: matched.name !== catDef.name,
        isAmbiguous: false,
        candidates: [matched]
      };
    }
  }

  const targetName = catDef.name;
  const targetLower = targetName.toLowerCase();
  const targetNorm = normalizeString(targetName);
  const legacyNorms = (catDef.legacyNames || []).map(normalizeString).filter(Boolean);

  // Find all category candidates
  const candidates = channelList.filter(
    c => c &&
         c.id &&
         !claimed.has(c.id) &&
         c.type === ChannelType.GuildCategory && (
           (c.name && c.name.toLowerCase() === targetLower) ||
           (c.name && normalizeString(c.name) === targetNorm) ||
           (c.name && legacyNorms.includes(normalizeString(c.name)))
         )
  );

  if (!candidates || candidates.length === 0) {
    return null;
  }

  // Check for exact matches
  const exactMatches = candidates.filter(c => c.name === targetName);
  const exactCaseInsensitive = candidates.filter(c => c.name && c.name.toLowerCase() === targetLower);

  let isAmbiguous = false;
  let chosen = null;
  let finalCandidates = candidates;

  if (exactMatches.length === 1) {
    chosen = exactMatches[0];
    finalCandidates = exactMatches;
  } else if (exactMatches.length > 1) {
    // Multiple categories have the EXACT same name in Discord
    finalCandidates = exactMatches;
    const nonZeroChildren = exactMatches.filter(c => {
      const count = c.children?.cache?.size ?? (Array.isArray(c.children) ? c.children.length : 0);
      return count > 0;
    });

    if (nonZeroChildren.length === 1) {
      // Exactly one category is active; others are empty duplicates
      chosen = nonZeroChildren[0];
      isAmbiguous = false;
    } else {
      // Ambiguous: multiple categories have channels or all are empty
      isAmbiguous = true;
      chosen = exactMatches[0];
    }
  } else if (exactCaseInsensitive.length === 1) {
    chosen = exactCaseInsensitive[0];
    finalCandidates = exactCaseInsensitive;
  } else if (exactCaseInsensitive.length > 1) {
    finalCandidates = exactCaseInsensitive;
    const nonZeroChildren = exactCaseInsensitive.filter(c => {
      const count = c.children?.cache?.size ?? (Array.isArray(c.children) ? c.children.length : 0);
      return count > 0;
    });

    if (nonZeroChildren.length === 1) {
      chosen = nonZeroChildren[0];
      isAmbiguous = false;
    } else {
      isAmbiguous = true;
      chosen = exactCaseInsensitive[0];
    }
  } else {
    // Only normalized or legacy matches exist
    const scoredCandidates = candidates.map(c => {
      let score = 0;
      const cNorm = normalizeString(c.name);
      if (cNorm === targetNorm) score += 40;
      else if (legacyNorms.includes(cNorm)) score += 20;

      const childCount = c.children?.cache?.size ?? (Array.isArray(c.children) ? c.children.length : 0);
      score += Math.min(childCount * 5, 25);
      return { candidate: c, score, childCount };
    });

    scoredCandidates.sort((a, b) => b.score - a.score);

    if (scoredCandidates.length > 1 && scoredCandidates[0].score === scoredCandidates[1].score) {
      isAmbiguous = true;
      chosen = scoredCandidates[0].candidate;
      finalCandidates = scoredCandidates.filter(s => s.score === scoredCandidates[0].score).map(s => s.candidate);
    } else {
      chosen = scoredCandidates[0].candidate;
      isAmbiguous = false;
      finalCandidates = [chosen];
    }
  }

  if (!chosen || !chosen.id) {
    return null;
  }

  if (!isAmbiguous) {
    claimed.add(chosen.id);
  }

  return {
    category: chosen,
    needsRename: chosen.name !== targetName,
    isAmbiguous,
    candidates: finalCandidates
  };
}

/**
 * Disambiguates and matches channels against definitions, preferring DB mappings,
 * category containment, active message history, and canonical category parents.
 */
function findCanonicalChannelMatch({
  chDef,
  targetCategory,
  existingChannels,
  claimedIds = new Set(),
  canonicalMap = {},
  intendedCatNorms = new Set()
}) {
  if (!chDef || !chDef.name) return null;

  const channelList = toChannelArray(existingChannels);
  const claimed = claimedIds instanceof Set ? claimedIds : new Set(claimedIds || []);
  const catMap = canonicalMap || {};

  const isCompatibleType = (c) => c && (c.type === chDef.type || (chDef.type === ChannelType.GuildText && (typeof c.isTextBased === 'function' ? c.isTextBased() : true)));
  const chNorm = normalizeString(chDef.name);
  const legacyNorms = (chDef.legacyNames || []).map(normalizeString).filter(Boolean);

  // 1. Direct database ID lookup
  const mappedId = catMap[chDef.name] || (chDef.starterKey && catMap[chDef.starterKey]);
  if (mappedId && !claimed.has(mappedId)) {
    const matched = channelList.find(c => c && c.id === mappedId);
    if (matched && matched.id && isCompatibleType(matched)) {
      claimed.add(matched.id);
      return {
        channel: matched,
        needsRename: matched.name !== chDef.name,
        needsMove: targetCategory && targetCategory.id ? matched.parentId !== targetCategory.id : false,
        source: 'database_map',
        isAmbiguous: false
      };
    }
  }

  // 2. Search inside target category
  if (targetCategory && targetCategory.id) {
    const inCatCandidates = channelList.filter(
      c => c && c.id && !claimed.has(c.id) && c.parentId === targetCategory.id && isCompatibleType(c) && (
        (c.name && c.name.toLowerCase() === chDef.name.toLowerCase()) ||
        (c.name && normalizeString(c.name) === chNorm) ||
        (c.name && legacyNorms.includes(normalizeString(c.name)))
      )
    );

    if (inCatCandidates.length > 0) {
      inCatCandidates.sort((a, b) => {
        let aScore = 0;
        let bScore = 0;
        if (a.name === chDef.name) aScore += 30;
        if (b.name === chDef.name) bScore += 30;
        if (a.name && a.name.toLowerCase() === chDef.name.toLowerCase()) aScore += 15;
        if (b.name && b.name.toLowerCase() === chDef.name.toLowerCase()) bScore += 15;
        return bScore - aScore;
      });

      const chosen = inCatCandidates[0];
      if (chosen && chosen.id) {
        claimed.add(chosen.id);
        const isAmbiguous = inCatCandidates.length > 1 && inCatCandidates[0].name === inCatCandidates[1].name;
        return {
          channel: chosen,
          needsRename: chosen.name !== chDef.name,
          needsMove: false,
          source: 'target_category',
          isAmbiguous,
          candidates: inCatCandidates
        };
      }
    }
  }

  // 3. Search guild-wide (when channel is outside target category)
  const guildCandidates = channelList.filter(
    c => c && c.id && !claimed.has(c.id) && isCompatibleType(c) && (
      (c.name && c.name.toLowerCase() === chDef.name.toLowerCase()) ||
      (c.name && normalizeString(c.name) === chNorm) ||
      (c.name && legacyNorms.includes(normalizeString(c.name)))
    )
  );

  if (guildCandidates.length > 0) {
    guildCandidates.sort((a, b) => {
      let aScore = 0;
      let bScore = 0;

      // Prefer channel whose parent category is an intended canonical category
      if (a.parent && intendedCatNorms.has(normalizeString(a.parent.name))) aScore += 50;
      if (b.parent && intendedCatNorms.has(normalizeString(b.parent.name))) bScore += 50;

      // Prefer exact name match over normalized/legacy
      if (a.name === chDef.name) aScore += 30;
      if (b.name === chDef.name) bScore += 30;
      if (a.name && a.name.toLowerCase() === chDef.name.toLowerCase()) aScore += 15;
      if (b.name && b.name.toLowerCase() === chDef.name.toLowerCase()) bScore += 15;

      // Prefer older created channel (already established)
      if (a.createdTimestamp && b.createdTimestamp) {
        if (a.createdTimestamp < b.createdTimestamp) aScore += 5;
        if (b.createdTimestamp < a.createdTimestamp) bScore += 5;
      }

      return bScore - aScore;
    });

    const chosen = guildCandidates[0];
    if (chosen && chosen.id) {
      claimed.add(chosen.id);
      const isAmbiguous = guildCandidates.length > 1 &&
        normalizeString(guildCandidates[0].name) === normalizeString(guildCandidates[1].name) &&
        guildCandidates[0].parentId === guildCandidates[1].parentId;
      return {
        channel: chosen,
        needsRename: chosen.name !== chDef.name,
        needsMove: targetCategory && targetCategory.id ? chosen.parentId !== targetCategory.id : false,
        source: 'guild_wide',
        isAmbiguous,
        candidates: guildCandidates
      };
    }
  }

  return null;
}

/**
 * Detects duplicate or obsolete channels that were left unclaimed by the canonical structure
 */
function detectDuplicateChannels(existingChannels, claimedChannelIds, configStructure) {
  const channelList = toChannelArray(existingChannels);
  const claimed = claimedChannelIds instanceof Set ? claimedChannelIds : new Set(claimedChannelIds || []);

  const obsoleteCategoryTerms = [
    'information & rules',
    'information and rules',
    'community',
    'minecraft modes',
    'voice channels',
    'events',
    'tournaments'
  ];

  const duplicates = [];

  for (const ch of channelList) {
    if (!ch || !ch.id) continue;
    if (ch.type === ChannelType.GuildCategory) continue;
    if (claimed.has(ch.id)) continue;

    const pName = ch.parent ? ch.parent.name : 'No Category';
    const pNorm = normalizeString(pName);
    const isUnderObsoleteCategory = obsoleteCategoryTerms.some(term => pNorm.includes(normalizeString(term)));

    duplicates.push({
      id: ch.id,
      name: ch.name || 'unnamed-channel',
      parentName: pName,
      parentId: ch.parentId || null,
      type: ch.type,
      isUnderObsoleteCategory,
      reason: isUnderObsoleteCategory
        ? `Located in obsolete duplicate category "${pName}". Canonical counterpart is active in modern category.`
        : `Extra channel outside official bot structure. Preserved.`
    });
  }

  return duplicates;
}

/**
 * Safely delivers an interaction reply or editReply, falling back to channel.send
 * if the interaction token expired (DiscordAPIError[10062]: Unknown interaction).
 */
async function safeRespond(interaction, payload) {
  try {
    if (interaction.deferred || interaction.replied) {
      return await interaction.editReply(payload);
    } else {
      return await interaction.reply(payload);
    }
  } catch (err) {
    if (err.code === 10062 || err.message?.includes('Unknown interaction')) {
      logger.warn(`[Setup] Interaction token expired (10062). Delivering response directly to channel #${interaction.channel?.name || 'unknown'}`);
      if (interaction.channel && interaction.channel.isTextBased()) {
        return await interaction.channel.send(payload).catch(sendErr => {
          logger.error(`Failed to send fallback message: ${sendErr.message}`);
        });
      }
    } else {
      throw err;
    }
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure modern Minecraft PvP categories, channels, complete role hierarchy & starter embeds')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addBooleanOption(option =>
      option
        .setName('preview')
        .setDescription('Set to True to simulate without modifying your server. Set to False to apply.')
        .setRequired(false)
    ),

  async execute(interaction) {
    // 1. Immediately acknowledge interaction within Discord's 3-second deadline
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: false });
      }
    } catch (deferErr) {
      if (deferErr.code === 10062) {
        logger.warn('[Setup] Interaction expired before deferReply could complete.');
      } else {
        logger.warn(`[Setup] Could not defer interaction: ${deferErr.message}`);
      }
    }

    const isPreview = interaction.options.getBoolean('preview') ?? true;
    const guild = interaction.guild;

    if (!guild) {
      return await safeRespond(interaction, {
        content: '❌ This command can only be executed inside a server.',
        ephemeral: true
      });
    }

    // Fetch up-to-date guild caches
    await guild.roles.fetch().catch(() => {});
    await guild.channels.fetch().catch(() => {});

    const existingRoles = guild.roles.cache;
    const existingChannels = toChannelArray(guild.channels.cache);
    const botMember = guild.members.me;

    // --------------------------------------------------------------
    // 1. Analyze Role Hierarchy & Existing Roles
    // --------------------------------------------------------------
    const rolesToCreate = [];
    const rolesToUpdate = [];
    const rolesExisting = [];

    const findRoleMatch = (roleDef) => {
      // 1. If it's a Server Booster role, check Discord native booster role first
      if (roleDef.isBoosterRole) {
        const boosterRole = existingRoles.find(
          r => r.tags?.premiumSubscriberRole || (r.managed && r.name.toLowerCase().includes('booster'))
        );
        if (boosterRole) return boosterRole;
      }

      // 2. Exact match
      let match = existingRoles.find(r => r.name.toLowerCase() === roleDef.name.toLowerCase());
      if (match) return match;

      // 3. Normalized NFKD match (handles mathematical bold fonts like 𝗢𝘄𝗻𝗲𝗿)
      const targetNormalized = normalizeString(roleDef.name);
      match = existingRoles.find(r => normalizeString(r.name) === targetNormalized);
      if (match) return match;

      // 4. Legacy names match
      if (roleDef.legacyNames) {
        match = existingRoles.find(r => {
          const rLower = r.name.toLowerCase();
          const rNorm = normalizeString(r.name);
          return roleDef.legacyNames.some(legacy =>
            rLower === legacy.toLowerCase() || rNorm === normalizeString(legacy)
          );
        });
        if (match) return match;
      }

      // 5. Clean name without emojis match
      const cleanName = roleDef.name.replace(/^[^\w\s]+\s*/, '').toLowerCase();
      match = existingRoles.find(r => {
        const rClean = r.name.replace(/^[^\w\s]+\s*/, '').toLowerCase();
        return rClean === cleanName;
      });
      if (match) return match;

      return null;
    };

    for (const roleDef of config.roles) {
      const match = findRoleMatch(roleDef);
      if (match) {
        const needsSync = !match.managed &&
          match.id !== guild.id &&
          (match.name !== roleDef.name || match.color !== roleDef.color || match.hoist !== (roleDef.hoist ?? false));

        if (needsSync) {
          rolesToUpdate.push({ def: roleDef, role: match });
        } else {
          rolesExisting.push({ def: roleDef, role: match });
        }
      } else {
        rolesToCreate.push(roleDef);
      }
    }

    // --------------------------------------------------------------
    // 2. Analyze Categories & Channels
    // --------------------------------------------------------------
    const canonicalChannelMap = db.getCanonicalChannelMap(guild.id);
    const intendedCatNorms = new Set(config.structure.map(c => normalizeString(c.name)));
    config.structure.forEach(c => {
      (c.legacyNames || []).forEach(l => intendedCatNorms.add(normalizeString(l)));
    });

    const categoriesToCreate = [];
    const categoriesToUpdate = [];
    const categoriesExisting = [];
    const categoryConflicts = [];

    const channelsToCreate = [];
    const channelsToUpdate = [];
    const channelsExisting = [];
    const channelConflicts = [];
    const starterMessagesPlanned = [];

    const claimedCatIds = new Set();
    const claimedChannelIds = new Set();

    for (const catDef of config.structure) {
      const catMatch = findCanonicalCategoryMatch({
        catDef,
        existingChannels,
        claimedCatIds,
        canonicalMap: canonicalChannelMap
      });

      let targetCategoryObj = null;
      if (!catMatch || !catMatch.category) {
        categoriesToCreate.push(catDef);
      } else if (catMatch.isAmbiguous) {
        categoryConflicts.push({
          catDef,
          chosen: catMatch.category,
          candidates: catMatch.candidates || [catMatch.category]
        });
        targetCategoryObj = null;
      } else {
        if (catMatch.needsRename) {
          categoriesToUpdate.push({
            current: catMatch.category,
            target: catDef,
            isAmbiguous: false
          });
          targetCategoryObj = catMatch.category;
        } else {
          categoriesExisting.push({
            name: catDef.name,
            id: catMatch.category.id,
            isAmbiguous: false
          });
          targetCategoryObj = catMatch.category;
        }
      }

      for (const chDef of catDef.channels) {
        const chMatch = findCanonicalChannelMatch({
          chDef,
          targetCategory: targetCategoryObj,
          existingChannels,
          claimedIds: claimedChannelIds,
          canonicalMap: canonicalChannelMap,
          intendedCatNorms
        });

        if (!chMatch || !chMatch.channel) {
          channelsToCreate.push({ ...chDef, categoryName: catDef.name, isStaffOnly: catDef.isStaffOnly });
        } else if (chMatch.isAmbiguous) {
          channelConflicts.push({
            chDef,
            chosen: chMatch.channel,
            candidates: chMatch.candidates || [chMatch.channel]
          });
        } else {
          if (chMatch.needsRename || chMatch.needsMove) {
            channelsToUpdate.push({
              current: chMatch.channel,
              targetDef: chDef,
              categoryName: catDef.name,
              needsMove: chMatch.needsMove,
              needsRename: chMatch.needsRename,
              isAmbiguous: false
            });
          } else {
            channelsExisting.push({
              name: chDef.name,
              id: chMatch.channel.id,
              category: catDef.name,
              isAmbiguous: false
            });
          }
        }

        if (chDef.starterKey) {
          starterMessagesPlanned.push({
            channelName: chDef.name,
            starterKey: chDef.starterKey,
            categoryName: catDef.name
          });
        }
      }
    }

    const duplicateChannels = detectDuplicateChannels(existingChannels, claimedChannelIds, config.structure);

    // ==============================================================
    // PREVIEW MODE: Display detailed dry-run report without changes
    // ==============================================================
    if (isPreview) {
      const staffRoles = config.roles.filter(r => r.category === 'Staff');
      const creatorRoles = config.roles.filter(r => r.category === 'Creator & Supporter');
      const communityRoles = config.roles.filter(r => r.category === 'Community & Utility');

      const formatRoleList = (rolesGroup) => {
        return rolesGroup.map(def => {
          const existing = rolesExisting.find(e => e.def.name === def.name);
          const toUpdate = rolesToUpdate.find(u => u.def.name === def.name);
          const colorHex = '#' + def.color.toString(16).padStart(6, '0').toUpperCase();

          if (existing) {
            return `✅ <@&${existing.role.id}> (\`${colorHex}\` • In Sync)`;
          } else if (toUpdate) {
            return `🔄 <@&${toUpdate.role.id}> (\`${toUpdate.role.name}\` ➔ \`${def.name}\` • Will Sync)`;
          } else {
            return `➕ **${def.name}** (\`${colorHex}\` • Will Create)`;
          }
        }).join('\n');
      };

      const previewEmbed = new EmbedBuilder()
        .setTitle(`🔍 ${config.communityName} Server Setup — PREVIEW MODE`)
        .setColor(theme.colors.warning)
        .setDescription(
          `**Safety Check**: No changes have been made to your server.\n` +
          `Existing channels, roles, messages, and member data are **NEVER deleted**.\n\n` +
          `Below is the complete hierarchy, channels, and starter embeds that will be synchronized:`
        )
        .addFields(
          {
            name: `👑 Staff Role Hierarchy (${staffRoles.length} roles)`,
            value: formatRoleList(staffRoles),
            inline: false
          },
          {
            name: `💎 Creator & Supporter Roles (${creatorRoles.length} roles)`,
            value: formatRoleList(creatorRoles),
            inline: false
          },
          {
            name: `👤 Community, Member & Ping Roles (${communityRoles.length} roles)`,
            value: formatRoleList(communityRoles),
            inline: false
          },
          {
            name: `📁 Categories (${categoriesToCreate.length} to create, ${categoriesToUpdate.length} upgrade, ${categoriesExisting.length} intact${categoryConflicts.length > 0 ? `, ${categoryConflicts.length} ambiguous` : ''})`,
            value:
              (categoriesToCreate.length > 0
                ? `**Will Create:**\n` + categoriesToCreate.map(c => `➕ \`${c.name}\``).join('\n') + '\n'
                : '') +
              (categoriesToUpdate.length > 0
                ? `**Will Rebrand/Synchronize:**\n` + categoriesToUpdate.map(u => `🔄 \`${u.current.name}\` ➔ \`${u.target.name}\``).join('\n') + '\n'
                : '') +
              (categoriesExisting.length > 0
                ? `**Already Up to Date:** ${categoriesExisting.length} categories preserved\n`
                : '') +
              (categoryConflicts.length > 0
                ? `⚠️ **Ambiguous Conflicts (${categoryConflicts.length}):** Action paused to prevent duplicate categories\n`
                : ''),
            inline: false
          },
          {
            name: `💬 Channels (${channelsToCreate.length} to create, ${channelsToUpdate.length} upgrade/move, ${channelsExisting.length} intact)`,
            value:
              (channelsToCreate.length > 0
                ? `**Will Create (${channelsToCreate.length}):**\n` +
                  channelsToCreate.slice(0, 6).map(ch => `➕ \`${ch.name}\` (${ch.categoryName})`).join('\n') +
                  (channelsToCreate.length > 6 ? `\n...and ${channelsToCreate.length - 6} more` : '') + '\n'
                : '') +
              (channelsToUpdate.length > 0
                ? `**Will Synchronize/Move (${channelsToUpdate.length}):**\n` +
                  channelsToUpdate.slice(0, 6).map(u => `🔄 \`#${u.current.name}\` ➔ \`${u.targetDef.name}\`${u.needsMove ? ' (Move Category)' : ''}`).join('\n') +
                  (channelsToUpdate.length > 6 ? `\n...and ${channelsToUpdate.length - 6} more` : '') + '\n'
                : '') +
              (channelsExisting.length > 0
                ? `**Already Matching Aesthetic:** ${channelsExisting.length} channels preserved`
                : ''),
            inline: false
          },
          {
            name: `🔒 Permissions & Security Highlights`,
            value:
              `• **Least-Privilege:** Only **👑 Owner** receives Administrator. Staff roles receive granular moderation access.\n` +
              `• **Safe Permission Clamping:** The bot will only attempt to grant role permissions it possesses to avoid Discord 50013 rejections.\n` +
              `• **Read-Only Channels:** \`📜・rules\`, \`📢・announcements\`, \`👋・welcome\`, \`🎭・choose-roles\`\n` +
              `• **Private Staff Zone:** Hidden from \`@everyone\`, visible only to authorized staff roles\n` +
              `• **Self-Roles Safety:** Buttons strictly restricted to the 5 opt-in community ping roles.`,
            inline: false
          },
          {
            name: `📨 Starter Embeds to Deploy (${starterMessagesPlanned.length} channels)`,
            value:
              `High-quality community guides, prompts, and panels will be automatically posted to empty channels:\n` +
              starterMessagesPlanned.map(s => `• \`${s.channelName}\` (${s.starterKey})`).join('\n'),
            inline: false
          },
          {
            name: `⚠️ Detected Duplicate / Obsolete Channels (${duplicateChannels.length})`,
            value: duplicateChannels.length > 0
              ? duplicateChannels.slice(0, 8).map(d => `• \`#${d.name}\` (\`${d.id}\` in \`${d.parentName}\`)`).join('\n') +
                (duplicateChannels.length > 8 ? `\n...and ${duplicateChannels.length - 8} more duplicates` : '') +
                `\n\n*🛡️ Safety First: Existing duplicate channels are never deleted automatically. Deletion requires explicit user confirmation.*`
              : '✨ No duplicate channels detected in server',
            inline: false
          },
          ...(categoryConflicts.length > 0 ? [{
            name: `⚠️ Ambiguous Category Matches (${categoryConflicts.length} conflict${categoryConflicts.length > 1 ? 's' : ''})`,
            value:
              categoryConflicts.map(conf => {
                const candList = conf.candidates.map(c => `• \`${c.name}\` (ID: \`${c.id}\`)`).join('\n');
                return `**${conf.catDef.name}** matches multiple existing categories:\n${candList}\n*To prevent duplicate categories or arbitrary selection, action is paused for this category.*`;
              }).join('\n\n'),
            inline: false
          }] : []),
          ...(channelConflicts.length > 0 ? [{
            name: `⚠️ Ambiguous Channel Matches (${channelConflicts.length} conflict${channelConflicts.length > 1 ? 's' : ''})`,
            value:
              channelConflicts.map(conf => {
                const candList = conf.candidates.map(c => `• \`#${c.name}\` (ID: \`${c.id}\`)`).join('\n');
                return `**${conf.chDef.name}** matches multiple existing channels:\n${candList}\n*Action paused to prevent duplicate channels.*`;
              }).join('\n\n'),
            inline: false
          }] : []),
          {
            name: '🚀 Ready to apply?',
            value:
              `Run **\`/setup preview:False\`** to safely apply this hierarchy and structure to your server.\n` +
              `All changes are non-destructive and 100% safe to run multiple times!`,
            inline: false
          }
        )
        .setFooter({ text: `${config.communityName} • Role Hierarchy & Server Setup Preview` })
        .setTimestamp();

      return await safeRespond(interaction, { embeds: [previewEmbed] });
    }

    // ==============================================================
    // EXECUTION MODE: Safely create missing resources & synchronize existing
    // ==============================================================
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles) ||
        !botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return await safeRespond(interaction, {
        content: '❌ **Permission Error:** The bot requires `Manage Channels` and `Manage Roles` permissions to perform server setup.'
      });
    }

    logger.info(`Starting server setup execution for guild "${guild.name}" (${guild.id})`);

    const createdRolesLog = [];
    const updatedRolesLog = [];
    const skippedRolesLog = [];
    const failedRolesLog = [];

    const createdCategoriesLog = [];
    const updatedCategoriesLog = [];

    const createdChannelsLog = [];
    const updatedChannelsLog = [];
    const failedChannelsLog = [];
    const postedStartersLog = [];

    const permissionNotices = [];

    // Helper to calculate permissions the bot can safely assign without throwing 50013
    const isBotAdmin = botMember.permissions.has(PermissionFlagsBits.Administrator);
    const safeRolePerms = (desiredPerms) => {
      if (isBotAdmin) return desiredPerms;
      return desiredPerms.filter(p => botMember.permissions.has(p));
    };

    // Step 1: Synchronize existing roles & create missing roles
    const roleMap = new Map();

    // 1A. Synchronize existing roles that need updates
    for (const { def: roleDef, role: existingRole } of rolesToUpdate) {
      roleMap.set(roleDef.name.toLowerCase(), existingRole);

      // Check if bot has hierarchy to edit this role
      if (!existingRole.editable || existingRole.position >= botMember.roles.highest.position) {
        skippedRolesLog.push(`\`@${existingRole.name}\` (Above bot's highest role)`);
        continue;
      }

      try {
        const updateData = {};
        if (existingRole.name !== roleDef.name && !roleDef.isBoosterRole) {
          updateData.name = roleDef.name;
        }
        if (existingRole.color !== roleDef.color) {
          updateData.color = roleDef.color;
        }
        if (existingRole.hoist !== (roleDef.hoist ?? false)) {
          updateData.hoist = roleDef.hoist ?? false;
        }
        if (existingRole.mentionable !== (roleDef.mentionable ?? false)) {
          updateData.mentionable = roleDef.mentionable ?? false;
        }

        const safePerms = safeRolePerms(roleDef.permissions ?? []);
        updateData.permissions = safePerms;

        await existingRole.edit(updateData);
        updatedRolesLog.push(`\`@${roleDef.name}\``);
        logger.info(`Synchronized existing role: @${roleDef.name}`);
      } catch (err) {
        failedRolesLog.push({ name: roleDef.name, error: err.message });
        logger.error(`Failed to synchronize role ${roleDef.name}: ${err.message}`);
      }
    }

    // Populate roleMap with already synced existing roles
    for (const { def: roleDef, role: existingRole } of rolesExisting) {
      roleMap.set(roleDef.name.toLowerCase(), existingRole);
    }

    // 1B. Create missing roles (created in reverse hierarchy order from bottom to top)
    const reversedRolesToCreate = [...rolesToCreate].reverse();

    for (const roleDef of reversedRolesToCreate) {
      // If it's a Server Booster role and guild is boosted, let Discord handle it
      if (roleDef.isBoosterRole) {
        const boosterRole = existingRoles.find(
          r => r.tags?.premiumSubscriberRole || (r.managed && r.name.toLowerCase().includes('booster'))
        );
        if (boosterRole) {
          roleMap.set(roleDef.name.toLowerCase(), boosterRole);
          continue;
        }
      }

      // Check if role is Owner and bot lacks Administrator
      if (roleDef.name.includes('Owner') && !isBotAdmin) {
        // Look for existing owner role
        const ownerMatch = existingRoles.find(r => normalizeString(r.name) === 'owner');
        if (ownerMatch) {
          roleMap.set(roleDef.name.toLowerCase(), ownerMatch);
          skippedRolesLog.push(`\`@${ownerMatch.name}\` (Owner role managed by server owner)`);
          continue;
        }
      }

      try {
        const safePerms = safeRolePerms(roleDef.permissions ?? []);

        if (safePerms.length < (roleDef.permissions ?? []).length) {
          permissionNotices.push(`Bot lacks advanced permissions to grant to \`@${roleDef.name}\`. Role created with available safe permissions.`);
        }

        const createdRole = await guild.roles.create({
          name: roleDef.name,
          color: roleDef.color,
          hoist: roleDef.hoist ?? false,
          mentionable: roleDef.mentionable ?? false,
          permissions: safePerms,
          reason: `OlflazMC Bot role hierarchy setup`
        });
        roleMap.set(roleDef.name.toLowerCase(), createdRole);
        createdRolesLog.push(`\`@${createdRole.name}\``);
        logger.info(`Created role: @${createdRole.name}`);
      } catch (err) {
        failedRolesLog.push({ name: roleDef.name, error: err.message });
        logger.error(`Failed to create role ${roleDef.name}: ${err.message}`);
      }
    }

    // Identify staff roles for channel permission overwrites
    const getStaffRole = (name) => {
      const norm = normalizeString(name);
      return existingRoles.find(r => normalizeString(r.name) === norm) ||
             roleMap.get(name.toLowerCase());
    };

    const ownerRole = getStaffRole('👑 Owner') || getStaffRole('owner');
    const adminRole = getStaffRole('🛡️ Admin') || getStaffRole('admin');
    const modRole = getStaffRole('🔨 Moderator') || getStaffRole('moderator');
    const helperRole = getStaffRole('🤝 Helper') || getStaffRole('helper');

    // Step 2 & 3: Manage categories and channels using canonical matching & persistence
    const executionClaimedCategories = new Set();
    const executionClaimedChannels = new Set();

    for (const catDef of config.structure) {
      const catMatch = findCanonicalCategoryMatch({
        catDef,
        existingChannels,
        claimedCatIds: executionClaimedCategories,
        canonicalMap: canonicalChannelMap
      });

      if (catMatch && catMatch.isAmbiguous) {
        logger.warn(`[Setup Execution] Skipping category "${catDef.name}" due to ambiguous matches in server (${catMatch.candidates?.length} candidates).`);
        continue;
      }

      let category = catMatch ? catMatch.category : null;

      if (category && category.name !== catDef.name) {
        try {
          await category.setName(catDef.name);
          updatedCategoriesLog.push(`\`${catDef.name}\``);
          logger.info(`Renamed category to: ${catDef.name}`);
        } catch (err) {
          logger.warn(`Could not rename category ${category.name}: ${err.message}`);
        }
      }

      // Create category if missing
      if (!category) {
        try {
          const permissionOverwrites = [];

          if (catDef.isStaffOnly) {
            permissionOverwrites.push({
              id: guild.roles.everyone.id,
              deny: [PermissionFlagsBits.ViewChannel]
            });

            // Grant bot full access in Staff Zone
            permissionOverwrites.push({
              id: botMember.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.ManageMessages
              ]
            });

            // Grant staff access to Staff Zone
            const staffList = [ownerRole, adminRole, modRole, helperRole].filter(Boolean);
            for (const sRole of staffList) {
              permissionOverwrites.push({
                id: sRole.id,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.AttachFiles,
                  PermissionFlagsBits.EmbedLinks
                ]
              });
            }
          }

          category = await guild.channels.create({
            name: catDef.name,
            type: ChannelType.GuildCategory,
            permissionOverwrites,
            reason: `OlflazMC Bot category setup`
          });
          if (category && category.id) {
            executionClaimedCategories.add(category.id);
            createdCategoriesLog.push(`\`${category.name}\``);
            logger.info(`Created category: ${category.name}`);
          }
        } catch (err) {
          logger.error(`Failed to create category ${catDef.name}: ${err.message}`);
          continue;
        }
      }

      // Update canonical map for category
      if (category && category.id) {
        canonicalChannelMap['cat_' + catDef.name] = category.id;
        executionClaimedCategories.add(category.id);
      }

      // Process channels in this category
      for (const chDef of catDef.channels) {
        const chMatch = findCanonicalChannelMatch({
          chDef,
          targetCategory: category,
          existingChannels,
          claimedIds: executionClaimedChannels,
          canonicalMap: canonicalChannelMap,
          intendedCatNorms
        });

        if (chMatch && chMatch.isAmbiguous) {
          logger.warn(`[Setup Execution] Skipping channel "${chDef.name}" due to ambiguous matches in server.`);
          continue;
        }

        let channel = chMatch ? chMatch.channel : null;

        // If channel exists, synchronize it
        if (channel) {
          try {
            const updateOptions = {};
            let changed = false;

            if (channel.name !== chDef.name) {
              updateOptions.name = chDef.name;
              changed = true;
            }
            if (category && category.id && channel.parentId !== category.id) {
              updateOptions.parent = category.id;
              changed = true;
            }
            if (chDef.topic && channel.topic !== chDef.topic) {
              updateOptions.topic = chDef.topic;
              changed = true;
            }

            if (changed) {
              await channel.edit(updateOptions);
              updatedChannelsLog.push(`\`#${chDef.name}\``);
              logger.info(`Synchronized channel: #${chDef.name}`);
            }

            // Audit and align permissions for existing channels (least-privilege policy)
            if (chDef.readOnly && typeof channel.isTextBased === 'function' && channel.isTextBased()) {
              const everyonePerms = channel.permissionsFor(guild.roles.everyone);
              if (everyonePerms && everyonePerms.has(PermissionFlagsBits.SendMessages)) {
                await channel.permissionOverwrites.edit(guild.roles.everyone.id, {
                  SendMessages: false,
                  AddReactions: false
                }).catch(() => {});
              }
            }

            if (catDef.isStaffOnly) {
              const everyonePerms = channel.permissionsFor(guild.roles.everyone);
              if (!everyonePerms || everyonePerms.has(PermissionFlagsBits.ViewChannel)) {
                await channel.permissionOverwrites.edit(guild.roles.everyone.id, {
                  ViewChannel: false
                }).catch(() => {});
              }

              const currentBotPerms = channel.permissionsFor(botMember);
              if (!currentBotPerms || !currentBotPerms.has(PermissionFlagsBits.ViewChannel)) {
                await channel.permissionOverwrites.edit(botMember.id, {
                  ViewChannel: true,
                  SendMessages: true,
                  ReadMessageHistory: true,
                  AttachFiles: true,
                  EmbedLinks: true,
                  ManageChannels: true,
                  ManageMessages: true
                }).catch(err => logger.warn(`Could not update bot permissions in ${channel.name}: ${err.message}`));
              }
            }
          } catch (err) {
            logger.warn(`Could not edit channel ${channel.name}: ${err.message}`);
          }
        } else {
          // Channel does not exist, create it
          try {
            const chOverwrites = [];

            if (catDef.isStaffOnly) {
              chOverwrites.push({
                id: botMember.id,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.EmbedLinks,
                  PermissionFlagsBits.AttachFiles,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.ManageChannels,
                  PermissionFlagsBits.ManageMessages
                ]
              });
            }

            if (chDef.readOnly) {
              chOverwrites.push({
                id: guild.roles.everyone.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions]
              });

              // Allow staff to write in announcement/rules/roles channels
              const staffWriteList = [ownerRole, adminRole, modRole].filter(Boolean);
              for (const sRole of staffWriteList) {
                chOverwrites.push({
                  id: sRole.id,
                  allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.EmbedLinks,
                    PermissionFlagsBits.AttachFiles
                  ]
                });
              }
            }

            const channelOptions = {
              name: chDef.name,
              type: chDef.type,
              parent: category ? category.id : undefined,
              permissionOverwrites: chOverwrites,
              reason: `OlflazMC Bot channel setup`
            };

            if (chDef.topic) channelOptions.topic = chDef.topic;
            if (chDef.userLimit) channelOptions.userLimit = chDef.userLimit;

            channel = await guild.channels.create(channelOptions);
            executionClaimedChannels.add(channel.id);

            createdChannelsLog.push(
              chDef.type === ChannelType.GuildVoice ? `🔊 \`${channel.name}\`` : `💬 <#${channel.id}>`
            );
            logger.info(`Created channel: #${channel.name}`);
          } catch (err) {
            failedChannelsLog.push({ name: chDef.name, error: err.message });
            logger.error(`Failed to create channel ${chDef.name}: ${err.message}`);
            continue;
          }
        }

        // Store canonical mapping
        if (channel) {
          canonicalChannelMap[chDef.name] = channel.id;
          if (chDef.starterKey) {
            canonicalChannelMap[chDef.starterKey] = channel.id;
          }
        }

        // Step 4: Post starter message if channel is text-based and has a starterKey
        if (chDef.starterKey && channel && channel.isTextBased()) {
          try {
            const recentMessages = await channel.messages.fetch({ limit: 15 }).catch(() => null);
            const hasBotEmbed = recentMessages && recentMessages.some(
              m => m.author.id === botMember.id && (m.embeds.length > 0 || m.components.length > 0)
            );

            if (!hasBotEmbed) {
              const payload = getStarterMessagePayload(chDef.starterKey, guild);
              if (payload) {
                await channel.send(payload);
                postedStartersLog.push(`\`#${channel.name}\``);
                logger.info(`Posted starter message to #${channel.name}`);
              }
            }
          } catch (err) {
            logger.warn(`Could not post starter embed in #${channel.name}: ${err.message}`);
          }
        }
      }
    }

    // Persist canonical channel IDs to SQLite for 100% idempotent future runs
    db.setCanonicalChannelMap(guild.id, canonicalChannelMap);

    // Step 5: Send Detailed Completion Embed
    const completionEmbed = new EmbedBuilder()
      .setTitle(`🎉 ${config.communityName} Setup Successfully Completed!`)
      .setColor(theme.colors.success)
      .setDescription(
        `Your complete role hierarchy, channels, and community structure have been synchronized!\n` +
        `**Zero Data Loss:** All pre-existing channels, roles, and message history were preserved.`
      )
      .addFields(
        {
          name: `👑 Roles Configured`,
          value:
            (createdRolesLog.length > 0 ? `**Created (${createdRolesLog.length}):** ${createdRolesLog.join(', ')}\n` : '') +
            (updatedRolesLog.length > 0 ? `**Synchronized (${updatedRolesLog.length}):** ${updatedRolesLog.join(', ')}\n` : '') +
            (skippedRolesLog.length > 0 ? `**Preserved (${skippedRolesLog.length}):** ${skippedRolesLog.join(', ')}\n` : '') +
            (failedRolesLog.length > 0 ? `**Failed (${failedRolesLog.length}):** ${failedRolesLog.map(f => `${f.name} (${f.error})`).join(', ')}\n` : '') +
            (createdRolesLog.length === 0 && updatedRolesLog.length === 0 ? '✨ All roles were already up to date' : ''),
          inline: false
        },
        {
          name: `📁 Categories & Channels`,
          value:
            (createdCategoriesLog.length > 0 ? `**Categories Created:** ${createdCategoriesLog.join(', ')}\n` : '') +
            (updatedCategoriesLog.length > 0 ? `**Categories Rebranded:** ${updatedCategoriesLog.join(', ')}\n` : '') +
            (createdChannelsLog.length > 0 ? `**Channels Created (${createdChannelsLog.length}):** ${createdChannelsLog.slice(0, 8).join(', ')}${createdChannelsLog.length > 8 ? '...' : ''}\n` : '') +
            (updatedChannelsLog.length > 0 ? `**Channels Synchronized/Moved (${updatedChannelsLog.length}):** ${updatedChannelsLog.slice(0, 8).join(', ')}${updatedChannelsLog.length > 8 ? '...' : ''}\n` : '') +
            (failedChannelsLog.length > 0 ? `**Failed Channels (${failedChannelsLog.length}):** ${failedChannelsLog.map(f => `${f.name} (${f.error})`).join(', ')}\n` : '') +
            (createdChannelsLog.length === 0 && updatedChannelsLog.length === 0 ? '✨ All channels were already synchronized' : ''),
          inline: false
        },
        {
          name: `📨 Community Starter Embeds`,
          value:
            postedStartersLog.length > 0
              ? `Deployed rich starter embeds to: ${postedStartersLog.join(', ')}`
              : '✨ Starter messages were already present in channels',
          inline: false
        }
      )
      .setFooter({ text: theme.footers.standard })
      .setTimestamp();

    if (permissionNotices.length > 0) {
      completionEmbed.addFields({
        name: '⚠️ Permission Notice',
        value:
          permissionNotices.slice(0, 3).join('\n') +
          '\n*Tip: To allow the bot to manage all advanced permissions automatically, grant the bot Administrator in Server Settings.*',
        inline: false
      });
    }

    return await safeRespond(interaction, { embeds: [completionEmbed] });
  },

  normalizeString,
  findCanonicalCategoryMatch,
  findCanonicalChannelMatch,
  detectDuplicateChannels
};
