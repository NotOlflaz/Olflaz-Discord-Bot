# ⚔️ OlflazMC Discord Community Bot — Complete Documentation

A comprehensive, production-ready Discord bot designed specifically for the **OlflazMC** Minecraft YouTube Community (specializing in Minecraft 1.8 PvP, UHC FFA, duel matchmaking, creator studio collaborations, and tournaments).

Built with **Node.js (v24)** and **Discord.js (v14)**, featuring native SQLite persistent storage (`node:sqlite`), least-privilege security controls, and dark Minecraft PvP aesthetics (emerald green, nether red, dark charcoal, and diamond cyan).

---

## 🌟 Feature Overview

### 1. 🛡️ Server Architecture & `/setup` Engine
- **Unicode Bold Categories**:
  - `「📌」𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗧𝗜𝗢𝗡` (`welcome`, `rules`, `announcements`, `choose-roles`)
  - `「💬」𝗖𝗢𝗠𝗠𝗨𝗡𝗜𝗧𝗬` (`general-chat`, `memes`, `media`, `suggestions`)
  - `「⚔️」𝗣𝗩𝗣 𝗔𝗥𝗘𝗡𝗔` (`pvp-chat`, `uhc-ffa`, `find-a-duel`, `leaderboards`)
  - `「🎥」𝗢𝗟𝗙𝗟𝗔𝗭𝗠𝗖 𝗦𝗧𝗨𝗗𝗜𝗢` (`new-videos`, `behind-the-scenes`, `video-ideas`, `creator-chat`)
  - `「🎉」𝗘𝗩𝗘𝗡𝗧𝗦 & 𝗦𝗨𝗣𝗣𝗢𝗥𝗧` (`open-a-ticket`, `giveaways`, `events`)
  - `「🛡️」𝗦𝗧𝗔𝗙𝗙` (`staff-chat`, `mod-logs`, `ticket-logs`, `applications-review`)
  - `「🔊」𝗩𝗢𝗜𝗖𝗘 𝗟𝗢𝗨𝗡𝗚𝗘` (`Lounge 1`, `Lounge 2`, `PvP Duo 1`, `PvP Duo 2`, `UHC Squad`)
- **Safe `/setup` Execution**:
  - `/setup preview:True` performs a simulation check and audits roles, channels, and permissions without altering anything.
  - `/setup preview:False` applies channels and assigns permissions.
  - **Zero Data Loss Guarantee**: Pre-existing channels, roles, and message histories are never deleted. Legacy channels are automatically rebranded and moved.
  - Starter embeds and guides are automatically posted to empty channels so the community never looks deserted.

---

### 2. 👑 17-Role Hierarchy & Least-Privilege Security
1. `👑 Owner` — Full server owner authority (`Administrator`).
2. `🛡️ Admin` — High-level server administration (no dangerous wildcard administrator).
3. `🔨 Moderator` — Member moderation, kick, ban, timeout, and message management.
4. `🤝 Helper` — Chat moderation, timeouts, and ticket assistance (no kick/ban permissions).
5. `💎 YouTuber+` — Verified partner YouTubers (assigned manually by staff).
6. `🎥 YouTuber` — Verified content creators (assigned manually by staff).
7. `🚀 Server Booster` — Reuses Discord's native booster role when available without duplication.
8. `🌟 VIP` — Distinguished VIP community members.
9. `🏅 OG` — Veteran server members.
10. `💜 Active Member` — Dedicated community members.
11. `🤖 Bot` — System bot role.
12. `👤 Member` — Default community member role automatically granted upon joining.
13. `🎮 Minecraft` — Community ping role (Self-assignable).
14. `⚔️ PvP` — Community ping role (Self-assignable).
15. `🩸 UHC FFA` — Community ping role (Self-assignable).
16. `📢 YouTube Updates` — Video notification ping role (Self-assignable).
17. `🎉 Events` — Community tournaments and giveaway ping role (Self-assignable).

---

### 3. 🎭 Community Self-Role Panel (`/roles-panel`)
- Interactive toggle buttons strictly whitelisted to the 5 community notification roles:
  - `🎮 Minecraft`
  - `⚔️ PvP`
  - `🩸 UHC FFA`
  - `📢 YouTube Updates`
  - `🎉 Events`
