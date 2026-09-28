# مُحسّن البرومبت العربي — Prototype

واجهة Single Page عربية RTL لاستكشاف عدد الـTokens والتكلفة المتوقعة قبل وبعد تحسين prompt عربي. الفهم وإعادة الصياغة والترجمة تتم عبر Gemini (المفتاح محفوظ في الخادم فقط)، مع سقوط محلي إلى mock عند غياب المفتاح. لا قاعدة بيانات.

## التشغيل

يتطلب Node.js 20.9 أو أحدث.

```bash
npm install
npm run dev
```

ثم افتح `http://localhost:3000`.

للتحقق من نسخة الإنتاج:

```bash
npm run build
npm start
```

## المتغيرات البيئية (`.env.local`)

| المتغير                                       | الاستخدام                                                                                                                                                        |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GEMINI_API_KEY`                              | **مطلوب** للقياس الحقيقي (`countTokens`) وللتحسين (`generateContent`). بدونه يسقط التطبيق إلى تقدير محلي ومحسّن Mock — العربية تعمل، الترجمة الإنجليزية لا تتاح. |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`         | محجوزة لمهايئات مستقبلية؛ غير مقروءة حاليًا في الكود.                                                                                                            |
| `TOSO_DEFAULT_PROVIDER`, `TOSO_DEFAULT_MODEL` | محجوزة؛ الافتراضي حاليًا ثابت في `lib/providers/registry.ts`.                                                                                                    |

> المفاتيح تُقرأ فقط في Route Handlers على الخادم ولا تصل للمتصفح أبدًا.

## ما يتضمنه النموذج

- مدخل prompt عربي وزر تحليل، ثم شجرة معالجة ثابتة يمشي عليها ضوء مع كل مرحلة: تحليل الـTokens، الفهم وإعادة الصياغة عبر Gemini، حاويتا مخرجات (عربية منقّحة + إنجليزية مترجمة) بزر نسخ، وشريط تحليل التكلفة.
- نافذة إعدادات لاختيار provider/model. حقل API key موجود لتوضيح التجربة المستقبلية فقط؛ لا يُخزّن ولا يُرسل ولا يدخل في أي حالة React.
- ضوء متنقّل على هيكل الشجرة يعكس تقدمًا حقيقيًا (أحداث من طبقة الخدمة، لا مؤقتات وهمية).
- مزوّدون ونماذج تجريبية قابلة للتوسعة، مع تكلفة إدخال تقديرية.
- شريط **نسبة العربية** في مرحلة القياس، ووسم `% عربي` في كل حاوية مخرجات — الإنجليزية تعرض 0% كدليل بصري على الترجمة.
- اختبارات Vitest للدوال النقية (`npm test` — 28 اختبارًا: الـheuristic والـBPE المعايران، حساب التكلفة، الـregistry، ومحلّل رد النموذج).
- تفاصيل إتاحة: `id`/`name` لكل حقول النماذج، `dir="ltr"` لحاوية الإنجليزية، وأيقونة `app/icon.svg`.

## المعمارية

```text
components/                    واجهة المستخدم وحالة الجلسة فقط
lib/services/optimization-service.ts
  ├─ lib/token-engine/         عداد Tokens قابل للاستبدال (provider → BPE → heuristic)
  ├─ lib/optimizer/            مهايئ Gemini ثنائي اللغة + سقوط Mock محلي
  ├─ lib/providers/            registry لمزوّدي النماذج وخصائص التكلفة
  └─ lib/cost-engine/          حساب تكلفة الإدخال
app/api/optimize/route.ts      نقطة التحسين الوحيدة التي تلمس مفتاح Gemini (Interactions API)
app/api/tokens/count/route.ts  نقطة قياس الـTokens الوحيدة (countTokens)
lib/mcp/contract.ts            عقد TypeScript لواجهة MCP المستقبلية
```

## مسار التحسين (`POST /api/optimize`)

الطلب: `{ text, model? }` — والرد أحد شكلين:

```jsonc
// نجاح:
{ "arabic": "…", "english": "…", "note": "…", "model": "gemini-3.5-flash", "fallback": false }
// سقوط (دائمًا HTTP 200 حتى يتدبّر العميل أمره محليًا):
{ "fallback": true, "reason": "no_api_key" | "http_429" | "bad_model_output" | … }
```

