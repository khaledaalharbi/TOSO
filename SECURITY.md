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
- If you fork this into a real service, key storage, rate limiting, and
  authentication are **your** responsibility — none are implemented here by
  design (see `AGENTS.md` → «جاهزية الإنتاج»).

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

Residual risk, stated honestly: **any local process running as you can read
the bridge port and, if it learns the token, launch the allowed CLIs** — the
same risk class as any localhost agent. If that is unacceptable for your
environment, do not run the bridge; the copy-paste fallback remains.

## Known dependency findings (last audit: October 2026)

`npm audit --omit=dev` is **clean** — nothing vulnerable ships to the
runtime/browser bundle. The full audit reports 9 dev-only findings
(7 high, 2 moderate) through two build-time chains:

| Chain | Package | Advisory | Status |
| --- | --- | --- | --- |
| `tailwindcss@3` → `chokidar`/`micromatch` → | `braces@3.0.3` | ReDoS (high) | No patched `braces` release exists; fix requires the breaking Tailwind 4 migration |
| `eslint-config-next` → `fast-glob` → `micromatch` → | `braces@3.0.3` | same | npm's autofix would *downgrade* `eslint-config-next` to 14.x — rejected |
| `tailwindcss@3` → `postcss-nested` → | `postcss-selector-parser@6.1.4` | ReDoS (moderate) | Fixed in `7.1.6`, outside Tailwind 3's `^6` range |

Why these are tolerated: all three run **at build/lint time only** and their
input is repo-controlled (glob patterns in `tailwind.config`, project CSS).
Exploiting them requires a malicious pattern inside the repository itself —
at which point arbitrary code is already in the build. The remaining
realistic vector in an open-source repo is a crafted CSS file in a PR
slowing a CI build.

Planned resolution: an upstream `braces` fix, or a deliberate Tailwind 4
migration. `npm audit fix --force` is **not** applied — it proposes breaking
changes (Tailwind 4, `eslint-config-next` 14.x) without migrating the code.
