# Security Policy — TOSO

## Reporting a vulnerability

This project is a free open-source prototype. If you find a security issue,
please open a **private** GitHub security advisory on the repository rather
than a public issue, or contact the maintainer through the profile linked on
the repo. Do not include real API keys or user prompts in reports.

## Key handling (read before self-hosting)

- `AGENT_PLATFORM_API_KEY` is read **only** inside Next.js Route Handlers.
  It must never be exposed to the browser, committed to the repo, or logged.
  `.env.local` and `gcp-key.json` are gitignored — keep them that way.
- The user BYOK key (`x-user-gemini-key` header) lives in the visitor's own
  `localStorage` and is forwarded per request; it is never persisted or
  logged server-side.
- TOSO is a tool you run yourself, **not a hosted service**: no accounts,
  rate limits or billing exist or are planned. `npm run start:all` (like
  `dev:all`) listens on `127.0.0.1` only. If you fork it into a shared service,
  authentication, rate limiting and key custody are **your** responsibility —
  and do not set `AGENT_PLATFORM_API_KEY` on anything reachable by others, or
  everyone's calls are billed to you.

## The local bridge (`bin/toso-bridge.mjs`)

The bridge runs CLI agents on your machine on behalf of the web UI. Its
threat model is deliberate and narrow — do not loosen it casually:

- It binds `127.0.0.1` **only**. Never set `0.0.0.0` or expose it to a LAN.
- Every endpoint requires the `x-toso-token` session token printed at start
  (or `TOSO_BRIDGE_TOKEN`). A page without the token gets HTTP 401.
- The agent registry is an **allowlist** — a request can only pick an agent
  id, never supply a command line. Prompts go over stdin; no shell is
  involved, so prompt text is never interpreted.
- `Origin` headers outside localhost (and `TOSO_BRIDGE_ORIGINS`) get 403 —
  a random website cannot drive your terminal through a rebinding attempt.
- **Workspace (`cwd`)**: a request may name the folder an allowlisted agent
  runs in. It must be absolute and exist, or the run is refused
  (`invalid_workspace`) — never silently redirected. `/fs/check` answers
  whether a path is an existing folder, which reveals local path existence
  to a token holder (same class as `/run`).
- **Trust is two separate classes.** Per-run trust injects an adapter's
  documented folder-trust env (Gemini: `GEMINI_CLI_TRUST_WORKSPACE=true`)
  into that one process; nothing is written. Permanent trust
  (`/trust/workspace`) writes the folder into the agent's own trust file and
  happens only on an explicit user click; a corrupt file is refused, not
  overwritten. Action-authorizing flags (`claude --dangerously-skip-permissions`,
  `codex --full-auto`) are **not** folder trust and are deliberately not wired.
- **Embedded terminals (`/pty/*`)** run an allowlisted agent's interactive
  TUI in a pseudo-terminal (`node-pty`, an optional native dependency loaded
  lazily — `TOSO_BRIDGE_DISABLE_PTY=1` turns it off). `/pty/:id/input`
  writes keystrokes into that session, so a token holder can drive the
  agent interactively — including whatever tools the agent itself allows
  under its own approval mode. The agent is started **without a lingering
  shell** (no `-NoExit`): when it exits the session ends, so input never
  reaches a free shell prompt. Sessions are capped (8) and their output
  buffer bounded (2 MB). The stream is a header-authenticated `fetch()`, not
  an `EventSource`, so the token is never put in a URL.
- `/api/clean` (opt-in "smart clean") sends a terminal capture to Gemini to
  re-flow it; the response is rejected unless ≥95% of its words occur in the
  capture, so the model cannot inject text into the agent transcript.
- `/open-terminal` launches an interactive window for an allowlisted agent
  in the workspace and releases it: the window is the user's session, TOSO
  never reads it back. Its script is passed as `-EncodedCommand`, so no
  user-supplied text is re-parsed by a shell.

Residual risk, stated honestly: **any local process running as you can read
the bridge port and, if it learns the token, launch the allowed CLIs in any
existing folder, type into their live embedded sessions, open agent windows,
and add folders to an agent's trust file** — the same risk class as any
localhost agent. If that is unacceptable
for your environment, do not run the bridge; the copy-paste fallback remains.

## Known dependency findings (last audit: October 2026)

`npm audit --omit=dev` is **clean** — nothing vulnerable ships to the
runtime/browser bundle. The full audit reports 3 dev-only findings
(moderate) through one build-time chain:

| Chain                                | Package                         | Advisory         | Status                                            |
| ------------------------------------ | ------------------------------- | ---------------- | ------------------------------------------------- |
| `tailwindcss@3` → `postcss-nested` → | `postcss-selector-parser@6.1.4` | ReDoS (moderate) | Fixed in `7.1.6`, outside Tailwind 3's `^6` range |

(The earlier `braces` ReDoS findings through `micromatch` are gone after the
`eslint-config-next` 15.5.28 and dev-dependency updates.)

Why this is tolerated: it runs **at build time only** and its input is
repo-controlled (project CSS). Exploiting it requires a malicious stylesheet
inside the repository itself; the realistic vector in an open-source repo is a
crafted CSS file in a PR slowing a CI build.

Planned resolution: a deliberate Tailwind 4 migration. `npm audit fix --force`
is **not** applied — it installs Tailwind 4, a breaking change, without migrating
the code.
