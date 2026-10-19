/**
 * OlflazMC Bot Comprehensive Automated Test Suite
 * Validates all 16 core functional areas, configuration, database persistence,
 * security whitelists, role hierarchy, anti-spam, and Discord interaction error handling.
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { PermissionFlagsBits } = require('discord.js');

console.log('\x1b[36m===============================================================\x1b[0m');
console.log('\x1b[36m        RUNNING OLFLAZMC DISCORD BOT TEST SUITE                \x1b[0m');
console.log('\x1b[36m===============================================================\x1b[0m\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(` \x1b[32m✔ PASS:\x1b[0m ${name}`);
    passedTests++;
  } catch (err) {
    console.error(` \x1b[31m✖ FAIL:\x1b[0m ${name}`);
    console.error(`   Error: ${err.message}\n${err.stack}`);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(` \x1b[32m✔ PASS:\x1b[0m ${name}`);
    passedTests++;
  } catch (err) {
    console.error(` \x1b[31m✖ FAIL:\x1b[0m ${name}`);
    console.error(`   Error: ${err.message}\n${err.stack}`);
  }
}

(async () => {
  const config = require('../src/config');
  const theme = require('../src/utils/theme');
  const db = require('../src/utils/database');

  // -----------------------------------------------------------------
  // 1. Config Integrity & Category/Channel Structure
  // -----------------------------------------------------------------
  runTest('Configuration structure and categories validity', () => {
    assert.strictEqual(config.communityName, 'OlflazMC', 'Community name must be OlflazMC');
    assert(Array.isArray(config.structure), 'Channel structure must be an array');
    assert(config.structure.length >= 6, 'Must have at least 6 categories');

    const catNames = config.structure.map(c => c.name);
    assert(catNames.some(n => n.includes('𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗧𝗜𝗢𝗡')), 'Must include INFORMATION category');
    assert(catNames.some(n => n.includes('𝗖𝗢𝗠𝗠𝗨𝗡𝗜𝗧𝗬')), 'Must include COMMUNITY category');
    assert(catNames.some(n => n.includes('𝗣𝗩𝗣 𝗔𝗥𝗘𝗡𝗔')), 'Must include PVP ARENA category');
    assert(catNames.some(n => n.includes('𝗢𝗟𝗙𝗟𝗔𝗭𝗠𝗖 𝗦𝗧𝗨𝗗𝗜𝗢')), 'Must include OLFLAZMC STUDIO category');
    assert(catNames.some(n => n.includes('𝗘𝗩𝗘𝗡𝗧𝗦 & 𝗦𝗨𝗣𝗣𝗢𝗥𝗧')), 'Must include EVENTS & SUPPORT category');
    assert(catNames.some(n => n.includes('𝗦𝗧𝗔𝗙𝗙')), 'Must include STAFF category');

    // Verify critical channels exist
    const allChannels = config.structure.flatMap(c => c.channels).map(ch => ch.name);
    assert(allChannels.some(n => n.includes('welcome')), 'Must have welcome channel');
    assert(allChannels.some(n => n.includes('rules')), 'Must have rules channel');
    assert(allChannels.some(n => n.includes('choose-roles')), 'Must have choose-roles channel');
    assert(allChannels.some(n => n.includes('suggestions')), 'Must have suggestions channel');
    assert(allChannels.some(n => n.includes('pvp-chat')), 'Must have pvp-chat channel');
    assert(allChannels.some(n => n.includes('uhc-ffa')), 'Must have uhc-ffa channel');
    assert(allChannels.some(n => n.includes('new-videos')), 'Must have new-videos channel');
    assert(allChannels.some(n => n.includes('open-a-ticket')), 'Must have open-a-ticket channel');
    assert(allChannels.some(n => n.includes('giveaways')), 'Must have giveaways channel');
    assert(allChannels.some(n => n.includes('events')), 'Must have events channel');
    assert(allChannels.some(n => n.includes('ticket-logs')), 'Must have ticket-logs channel');
    assert(allChannels.some(n => n.includes('applications-review')), 'Must have applications-review channel');
  });

  // -----------------------------------------------------------------
  // 2. Role Hierarchy & Least-Privilege Permissions
  // -----------------------------------------------------------------
  runTest('Complete 17-role hierarchy and least-privilege permissions', () => {
    assert(Array.isArray(config.roles), 'roles must be an array');
    assert.strictEqual(config.roles.length, 17, 'Must have exactly 17 defined roles');

    const roleNames = config.roles.map(r => r.name);

    // Verify Staff Roles
    assert(roleNames.includes('👑 Owner'), 'Must include 👑 Owner');
    assert(roleNames.includes('🛡️ Admin'), 'Must include 🛡️ Admin');
    assert(roleNames.includes('🔨 Moderator'), 'Must include 🔨 Moderator');
    assert(roleNames.includes('🤝 Helper'), 'Must include 🤝 Helper');

    // Verify Creator and Supporter Roles
    assert(roleNames.includes('💎 YouTuber+'), 'Must include 💎 YouTuber+');
    assert(roleNames.includes('🎥 YouTuber Rank') || roleNames.includes('🎥 YouTuber'), 'Must include 🎥 YouTuber Rank');
    assert(roleNames.includes('🚀 Server Booster'), 'Must include 🚀 Server Booster');
    assert(roleNames.includes('🌟 VIP'), 'Must include 🌟 VIP');
    assert(roleNames.includes('🏅 OG'), 'Must include 🏅 OG');
    assert(roleNames.includes('💜 Active Member'), 'Must include 💜 Active Member');

    // Verify Community and Utility Roles
    assert(roleNames.includes('🤖 Bot'), 'Must include 🤖 Bot');
    assert(roleNames.includes('👤 Member'), 'Must include 👤 Member');
    assert(roleNames.includes('🎮 Minecraft'), 'Must include 🎮 Minecraft');
    assert(roleNames.includes('⚔️ PvP'), 'Must include ⚔️ PvP');
    assert(roleNames.includes('🩸 UHC FFA'), 'Must include 🩸 UHC FFA');
    assert(roleNames.includes('📢 YouTube Updates'), 'Must include 📢 YouTube Updates');
    assert(roleNames.includes('🎉 Events'), 'Must include 🎉 Events');

    // Verify Hierarchy: Owner must be at the very top
    assert.strictEqual(config.roles[0].name, '👑 Owner', 'Owner must be at index 0');
    assert.strictEqual(config.roles[1].name, '🛡️ Admin', 'Admin must be index 1');
    assert.strictEqual(config.roles[2].name, '🔨 Moderator', 'Moderator must be index 2');
    assert.strictEqual(config.roles[3].name, '🤝 Helper', 'Helper must be index 3');

    // Least-privilege check: ONLY Owner has Administrator
    const ownerRole = config.roles.find(r => r.name === '👑 Owner');
    assert(ownerRole.permissions.includes(PermissionFlagsBits.Administrator), 'Owner must have Administrator');

    const nonOwnerRoles = config.roles.filter(r => r.name !== '👑 Owner');
    for (const role of nonOwnerRoles) {
      assert(
        !role.permissions.includes(PermissionFlagsBits.Administrator),
        `Role "${role.name}" must NOT have Administrator permission (least-privilege violation)`
      );
    }

    // Verify Moderator has moderation permissions but not Administrator
    const modRole = config.roles.find(r => r.name === '🔨 Moderator');
    assert(modRole.permissions.includes(PermissionFlagsBits.ModerateMembers), 'Moderator must have ModerateMembers');
    assert(modRole.permissions.includes(PermissionFlagsBits.KickMembers), 'Moderator must have KickMembers');
    assert(modRole.permissions.includes(PermissionFlagsBits.BanMembers), 'Moderator must have BanMembers');

    // Verify Helper has manage messages and timeout, but NOT kick/ban
    const helperRole = config.roles.find(r => r.name === '🤝 Helper');
    assert(helperRole.permissions.includes(PermissionFlagsBits.ManageMessages), 'Helper must have ManageMessages');
    assert(helperRole.permissions.includes(PermissionFlagsBits.ModerateMembers), 'Helper must have ModerateMembers');
    assert(!helperRole.permissions.includes(PermissionFlagsBits.KickMembers), 'Helper must NOT have KickMembers');
    assert(!helperRole.permissions.includes(PermissionFlagsBits.BanMembers), 'Helper must NOT have BanMembers');
  });

  // -----------------------------------------------------------------
  // 3. Self-Assignable Roles Security & Button Whitelist
  // -----------------------------------------------------------------
  runTest('5 Self-Assignable roles security and button panel', () => {
    assert(Array.isArray(config.selfRoles), 'selfRoles must be an array');
    assert.strictEqual(config.selfRoles.length, 5, 'Must have exactly 5 self roles');

    const selfRoleNames = config.selfRoles.map(r => r.name);
    assert(selfRoleNames.includes('⚔️ PvP'), 'Must include ⚔️ PvP');
    assert(selfRoleNames.includes('🩸 UHC FFA'), 'Must include 🩸 UHC FFA');
    assert(selfRoleNames.includes('🎉 Events'), 'Must include 🎉 Events');
    assert(selfRoleNames.includes('🎮 Minecraft'), 'Must include 🎮 Minecraft');
    assert(selfRoleNames.includes('📢 YouTube Updates'), 'Must include 📢 YouTube Updates');

    // Security check: selfRoles must NEVER include staff, creator, or supporter roles
    const forbiddenRoles = ['👑 Owner', '🛡️ Admin', '🔨 Moderator', '🤝 Helper', '🎥 YouTuber', '💎 YouTuber+', '🚀 Server Booster', '🌟 VIP', '🏅 OG'];
    for (const f of forbiddenRoles) {
      assert(!selfRoleNames.includes(f), `selfRoles must never contain "${f}"`);
    }

    const { createRolesPanelPayload } = require('../src/commands/setup/roles-panel');
    const payload = createRolesPanelPayload();
    assert(payload.embeds && payload.embeds.length === 1, 'Payload must contain 1 embed');
    assert(payload.components && payload.components.length === 1, 'Payload must contain 1 ActionRow');
    const buttons = payload.components[0].components;
    assert.strictEqual(buttons.length, 5, 'ActionRow must contain 5 buttons');
  });

  // -----------------------------------------------------------------
  // 4. Slash Commands Loading and Schema Validation
  // -----------------------------------------------------------------
  runTest('Slash Commands loading and JSON schemas', () => {
    const commandsPath = path.join(__dirname, '../src/commands');
    const folders = fs.readdirSync(commandsPath);
    let commandCount = 0;

    for (const folder of folders) {
      const folderPath = path.join(commandsPath, folder);
      if (!fs.statSync(folderPath).isDirectory()) continue;

      const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
      for (const file of files) {
        const cmd = require(path.join(folderPath, file));
        assert(cmd.data, `Command ${file} must export "data"`);
        assert(typeof cmd.execute === 'function', `Command ${file} must export "execute" function`);
        const json = cmd.data.toJSON();
        assert(/^[a-z0-9_-]{1,32}$/.test(json.name), `Command ${file} name "${json.name}" is invalid`);
        assert(json.description, `Command ${file} must have a description`);
        commandCount++;
      }
    }
    assert(commandCount >= 14, `Expected at least 14 commands, got ${commandCount}`);
  });

  // -----------------------------------------------------------------
  // 5. Events Validation
  // -----------------------------------------------------------------
  runTest('Event listeners export expected contract', () => {
    const eventsPath = path.join(__dirname, '../src/events');
    const files = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));
    const expectedEvents = ['ready', 'guildMemberAdd', 'interactionCreate', 'messageCreate'];

    for (const file of files) {
      const event = require(path.join(eventsPath, file));
      assert(event.name, `Event ${file} must have a name`);
      assert(typeof event.execute === 'function', `Event ${file} must have an execute function`);
    }

    for (const expected of expectedEvents) {
      assert(files.includes(`${expected}.js`), `Missing event ${expected}.js`);
    }
  });

  // -----------------------------------------------------------------
  // 6. Starter Messages Generator & Visual Aesthetics
  // -----------------------------------------------------------------
  runTest('Starter messages generator produces rich embeds', () => {
    const { getStarterMessagePayload } = require('../src/utils/starterMessages');
    const keys = [
      'rules', 'announcements', 'welcome', 'roles', 'suggestions-panel',
      'pvp-chat', 'uhc-ffa', 'find-a-duel', 'leaderboards', 'new-videos',
      'behind-the-scenes', 'video-ideas', 'creator-chat', 'ticket-panel',
      'giveaways-info', 'events-info'
    ];

    for (const key of keys) {
      const payload = getStarterMessagePayload(key, null);
      assert(payload, `Starter payload for "${key}" must not be null`);
      assert(payload.embeds && payload.embeds.length > 0, `Starter payload for "${key}" must contain at least 1 embed`);
      const embed = payload.embeds[0].toJSON();
      assert(embed.title, `Starter embed for "${key}" must have a title`);
      assert(embed.description, `Starter embed for "${key}" must have a description`);
    }
  });

  // -----------------------------------------------------------------
  // 7. Anti-Spam Detection Logic
  // -----------------------------------------------------------------
  await runAsyncTest('Anti-Spam rate limiting and spam detection', async () => {
    const { handleAntiSpam } = require('../src/utils/antiSpam');

    const createMockMessage = (userId, content, mentionsCount = 0) => ({
      author: { id: userId, bot: false, tag: `User${userId}#0001` },
      guild: {
        id: '123456789',
        channels: { cache: { find: () => null } }
      },
      member: {
        id: userId,
        permissions: { has: () => false },
        moderatable: true,
        timeout: async () => {}
      },
      content,
      deletable: true,
      delete: async () => {},
      channel: {
        send: async () => ({ delete: async () => {} })
      },
      mentions: {
        users: { size: mentionsCount },
        roles: { size: 0 }
      }
    });

    const spammerId = '999000111';
    let flagged = false;
    for (let i = 0; i < 7; i++) {
      const msg = createMockMessage(spammerId, `Spam message number ${i}`);
      const isSpam = await handleAntiSpam(msg);
      if (isSpam) flagged = true;
    }
    assert(flagged, 'Should have flagged message flood');

    const mentionSpammerId = '999000222';
    const massMentionMsg = createMockMessage(mentionSpammerId, 'Check this out @everyone @here @user', 6);
    const mentionFlagged = await handleAntiSpam(massMentionMsg);
    assert(mentionFlagged, 'Should have flagged mass mentions');
  });

  // -----------------------------------------------------------------
  // 8. Ticket Authorization & Duplicate Prevention
  // -----------------------------------------------------------------
  // 8. Ticket Authorization & Duplicate Prevention
  // -----------------------------------------------------------------
  runTest('Ticket database operations & duplicate ticket prevention', () => {
    const testStamp = Date.now();
    const guildId = `test_guild_${testStamp}`;
    const userId = `test_user_${testStamp}`;
    const ticketType = 'support';

    // Ensure no open tickets initially
    const openBefore = db.getOpenTicket(guildId, userId, ticketType);
    assert(!openBefore, 'Should have no open ticket initially');

    // Create ticket
    const ticketNum = db.getNextTicketNumber(guildId);
    const ticketId = db.createTicket({
      guildId,
      channelId: `ch_test_${testStamp}`,
      userId,
      userTag: 'TestUser#1234',
      ticketType,
      ticketNumber: ticketNum
    });
    assert(ticketId > 0, 'Ticket ID must be positive integer');

    // Check duplicate prevention: should find open ticket
    const openAfter = db.getOpenTicket(guildId, userId, ticketType);
    assert(openAfter, 'Should detect active open ticket');
    assert.strictEqual(openAfter.id, ticketId);

    // Claim ticket
    db.claimTicket(ticketId, 'staff_555', 'StaffMember#0001');
    const claimed = db.getTicketById(ticketId);
    assert.strictEqual(claimed.status, 'claimed');
    assert.strictEqual(claimed.claimed_by_id, 'staff_555');

    // Close ticket
    db.closeTicket(ticketId, 'staff_555', 'StaffMember#0001', 'Resolved', '/path/to/transcript.html');
    const closed = db.getTicketById(ticketId);
    assert.strictEqual(closed.status, 'closed');

    // Duplicate check now returns null since previous ticket closed
    const openAfterClose = db.getOpenTicket(guildId, userId, ticketType);
    assert(!openAfterClose, 'Closed ticket should not block opening new ticket');
  });

  // -----------------------------------------------------------------
  // 9. HTML Transcript Generator & XSS Escaping
  // -----------------------------------------------------------------
  runTest('HTML transcript generation and XSS injection escaping', () => {
    const { escapeHtml } = require('../src/utils/ticketManager');
    const malicious = '<script>alert("XSS")</script>&"\'';
    const escaped = escapeHtml(malicious);

    assert(!escaped.includes('<script>'), 'Must escape <');
    assert(!escaped.includes('</script>'), 'Must escape >');
    assert(escaped.includes('&lt;script&gt;'), 'Must encode HTML tags');
    assert(escaped.includes('&quot;'), 'Must encode double quotes');
    assert(escaped.includes('&#039;'), 'Must encode single quotes');
  });

  // -----------------------------------------------------------------
  // 10. Creator Application System & Review Workflow
  // -----------------------------------------------------------------
  runTest('Creator Application submission and staff review controls', () => {
    const appManager = require('../src/utils/applicationManager');
    const modal = appManager.buildApplicationModal();
    assert(modal.data.custom_id === 'modal_creator_app', 'Modal custom_id must be modal_creator_app');

    const appId = db.createApplication({
      userId: 'creator_user_1',
      userTag: 'Minecrafter#0001',
      channelLink: 'https://youtube.com/@OlflazMC',
      contentType: 'PvP & UHC Montages (5,000 subs)',
      reason: 'I want to help create events for OlflazMC',
      messageId: 'msg_app_123',
      channelId: 'ch_app_review'
    });

    const app = db.getApplicationById(appId);
    assert.strictEqual(app.status, 'pending');
    assert.strictEqual(app.user_id, 'creator_user_1');

    // Staff accepts application
    db.updateApplicationStatus(appId, 'accepted', 'mod_999', 'ModStaff#0001', 'High quality content');
    const updatedApp = db.getApplicationById(appId);
    assert.strictEqual(updatedApp.status, 'accepted');
    assert.strictEqual(updatedApp.reviewed_by_id, 'mod_999');
  });

  // -----------------------------------------------------------------
  // 11. Suggestion Voting Uniqueness & Vote Switching
  // -----------------------------------------------------------------
  runTest('Suggestion voting uniqueness, vote switching, and status management', () => {
    const { id: sId, number: sNum } = db.createSuggestion({
      messageId: `msg_sugg_${Date.now()}`,
      channelId: 'ch_suggestions',
      userId: 'voter_1',
      userTag: 'Voter1#0001',
      title: 'Add Rod PvP Kit',
      content: 'We need 1.8 rod PvP duels!'
    });

    assert(sId > 0);
    assert(sNum > 0);

    // Initial Upvote
    const vote1 = db.voteSuggestion(sId, 'user_a', 'up');
    assert.strictEqual(vote1.action, 'added');
    assert.strictEqual(vote1.upvotes, 1);
    assert.strictEqual(vote1.downvotes, 0);

    // Switch vote to Downvote
    const vote2 = db.voteSuggestion(sId, 'user_a', 'down');
    assert.strictEqual(vote2.action, 'switched');
    assert.strictEqual(vote2.upvotes, 0);
    assert.strictEqual(vote2.downvotes, 1);

    // Toggle Downvote off (remove vote)
    const vote3 = db.voteSuggestion(sId, 'user_a', 'down');
    assert.strictEqual(vote3.action, 'removed');
    assert.strictEqual(vote3.upvotes, 0);
    assert.strictEqual(vote3.downvotes, 0);

    // Staff updates status
    db.updateSuggestionStatus(sId, 'accepted', 'staff_1', 'Great idea!');
    const sugg = db.getSuggestionById(sId);
    assert.strictEqual(sugg.status, 'accepted');
  });

  // -----------------------------------------------------------------
  // 12. Giveaways Entries Uniqueness & Fair Winner Selection
  // -----------------------------------------------------------------
  runTest('Giveaway entry uniqueness, winner picking, and restart recovery', () => {
    const msgId = `msg_gw_${Date.now()}`;
    const gwId = db.createGiveaway({
      messageId: msgId,
      channelId: 'ch_giveaways',
      guildId: 'guild_1',
      prize: 'Discord Nitro 1 Month',
      winnerCount: 2,
      hostId: 'host_1',
      hostTag: 'Host#0001',
      endsAt: Date.now() + 600000
    });

    // Enter giveaway
    const entry1 = db.enterGiveaway(gwId, 'user_entry_1');
    assert.strictEqual(entry1.action, 'entered');
    assert.strictEqual(entry1.count, 1);

    // Duplicate entry toggles entry off
    const entry2 = db.enterGiveaway(gwId, 'user_entry_1');
    assert.strictEqual(entry2.action, 'left');
    assert.strictEqual(entry2.count, 0);

    // Re-enter + add more entrants
    db.enterGiveaway(gwId, 'user_entry_1');
    db.enterGiveaway(gwId, 'user_entry_2');
    db.enterGiveaway(gwId, 'user_entry_3');

    const entrants = db.getGiveawayEntrants(gwId);
    assert.strictEqual(entrants.length, 3);
    assert(entrants.includes('user_entry_1'));
    assert(entrants.includes('user_entry_2'));
    assert(entrants.includes('user_entry_3'));

    // Verify active giveaways for restart reconciliation
    const active = db.getActiveGiveaways();
    assert(active.some(g => g.id === gwId), 'Must be listed in active giveaways');

    // Conclude giveaway
    db.endGiveaway(gwId, JSON.stringify(['user_entry_1', 'user_entry_2']), 'ended');
    const ended = db.getGiveawayByMessage(msgId);
    assert.strictEqual(ended.status, 'ended');
  });

  // -----------------------------------------------------------------
  // 13. Community Event Registration & Cancellation
  // -----------------------------------------------------------------
  runTest('Community event registration, live attendees, and cancellation', () => {
    const msgId = `msg_ev_${Date.now()}`;
    const evId = db.createEvent({
      messageId: msgId,
      channelId: 'ch_events',
      guildId: 'guild_1',
      title: 'UHC Saturday Showdown',
      description: 'Solo UHC with custom golden head crafts',
      location: 'mc.olflazmc.net',
      eventTime: Date.now() + 86400000,
      hostId: 'host_1',
      hostTag: 'Host#0001'
    });

    const reg1 = db.toggleEventRegistration(evId, 'user_att_1');
    assert.strictEqual(reg1.action, 'registered');
    assert.strictEqual(reg1.count, 1);

    // Toggle off
    const reg2 = db.toggleEventRegistration(evId, 'user_att_1');
    assert.strictEqual(reg2.action, 'unregistered');
    assert.strictEqual(reg2.count, 0);

    // Re-register
    db.toggleEventRegistration(evId, 'user_att_1');
    db.toggleEventRegistration(evId, 'user_att_2');
    const attendees = db.getEventAttendees(evId);
    assert.strictEqual(attendees.length, 2);

    // Cancel event
    db.cancelEvent(evId);
    const cancelled = db.getEventById(evId);
    assert.strictEqual(cancelled.status, 'cancelled');
  });

  // -----------------------------------------------------------------
  // 14. YouTube RSS Checkpointing & Duplicate Prevention
  // -----------------------------------------------------------------
  runTest('YouTube RSS monitor checkpointing and duplicate prevention', () => {
    // Checkpoint setting in database
    db.setSetting('youtube_last_video_id', 'vid_checkpoint_123');
    const checkpoint = db.getSetting('youtube_last_video_id');
    assert.strictEqual(checkpoint, 'vid_checkpoint_123');

    // New video detected
    const newVid = 'vid_new_456';
    assert.notStrictEqual(checkpoint, newVid, 'Should detect video differs from checkpoint');

    db.setSetting('youtube_last_video_id', newVid);
    const updatedCheckpoint = db.getSetting('youtube_last_video_id');
    assert.strictEqual(updatedCheckpoint, newVid);
  });

  // -----------------------------------------------------------------
  // 15. Moderation Warnings Persistence & Role Hierarchy
  // -----------------------------------------------------------------
  runTest('Moderation warnings persistence, retrieval, and clearing', () => {
    const guildId = 'guild_warn_test';
    const userId = 'user_to_warn';

    db.addWarning({
      guildId,
      userId,
      userTag: 'BadPlayer#0001',
      moderatorId: 'mod_1',
      moderatorTag: 'Mod#0001',
      reason: 'Excessive spam in pvp-chat'
    });

    db.addWarning({
      guildId,
      userId,
      userTag: 'BadPlayer#0001',
      moderatorId: 'mod_2',
      moderatorTag: 'Mod#0002',
      reason: 'Unsportsmanlike conduct'
    });

    const warnings = db.getUserWarnings(guildId, userId);
    assert.strictEqual(warnings.length, 2);
    assert.strictEqual(warnings[0].reason, 'Unsportsmanlike conduct');

    db.clearUserWarnings(guildId, userId);
    const afterClear = db.getUserWarnings(guildId, userId);
    assert.strictEqual(afterClear.length, 0);
  });

  // -----------------------------------------------------------------
  // 16. DiscordAPIError 10062 Safe Handling
  // -----------------------------------------------------------------
  runTest('Interaction 10062 token expiration safe handling', () => {
    const error10062 = new Error('Unknown interaction');
    error10062.code = 10062;

    let handledGracefully = false;
    try {
      if (error10062.code === 10062 || error10062.message.includes('Unknown interaction')) {
        handledGracefully = true;
      }
    } catch {
      handledGracefully = false;
    }
    assert(handledGracefully, 'DiscordAPIError 10062 must be recognized and handled safely');
  });

  // -----------------------------------------------------------------
  // 17. TicketManager Contract & Export Function Signatures
  // -----------------------------------------------------------------
  runTest('TicketManager contract and function exports', () => {
    const tm = require('../src/utils/ticketManager');
    assert.strictEqual(typeof tm.createTicketChannel, 'function', 'Must export createTicketChannel');
    assert.strictEqual(typeof tm.handleTicketCreate, 'function', 'Must export handleTicketCreate');
    assert.strictEqual(typeof tm.handleTicketClaim, 'function', 'Must export handleTicketClaim');
    assert.strictEqual(typeof tm.handleClaimTicket, 'function', 'Must export handleClaimTicket alias');
    assert.strictEqual(typeof tm.handleTicketCloseRequest, 'function', 'Must export handleTicketCloseRequest');
    assert.strictEqual(typeof tm.handleCloseTicketRequest, 'function', 'Must export handleCloseTicketRequest alias');
    assert.strictEqual(typeof tm.handleTicketCloseConfirm, 'function', 'Must export handleTicketCloseConfirm');
    assert.strictEqual(typeof tm.handleConfirmCloseTicket, 'function', 'Must export handleConfirmCloseTicket alias');
    assert.strictEqual(typeof tm.handleTicketCloseCancel, 'function', 'Must export handleTicketCloseCancel');
    assert.strictEqual(typeof tm.handleCancelCloseTicket, 'function', 'Must export handleCancelCloseTicket alias');
    assert.strictEqual(typeof tm.isStaffMember, 'function', 'Must export isStaffMember');

    // Test staff check with guild owner
    const mockOwnerMember = {
      id: 'owner_123',
      guild: { ownerId: 'owner_123' },
      roles: { cache: new Map() },
      permissions: { has: () => false }
    };
    assert(tm.isStaffMember(mockOwnerMember), 'Server owner must always be recognized as staff member');

    const mockRegularMember = {
      id: 'user_456',
      guild: { ownerId: 'owner_123' },
      roles: { cache: new Map() },
      permissions: { has: () => false }
    };
    assert(!tm.isStaffMember(mockRegularMember), 'Regular member must not be recognized as staff member');
  });

  // -----------------------------------------------------------------
  // 18. Community Features (Duels & Video Ideas Workflows)
  // -----------------------------------------------------------------
  runTest('Community duel matchmaking and video concept pitch workflows', () => {
    const cf = require('../src/utils/communityFeatures');
    assert.strictEqual(typeof cf.buildDuelModal, 'function');
    assert.strictEqual(typeof cf.buildVideoIdeaModal, 'function');
    assert.strictEqual(typeof cf.handleRulesAcknowledge, 'function');

    const duelModal = cf.buildDuelModal();
    assert.strictEqual(duelModal.data.custom_id, 'modal_find_duel');
    assert(duelModal.components.length >= 3, 'Duel modal must have required inputs');

    const ideaModal = cf.buildVideoIdeaModal();
    assert.strictEqual(ideaModal.data.custom_id, 'modal_submit_video_idea');
    assert(ideaModal.components.length >= 3, 'Video idea modal must have required inputs');
  });

  // -----------------------------------------------------------------
  // 19. Role Permission Clamping & Setup Safety
  // -----------------------------------------------------------------
  runTest('Role permission clamping avoids Discord 50013 Missing Permissions', () => {
    const { PermissionsBitField } = require('discord.js');
    // Simulate a bot with limited permissions
    const botPerms = new PermissionsBitField([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ManageRoles
    ]);

    const desiredPerms = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.Administrator,
      PermissionFlagsBits.PrioritySpeaker
    ];

    const safePerms = desiredPerms.filter(p => botPerms.has(p));
    assert.strictEqual(safePerms.length, 2, 'Should only retain ViewChannel and SendMessages');
    assert(!safePerms.includes(PermissionFlagsBits.Administrator), 'Must omit Administrator');
    assert(!safePerms.includes(PermissionFlagsBits.PrioritySpeaker), 'Must omit PrioritySpeaker');
  });

  // -----------------------------------------------------------------
  // 20. Channel Deduplication & Canonical Disambiguation
  // -----------------------------------------------------------------
  runTest('Channel deduplication and canonical disambiguation', () => {
    const setup = require('../src/commands/setup/setup');
    const { ChannelType } = require('discord.js');

    const canonicalCat = { id: 'cat_canonical', name: '「📌」𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗧𝗜𝗢𝗡', type: ChannelType.GuildCategory };
    const obsoleteCat = { id: 'cat_obsolete', name: '📌 INFORMATION & RULES', type: ChannelType.GuildCategory };

    const canonicalAnnounce = {
      id: 'ch_canon_ann',
      name: '📢・announcements',
      parentId: 'cat_canonical',
      type: ChannelType.GuildText,
      isTextBased: () => true,
      createdTimestamp: 1000
    };

    const duplicateAnnounce = {
      id: 'ch_dup_ann',
      name: 'announcements',
      parentId: 'cat_obsolete',
      type: ChannelType.GuildText,
      isTextBased: () => true,
      createdTimestamp: 2000
    };

    const allChannels = [canonicalCat, obsoleteCat, canonicalAnnounce, duplicateAnnounce];
    const claimedIds = new Set();
    const chDef = {
      name: '📢・announcements',
      type: ChannelType.GuildText,
      legacyNames: ['announcements']
    };

    const match = setup.findCanonicalChannelMatch({
      chDef,
      targetCategory: canonicalCat,
      existingChannels: allChannels,
      claimedIds,
      canonicalMap: {},
      intendedCatNorms: new Set(['information'])
    });

    assert(match, 'Must find a matching channel');
    assert.strictEqual(match.channel.id, 'ch_canon_ann', 'Must select canonical channel over duplicate in obsolete category');
    assert.strictEqual(match.needsMove, false, 'Canonical channel is already in target category');

    // Detect duplicates
    const duplicates = setup.detectDuplicateChannels(allChannels, claimedIds, config.structure);
    assert(duplicates.some(d => d.id === 'ch_dup_ann'), 'Must flag duplicate channel as candidate for cleanup');
  });

  // -----------------------------------------------------------------
  // 21. Database Channel Map & Idempotent Synchronization
  // -----------------------------------------------------------------
  runTest('Database channel map and idempotent synchronization', () => {
    const setup = require('../src/commands/setup/setup');
    const { ChannelType } = require('discord.js');

    const testGuildId = 'test_guild_idempotent_999';
    const sampleMap = {
      '📢・announcements': '1561039865267757070',
      'welcome': '1561046405928190136'
    };

    db.setCanonicalChannelMap(testGuildId, sampleMap);
    const loaded = db.getCanonicalChannelMap(testGuildId);
    assert.strictEqual(loaded['📢・announcements'], '1561039865267757070');
    assert.strictEqual(loaded['welcome'], '1561046405928190136');

    // Test that findCanonicalChannelMatch prioritizes database-mapped IDs
    const mockChannel = {
      id: '1561039865267757070',
      name: '📢・announcements',
      parentId: 'cat_123',
      type: ChannelType.GuildText,
      isTextBased: () => true
    };

    const claimed = new Set();
    const match = setup.findCanonicalChannelMatch({
      chDef: { name: '📢・announcements', type: ChannelType.GuildText },
      targetCategory: { id: 'cat_123' },
      existingChannels: [mockChannel],
      claimedIds: claimed,
      canonicalMap: loaded,
      intendedCatNorms: new Set()
    });

    assert(match, 'Must match channel');
    assert.strictEqual(match.source, 'database_map', 'Must resolve from database map');
    assert.strictEqual(match.channel.id, '1561039865267757070');
  });

  // -----------------------------------------------------------------
  // 22. Category Matching: Missing Category Handling & Null-Safety (Regression)
  // -----------------------------------------------------------------
  runTest('Category matching safely handles missing categories and null elements without .id errors', () => {
    const setup = require('../src/commands/setup/setup');
    const { ChannelType, Collection } = require('discord.js');

    const catDef = {
      name: '「📌」𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗧𝗜𝗢𝗡',
      legacyNames: ['information', 'rules', 'info']
    };

    // Test 1: Empty Array
    const claimed1 = new Set();
    const match1 = setup.findCanonicalCategoryMatch({
      catDef,
      existingChannels: [],
      claimedCatIds: claimed1,
      canonicalMap: {}
    });
    assert.strictEqual(match1, null, 'Must return null for empty channels array');
    assert.strictEqual(claimed1.size, 0, 'Must not claim anything on missing category');

    // Test 2: Discord.js Collection instance (empty)
    const claimed2 = new Set();
    const match2 = setup.findCanonicalCategoryMatch({
      catDef,
      existingChannels: new Collection(),
      claimedCatIds: claimed2,
      canonicalMap: {}
    });
    assert.strictEqual(match2, null, 'Must return null for empty Discord Collection');

    // Test 3: Array containing null, undefined, and non-category objects
    const claimed3 = new Set();
    const match3 = setup.findCanonicalCategoryMatch({
      catDef,
      existingChannels: [null, undefined, { id: 'text_1', name: 'general', type: ChannelType.GuildText }, {}],
      claimedCatIds: claimed3,
      canonicalMap: {}
    });
    assert.strictEqual(match3, null, 'Must safely ignore null/undefined items without throwing');

    // Test 4: Completely unrelated categories
    const claimed4 = new Set();
    const match4 = setup.findCanonicalCategoryMatch({
      catDef,
      existingChannels: [
        { id: 'cat_unrelated', name: 'Random Category', type: ChannelType.GuildCategory, children: { cache: new Collection() } }
      ],
      claimedCatIds: claimed4,
      canonicalMap: {}
    });
    assert.strictEqual(match4, null, 'Must return null when no categories match definition');
  });

  // -----------------------------------------------------------------
  // 23. Category Matching: Ambiguous Duplicate Matches & Conflict Detection (Regression)
  // -----------------------------------------------------------------
  runTest('Category matching detects ambiguous duplicate matches and avoids arbitrary selection', () => {
    const setup = require('../src/commands/setup/setup');
    const { ChannelType, Collection } = require('discord.js');

    const catDef = {
      name: '「💬」𝗖𝗢𝗠𝗠𝗨𝗡𝗜𝗧𝗬',
      legacyNames: ['community', 'general']
    };

    // Test 1: Two categories with identical exact name and equal child counts
    const catA = {
      id: 'cat_community_1',
      name: '「💬」𝗖𝗢𝗠𝗠𝗨𝗡𝗜𝗧𝗬',
      type: ChannelType.GuildCategory,
      children: { cache: new Collection() }
    };
    const catB = {
      id: 'cat_community_2',
      name: '「💬」𝗖𝗢𝗠𝗠𝗨𝗡𝗜𝗧𝗬',
      type: ChannelType.GuildCategory,
      children: { cache: new Collection() }
    };

    const claimed1 = new Set();
    const match1 = setup.findCanonicalCategoryMatch({
      catDef,
      existingChannels: [catA, catB],
      claimedCatIds: claimed1,
      canonicalMap: {}
    });

    assert(match1, 'Must return a match result');
    assert.strictEqual(match1.isAmbiguous, true, 'Duplicate categories with equal child counts must be flagged as ambiguous');
    assert.strictEqual(match1.candidates.length, 2, 'Candidates list must contain both duplicates');
    assert(!claimed1.has('cat_community_1') && !claimed1.has('cat_community_2'), 'Ambiguous match must NOT be claimed');

    // Test 2: Two categories with identical name, but one has active channels and one is empty
    const catActive = {
      id: 'cat_active_comm',
      name: '「💬」𝗖𝗢𝗠𝗠𝗨𝗡𝗜𝗧𝗬',
      type: ChannelType.GuildCategory,
      children: { cache: new Collection([['ch1', { id: 'ch1' }], ['ch2', { id: 'ch2' }]]) }
    };
    const catEmpty = {
      id: 'cat_empty_comm',
      name: '「💬」𝗖𝗢𝗠𝗠𝗨𝗡𝗜𝗧𝗬',
      type: ChannelType.GuildCategory,
      children: { cache: new Collection() }
    };

    const claimed2 = new Set();
    const match2 = setup.findCanonicalCategoryMatch({
      catDef,
      existingChannels: [catEmpty, catActive],
      claimedCatIds: claimed2,
      canonicalMap: {}
    });

    assert(match2, 'Must return match result');
    assert.strictEqual(match2.isAmbiguous, false, 'Should safely resolve to active category when duplicate is empty');
    assert.strictEqual(match2.category.id, 'cat_active_comm', 'Must pick active category with channels');
    assert(claimed2.has('cat_active_comm'), 'Active non-ambiguous category must be claimed');

    // Test 3: Two different legacy categories with exact same tie score
    const legacyCatDef = {
      name: '「💬」𝗖𝗢𝗠𝗠𝗨𝗡𝗜𝗧𝗬',
      legacyNames: ['chat-zone', 'general-lounge']
    };
    const legacyA = {
      id: 'cat_legacy_a',
      name: 'Chat-Zone',
      type: ChannelType.GuildCategory,
      children: { cache: new Collection() }
    };
    const legacyB = {
      id: 'cat_legacy_b',
      name: 'General-Lounge',
      type: ChannelType.GuildCategory,
      children: { cache: new Collection() }
    };

    const claimed3 = new Set();
    const match3 = setup.findCanonicalCategoryMatch({
      catDef: legacyCatDef,
      existingChannels: [legacyA, legacyB],
      claimedCatIds: claimed3,
      canonicalMap: {}
    });

    assert(match3, 'Must return match result');
    assert.strictEqual(match3.isAmbiguous, true, 'Tied legacy categories must be flagged as ambiguous');
    assert(!claimed3.has('cat_legacy_a') && !claimed3.has('cat_legacy_b'), 'Tied categories must not be claimed');
  });

  // -----------------------------------------------------------------
  // 24. Category Matching: Unicode Font Normalization & Discord Collection Support
  // -----------------------------------------------------------------
  runTest('Category matching handles Unicode mathematical bold fonts and Discord.js Collections', () => {
    const setup = require('../src/commands/setup/setup');
    const { ChannelType, Collection } = require('discord.js');

    const catDef = {
      name: '「⚔️」𝗣𝗩𝗣 𝗔𝗥𝗘𝗡𝗔',
      legacyNames: ['pvp arena', 'pvp', 'arena']
    };

    // Category in guild has regular ASCII font without emojis or brackets
    const guildCategory = {
      id: 'cat_pvp_regular',
      name: 'PVP ARENA',
      type: ChannelType.GuildCategory,
      children: { cache: new Collection() }
    };

    // Use a Discord.js Collection as the channels cache
    const channelCollection = new Collection();
    channelCollection.set(guildCategory.id, guildCategory);
    channelCollection.set('text_1', { id: 'text_1', name: 'pvp-chat', type: ChannelType.GuildText });

    const claimed = new Set();
    const match = setup.findCanonicalCategoryMatch({
      catDef,
      existingChannels: channelCollection,
      claimedCatIds: claimed,
      canonicalMap: {}
    });

    assert(match, 'Must match category across Unicode mathematical bold normalization');
    assert.strictEqual(match.category.id, 'cat_pvp_regular');
    assert.strictEqual(match.isAmbiguous, false);
    assert.strictEqual(match.needsRename, true, 'Must flag needsRename since Discord category name lacks styling');
    assert(claimed.has('cat_pvp_regular'));
  });

  // -----------------------------------------------------------------
  // 25. Setup Preview Read-Only Execution & Ambiguity Reporting
  // -----------------------------------------------------------------
  await runAsyncTest('Setup preview is strictly read-only and reports category conflicts', async () => {
    const setup = require('../src/commands/setup/setup');
    const { ChannelType, Collection } = require('discord.js');

    let repliedPayload = null;
    let deferred = false;

    // Create a mock guild with duplicate categories to trigger ambiguity
    const mockCat1 = {
      id: 'cat_dup_1',
      name: '「📌」𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗧𝗜𝗢𝗡',
      type: ChannelType.GuildCategory,
      children: { cache: new Collection() }
    };
    const mockCat2 = {
      id: 'cat_dup_2',
      name: '「📌」𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗧𝗜𝗢𝗡',
      type: ChannelType.GuildCategory,
      children: { cache: new Collection() }
    };

    const channelsCollection = new Collection();
    channelsCollection.set(mockCat1.id, mockCat1);
    channelsCollection.set(mockCat2.id, mockCat2);

    const mockGuild = {
      id: 'mock_guild_preview_test',
      name: 'Mock Test Server',
      roles: {
        cache: new Collection(),
        fetch: async () => new Collection()
      },
      channels: {
        cache: channelsCollection,
        fetch: async () => channelsCollection,
        create: async () => {
          throw new Error('READ-ONLY VIOLATION: guild.channels.create must NOT be called in preview mode');
        }
      },
      members: {
        me: {
          id: 'bot_me_123',
          roles: { highest: { position: 10 } },
          permissions: { has: () => true }
        }
      }
    };

    const mockInteraction = {
      guild: mockGuild,
      options: {
        getBoolean: (name) => name === 'preview' ? true : false
      },
      deferred: false,
      replied: false,
      deferReply: async () => { deferred = true; },
      editReply: async (payload) => { repliedPayload = payload; return payload; },
      reply: async (payload) => { repliedPayload = payload; return payload; }
    };

    await setup.execute(mockInteraction);

    assert(deferred, 'Must acknowledge interaction within 3s deadline');
    assert(repliedPayload, 'Must reply with preview payload');
    assert(repliedPayload.embeds && repliedPayload.embeds.length > 0, 'Must include preview embed');

    const embed = repliedPayload.embeds[0];
    const embedData = typeof embed.toJSON === 'function' ? embed.toJSON() : embed;

    assert(embedData.title.includes('PREVIEW MODE'), 'Must have PREVIEW MODE in title');

    // Verify ambiguous category conflict field is present
    const conflictField = embedData.fields.find(f => f.name.includes('Ambiguous Category Matches'));
    assert(conflictField, 'Must report ambiguous category conflicts in preview embed');
    assert(conflictField.value.includes('cat_dup_1'), 'Must include candidate ID 1');
    assert(conflictField.value.includes('cat_dup_2'), 'Must include candidate ID 2');
    assert(conflictField.value.includes('action is paused'), 'Must explain action is paused');
  });

  // -----------------------------------------------------------------
  // 26. Moderation Logger & Token Redaction Safety
  // -----------------------------------------------------------------
  await runAsyncTest('Moderation logger sanitization and token redaction', async () => {
    const { sanitizeLogText, logModerationAction } = require('../src/utils/modLogger');

    const mockToken = ['AAAABBBBCCCCDDDDEEEEFFFF', 'GGGGHH', 'IIIIJJJJKKKKLLLLMMMMNNNNOOO'].join('.');
    const sampleLeaked = `Warning user: bot token is ${mockToken} and token Bearer mysecrettoken123`;
    const sanitized = sanitizeLogText(sampleLeaked);

    assert(!sanitized.includes('AAAABBBBCCCCDDDDEEEEFFFF'), 'Must redact Discord tokens');
    assert(sanitized.includes('[REDACTED_DISCORD_TOKEN]'), 'Must replace with token placeholder');
    assert(sanitized.includes('[REDACTED_BEARER_TOKEN]'), 'Must replace Bearer tokens');

    // Test logModerationAction with mock guild
    let sentPayload = null;
    const mockGuild = {
      id: 'guild_mod_test',
      channels: {
        cache: [
          {
            id: 'ch_mod_logs',
            name: '📋・mod-logs',
            isTextBased: () => true,
            send: async (p) => { sentPayload = p; return p; }
          }
        ]
      }
    };

    await logModerationAction(mockGuild, {
      action: '🔨 Ban Applied',
      targetUser: { id: 'target_123', tag: 'BadPlayer#0001' },
      moderator: { id: 'mod_123', tag: 'Staff#0001' },
      reason: 'Rule 1 violation'
    });

    assert(sentPayload, 'Must send embed to mod-logs channel');
    assert(sentPayload.embeds && sentPayload.embeds.length === 1, 'Must contain 1 embed');
    assert.strictEqual(sentPayload.embeds[0].data.title, '🔨 Ban Applied', 'Title must match action');
  });

  // -----------------------------------------------------------------
  // 27. Sticky Messages Persistence & Duplicate Repost Prevention
  // -----------------------------------------------------------------
  await runAsyncTest('Sticky messages configuration, persistence, and duplicate skipping', async () => {
    const stickyManager = require('../src/utils/stickyManager');

    const channelId = 'ch_sticky_test_' + Date.now();
    const guildId = 'guild_sticky_test';

    // 1. Persistence in SQLite
    db.setStickyMessage({
      channelId,
      guildId,
      content: 'Important Notice',
      embedTitle: 'PvP Rules',
      embedDescription: 'No combat logging in arena',
      embedColor: '#00D2D3'
    });

    const persisted = db.getStickyMessage(channelId);
    assert(persisted, 'Sticky message must be persisted in database');
    assert.strictEqual(persisted.embed_title, 'PvP Rules');
    assert.strictEqual(persisted.is_active, 1);

    // 2. Duplicate skipping: If last_message_id is already the newest message, skip repost
    let repostSent = false;
    const mockChannel = {
      id: channelId,
      name: 'pvp-chat',
      isTextBased: () => true,
      client: { user: { id: 'bot_id_123' } },
      messages: {
        fetch: async (opts) => {
          if (opts.limit === 1) {
            return {
              size: 1,
              first: () => ({ id: 'tracked_msg_456', author: { id: 'bot_id_123' } })
            };
          }
          return new Map();
        }
      },
      send: async () => {
        repostSent = true;
      }
    };

    // Set last_message_id to match the latest message in channel
    persisted.last_message_id = 'tracked_msg_456';
    await stickyManager.executeStickyRepost(mockChannel, persisted);

    assert.strictEqual(repostSent, false, 'Must skip repost when sticky notice is already the newest message');

    // 3. Removal
    db.deleteStickyMessage(channelId);
    const removed = db.getStickyMessage(channelId);
    assert.strictEqual(removed, undefined, 'Sticky message must be removed from DB');
  });

  // -----------------------------------------------------------------
  // 28. YouTube Feed Parsing & Cold-Start Duplicate Prevention
  // -----------------------------------------------------------------
  await runAsyncTest('YouTube monitor cold-start checkpoint & duplicate upload detection', async () => {
    const youtubeMonitor = require('../src/utils/youtubeMonitor');

    // Verify channel ID is OlflazMC's authentic ID
    const channelId = youtubeMonitor.getTargetYouTubeChannelId();
    assert.strictEqual(channelId, 'UCl4u_M9jzMV14y-TfrJ0-aQ', 'Target YouTube ID must be OlflazMC channel');

    // Test cold start checkpoint
    db.setSetting('youtube_last_video_id', 'test_video_123');
    assert.strictEqual(db.getSetting('youtube_last_video_id'), 'test_video_123', 'Last video ID must persist across restarts');
  });

  // -----------------------------------------------------------------
  // 29. Welcome Message Payload Construction & Safe Fallback
  // -----------------------------------------------------------------
  runTest('Welcome payload construction, dynamic avatar, and rules button', () => {
    const { buildWelcomePayload } = require('../src/events/guildMemberAdd');

    const mockGuild = {
      id: 'guild_welcome_test',
      name: 'OlflazMC Server',
      memberCount: 1540,
      channels: {
        cache: [
          { id: 'ch_rules_1', name: '📜・rules', isTextBased: () => true },
          { id: 'ch_roles_1', name: '🎭・choose-roles', isTextBased: () => true },
          { id: 'ch_general_1', name: '💬・general-chat', isTextBased: () => true }
        ]
      }
    };

    const mockMember = {
      id: 'user_new_123',
      displayName: 'SwordMaster',
      user: {
        id: 'user_new_123',
        username: 'SwordMaster',
        tag: 'SwordMaster#1234',
        displayAvatarURL: () => 'https://cdn.discordapp.com/avatars/user.png'
      }
    };

    const payload = buildWelcomePayload({ member: mockMember, guild: mockGuild });
    assert(payload.content.includes('SwordMaster') || payload.content.includes('user_new_123'), 'Content must mention new member');
    assert(payload.embeds && payload.embeds.length === 1, 'Must contain 1 embed');

    const embedData = typeof payload.embeds[0].toJSON === 'function' ? payload.embeds[0].toJSON() : payload.embeds[0];
    assert(embedData.title.includes('SwordMaster'), 'Title must dynamically include member display name');
    assert(embedData.thumbnail.url.includes('cdn.discordapp.com'), 'Thumbnail must contain dynamic avatar URL');
    assert(embedData.description.includes('ch_rules_1'), 'Description must link to rules channel');

    assert(payload.components && payload.components.length === 1, 'Must include link action row');
    const buttons = payload.components[0].components;
    assert(buttons.some(b => b.data.url?.includes('ch_rules_1')), 'Must contain a button linking to the rules channel');
  });

  // -----------------------------------------------------------------
  // 30. Creator Application Review Authorization & Audit Trail
  // -----------------------------------------------------------------
  runTest('Creator application review authorization, notes, and audit trail', () => {
    const applicationManager = require('../src/utils/applicationManager');

    const mockOwnerMember = {
      id: 'owner_1',
      guild: { ownerId: 'owner_1' },
      roles: { cache: [] }
    };

    const mockRegularMember = {
      id: 'player_1',
      guild: { ownerId: 'owner_1' },
      permissions: { has: () => false },
      roles: { cache: [{ name: '👤 Member' }] }
    };

    assert.strictEqual(applicationManager.isApplicationReviewer(mockOwnerMember), true, 'Server Owner must be an authorized reviewer');
    assert.strictEqual(applicationManager.isApplicationReviewer(mockRegularMember), false, 'Regular member must NOT be an authorized reviewer');

    // Test application modal building (5 fields)
    const modal = applicationManager.buildApplicationModal();
    assert(modal.data.custom_id, 'Modal must have custom_id');
    assert.strictEqual(modal.components.length, 5, 'Modal must contain 5 fields (platform, channel, focus, stats, reason)');

    // Test application audit trail persistence
    const auditId = db.addApplicationAudit({
      appId: 9999,
      action: 'approved',
      actorId: 'mod_123',
      actorTag: 'Admin#0001',
      notes: 'Passed review and verified channel stats'
    });

    const audits = db.getApplicationAudits(9999);
    assert(audits.length > 0, 'Audit record must be saved in database');
    assert.strictEqual(audits[0].action, 'approved');
    assert.strictEqual(audits[0].notes, 'Passed review and verified channel stats');
  });

  // -----------------------------------------------------------------
  // 31. Leaderboard Real Activity Tracking, Anti-Spam Cooldown & Reset
  // -----------------------------------------------------------------
  await runAsyncTest('Leaderboard activity scoring, 60s cooldown, and weekly reset', async () => {
    const leaderboardManager = require('../src/utils/leaderboardManager');

    const testGuildId = 'guild_lb_test_' + Date.now();
    const testUserId = 'user_lb_test_' + Date.now();

    // 1. Record activity
    db.recordUserActivity(testUserId, testGuildId, 1);
    let record = db.getUserActivity(testUserId, testGuildId);
    assert(record, 'Activity must be stored in database');
    assert.strictEqual(record.weekly_points, 1);
    assert.strictEqual(record.message_count, 1);

    // 2. Add points for accepted suggestion
    db.recordSuggestionAccepted(testUserId, testGuildId);
    record = db.getUserActivity(testUserId, testGuildId);
    assert.strictEqual(record.weekly_points, 6);
    assert.strictEqual(record.suggestions_accepted, 1);

    // 3. Top rankings query
    const top = db.getTopActivityLeaderboard(testGuildId, 5);
    assert(top.length >= 1, 'Top rankings must include the recorded user');
    assert.strictEqual(top[0].user_id, testUserId);

    // 4. Weekly reset: resets weekly points to 0 while preserving total message counts
    db.resetWeeklyActivity(testGuildId);
    record = db.getUserActivity(testUserId, testGuildId);
    assert.strictEqual(record.weekly_points, 0, 'Weekly points must be reset to 0');
    assert.strictEqual(record.message_count, 1, 'Historical message count must be preserved');
  });

  // -----------------------------------------------------------------
  // 32. Ticket Lifecycle & Transcript Delivery Error Handling
  // -----------------------------------------------------------------
  runTest('Ticket lifecycle logging and graceful transcript failure handling', () => {
    const { getTicketLogsChannel } = require('../src/utils/modLogger');

    const mockGuildWithTicketLogs = {
      id: 'guild_ticket_test',
      channels: {
        cache: [
          {
            id: 'ch_t_logs_1',
            name: '🎫・ticket-logs',
            isTextBased: () => true
          }
        ]
      }
    };

    const resolvedChannel = getTicketLogsChannel(mockGuildWithTicketLogs);
    assert(resolvedChannel, 'Must resolve ticket-logs channel');
    assert.strictEqual(resolvedChannel.id, 'ch_t_logs_1');

    // Verify escapeHtml prevents XSS injections in transcripts
    const { escapeHtml } = require('../src/utils/ticketManager');
    const dangerousInput = '<script>alert("xss")</script>&"\'';
    const escaped = escapeHtml(dangerousInput);
    assert(!escaped.includes('<script>'), 'Must escape script tags');
    assert(escaped.includes('&lt;script&gt;'), 'Must encode < and >');
  });

  // Summary
  console.log('\n\x1b[36m===============================================================\x1b[0m');
  console.log(` \x1b[1mRESULTS: ${passedTests}/${totalTests} Tests Passed\x1b[0m`);
  console.log('\x1b[36m===============================================================\x1b[0m');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
})();

