# مقارنة تعليمات التحسين — مدفوعة (Interactions API)

- التاريخ: 2026-09-28T16:56:36.095Z
- مفتاح: **backup** — store:false — thinking:low
- old = التعليمات الإنجليزية السابقة (نص HEAD) + تلميح لهجة مُعاد بناؤه؛ new = التعليمات العربية الحالية دون تلميح.
- الجانبان داخل الحالة الواحدة مثبّتان على النموذج نفسه عندما ينجح أولهما.

## اعتذار عميل (خليجية + تاريخ + نفي)

> أبي رسالة اعتذار للعميل عن تأخر الطلب بتاريخ ٢٠٢٥-٠٦-١٠، خليها سطرين ولا تذكر الأسعار أو سبب التأخير.

### old — gemini-3.5-flash-lite

- **arabic**: ابي رسالة اعتذار للعميل عن تأخر الطلب بتاريخ 10-06-2025، سطرين بس، بدون ما تذكر الأسعار أو سبب التأخير.
- **english**: Write a two-line apology message to a customer for the delayed order on 2025-06-10. Do not mention prices or the reason for the delay.
- **note**: لخصت الطلب وحافظت على اللهجة الخليجية مع الشروط بدقة.
- **usage**: `{"total_tokens":394,"total_input_tokens":272,"input_tokens_by_modality":[{"modality":"text","tokens":272}],"total_cached_tokens":0,"total_output_tokens":122,"total_tool_use_tokens":0,"total_thought_tokens":0,"raw_prompt_token":397,"model_invocation_token_counts":[{"prompt_tokens_details":[{"modality":"text","tokens":397}],"candidates_tokens_details":[{"modality":"text","tokens":140}]}],"non_grounding_model_invocation_token_counts":[{"prompt_tokens_details":[{"modality":"text","tokens":397}],"candidates_tokens_details":[{"modality":"text","tokens":140}]}]}`
- **كيانات مفقودة**: 2025-06-10

### new — gemini-3.5-flash-lite

- **arabic**: اكتب رسالة اعتذار للعميل عن تأخر الطلب بتاريخ 2025-06-10 في سطرين فقط، دون ذكر الأسعار أو سبب التأخير.
- **english**: Write a two-line customer apology message for a delayed order on 2025-06-10, without mentioning prices or the reason for the delay.
- **note**: تمت صياغة البرومبت بوضوح مع الحفاظ على شرط الطول (سطرين) والاستثناءات.
- **usage**: `{"total_tokens":576,"total_input_tokens":451,"input_tokens_by_modality":[{"modality":"text","tokens":451}],"total_cached_tokens":0,"total_output_tokens":125,"total_tool_use_tokens":0,"total_thought_tokens":0,"raw_prompt_token":576,"model_invocation_token_counts":[{"prompt_tokens_details":[{"modality":"text","tokens":576}],"candidates_tokens_details":[{"modality":"text","tokens":143}]}],"non_grounding_model_invocation_token_counts":[{"prompt_tokens_details":[{"modality":"text","tokens":576}],"candidates_tokens_details":[{"modality":"text","tokens":143}]}]}`
- **كيانات مفقودة**: لا شيء

## تلخيص تقرير (مصرية + عدد + متغير + نفي)

> عايز تلخص التقرير ده في ٣ نقاط بس، من غير توقعات، واحتفظ بـ {order_id}.

### old — gemini-3.5-flash-lite

- **arabic**: تلخص التقرير ده في ٣ نقاط بس، من غير أي توقعات، واحتفظ بـ {order_id}.
- **english**: Summarize this report in exactly 3 bullet points without making any assumptions or predictions. Retain the {order_id}.
- **note**: تمت إزالة الحشو وتوضيح شروط التلخص بدقة باللغتين.
- **usage**: `{"total_tokens":353,"total_input_tokens":259,"input_tokens_by_modality":[{"modality":"text","tokens":259}],"total_cached_tokens":0,"total_output_tokens":94,"total_tool_use_tokens":0,"total_thought_tokens":0,"raw_prompt_token":384,"model_invocation_token_counts":[{"prompt_tokens_details":[{"modality":"text","tokens":384}],"candidates_tokens_details":[{"modality":"text","tokens":112}]}],"non_grounding_model_invocation_token_counts":[{"prompt_tokens_details":[{"modality":"text","tokens":384}],"candidates_tokens_details":[{"modality":"text","tokens":112}]}]}`
- **كيانات مفقودة**: لا شيء

### new — gemini-3.5-flash-lite

- **arabic**: تلخيص التقرير في ٣ نقاط رئيسية فقط، بدون أي توقعات أو افتراضات، مع الاحتفاظ بالمعرف {order_id}.
- **english**: Summarize this report into exactly 3 key points without any assumptions or speculations, while retaining {order_id}.
- **note**: تمت إعادة صياغة البرومبت بدقة مع الحفاظ على شرط النقاط الثلاث والمتغير.
- **usage**: `{"total_tokens":536,"total_input_tokens":438,"input_tokens_by_modality":[{"modality":"text","tokens":438}],"total_cached_tokens":0,"total_output_tokens":98,"total_tool_use_tokens":0,"total_thought_tokens":0,"raw_prompt_token":563,"model_invocation_token_counts":[{"prompt_tokens_details":[{"modality":"text","tokens":563}],"candidates_tokens_details":[{"modality":"text","tokens":116}]}],"non_grounding_model_invocation_token_counts":[{"prompt_tokens_details":[{"modality":"text","tokens":563}],"candidates_tokens_details":[{"modality":"text","tokens":116}]}]}`
- **كيانات مفقودة**: لا شيء

