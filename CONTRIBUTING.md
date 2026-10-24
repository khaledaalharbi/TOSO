# Contributing to TOSO

TOSO is a free, local tool that cuts the tokens your AI coding agent spends.
Contributions are welcome — small fixes as much as new languages.
(بالعربية: المساهمات مرحّب بها؛ الشيفرة بالإنجليزية والواجهة والتوثيق ثنائيا اللغة.)

## Set up

Requires **Node.js 22.12+**.

```bash
git clone https://github.com/khaledaalharbi/TOSO.git
cd TOSO
npm install
npm run dev:all      # app + local agent bridge, opens your browser
```

You do not need a paid key: paste a free [Google AI Studio](https://aistudio.google.com/)
key in Settings. Without any key only the local cleanup runs.

## Before you open a pull request

CI runs exactly these four checks — run them first:

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```

Add a test with every behaviour change. UI text is checked by
`lib/i18n/i18n-coverage.test.ts`.

## Rules that keep the project honest

- **Agents receive English only.** Never add a path that sends Arabic (or any
  non-English text) to a CLI agent. Every send goes through `withEnglishReply`
  (`lib/bridge/agents.ts`) so the reply comes back in English too.
- **No claim without a source.** A number or saving in the docs needs a link to a
  paper/vendor doc or a measurement anyone can reproduce
  ([`Docs/RESEARCH.md`](Docs/RESEARCH.md) lists what we do and do not claim).
- **Local-first, not a service.** No accounts, billing, telemetry or server-side
  storage. The app and the bridge listen on `127.0.0.1` only — see
  [`SECURITY.md`](SECURITY.md) before touching the bridge.
- **Entity safety.** Cleanup and rewriting must never alter code, URLs, JSON,
  quotes, numbers or `{variables}` — `lib/optimizer/entity-guard.ts` enforces it.
- **No secrets or personal paths** in code, tests, docs or screenshots.

## UI text and languages

Interface text uses a source-keyed dictionary: the Arabic text in the code is the
key, and `lib/i18n/en.ts` holds the English. Write `t("نص عربي")` in a component
(via `useI18n()`), add the English entry, and the coverage test tells you if you
forgot. Keep `{placeholders}` identical in both languages.

**Adding a language** (Chinese, Russian and Hindi are open for the community):
a UI dictionary, language detection and quality-guard word lists, a local
normalizer next to `lib/optimizer/english-normalizer.ts`, Gemini instructions,
tests, and a token-tax measurement. The checklist is in
[`Docs/future-ideas.md`](Docs/future-ideas.md). Please open an issue first so we
can agree on scope — and a native speaker's review of the wording is required.

## Documentation map

Update the docs that your change touches:

| File                                                      | Covers                                                   |
| --------------------------------------------------------- | -------------------------------------------------------- |
| [`README.md`](README.md) / [`README.ar.md`](README.ar.md) | What TOSO is, quick start, limits, roadmap               |
| [`Docs/getting-started.md`](Docs/getting-started.md)      | Install, run, per-agent steps, troubleshooting (English) |
| [`Docs/setup-and-usage.md`](Docs/setup-and-usage.md)      | The same guide in Arabic — keep the two in sync          |
| [`Docs/ARCHITECTURE.md`](Docs/ARCHITECTURE.md)            | Technical reference: pipeline, routes, bridge, guards    |
| [`Docs/RESEARCH.md`](Docs/RESEARCH.md)                    | Evidence behind every claim                              |
| [`SECURITY.md`](SECURITY.md)                              | Key handling and the bridge threat model                 |
| [`AGENTS.md`](AGENTS.md)                                  | Rules for coding agents working on this repo             |

## Reporting problems

Use the issue templates (bug report, feature request). Report vulnerabilities
privately, as described in [`SECURITY.md`](SECURITY.md). Never paste API keys,
bridge tokens or confidential prompts.

## License

By contributing you agree that your work is released under the [MIT License](LICENSE).
