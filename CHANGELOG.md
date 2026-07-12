# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project has not yet cut a tagged release, so everything so far lives under Unreleased.

## Unreleased

The bot and dashboard have been under active development without version bumps. Recent work includes full test coverage for `events/` and `slashCommands/`, a Vitest and ESLint setup for the dashboard with coverage for its server actions, a handful of bug fixes (ticket cooldown races, case number reuse, duplicate duration formatting), and a new suggestion box (`/suggest submit`, `/suggest setup`, `/suggest list`) with up/down voting and a staff-only review flow. Approve, Deny, and Implement buttons only show up for permitted reviewers, never on the public message. Configurable via the command or the dashboard's Suggestions page, which also lists pending and resolved suggestions for review and deletion.

Added birthday announcements: `/birthday set/view/unset` for members to manage their own birthday per server, `/birthdayconfig set/unset` (Manage Server) to configure the announcement channel, message, and an optional day-only role, and a daily check scheduled from `clientReady` that self-aligns to local midnight. The birthday role is cleared from all holders each day before the day's new birthdays are granted it. Configurable via the dashboard's new Birthdays page as well.

Revamped the dashboard's layout and page structure. The old General section is gone. Its log channel setting moved into Moderation, and suggestion config moved into Suggestions. Warnings and Case Log are now one page shown side by side. Leveling's Settings and Level Roles cards merged into one card with a single Save button, and every settings card saves itself now instead of sharing a form wrapper that kept causing spacing bugs. All cards also picked up a subtle drop shadow.

Rebuilt the Overview page with a 14-day message activity chart, a top-6 XP leaderboard, a recent activity feed for moderation and community events, and a stats card covering coins in circulation, active giveaways, shop items, reaction role messages, triggers, approved suggestions, and warn thresholds. Member names in these lists resolve and copy their user ID on click, the same pattern already used on Leveling, Tickets, Suggestions, and Warnings.