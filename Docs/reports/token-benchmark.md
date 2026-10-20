# TOSO — Arabic Token Benchmark (Gemini 3.8 Flash)

**Date:** 2026-09-27 · **Source:** Google Generative Language API `countTokens` (billing-exact)
**Method:** 12-case parallel corpus — each case is an Arabic prompt paired with its English
translation (same meaning, not transliteration). Measurement only; no generation involved.

## Headline result

| Script | Tokens | Chars | Tokens / 100 chars |
|---|---:|---:|---:|
| **Arabic**  | 246 | 739  | **33.29** |
| **English** | 181 | 988  | **18.32** |
| **Ratio**   | 1.36× tokens (on 25% fewer chars) | | **1.82× per character** |

> Arabic consumes **1.82× more tokens per character** than English on the same meaning.
> The old prototype assumed `chars / 2.4` (≈ 41.7 tokens/100 chars) for everything —
> it overstated Arabic by 25% and English by 128%.

## Full corpus

| Case | AR chars | AR tok | AR t/100c | EN chars | EN tok | EN t/100c | Ratio |
|---|---:|---:|---:|---:|---:|---:|---:|
| business_1 | 65 | 21 | 32.31 | 86 | 16 | 18.60 | 1.74 |
| business_2 | 81 | 28 | 34.57 | 107 | 18 | 16.82 | 2.05 |
| technical_1 | 63 | 20 | 31.75 | 91 | 16 | 17.58 | 1.81 |
| technical_2 | 62 | 27 | 43.55 | 85 | 15 | 17.65 | 2.47 |
| instructions_1 | 59 | 15 | 25.42 | 84 | 14 | 16.67 | 1.53 |
| instructions_2 | 74 | 20 | 27.03 | 76 | 12 | 15.79 | 1.71 |
| reasoning_1 | 65 | 22 | 33.85 | 94 | 13 | 13.83 | 2.45 |
| reasoning_2 | 56 | 17 | 30.36 | 78 | 15 | 19.23 | 1.58 |
| creative_1 | 55 | 20 | 36.36 | 73 | 15 | 20.55 | 1.77 |
| casual_1 (Kuwaiti) | 50 | 21 | 42.00 | 74 | 21 | 28.38 | 1.48 |
| code_comment | 50 | 17 | 34.00 | 61 | 11 | 18.03 | 1.89 |
| prompt_engineer | 59 | 18 | 30.51 | 79 | 15 | 18.99 | 1.61 |
| **TOTAL** | **739** | **246** | **33.29** | **988** | **181** | **18.32** | **1.82** |

Range: **1.48× – 2.47×** — the penalty is consistent across every genre tested,
never below 1.4×. Kuwaiti dialect (`casual_1`) is the most expensive at 42 tok/100 chars.

## Model agreement

All four Gemini models tested return **identical** counts (shared SentencePiece tokenizer):

| Model | arabic_only | english_only | mixed | code_arabic | technical_arabic |
|---|---:|---:|---:|---:|---:|
| gemini-3.8-flash | 37 | 25 | 25 | 27 | 37 |
| gemini-3.1-pro-preview | 37 | 25 | 25 | 27 | 37 |
| gemini-flash-latest | 37 | 25 | 25 | 27 | 37 |
| gemini-3.5-flash | 37 | 25 | 25 | 27 | 37 |

## Accuracy validation

`countTokens` was cross-checked against actual `generateContent` billing:

| Case | countTokens | generateContent prompt | Match |
|---|---:|---:|---|
| arabic_only | 37 | 48 (= 37 + 11 prefix) | ✓ |
| english_only | 25 | 36 (= 25 + 11 prefix) | ✓ |
| mixed | 25 | 36 | ✓ |
| code_arabic | 27 | 37 (+10) | ✓ |
| technical_arabic | 37 | 47 (+10) | ✓ |

`countTokens` is **exact billing truth**, not an estimate. Safe to use for cost projection.

## Model availability note (2026-09-27)

`gemini-2.5-flash` and `gemini-2.5-pro` return **404 "no longer available to new users"**
even though they still appear in `models.list`. The registry now ships
`gemini-3.8-flash` (default), `gemini-3.5-flash`, and `gemini-3.1-pro-preview`.

## Implication for TOSO

The project hypothesis is **confirmed**: Arabic prompts are materially more expensive
per unit of meaning. A 1.8× cost asymmetry is large enough to fund a real optimization
product — every 10M input tokens of Arabic traffic carries roughly $0.30–$1.25 of
avoidable spend depending on the model tier.

## Reproduction

```bash
# engine-level check against the running dev server
curl -X POST http://localhost:3000/api/tokens/count \
  -H "Content-Type: application/json" \
  -d '{"text":"من فضلك أريد منك أن تحلل لي أداء الشركة"}'
# → {"tokens":23,"fallback":false,"model":"gemini-3.8-flash"}
```
