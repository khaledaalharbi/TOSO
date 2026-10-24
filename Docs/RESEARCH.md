# The evidence behind TOSO

TOSO's one idea is to **cut token consumption**: on the input (① local cleanup,
② a free model's rewrite, ③ translation to English for non-English prompts) and in
execution (④ CLI agents instead of GUI agents, ⑤ many agents from one screen).
Three of those rest on published or measurable evidence, stated below as three
claims. ① and ⑤ carry no published figure and **no saving is claimed for them**;
TOSO measures ① per prompt instead. This page states each claim, the evidence for
it, how strong that evidence is, and what we deliberately do **not** claim.

Every number here falls into one of three levels:

| Level | Meaning | How to read it |
|---|---|---|
| **A — Published measurement** | From a paper (peer-reviewed or arXiv preprint), quoted with its exact source | Trust the number *for the setting the paper measured* |
| **B — Transparent estimate** | Calculated by us from official vendor documentation; the formula is shown | Reproduce it yourself; it depends on the stated assumptions |
| **C — TOSO measurement** | Measured with TOSO itself on Gemini's billing tokenizer | Reproducible, but a small corpus — read the limits |

Sources were last checked on **2026-10-20**.

---

## Claim 1 — Non-English prompts cost more tokens ("language tax")

The same meaning costs more tokens in many languages than in English, because
tokenizer vocabularies are built mostly from English text and code. This is
also called *tokenizer fertility* or the *language tax*.

### Published measurements (Level A)