- **Security Whitelist**: Staff, Creator, VIP, OG, and Booster roles can never be obtained through self-role buttons, even with modified button IDs.

---

### 4. 🎫 Interactive Ticket System
- Hosted in `🎫・open-a-ticket` with 4 ticket types:
  - 🛠️ **General Support**
  - 🚨 **Player Report**
  - 🎥 **Creator Application** (opens modal)
  - ❓ **Other Inquiries**
- **Duplicate Prevention**: Users cannot open multiple open tickets of the same category simultaneously.
- **Privacy & Permissions**: Dedicated private channel created for requester + authorized staff (`Helper`, `Moderator`, `Admin`, `Owner`).
- **Claim & Close Controls**: Staff can claim tickets. Closing requires confirmation and produces an archived HTML transcript.
- **XSS-Safe HTML Transcripts**: Transcripts escape all HTML tags, quotes, and scripts. Transcripts are archived in `data/transcripts/` and sent to `🎫・ticket-logs`.

---

### 5. 📝 Creator Application Workflow
- Integrated directly into the ticket system and review pipeline.
- Submissions collected via Discord Modals (`modal_creator_app`) requesting YouTube URL, content focus, subscriber/view stats, and pitch.
- Application embed posted to private `📝・applications-review` channel with **Accept** (`✅`) and **Reject** (`❌`) staff action buttons.
- Records reviewer ID, decision, and timestamp in SQLite.
- Sends private direct message notification to applicant.
- Prevents automatic assignment of `YouTuber` or `YouTuber+` rank—requires manual staff verification.

---

### 6. 💡 Community Suggestions System
- Interactive submission button in `💡・suggestions` opening a modal (`modal_submit_suggestion`).
- Formatted embed featuring live `🟢` Upvote and `🔴` Downvote buttons.
- **Vote Integrity**: 1 active vote per user per suggestion. Users can switch votes or remove votes.
- **Staff Controls**: Staff can mark suggestions as `Accepted`, `Under Review`, or `Declined` with color-coded status badges.

---

### 7. 🎉 Giveaways Engine (`/giveaway`)
- Subcommands:
  - `/giveaway create <prize> <duration> [winners] [channel]`
  - `/giveaway end <message_id>`
  - `/giveaway reroll <message_id> [winners]`
  - `/giveaway list`
- Interactive `🎟️ Enter Giveaway` button updating live participant counter.
- **Restart Recovery**: Active giveaways and participants persist in SQLite (`data/bot.sqlite`). On bot reboot, active timers reconcile automatically.
- Fair Fisher-Yates shuffle algorithm for winner selection.

---

### 8. 📅 Community Events System (`/event`)
- Subcommands:
  - `/event create <title> <description> <time> [location] [channel]`
  - `/event cancel <message_id>`
  - `/event list`
- Formatted event embeds in `📅・events` with live `RSVP / Register` toggle buttons and live attendee counters.
- Supports ISO date strings, UTC timestamps, and Unix epoch seconds.

---

### 9. 📺 YouTube RSS Monitor
- Periodically checks the official YouTube RSS feed for channel **@OlflazMC** (`UCl4u_M9jzMV14y-TfrJ0-aQ`):
  `https://www.youtube.com/feeds/videos.xml?channel_id=UCl4u_M9jzMV14y-TfrJ0-aQ`
- Checkpoint persistence in SQLite: Prevents announcing old videos on initial startup and prevents duplicate announcements across bot restarts.
- Posts upload embeds with thumbnails and timestamps in `📺・new-videos`, with optional ping to `📢 YouTube Updates` subscribers.

---

### 10. 🛡️ Moderation Suite & Automated Anti-Spam
- Commands:
  - `/warn <user> <reason>` — Formal warning logged in SQLite and `📋・mod-logs`.
  - `/warnings view <user>` — View warning history for a member.
  - `/warnings clear <user>` — Clear warning records for a member.
  - `/timeout <user> <duration> [reason]` — Time out user with duration parsing (`5m`, `1h`, `1d`).
  - `/untimeout <user>` — Remove active timeout.
  - `/kick <user> [reason]` — Kick member from server.
  - `/ban <user> [reason] [purge_days]` — Ban member with optional message purge.
  - `/clear <amount> [user]` — Bulk delete up to 100 messages with optional author filter.
