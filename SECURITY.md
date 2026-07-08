# Security Policy

## Supported Versions

Only the latest commit on `main` is supported. Make sure you're running the latest version before reporting an issue.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report it privately using the [Security tab](../../security) of this repository ("Report a vulnerability"), or contact the maintainer directly through GitHub.

Please include:

- A description of the vulnerability and its impact
- Steps to reproduce it
- Any relevant logs or proof-of-concept code

## What to Expect

- We'll acknowledge your report as soon as possible
- We'll investigate and work on a fix, keeping you updated
- Once fixed, we'll credit you in the release notes unless you'd prefer to stay anonymous

## Scope

Covers the bot (`slashCommands/`, `events/`, `handlers/`, `utils/`, `models/`, `src/`) and the dashboard (`dashboard/`). Third-party dependencies should be reported upstream to the relevant project.

## Handling Secrets

If you find committed credentials, API keys, or tokens anywhere in this repository's history, report it the same way. Do not attempt to use any exposed credentials.
