# Changelog

All notable changes to TOSO are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] — 2026-10-25

First public release.

### Input: fewer tokens before the agent reads your prompt

- Local, deterministic cleanup for **Arabic and English** (greetings, filler,
  spacing) that never touches code, URLs, JSON, quotes or `{variables}`.
- Rewrite through a free Gemini model on your own AI Studio key (BYOK); English
  input is tightened without translation.
- Arabic prompts are translated to concise English; the Arabic version of an
  English prompt is available on demand, for reading only.
- Real token measurement with Gemini `countTokens`, two gauges and a heat map.
- Meaning guards: entities (`{var}` and `{{var}}`, numbers, dates, URLs, quotes),
  negation and content coverage; a failing rewrite falls back to the local cleanup.

### Execution: CLI agents from one screen

- Five CLI agents in live embedded terminals: Gemini CLI, Claude Code, OpenAI
  Codex, Devin and Hermes — each with its own prompt box and IN / OUT log.
- Agents receive English only; every send ends with `Respond in English.`.
- Per-agent project folder with check → optional trust → start; re-send past
  prompts to another agent without reprocessing; bridge sessions panel.
- Local bridge bound to `127.0.0.1` with a session token and an agent allowlist.

### Project

- Arabic / English interface with RTL ↔ LTR switch.
- `npm run start:all` for daily use (local production build) and
  `npm run dev:all` for development; both listen on `127.0.0.1` only.
- CI (types, lint, tests, build), issue and PR templates, contributing guide,
  code of conduct, security policy, and guides in English and Arabic.

[0.1.0]: https://github.com/khaledaalharbi/TOSO/releases/tag/v0.1.0