- **Role Hierarchy Enforcement**: Commands verify that the target member does not outrank or equal the moderator in server hierarchy. Server owner cannot be moderated.
- **Automated Anti-Spam Engine**:
  - Message flood protection (5 msgs in 5 seconds).
  - Repeated message spam detection.
  - Mass-mention interception (5+ mentions).
  - Auto-timeout escalation for repeated offenders.

---

### 11. 🔒 Reliability & DiscordAPIError [10062] Prevention
- All interaction listeners acknowledge interactions within Discord's 3-second deadline (`deferReply`, `deferUpdate`, or immediate modal response).
- Gracefully intercepts expired tokens (`DiscordAPIError[10062]`) and falls back to channel messaging without crashing the bot process.

---

## 💾 Persistent Storage (SQLite)

The bot utilizes Node.js v24 native `node:sqlite` (`DatabaseSync`) located at `data/bot.sqlite`.

Tables:
- `settings` — Key-value configuration & YouTube checkpoints.
- `tickets` — Ticket records, status, staff assignees, transcript paths.
- `applications` — Creator applications, channels, review decisions.
- `suggestions` — Community suggestions, status, vote counts.
- `suggestion_votes` — Unique user vote tracking.
- `giveaways` — Active and ended giveaways, prizes, winners.
- `giveaway_entries` — Participant entries per giveaway.
- `events` — Scheduled community events and timestamps.
- `event_attendees` — Registered attendees per event.
- `warnings` — Moderation warning audit trail.

---

## 🔧 Environment Variables (`.env`)

Configure the following variables in your `.env` file (see `.env.example`):

| Variable | Description |
| :--- | :--- |
| `DISCORD_TOKEN` | Discord Bot Token from Discord Developer Portal (**Keep Secret**) |
| `CLIENT_ID` | Application (Client) ID of the Discord Bot |
| `GUILD_ID` | Guild (Server) ID for instant slash command registration |
| `NODE_ENV` | Environment mode (`development` or `production`) |
| `DATABASE_PATH` | (Optional) Path to SQLite database file (defaults to `data/bot.sqlite`) |

---

## 🚀 Deployment & Startup Instructions

### 1. Run Automated Test Suite
Verify that all 32 systems and configurations pass offline:
```powershell
node test/bot-test.js
```

### 2. Deploy Slash Commands to Discord
Registers all slash commands instantly to your guild and globally:
```powershell
node src/deploy-commands.js
```

### 3. Start the Bot
Launch the live bot process:
```powershell
node index.js
```
*(On hosting panels like bothosting.com, the container runs `node index.js` automatically)*.

---

## 🔑 Required Discord Developer Portal Settings