## تحويل JSON (فصحى + قيم)

> حوّل البيانات {"count":2,"ratio":"٥٠٪"} إلى جدول من عمودين دون تغيير القيم.

### old — gemini-3.5-flash-lite

- **arabic**: حوّل البيانات {"count":2,"ratio":"٥٠٪"} إلى جدول من عمودين دون تغيير القيم.
- **english**: Convert the data {"count":2,"ratio":"50%"} into a two-column table without altering the values.
- **note**: تم الحفاظ على المعنى وصياغة الطلب بشكل دقيق ومباشر.
- **usage**: `{"total_tokens":338,"total_input_tokens":246,"input_tokens_by_modality":[{"modality":"text","tokens":246}],"total_cached_tokens":0,"total_output_tokens":92,"total_tool_use_tokens":0,"total_thought_tokens":0,"raw_prompt_token":371,"model_invocation_token_counts":[{"prompt_tokens_details":[{"modality":"text","tokens":371}],"candidates_tokens_details":[{"modality":"text","tokens":110}]}],"non_grounding_model_invocation_token_counts":[{"prompt_tokens_details":[{"modality":"text","tokens":371}],"candidates_tokens_details":[{"modality":"text","tokens":110}]}]}`
- **كيانات مفقودة**: {"count":2,"ratio":"50٪"}

### new — gemini-3.5-flash-lite

- **arabic**: حوّل بيانات كائن JSON التالي {"count":2,"ratio":"٥٠٪"} إلى جدول مكون من عمودين، مع الالتزام التام بعدم تغيير أي من القيم الأصلية.
- **english**: Convert the following JSON data {"count":2,"ratio":"٥٠٪"} into a two-column table without modifying any of the original values.
- **note**: تم تحسين ووضوح البرومبت مع الحفاظ على البيانات والمتغيرات بدقة.
- **usage**: `{"total_tokens":549,"total_input_tokens":433,"input_tokens_by_modality":[{"modality":"text","tokens":433}],"total_cached_tokens":0,"total_output_tokens":116,"total_tool_use_tokens":0,"total_thought_tokens":0,"raw_prompt_token":558,"model_invocation_token_counts":[{"prompt_tokens_details":[{"modality":"text","tokens":558}],"candidates_tokens_details":[{"modality":"text","tokens":134}]}],"non_grounding_model_invocation_token_counts":[{"prompt_tokens_details":[{"modality":"text","tokens":558}],"candidates_tokens_details":[{"modality":"text","tokens":134}]}]}`
- **كيانات مفقودة**: لا شيء

## إجمالي usage

| variant | input | output | total |
| ------- | ----- | ------ | ----- |
| old     | 777   | 308    | 1085  |
| new     | 1322  | 339    | 1661  |

## تقييم يدوي للنتائج

| الحالة           | old (إنجليزية + تلميح لهجة)                                                                                     | new (عربية، بلا تلميح)                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| apology-gulf     | حفظ اللهجة (أبي/بس/بدون ما) لكن **غيّر شكل التاريخ**: `٢٠٢٥-٠٦-١٠` → `10-06-2025` (ترتيب مقلوب، التباس يوم/شهر) | تاريخ سليم + كل القيود والنفي، لكن صاغ بفصحى («اكتب») — خالف قاعدة «أسلوب المستخدم»                          |
| summary-egyptian | حفظ المصرية والكيانات؛ أبقى حشواً («ده»، «بس»، «واحتفظ»)                                                        | فصحى نظيفة، كيانات سليمة؛ أسقط علامات اللهجة كلها — المخرج أقرب لبرومبت نظيف لكن أقل التزاماً بقاعدة الأسلوب |
| json-msa         | أعاد النص العربي **كما هو دون تحسين**؛ النسخة الإنجليزية حوّلت `٥٠٪` → `50%` (تغيير شكل)                        | برومبت أوضح، حافظ على JSON كاملاً بما فيه `٥٠٪` حرفياً، لكن الناتج أطول من الأصل                             |

**الخلاصة الاتجاهية (n=3، عينة واحدة لكل حالة — لا إحصاء):**

- حفظ الكيانات والقيود: **new نظيف 3/3**؛ old خالف في التاريخ (حالة 1) وشكل النسبة (حالة 3، على نسخة English).
- أسلوب العربية: old أبقى اللهجة حيث نجح تخمينها (التلميح الصريح ساعد النموذج الصغير)؛ new مالت للفصحى في 2/3 رغم قاعدة «بأسلوب المستخدم» — ضعف تعليمة أو محدودية نموذج، يُعالج بتشديد القاعدة ثم إعادة مقارنة.
- إيجاز المخرج: مخرجات old أقصر؛ new أصقل لكن أطول (حالة 3 توسّعت رغم أن الأصل موجز).
- تكلفة الاستدعاء: input الجديد أعلى ~70% (1661 مقابل 1085 إجمالاً) لأن التعليمة العربية أطول من الإنجليزية.
- قيود التجربة: كل الاستدعاءات على `gemini-3.5-flash-lite` (3.8-flash كان 503 وقت التشغيل)؛ التلميح القديم مُعاد بناؤه لأن نسخته لم تُحفظ في git؛ النموذج الافتراضي للإنتاج `gemini-3.8-flash` قد يعطي نتائج مختلفة.
