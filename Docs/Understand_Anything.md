# Understand-Anything — دليل الأوامر

أداة تحويل المستودع إلى **رسم معرفي تفاعلي** (عقد + حواف + طبقات + جولة إرشادية) يعيش في `.ua/`، مع لوحة عرض (dashboard) لاستكشاف البنية.

المصدر: `~/.understand-anything/repo` · المهارات مثبّتة عالمياً عبر `~/.agents/skills/` (تعمل في أي مشروع).

---

## كيف تستدعيها

| الوكيل | الطريقة |
|---|---|
| **Devin** | `/understand` في المحادثة، أو لغة طبيعية: «حلل المشروع بمهارة understand» |
| **Hermes** | `/understand` (مثبّتة في `~/.hermes/skills/`) |

في Devin: اكتب `/` لرؤية قائمة المهارات كاملة، أو اطلب بلغة طبيعية — الوكيل يستدعي المهارة المناسبة ذاتياً.

---

## الأوامر التسعة — وظيفة + مثال بسيط

### 1. `/understand` — التحليل الرئيسي

يحلل المشروع ويبني `knowledge-graph.json` في `.ua/`. أول تشغيل = تحليل كامل؛ التشغيلات التالية = تحديث تزايدي سريع.

| المثال | ماذا يفعل |
|---|---|
| `/understand` | تحديث تزايدي للمشروع الحالي (يلتقط ما تغيّر فقط) |
| `/understand --full` | إعادة تحليل كاملة من الصفر |
| `/understand --language ar` | يولّد المحتوى النصي (summaries, tags, tour) بالعربية |
| `/understand ../other-project` | يحلل مشروعاً آخر بمساره |
| `/understand --exclude "tests/*,outputs/*"` | يستبعد أنماطاً إضافية من التحليل |
| `/understand --review` | مراجعة LLM أعمق للرسم قبل الحفظ |
| `/understand --auto-update` | يحفظ تفضيل التحديث التلقائي في `.ua/config.json` |

> **شرط التزايدي:** شجرة git نظيفة (commit أو stash أولاً) — وإلا يرفض `prepare-incremental` حفاظاً على baseline قابل لإعادة الإنتاج.

### 2. `/understand-dashboard` — لوحة العرض

يشغّل خادماً محلياً يعرض الرسم بيانياً (عقد، طبقات، بحث، عارض كود).

| المثال | ماذا يفعل |
|---|---|
| `/understand-dashboard` | يفتح لوحة المشروع الحالي |
| `/understand-dashboard C:/MyProject/TOSO` | لوحة مشروع بمسار صريح |

### 3. `/understand-explain` — شرح معمق

| المثال | ماذا يفعل |
|---|---|
| `/understand-explain lib/types.ts` | شرح ملف كامل |
| `/understand-explain lib/optimizer/entity-guard.ts` | شرح حارس الكيانات |

### 4. `/understand-chat` — أسئلة عن الكود

يجيب من الرسم المعرفي لا من قراءة الملفات من الصفر.

| المثال | ماذا يفعل |
|---|---|
| `/understand-chat كيف يتدفق طلب التحسين من الواجهة إلى الـAPI؟` | يتتبع المسار عبر الحواف |
| `/understand-chat ما الذي يتأثر لو عدّلت types.ts؟` | تحليل أثر عبر fan-in |

### 5. `/understand-diff` — تحليل التغييرات

| المثال | ماذا يفعل |
|---|---|
| `/understand-diff` | ما تغيّر في آخر commit + المكونات المتأثرة + المخاطر |
| `/understand-diff HEAD~3` | تحليل آخر 3 التزامات |

### 6. `/understand-onboard` — دليل الانضمام

| المثال | ماذا يفعل |
|---|---|
| `/understand-onboard` | يولّد دليل دخول لعضو جديد (من أين تبدأ، الخريطة، المصطلحات) |

### 7. `/understand-domain` — معرفة النطاق

يستخرج كيانات العمل وتدفقاتها إلى رسم نطاق تفاعلي.

| المثال | ماذا يفعل |
|---|---|
| `/understand-domain` | اشتقاق من الرسم الموجود (خفيف) |
| `/understand-domain --full` | مسح مستقل كامل |

### 8. `/understand-knowledge` — قاعدة wiki

| المثال | ماذا يفعل |
|---|---|
| `/understand-knowledge ./wiki` | يحلل قاعدة معرفة بنمط Karpathy → رسم مواضيع وعلاقات |

### 9. `/understand-figma` — تحليل التصميم

| المثال | ماذا يفعل |
|---|---|
| `/understand-figma https://www.figma.com/design/<key>/file` | صفحات + مكونات + design tokens → رسم `kind:"design"` |

> يتطلب `FIGMA_TOKEN` في ترويسة الطلب (يبقى سرّياً — لا يدخل الرسم).

---

## سيناريو بسيط ومباشر

**عضو جديد انضم لفريق TOSO:**

```text
1. /understand                     # يبني الرسم (أو يحدّثه تزايدياً)
2. /understand-dashboard           # يفتح الخريطة البصرية: 8 طبقات، تدفق imports
3. /understand-onboard             # دليل الانضمام — من أين يبدأ
4. /understand-chat ما مسار الطلب من الواجهة حتى Vertex AI؟
5. /understand-explain lib/services/optimization-service.ts   # عمق في المنسّق
6. # عدّل كوداً → commit → /understand   # تحديث تزايدي سريع
7. /understand-diff                # قبل مراجعة الـPR: ماذا تغيّر والمخاطر
```

---

## ملاحظات عملية

- **`.ua/` محلي** — مستبعد من git؛ النتائج لا تُرفع للمستودع.
- **`.understandignore`** يستبعد `.hermes/` وأدوات الوكلاء — الرسم للمنتج فقط.
- **الـdashboard الحالية:** `http://127.0.0.1:5174/?token=toso-graph-2026` (عندما تعمل). لو انقطعت: `/understand-dashboard`.
- **Windows/Git Bash:** مرّر مسارات `C:/...` صريحة لسكربتات الأداة — `/c/...` ينهار إلى `C:\c\...`.
- **الـviewer المثبّت بالإصدار** قد يعيد 404 (علة #697 موثقة) — البديل `releases/latest/download/` أو خادم Vite المحلي.
- كل مهارة توثّق نفسها: `~/.agents/skills/understand-*/SKILL.md`.
