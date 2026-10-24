# TOSO

**Spend fewer tokens on every AI coding task — before the agent reads your prompt,
and while it works.** TOSO cleans and tightens your prompt, translates it to English
when you write in another language, sends it to the CLI coding agent of your
choice, and lets you drive several agents from one screen.

[العربية](README.ar.md) · [Evidence](Docs/RESEARCH.md) · [Setup & usage (Arabic)](Docs/setup-and-usage.md) · [Architecture](Docs/ARCHITECTURE.md) · MIT License

---

## The idea

Tokens are the bill. TOSO cuts them in two places:

**1 · On the input — what you send (three layers)**

| #   | Layer                        | What it does                                                                                                                                                                                                     |
| --- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ①   | **Local processing**         | Deterministic cleanup on your machine, no network: drops greetings, filler and repeated spacing; never touches code, URLs, JSON, quotes or `{variables}`. Works in Arabic and English, even without any API key. |
| ②   | **A free model rewrites it** | Gemini tightens the wording without changing the task. It runs on your own free [AI Studio](https://aistudio.google.com/) key, so the preprocessing costs **$0** (conditions below).                             |
| ③   | **Translation to English**   | A non-English prompt is translated to concise English first — the same meaning costs fewer tokens. **Arabic is supported today**; English input skips translation. See [why](#the-problem).                      |

**2 · On the execution — how the agent works (two ideas)**

| #   | Idea                             | What it does                                                                                                                                                                                              |
| --- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ④   | **CLI agents, driven from a UI** | The agent works through text and commands in a real terminal instead of screenshots of a screen, which lowers the cost of its processing and its output. TOSO gives that terminal a friendly interface.   |
| ⑤   | **Many agents, one screen**      | Gemini CLI, Claude Code, OpenAI Codex, Devin and Hermes each get a tab with their own live terminal, prompt box and IN / OUT log. Run them side by side and re-send a prompt to another agent in a click. |

**TOSO moves language work from your paid agent's budget to Gemini's free quota.**

## The problem

Developers who think in Arabic, Hindi, Russian or Chinese pay more to use AI
coding agents than developers who write in English — for the same request.

- **The language tax.** The same meaning costs more tokens in many languages:
  ≈3× for Arabic on the GPT-4 tokenizer, up to 15× for some languages
  ([Petrov et al., NeurIPS 2023](https://arxiv.org/abs/2305.15425)). Speakers of
  many languages are charged more while getting worse results
  ([Ahia et al., EMNLP 2023](https://arxiv.org/abs/2305.13707)).
- **Translation is a proven fix.** Translating to an efficient language before
  calling the model cut cost by up to 90% with comparable or better quality
  ([Nag et al., 2024](https://arxiv.org/abs/2403.05434)).
- **The channel matters too.** In a controlled study of 440 desktop tasks, CLI
  agents finished faster than screen-driven GUI agents on the same model, and
  reached 69.3% success (vs 59.1% for GUI) once their skill coverage was patched —
  a diagnostic upper bound, per the authors
  ([Zhou et al., 2026](https://arxiv.org/abs/2606.24551)). Screenshots are
  expensive context: one 1920×1080 screenshot is roughly 1,500–2,700 tokens
  ([calculated from vendor docs](Docs/RESEARCH.md)).

## How a prompt flows

```
 your prompt                TOSO                                   your CLI agent
 (Arabic or English)  ──▶  ① clean up locally (no network)
                           ② rewrite with a free Gemini model
                           ③ Arabic → concise English
                              (English input: no translation)
                           guard entities, negation, coverage
                                           English only  ───────▶  Gemini CLI · Claude Code
                                                                    Codex · Devin · Hermes
 reply in your         ◀──  translate the reply back  ◀── captured from the live terminal
 language                   (on demand for English input)
```

| #   | Layer                                         | Evidence                                                                                                              |
| --- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| ①   | Local processing                              | No published figure is claimed. TOSO shows the measured before/after tokens of _your_ prompt.                         |
| ②   | A free model does the rewriting               | [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)                                                       |
| ③   | English instead of your language at the agent | [Petrov 2023](https://arxiv.org/abs/2305.15425), [Nag 2024](https://arxiv.org/abs/2403.05434), TOSO's own measurement |
| ④   | A CLI agent instead of a GUI agent            | [Zhou 2026](https://arxiv.org/abs/2606.24551), [Bechard 2026](https://arxiv.org/abs/2604.00073)                       |
| ⑤   | Several agents from one screen                | A workflow feature — no saving is claimed for it                                                                      |

## Measured, not assumed

TOSO counts tokens with Gemini's billing-exact `countTokens` and shows the real
numbers for _your_ prompt — original, cleaned, and final English.

On a 12-prompt Arabic/English parallel corpus, Arabic cost **1.36× the tokens of
English for the same meaning** on Gemini's tokenizer, so the English version saved
≈26% ([report](Docs/reports/token-benchmark.md)). Gemini's tokenizer is relatively
kind to Arabic; English-centric tokenizers tax it far more, so the saving at your
agent can be larger. Full method, limits and sources: **[Docs/RESEARCH.md](Docs/RESEARCH.md)**.

## Features

- **Real token measurement** of the original, the local cleanup and the final
  English, with two gauges and a per-segment heat map.
- **Arabic and English input.** Arabic is translated to English; English is
  cleaned and tightened without translation, with the Arabic version one click
  away if you want to read it («عرض النسخة العربية»).
- **Meaning guards:** numbers, dates, URLs, `{variables}` and `{{variables}}`,
  and quotes must survive; lost negation is flagged; a failing rewrite falls back
  to the local cleanup.
- **English-only rule:** agents never receive the Arabic text — mostly-Arabic text
  is refused on every send path.
- **Five CLI agents on one screen**, in live embedded terminals: Gemini CLI,
  Claude Code, OpenAI Codex, Devin, Hermes. Each has its own prompt box, so a
  prompt can't go to the wrong agent, and sessions keep context across turns.
- **Per-agent project folder** with a check → optional trust → start sequence;
  no agent ever runs on an unchecked folder.
- **IN / OUT transcript** per agent and per turn, with the reply translated back;
  past prompts can be re-sent to another agent without being processed again.
- **Bridge sessions panel:** see which sessions are live, reconnect to them, end
  them or reopen closed ones.
- **Local bridge** bound to `127.0.0.1` with a session token and a fixed agent
  allowlist — see [SECURITY.md](SECURITY.md).

## Quick start

Requires **Node.js 22.12+** and at least one CLI agent installed and logged in.

```bash
git clone <this-repo>
cd TOSO
npm install
npm run dev:all
```

`dev:all` starts the app (`http://localhost:3000`) and the local agent bridge
together, pairs them automatically and opens your browser. Then:

1. **Settings →** paste your free [Google AI Studio](https://aistudio.google.com/) key.
2. **Agent tab →** enter your project folder → ① Check → ④ Start session.
3. Write your prompt in that agent's own box → **Process** (your draft is replaced
   in place by the concise English version) → **Send**. A per-agent switch makes it
   one click. Past prompts can be re-sent to another agent from the IN/OUT log
   («إرسال أيضاً»), with no new processing.

Step-by-step guide (Arabic): [Docs/setup-and-usage.md](Docs/setup-and-usage.md).

## Free tier: know the conditions

- `gemini-3.8-flash` (default) and `gemini-3.5-flash-lite` are free of charge on
  the Gemini free tier; `gemini-3.1-pro-preview` is not.
- **Privacy:** on the free tier Google states content may be _used to improve its
  products_; on the paid tier it is not. Keep confidential code out of prompts on
  the free tier.
- Free-tier [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) apply.
- The free path is **your own AI Studio key**. The optional server key uses
  Google's billed Agent Platform.
- Without any key, only the local cleanup (①) runs; the Gemini rewrite and the
  translation are unavailable and TOSO says so.

## Status and limits

TOSO is a working prototype and the author's first open-source project.

- Input today is **Arabic and English**; the interface is Arabic.
- Savings are measured on **Gemini's tokenizer**; your agent's tokenizer differs.
- Reply capture reads each agent's terminal screen; a new agent UI may need a new
  rule. Long replies from full-screen agents can be truncated.
- Translation can lose nuance — the guards catch visible losses, not every shift
  in meaning.
- The CLI-vs-GUI studies are 2026 preprints; their results may change on review.

## Roadmap

- Five languages for both input and interface: **Arabic, English, Chinese, Russian,
  Hindi** — chosen because their token tax is measurable and varies widely.
- A larger, reproducible multi-language benchmark using TOSO's measurement path.
- Free-form sessions beyond the fixed agent tabs.

## Documentation

| Document                                           | Contents                                                                |
| -------------------------------------------------- | ----------------------------------------------------------------------- |
| [Docs/RESEARCH.md](Docs/RESEARCH.md)               | Every claim with its source, evidence level, and what we do not claim   |
| [Docs/setup-and-usage.md](Docs/setup-and-usage.md) | Install, run, first settings, per-agent steps, troubleshooting (Arabic) |
| [Docs/ARCHITECTURE.md](Docs/ARCHITECTURE.md)       | Technical reference: pipeline, API routes, bridge, guards (Arabic)      |
| [SECURITY.md](SECURITY.md)                         | Key handling and the local bridge threat model                          |

## License

[MIT](LICENSE) © 2026 khaledaalharbi and TOSO contributors.