For the bot to function with full capabilities, ensure the following are enabled in the **[Discord Developer Portal](https://discord.com/developers/applications)**:
1. Navigate to **Applications** ➔ **Your Bot Application** ➔ **Bot** tab.
2. Under **Privileged Gateway Intents**, enable:
   - ✅ **Server Members Intent** *(REQUIRED for Welcome messages, auto-assigning @Member role, and member caching)*
   - ✅ **Message Content Intent** *(REQUIRED for Anti-Spam inspection, message edit/delete audit logs, and sticky message detection)*
3. Save changes.

---

## 📋 Complete Slash Command Reference

| Command | Subcommands / Options | Permissions Required | Purpose |
| :--- | :--- | :--- | :--- |
| `/setup` | `preview:True/False` | Administrator | Simulates or applies complete 17-role hierarchy, categories, and channels |
| `/apply` | *(Opens modal)* | Everyone | Dedicated creator application modal for YouTuber / YouTuber+ team |
| `/sticky` | `set`, `remove`, `list`, `preview` | Manage Messages | Creates, updates, or lists persistent sticky notices in designated channels |
| `/youtube` | `status`, `check`, `set-channel`, `set-destination` | Manage Messages / Admin | Monitors @OlflazMC YouTube uploads & tests live announcements |
| `/leaderboard` | `view`, `post`, `reset` | Everyone (View) / Staff (Manage) | Real, verified community activity and suggestion ranking system |
| `/welcometest` | `target`, `send_to_channel` | Manage Guild | Simulates and previews the official welcome card for a member |
| `/diagnostics` | *(None)* | Manage Guild | Runs comprehensive system health check, channel audit, and DB counts |
| `/ticket` | `open`, `close` | Everyone | Opens or closes support tickets |
| `/warn` | `target`, `reason` | Moderate Members | Issues a formal warning and logs to `#mod-logs` |
| `/warnings` | `view`, `clear` | Moderate Members | Views or clears a member's warning history |
| `/timeout` | `target`, `duration`, `reason` | Moderate Members | Times out a member for a specified duration |
| `/untimeout` | `target`, `reason` | Moderate Members | Removes an active timeout from a member |
| `/kick` | `target`, `reason` | Kick Members | Kicks a member from the server |
| `/ban` | `target`, `reason`, `delete_messages` | Ban Members | Permanently bans a member from the server |
| `/clear` | `amount`, `target` | Manage Messages | Bulk deletes messages in a channel |
| `/giveaway` | `create`, `reroll`, `end` | Manage Messages | Manages community giveaways with persistent timers |
| `/event` | `create`, `list`, `cancel` | Manage Messages | Schedules community events with attendee RSVPs |
| `/roles-panel` | *(None)* | Manage Roles | Posts interactive button panel for 5 self-assignable ping roles |
| `/ticket-panel`| *(None)* | Manage Channels | Posts ticket creation launcher panel |
| `/ping` | *(None)* | Everyone | Checks bot latency and Discord API heartbeat |
| `/serverinfo` | *(None)* | Everyone | Displays server statistics and member breakdown |
| `/help` | *(None)* | Everyone | Shows interactive command catalog |

---

## 📋 Discord Live Verification Checklist

Once the bot is online, verify each feature in your server:

1. **System Health Check**:
   - Run `/diagnostics` in your staff channel. Confirm that database is connected and channel mappings are green.
2. **Server Setup**:
   - Run `/setup preview:True` in your staff channel. Verify the dry-run report displays the complete 17 roles, categories, and channels.
   - Run `/setup preview:False`. Confirm channels are organized and starter embeds appear in rules, announcements, roles, and tickets.
3. **Sticky Messages**:
   - Run `/sticky preview title:"PvP Chat Rules" description:"No toxicity or combat logging."`.
   - Run `/sticky set channel:#pvp-chat title:"PvP Chat Rules" description:"No toxicity or combat logging."`.
   - Send chat messages in `#pvp-chat` and verify the notice stays at the bottom without spamming.
4. **Welcome System**:
   - Run `/welcometest` to preview your own dynamic welcome embed with rules button link.
5. **Creator Applications**:
   - Run `/apply` or click `🎥 Creator Apply` in `#open-a-ticket`.
   - Fill out the 5-field modal (platform, channel link, focus, stats, reason) and submit.
   - Verify a private application channel is opened under `「📝」𝗖𝗥𝗘𝗔𝗧𝗢𝗥 𝗔𝗣𝗣𝗟𝗜𝗖𝗔𝗧𝗜𝗢𝗡𝗦`.
   - Verify the review embed appears in `📝・applications-review` with Accept, Reject, Request Info, and Add Note buttons.
6. **YouTube Announcements**:
   - Run `/youtube status` to verify `@OlflazMC` channel ID (`UCl4u_M9jzMV14y-TfrJ0-aQ`) and `#new-videos` destination.
   - Run `/youtube check` to poll the live RSS feed.
7. **Leaderboard System**:
   - Run `/leaderboard view` to verify genuine community activity rankings.
   - Run `/leaderboard post` to sync the embed in place in `#leaderboards`.
8. **Tickets & Logs**:
   - Open a ticket in `#open-a-ticket`. Verify an `opened` log appears in `🎫・ticket-logs`.
   - Claim the ticket. Verify a `claimed` log appears in `🎫・ticket-logs`.
   - Close the ticket. Verify the HTML transcript is archived and delivered to `🎫・ticket-logs`.
9. **Moderation Logs**:
   - Run `/warn target:@Member reason:"Test warning"`. Verify log embed appears in `📋・mod-logs`.
   - Delete or edit a message and verify automated logging in `📋・mod-logs`.