| Source | Finding |
|---|---|
| Petrov et al., *Language Model Tokenizers Introduce Unfairness Between Languages*, NeurIPS 2023 — [arXiv:2305.15425](https://arxiv.org/abs/2305.15425) | On the GPT-4 tokenizer, the same text costs ≈1.6× in Italian, 2.6× in Bulgarian and **≈3× in Arabic** versus English; up to 15× for some languages. The authors tie this directly to **cost, latency and usable context length**. |
| Ahia et al., *Do All Languages Cost the Same?*, EMNLP 2023 — [arXiv:2305.13707](https://arxiv.org/abs/2305.13707) | Across 22 languages on a commercial API, speakers of many languages are **charged more while getting worse results**. |
| Rust et al., *How Good is Your Tokenizer?*, ACL 2021 — [ACL Anthology](https://aclanthology.org/2021.acl-long.243/) | Foundational work on tokenizer *fertility* as a measurable property of multilingual models. |

### The tax depends on the tokenizer, not only the language

A parallel-corpus measurement (997 identical FLORES-200 sentences, seven public
tokenizers) published as a technical article —
[Towards AI](https://pub.towardsai.net/does-writing-in-another-language-cost-you-fewer-tokens-i-tested-it-621f80200304),
*not peer-reviewed* — shows how wide the range is:

| Language | Tokens vs English, across tokenizers |
|---|---|
| Hindi | 1.58× – 4.79× |
| Arabic | 1.25× – 3.03× |
| Mandarin Chinese | 0.96× – 1.89× |
| Spanish | 1.26× – 1.55× |

Two consequences for TOSO:

- **Measure per meaning, never per character.** One Chinese character carries
  roughly a word; per-character counts make Chinese look 4–5× more expensive
  when, per unit of meaning, modern tokenizers are close to English.
- **The saving depends on the agent's own tokenizer.** TOSO measures with
  Gemini's tokenizer (see below); Claude, Codex and others tokenize differently.

### TOSO's own measurement on Gemini (Level C)

[`reports/token-benchmark.md`](reports/token-benchmark.md) — 12 Arabic prompts
paired with English translations of the same meaning, counted with Gemini's
billing-exact `countTokens` (2026-09-27):

| | Tokens | Characters |
|---|---:|---:|
| Arabic | 246 | 739 |
| English | 181 | 988 |
| **Arabic ÷ English, same meaning** | **1.36×** | |

Per prompt, the ratio ranges from **1.00×** (a short Kuwaiti-dialect sentence)
to **1.80×**. On this corpus, the English version saves **≈26%** of input tokens
on Gemini.

> The original report also states "1.82× per character". That figure is real but
> it is the per-character metric warned against above — the meaningful number
> is **1.36× per meaning**.

What this tells us: **Gemini's tokenizer is relatively efficient for Arabic**
(close to the best tokenizers in the table above). Older or English-centric
tokenizers tax Arabic far more (Petrov et al.: ≈3×).

**Limits:** 12 short prompts; one tokenizer; Arabic only. A larger,
multi-language benchmark is on the roadmap.

---

## Claim 2 — Translating before sending cuts cost without hurting quality

| Source | Finding |
|---|---|
| Nag et al., *Cost-Performance Optimization for Processing Low-Resource Language Tasks Using Commercial LLMs*, 2024 — [arXiv:2403.05434](https://arxiv.org/abs/2403.05434) | Translating (or transliterating) from a token-expensive language to a token-efficient one before calling GPT-4 **reduced cost by up to 90%**, with **better or comparable** quality, across 15 Indic and 3 other languages. |

This is the closest published evidence for TOSO's core step. Note the setting:
classification and generative NLP tasks on GPT-4 — not coding agents. TOSO
applies the same idea to prompts sent to CLI coding agents.

**How TOSO protects meaning during translation** (it does not claim the
translation is perfect):

- an **entity guard** checks that numbers, dates, URLs, `{variables}`,
  identifiers and quotes survive; if not, the local cleanup is used instead;
- a **negation check** flags prompts whose "not / never / without" was lost;
- a **coverage check** reports how much of the content survived.

---

## Claim 3 — CLI agents are a cheaper, faster channel than GUI agents

### Published measurements (Level A)

**Zhou et al., *GUI vs. CLI: Execution Bottlenecks in Screen-Only and
Skill-Mediated Computer-Use Agents*, 2026 —
[arXiv:2606.24551](https://arxiv.org/abs/2606.24551)** (NYU Shanghai, Yale,
NTU). 440 desktop tasks, 18 applications, identical goals, initial states and
verifiers for both modalities.

| Result | Value |
|---|---|
| Best GUI agent (GPT-5.4), full pass rate | **59.1%** |
| Best CLI agent with original skills (Codex GPT-5.5) | **48.2%** |
| Verifier checkpoints reachable through the original CLI skills | **37.6%** |
| CLI after verifier-guided skill patching | **69.3%** |

The authors frame 69.3% as a *diagnostic upper bound* (the patching used
verifier information), not an out-of-the-box result. Their conclusion: the CLI
bottleneck is **skill coverage**, the GUI bottleneck is **grounded interaction
over long workflows**.

The paper measures cost as **average task time**, not tokens. Same model,
both channels (from its main results table):

| Model | GUI | CLI | GUI slower by |
|---|---:|---:|---:|
| GPT-5.4 | 455.8 s | 254.4 s | 1.8× |
| Claude Opus 4.7 | 346.4 s | 248.8 s | 1.4× |
| Claude Sonnet 4.6 | 245.4 s | 208.6 s | 1.2× |

**Bechard et al., *Terminal Agents Suffice for Enterprise Automation*, 2026 —
[arXiv:2604.00073](https://arxiv.org/abs/2604.00073)** (ServiceNow). On 729
enterprise tasks, a coding agent with only a terminal and a filesystem matched
or outperformed web and MCP agents, at **2–9× lower cost** (as summarised in
He Ye's [research notes](https://heye.me/research-notes/cli/), UCL).

### Why screenshots are expensive (Level B — calculated)

GUI agents send screenshots. Official image pricing:

| Vendor | Rule (official docs) | One 1920×1080 screenshot |
|---|---|---:|
| Anthropic Claude, standard tier | ⌈width/28⌉ × ⌈height/28⌉ visual tokens, capped at 1,568 — [docs](https://docs.anthropic.com/en/docs/build-with-claude/vision) | 1,560 |
| Anthropic Claude 4.7+, high-res tier | same rule, capped at 4,784 | 2,691 |
| Google Gemini | 258 tokens per 768×768 tile — [docs](https://ai.google.dev/gemini-api/docs/tokens) | 1,548 (6 tiles) |

So a GUI session that keeps 10 screenshots in context carries roughly
**15,000–27,000 tokens of images alone**, before any text. This is an estimate
from the formulas above, not a measured average — real agents may downscale or
drop old screenshots.

A CLI turn has no such floor, but **no fixed CLI number is claimed**: a CLI agent
that reads a large file can also consume tens of thousands of tokens.

---

## The free preprocessing layer (verified 2026-10-20)

TOSO's preprocessing has two parts. The **local cleanup** (①) runs on your machine
with no network and no key: it removes greetings, request filler and repeated
spacing in Arabic and English, and never edits code, URLs, JSON, quotes or
`{variables}`. The **rewrite and translation** (② and ③) run on Gemini. On the **free tier** of the Gemini Developer
API ([pricing](https://ai.google.dev/gemini-api/docs/pricing)):

| TOSO model | Free tier |
|---|---|
| `gemini-3.8-flash` (default) | Free of charge |
| `gemini-3.5-flash-lite` (described by Google as optimised for translation) | Free of charge |
| `gemini-3.1-pro-preview` | Not available on the free tier |

Conditions that must be understood:

- **Privacy:** on the free tier Google states content is *"used to improve our
  products"*; on the paid tier it is *not*. Do not put confidential code or data
  in prompts on the free tier.
- **Rate limits** apply — see the [official limits](https://ai.google.dev/gemini-api/docs/rate-limits).
- The free path is **your own AI Studio key** entered in TOSO's settings. TOSO's
  optional server key uses Google's Agent Platform, which is billed.

## Net saving — the honest accounting

```
net saving = tokens saved at the agent − cost of the TOSO preprocessing
```

TOSO records the real token usage of its own Gemini call, so both sides are
visible. On the free tier the preprocessing costs **$0** (it uses free quota,
not money). The tokens saved are at the **paid** agent — usually the expensive
side. In one sentence: *TOSO moves language work from your paid agent's budget
to Gemini's free quota.*

---

## What we do not claim

These figures circulate online but have **no source we could verify**, so they
are not used anywhere in this project:

- "A CLI task costs 900–3,000 tokens; a GUI task 15,000–30,000+."
- "$3.20 vs $55.20 per 10,000 operations."
- "GUI agents are 3–6× slower." (The controlled study above measured 1.2–1.8× for the same model.)
- "GUI agents get stuck in loops 35–50% more often."
- "Context caching saves an extra 30–50% for CLI."
- "The local cleanup saves N% of tokens." (No such number exists: the saving depends on how much filler your prompt has. TOSO shows the measured before/after for each prompt.)
- "Running several agents at once saves tokens." (It is a workflow feature; no saving is claimed.)
- "CLI skills cut tokens by 82–96%." (That range is from AutoRPA, ICML 2026 — compiling agent trajectories into code — not from a CLI-vs-GUI comparison.)

If you have a primary source for any of them, open an issue.

## Threats to validity

- TOSO measures savings on **Gemini's tokenizer**; your agent's tokenizer may
  tax your language more (larger saving) or less.
- The Arabic benchmark is small (12 prompts). Treat 1.36× as indicative.
- Translation can lose nuance; the guards detect visible losses (entities,
  negation), not every shift in meaning.
- The CLI-vs-GUI papers are 2026 preprints; results may change on review.

## References

1. Petrov, A., La Malfa, E., Torr, P. H. S., Bibi, A. (2023). *Language Model Tokenizers Introduce Unfairness Between Languages.* NeurIPS. [arXiv:2305.15425](https://arxiv.org/abs/2305.15425)
2. Ahia, O., Kumar, S., Gonen, H., Kasai, J., Mortensen, D. R., Smith, N. A., Tsvetkov, Y. (2023). *Do All Languages Cost the Same? Tokenization in the Era of Commercial Language Models.* EMNLP. [arXiv:2305.13707](https://arxiv.org/abs/2305.13707)
3. Rust, P., Pfeiffer, J., Vulić, I., Ruder, S., Gurevych, I. (2021). *How Good is Your Tokenizer? On the Monolingual Performance of Multilingual Language Models.* ACL. [aclanthology.org/2021.acl-long.243](https://aclanthology.org/2021.acl-long.243/)
4. Nag, A., Mukherjee, A., Ganguly, N., Chakrabarti, S. (2024). *Cost-Performance Optimization for Processing Low-Resource Language Tasks Using Commercial LLMs.* [arXiv:2403.05434](https://arxiv.org/abs/2403.05434)
5. Zhou, X., Zhang, S., Zhao, Y., Wei, J., Song, T., Cohan, A., Zhao, C. (2026). *GUI vs. CLI: Execution Bottlenecks in Screen-Only and Skill-Mediated Computer-Use Agents.* [arXiv:2606.24551](https://arxiv.org/abs/2606.24551)
6. Bechard, P., Marquez Ayala, O., Chen, E., Skelton, J., Davasam, S., Sunkara, S., Yadav, V., Rajeswar, S. (2026). *Terminal Agents Suffice for Enterprise Automation.* [arXiv:2604.00073](https://arxiv.org/abs/2604.00073)
7. He Ye (UCL). *Agent-Native Interfaces — research notes.* [heye.me/research-notes/cli](https://heye.me/research-notes/cli/)
8. Anthropic. *Vision — resolution and token cost.* [docs](https://docs.anthropic.com/en/docs/build-with-claude/vision)
9. Google. *Understand and count tokens* and *Gemini Developer API pricing.* [tokens](https://ai.google.dev/gemini-api/docs/tokens) · [pricing](https://ai.google.dev/gemini-api/docs/pricing)
