# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project has not yet cut a tagged release, so everything so far lives under Unreleased.

## Unreleased

The bot and dashboard have been under active development without version bumps. Recent work includes full test coverage for `events/` and `slashCommands/`, a Vitest and ESLint setup for the dashboard with coverage for its server actions, a handful of bug fixes (ticket cooldown races, case number reuse, duplicate duration formatting), and a new suggestion box (`/suggest submit`, `/suggest setup`, `/suggest list`) with up/down voting and a staff-only review flow. Approve, Deny, and Implement buttons only show up for permitted reviewers, never on the public message. Configurable via the command or the dashboard's General section, with a new dashboard Suggestions page for reviewing and deleting suggestions.