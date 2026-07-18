# Discord Bot Dashboard

A Next.js 16 web dashboard for managing the [Discord Bot](../README.md). Shares the bot's MongoDB instance, so changes take effect immediately with no separate sync step.

## Features

| Section | What you can manage |
| --- | --- |
| Overview | Open ticket, pending suggestion, case, and warning counts, a 14-day message activity chart, top-6 XP leaderboard, a recent activity feed, and a community stats card |
| Welcome & Farewell | Join/leave channels and messages |
| Birthdays | Announcement channel/message and an optional birthday role |
| Moderation | Log channel, mute role, autorole |
| Auto-Mod | Filters, action, banned word list |
| Anti-Raid | Quarantine role, alert channel, join threshold/window, auto-detection |
| Warn Thresholds | Auto-escalation rules |
| Warnings & Case Log | View and delete member warnings and mod cases, side by side |
| Leveling | Enable toggle, level-up channel, level→role mappings, top-20 XP leaderboard |
| Starboard | Channel, emoji, and star threshold |
| Reaction Roles | Emoji→role mappings |
| Triggers | Keyword→reply mappings |
| Economy | Credit leaderboard (top 20) |
| Shop | Add, edit, remove shop items (role grants and profile badges) |
| Tickets | Ticket category/support role setup, plus a searchable, filterable list of open/closed tickets |
| Temp Voice Channels | Auto-VC channel and category |
| Giveaways | View, end, and reroll giveaways |
| Suggestions | Suggestion channel/approver role, review pending suggestions, view resolved |

## Auth

Discord OAuth2 (`identify guilds` scopes). Only users with **Manage Server** permission on a guild can access that guild's dashboard. Sessions use `iron-session` (encrypted cookie), and stale or expired sessions are redirected to re-authenticate automatically.

## Environment variables

| Variable | Description |
| --- | --- |
| `MONGODB_URL` | MongoDB connection string (shared with the bot) |
| `ClientID` | Discord application client ID |
| `CLIENT_SECRET` | Discord application client secret |
| `DASHBOARD_URL` | Public base URL, e.g. `http://localhost:3000` |
| `SESSION_SECRET` | 32+ character secret for iron-session |
| `Token` | Bot token, used server-side to fetch guild roles/channels |

## Development

```bash
npm install
npm run dev
```

## Production

Built and run via Docker. From the project root, run `./restart.sh --dashboard`.

On Windows, run that from WSL or Git Bash. `npm install` and `npm run dev` above work in any shell.
