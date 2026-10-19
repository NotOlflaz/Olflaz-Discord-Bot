const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'bot.sqlite');
const db = new DatabaseSync(dbPath);

// Initialize Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_number INTEGER,
    channel_id TEXT UNIQUE,
    guild_id TEXT,
    user_id TEXT,
    user_tag TEXT,
    ticket_type TEXT,
    status TEXT DEFAULT 'open',
    claimed_by_id TEXT,
    claimed_by_tag TEXT,
    closed_by_id TEXT,
    closed_by_tag TEXT,
    close_reason TEXT,
    created_at INTEGER,
    closed_at INTEGER,
    transcript_path TEXT
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    user_tag TEXT,
    channel_link TEXT,
    content_type TEXT,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    reviewed_by_id TEXT,
    reviewed_by_tag TEXT,
    review_notes TEXT,
    message_id TEXT,
    channel_id TEXT,
    created_at INTEGER,
    reviewed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    suggestion_number INTEGER,
    message_id TEXT UNIQUE,
    channel_id TEXT,
    user_id TEXT,
    user_tag TEXT,
    title TEXT,
    content TEXT,
    status TEXT DEFAULT 'pending',
    staff_response TEXT,
    staff_id TEXT,
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    created_at INTEGER,
    updated_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS suggestion_votes (
    suggestion_id INTEGER,
    user_id TEXT,
    vote_type TEXT,
    PRIMARY KEY (suggestion_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS giveaways (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT UNIQUE,
    channel_id TEXT,
    guild_id TEXT,
    prize TEXT,
    winner_count INTEGER DEFAULT 1,
    host_id TEXT,
    host_tag TEXT,
    ends_at INTEGER,
    status TEXT DEFAULT 'active',
    winners TEXT,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS giveaway_entries (
    giveaway_id INTEGER,
    user_id TEXT,
    entered_at INTEGER,
    PRIMARY KEY (giveaway_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT UNIQUE,
    channel_id TEXT,
    guild_id TEXT,
    title TEXT,
    description TEXT,
    location TEXT,
    event_time INTEGER,
    host_id TEXT,
    host_tag TEXT,
    status TEXT DEFAULT 'scheduled',
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS event_attendees (
    event_id INTEGER,
    user_id TEXT,
    registered_at INTEGER,
    PRIMARY KEY (event_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    user_id TEXT,
    user_tag TEXT,
    moderator_id TEXT,
    moderator_tag TEXT,
    reason TEXT,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS sticky_messages (
    channel_id TEXT PRIMARY KEY,
    guild_id TEXT,
    content TEXT,
    embed_title TEXT,
    embed_description TEXT,
    embed_color TEXT,
    last_message_id TEXT,
    is_active INTEGER DEFAULT 1,
    updated_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS user_activity (
    user_id TEXT,
    guild_id TEXT,
    message_count INTEGER DEFAULT 0,
    weekly_points INTEGER DEFAULT 0,
    suggestions_accepted INTEGER DEFAULT 0,
    last_active INTEGER,
    updated_at INTEGER,
    PRIMARY KEY (user_id, guild_id)
  );

  CREATE TABLE IF NOT EXISTS application_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER,
    action TEXT,
    actor_id TEXT,
    actor_tag TEXT,
    notes TEXT,
    created_at INTEGER
  );
`);

logger.info(`SQLite Database initialized at ${dbPath}`);


// -----------------------------------------------------------------
// Key-Value Settings
// -----------------------------------------------------------------
function getSetting(key, defaultValue = null) {
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const row = stmt.get(key);
  return row ? row.value : defaultValue;
}

function setSetting(key, value) {
  const stmt = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
  stmt.run(key, String(value), Date.now());
}

function getCanonicalChannelMap(guildId) {
  const val = getSetting(`canonical_channel_map_${guildId}`);
  if (!val) return {};
  try {
    return JSON.parse(val);
  } catch {
    return {};
  }
}

function setCanonicalChannelMap(guildId, map) {
  setSetting(`canonical_channel_map_${guildId}`, JSON.stringify(map || {}));
}

function getCanonicalChannel(guildId, key) {
  const map = getCanonicalChannelMap(guildId);
  return map[key] || null;
}

function setCanonicalChannel(guildId, key, channelId) {
  const map = getCanonicalChannelMap(guildId);
  map[key] = channelId;
  setCanonicalChannelMap(guildId, map);
}

// -----------------------------------------------------------------
// Tickets
// -----------------------------------------------------------------
function getNextTicketNumber(guildId) {
  const counterKey = `ticket_seq_${guildId}`;
  const current = parseInt(getSetting(counterKey, '0'), 10);
  const next = current + 1;
  setSetting(counterKey, String(next));
  return next;
}

function createTicket({ guildId, channelId, userId, userTag, ticketType, ticketNumber }) {
  const stmt = db.prepare(`
    INSERT INTO tickets (ticket_number, channel_id, guild_id, user_id, user_tag, ticket_type, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'open', ?)
  `);
  const result = stmt.run(ticketNumber, channelId, guildId, userId, userTag, ticketType, Date.now());
  return result.lastInsertRowid;
}

function getTicketByChannel(channelId) {
  return db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(channelId);
}

function getTicketById(ticketId) {
  return db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
}

function getOpenTicket(guildId, userId, ticketType) {
  return db.prepare(`
    SELECT * FROM tickets 
    WHERE guild_id = ? AND user_id = ? AND ticket_type = ? AND status IN ('open', 'claimed')
  `).get(guildId, userId, ticketType);
}

function claimTicket(ticketId, claimedById, claimedByTag) {
  const stmt = db.prepare(`
    UPDATE tickets 
    SET status = 'claimed', claimed_by_id = ?, claimed_by_tag = ?
    WHERE id = ?
  `);
  stmt.run(claimedById, claimedByTag, ticketId);
}

function closeTicket(ticketId, closedById, closedByTag, closeReason, transcriptPath) {
  const stmt = db.prepare(`
    UPDATE tickets 
    SET status = 'closed', closed_by_id = ?, closed_by_tag = ?, close_reason = ?, transcript_path = ?, closed_at = ?
    WHERE id = ?
  `);
  stmt.run(closedById, closedByTag, closeReason, transcriptPath, Date.now(), ticketId);
}

// -----------------------------------------------------------------
// Creator Applications
// -----------------------------------------------------------------
function createApplication({ userId, userTag, channelLink, contentType, reason, messageId, channelId }) {
  const stmt = db.prepare(`
    INSERT INTO applications (user_id, user_tag, channel_link, content_type, reason, status, message_id, channel_id, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `);
  const result = stmt.run(userId, userTag, channelLink, contentType, reason, messageId, channelId, Date.now());
  return result.lastInsertRowid;
}

function getApplicationById(appId) {
  return db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
}

function updateApplicationStatus(appId, status, reviewedById, reviewedByTag, reviewNotes = '') {
  const stmt = db.prepare(`
    UPDATE applications 
    SET status = ?, reviewed_by_id = ?, reviewed_by_tag = ?, review_notes = ?, reviewed_at = ?
    WHERE id = ?
  `);
  stmt.run(status, reviewedById, reviewedByTag, reviewNotes, Date.now(), appId);
}

// -----------------------------------------------------------------
// Suggestions & Voting
// -----------------------------------------------------------------
function getNextSuggestionNumber() {
  const current = parseInt(getSetting('suggestion_counter', '0'), 10);
  const next = current + 1;
  setSetting('suggestion_counter', String(next));
  return next;
}

function createSuggestion({ messageId, channelId, userId, userTag, title, content }) {
  const num = getNextSuggestionNumber();
  const stmt = db.prepare(`
    INSERT INTO suggestions (suggestion_number, message_id, channel_id, user_id, user_tag, title, content, status, upvotes, downvotes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, 0, ?, ?)
  `);
  const now = Date.now();
  const result = stmt.run(num, messageId, channelId, userId, userTag, title, content, now, now);
  return { id: result.lastInsertRowid, number: num };
}

function getSuggestionById(id) {
  return db.prepare('SELECT * FROM suggestions WHERE id = ?').get(id);
}

function getSuggestionByMessage(messageId) {
  return db.prepare('SELECT * FROM suggestions WHERE message_id = ?').get(messageId);
}

function updateSuggestionStatus(id, status, staffId, staffResponse = '') {
  const stmt = db.prepare(`
    UPDATE suggestions 
    SET status = ?, staff_id = ?, staff_response = ?, updated_at = ?
    WHERE id = ?
  `);
  stmt.run(status, staffId, staffResponse, Date.now(), id);
}

function voteSuggestion(suggestionId, userId, voteType) {
  // Check existing vote
  const existingVote = db.prepare('SELECT vote_type FROM suggestion_votes WHERE suggestion_id = ? AND user_id = ?').get(suggestionId, userId);

  let userAction = '';
  if (existingVote) {
    if (existingVote.vote_type === voteType) {
      // Toggle off
      db.prepare('DELETE FROM suggestion_votes WHERE suggestion_id = ? AND user_id = ?').run(suggestionId, userId);
      userAction = 'removed';
    } else {
      // Switch vote
      db.prepare('UPDATE suggestion_votes SET vote_type = ? WHERE suggestion_id = ? AND user_id = ?').run(voteType, suggestionId, userId);
      userAction = 'switched';
    }
  } else {
    // New vote
    db.prepare('INSERT INTO suggestion_votes (suggestion_id, user_id, vote_type) VALUES (?, ?, ?)').run(suggestionId, userId, voteType);
    userAction = 'added';
  }

  // Recount
  const upCount = db.prepare("SELECT COUNT(*) as count FROM suggestion_votes WHERE suggestion_id = ? AND vote_type = 'up'").get(suggestionId).count;
  const downCount = db.prepare("SELECT COUNT(*) as count FROM suggestion_votes WHERE suggestion_id = ? AND vote_type = 'down'").get(suggestionId).count;

  db.prepare('UPDATE suggestions SET upvotes = ?, downvotes = ?, updated_at = ? WHERE id = ?').run(upCount, downCount, Date.now(), suggestionId);

  return { upvotes: upCount, downvotes: downCount, action: userAction };
}

// -----------------------------------------------------------------
// Giveaways
// -----------------------------------------------------------------
function createGiveaway({ messageId, channelId, guildId, prize, winnerCount, hostId, hostTag, endsAt }) {
  const stmt = db.prepare(`
    INSERT INTO giveaways (message_id, channel_id, guild_id, prize, winner_count, host_id, host_tag, ends_at, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `);
  const result = stmt.run(messageId, channelId, guildId, prize, winnerCount, hostId, hostTag, endsAt, Date.now());
  return result.lastInsertRowid;
}

function getGiveawayByMessage(messageId) {
  return db.prepare('SELECT * FROM giveaways WHERE message_id = ?').get(messageId);
}

function getActiveGiveaways() {
  return db.prepare("SELECT * FROM giveaways WHERE status = 'active'").all();
}

function enterGiveaway(giveawayId, userId) {
  const existing = db.prepare('SELECT 1 FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?').get(giveawayId, userId);
  let action = '';

  if (existing) {
    db.prepare('DELETE FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?').run(giveawayId, userId);
    action = 'left';
  } else {
    db.prepare('INSERT INTO giveaway_entries (giveaway_id, user_id, entered_at) VALUES (?, ?, ?)').run(giveawayId, userId, Date.now());
    action = 'entered';
  }

  const count = db.prepare('SELECT COUNT(*) as count FROM giveaway_entries WHERE giveaway_id = ?').get(giveawayId).count;
  return { action, count };
}

function getGiveawayEntrants(giveawayId) {
  const rows = db.prepare('SELECT user_id FROM giveaway_entries WHERE giveaway_id = ?').all(giveawayId);
  return rows.map(r => r.user_id);
}

function endGiveaway(giveawayId, winnersJson, status = 'ended') {
  db.prepare('UPDATE giveaways SET status = ?, winners = ? WHERE id = ?').run(status, winnersJson, giveawayId);
}

// -----------------------------------------------------------------
// Community Events
// -----------------------------------------------------------------
function createEvent({ messageId, channelId, guildId, title, description, location, eventTime, hostId, hostTag }) {
  const stmt = db.prepare(`
    INSERT INTO events (message_id, channel_id, guild_id, title, description, location, event_time, host_id, host_tag, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)
  `);
  const result = stmt.run(messageId, channelId, guildId, title, description, location, eventTime, hostId, hostTag, Date.now());
  return result.lastInsertRowid;
}

function getEventByMessage(messageId) {
  return db.prepare('SELECT * FROM events WHERE message_id = ?').get(messageId);
}

function getEventById(eventId) {
  return db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
}

function getActiveEvents() {
  return db.prepare("SELECT * FROM events WHERE status IN ('scheduled', 'active') ORDER BY event_time ASC").all();
}

function toggleEventRegistration(eventId, userId) {
  const existing = db.prepare('SELECT 1 FROM event_attendees WHERE event_id = ? AND user_id = ?').get(eventId, userId);
  let action = '';

  if (existing) {
    db.prepare('DELETE FROM event_attendees WHERE event_id = ? AND user_id = ?').run(eventId, userId);
    action = 'unregistered';
  } else {
    db.prepare('INSERT INTO event_attendees (event_id, user_id, registered_at) VALUES (?, ?, ?)').run(eventId, userId, Date.now());
    action = 'registered';
  }

  const count = db.prepare('SELECT COUNT(*) as count FROM event_attendees WHERE event_id = ?').get(eventId).count;
  return { action, count };
}

function getEventAttendees(eventId) {
  return db.prepare('SELECT user_id FROM event_attendees WHERE event_id = ?').all(eventId).map(r => r.user_id);
}

function cancelEvent(eventId) {
  db.prepare("UPDATE events SET status = 'cancelled' WHERE id = ?").run(eventId);
}

// -----------------------------------------------------------------
// Moderation Warnings
// -----------------------------------------------------------------
function addWarning({ guildId, userId, userTag, moderatorId, moderatorTag, reason }) {
  const stmt = db.prepare(`
    INSERT INTO warnings (guild_id, user_id, user_tag, moderator_id, moderator_tag, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(guildId, userId, userTag, moderatorId, moderatorTag, reason, Date.now()).lastInsertRowid;
}

function getUserWarnings(guildId, userId) {
  return db.prepare('SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC').all(guildId, userId);
}

function clearUserWarnings(guildId, userId) {
  return db.prepare('DELETE FROM warnings WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
}

// -----------------------------------------------------------------
// Sticky Messages
// -----------------------------------------------------------------
function getStickyMessage(channelId) {
  return db.prepare('SELECT * FROM sticky_messages WHERE channel_id = ? AND is_active = 1').get(channelId);
}

function setStickyMessage({ channelId, guildId, content = '', embedTitle = '', embedDescription = '', embedColor = '', lastMessageId = null, isActive = 1 }) {
  const stmt = db.prepare(`
    INSERT INTO sticky_messages (channel_id, guild_id, content, embed_title, embed_description, embed_color, last_message_id, is_active, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(channel_id) DO UPDATE SET
      content = excluded.content,
      embed_title = excluded.embed_title,
      embed_description = excluded.embed_description,
      embed_color = excluded.embed_color,
      last_message_id = excluded.last_message_id,
      is_active = excluded.is_active,
      updated_at = excluded.updated_at
  `);
  stmt.run(channelId, guildId, content, embedTitle, embedDescription, embedColor, lastMessageId, isActive ? 1 : 0, Date.now());
}

function updateStickyLastMessage(channelId, lastMessageId) {
  db.prepare('UPDATE sticky_messages SET last_message_id = ?, updated_at = ? WHERE channel_id = ?').run(lastMessageId, Date.now(), channelId);
}

function deleteStickyMessage(channelId) {
  return db.prepare('DELETE FROM sticky_messages WHERE channel_id = ?').run(channelId);
}

function getAllActiveStickyMessages(guildId) {
  return db.prepare('SELECT * FROM sticky_messages WHERE guild_id = ? AND is_active = 1').all(guildId);
}

// -----------------------------------------------------------------
// Real Verified Activity Leaderboard
// -----------------------------------------------------------------
function recordUserActivity(userId, guildId, pointsToAdd = 1) {
  const stmt = db.prepare(`
    INSERT INTO user_activity (user_id, guild_id, message_count, weekly_points, suggestions_accepted, last_active, updated_at)
    VALUES (?, ?, 1, ?, 0, ?, ?)
    ON CONFLICT(user_id, guild_id) DO UPDATE SET
      message_count = user_activity.message_count + 1,
      weekly_points = user_activity.weekly_points + excluded.weekly_points,
      last_active = excluded.last_active,
      updated_at = excluded.updated_at
  `);
  const now = Date.now();
  stmt.run(userId, guildId, pointsToAdd, now, now);
}

function recordSuggestionAccepted(userId, guildId) {
  const stmt = db.prepare(`
    INSERT INTO user_activity (user_id, guild_id, message_count, weekly_points, suggestions_accepted, last_active, updated_at)
    VALUES (?, ?, 0, 5, 1, ?, ?)
    ON CONFLICT(user_id, guild_id) DO UPDATE SET
      weekly_points = user_activity.weekly_points + 5,
      suggestions_accepted = user_activity.suggestions_accepted + 1,
      last_active = excluded.last_active,
      updated_at = excluded.updated_at
  `);
  const now = Date.now();
  stmt.run(userId, guildId, now, now);
}

function getUserActivity(userId, guildId) {
  return db.prepare('SELECT * FROM user_activity WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
}

function getTopActivityLeaderboard(guildId, limit = 10) {
  return db.prepare(`
    SELECT * FROM user_activity 
    WHERE guild_id = ? AND weekly_points > 0
    ORDER BY weekly_points DESC, message_count DESC 
    LIMIT ?
  `).all(guildId, limit);
}

function resetWeeklyActivity(guildId) {
  return db.prepare('UPDATE user_activity SET weekly_points = 0, updated_at = ? WHERE guild_id = ?').run(Date.now(), guildId);
}

// -----------------------------------------------------------------
// Application Audit Trail
// -----------------------------------------------------------------
function addApplicationAudit({ appId, action, actorId, actorTag, notes = '' }) {
  const stmt = db.prepare(`
    INSERT INTO application_audit (app_id, action, actor_id, actor_tag, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(appId, action, actorId, actorTag, notes, Date.now()).lastInsertRowid;
}

function getApplicationAudits(appId) {
  return db.prepare('SELECT * FROM application_audit WHERE app_id = ? ORDER BY created_at ASC').all(appId);
}

module.exports = {
  db,
  getSetting,
  setSetting,
  getCanonicalChannelMap,
  setCanonicalChannelMap,
  getCanonicalChannel,
  setCanonicalChannel,
  getNextTicketNumber,
  createTicket,
  getTicketByChannel,
  getTicketById,
  getOpenTicket,
  claimTicket,
  closeTicket,
  createApplication,
  getApplicationById,
  updateApplicationStatus,
  createSuggestion,
  getSuggestionById,
  getSuggestionByMessage,
  updateSuggestionStatus,
  voteSuggestion,
  createGiveaway,
  getGiveawayByMessage,
  getActiveGiveaways,
  enterGiveaway,
  getGiveawayEntrants,
  endGiveaway,
  createEvent,
  getEventByMessage,
  getEventById,
  getActiveEvents,
  toggleEventRegistration,
  getEventAttendees,
  cancelEvent,
  addWarning,
  getUserWarnings,
  clearUserWarnings,
  getStickyMessage,
  setStickyMessage,
  updateStickyLastMessage,
  deleteStickyMessage,
  getAllActiveStickyMessages,
  recordUserActivity,
  recordSuggestionAccepted,
  getUserActivity,
  getTopActivityLeaderboard,
  resetWeeklyActivity,
  addApplicationAudit,
  getApplicationAudits
};