- الاستدعاء عبر **Interactions API** (`POST /v1beta/interactions`، هيدر `x-goog-api-key` + `Api-Revision: 2026-05-20`) — الـAPI الموصى به للتطوير الجديد؛ الرد كائن `steps` نأخذ منه آخر خطوة `model_output`.
- **الحقن الخلفي (system instruction)** يفرض ثلاثة حقول — `arabic` (صياغة موجزة بنفس لهجة المستخدم)، `english` (ترجمة محسّنة جاهزة كـ LLM prompt)، `note` (سطر عربي يصف التغيير) — مع قواعد صارمة لحفظ النية: لا حذف لكيان/رقم/شرط، ولا إضافة متطلبات. الإخراج مقيّد بـ `response_format` مع JSON Schema صريح.
- `store: false` — لا يُخزَّن الـprompt على خوادم Google (لا نستخدم `previous_interaction_id` ولا `background` أصلًا). و`thinking_level: "low"` يخفض كلفة وزمن الأفكار لأن إعادة الصياغة ليست استدلالًا عميقًا.
- **سلسلة سقوط بين النماذج**: يجرّب النموذج المطلوب ثم بقية نماذج Gemini بالترتيب (`3.8-flash → 3.5-flash → 3.5-flash-lite → 3.1-pro`); `429` (حصة لكل نموذج يوميًا) ينتقل للتالي مباشرة، و`5xx` يعيد المحاولة مرتين قبل الانتقال. حقل `model` في الرد يوضّح أي نموذج عمل فعلًا، وتعرضه الواجهة في شارة مرحلة المعالجة.

## ملاحظات تشغيلية (تجربة فعلية)

- نماذج Gemini الحديثة **نماذج thinking**: تستهلك توكنز إخراج على "الأفكار" قبل الإجابة — `generation_config.thinking_level: "low"` يخفّضها (قياس تجريبي: ~110 توكن أفكار على طلب تافه بدون ضبط).
- الطبقة المجانية من Gemini API تحدّ بـ **~20 طلب توليد يوميًا لكل نموذج** (قياس `countTokens` بحصة منفصلة لا تتأثر). عند استنزاف النماذج كلها يرجع الـroute `fallback` وتعمل الواجهة بالـmock بصدق.
- `countTokens` (في `/api/tokens/count`) لا يزال على `generateContent` — endpoint القياس لم يُرحَّل بعد، وهو مدعوم رسميًا ولا يحتاج Interactions.
- `countTokens` يعيد نفس العدد لكل نماذج Gemini (tokenizer مشترك) — انظر `outputs/token-benchmark.md`.

## إعدادات Devin (`.devin/`)

- `skills/gemini-api-dev/` — مهارة تطوير Gemini API (Interactions API، النماذج الحالية، SDK `@google/genai`، مرجع الترحيل) منقولة من مشروع JrsAlsoq_v2 — المصدر لأي عمل مستقبلي على Gemini هنا.
- `config.local.json` — صلاحيات أوامر exec للوكيل (npm/npx/git/curl).

## الانتقال إلى الإنتاج وMCP

1. ~~أنشئ Route Handler على الخادم~~ — `app/api/optimize/route.ts` يعمل الآن عبر Gemini مع سقوط إلى mock.
2. ~~استبدل tokenizer الوهمي بعدّاد حقيقي~~ — `/api/tokens/count` يقيس عبر `countTokens` الرسمي؛ يتبقى مهايئات tokenizer لمزوّدين غير Google.
3. ~~استبدل `mock-optimizer.ts` بمهايئ LLM~~ — `llm-optimizer.ts` يستدعي `/api/optimize`؛ يتبقى فحص المعنى والجودة.
4. عرّض `runOptimization` من خلال أداة MCP باسم `optimize_arabic_prompt` وفق العقد في `lib/mcp/contract.ts`.
5. أضف مصادقة، حدود استخدام، سجل تدقيق، وقياس usage قبل تشغيل خدمة مدفوعة.

> أسعار النماذج الحالية أمثلة واجهة فقط وليست مصدرًا للفوترة أو التسعير الرسمي.
