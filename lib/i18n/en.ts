/**
 * English UI strings, keyed by the Arabic source text used in code.
 * i18n-coverage.test.ts keeps this file and the code in lockstep: every
 * t()/tx() key must have an entry here, and no entry may be stale.
 */
export const EN: Record<string, string> = {
  // agent-card
  "يفحص الجسر…": "Checking the bridge…",
  "الوكيل يعمل…": "The agent is working…",
  اكتمل: "Done",
  فشل: "Failed",
  "الجسر غير متصل": "Bridge offline",
  "نتيجة الوكيل": "Agent result",
  " · مباشر": " · live",
  "رمز خروج العملية": "Process exit code",
  "مجلد تشغيل الجسر — لم تُحدَّد مساحة عمل في الإعدادات":
    "Bridge working folder — no workspace set in settings",
  "ثقة لهذه التشغيلة": "Trusted for this run",
  "تعذّر الوصول إلى الجسر المحلي.": "Could not reach the local bridge.",
  "شغّل الجسر بأمر": "Start the bridge with",
  "ثم أدخل العنوان والتوكن في الإعدادات — أو انسخ الأمر الجاهز:":
    "then enter its address and token in Settings — or copy the ready-made command:",
  "نسخ أمر التشغيل للصقه في الطرفية":
    "Copy the command to paste into a terminal",
  "أنهى الوكيل دون مخرجات نصية.": "The agent finished without any text output.",
  "تظهر مخرجات الوكيل هنا…": "The agent's output appears here…",
  "تُترجم…": "Translating…",
  "ترجمة النتيجة إلى العربية": "Translate the result to Arabic",
  "الترجمة العربية": "Arabic translation",
  "تعذّرت الترجمة عبر Gemini{reason}؛ النتيجة الإنجليزية معروضة أعلاه كما هي — جرّب مفتاحك في الإعدادات.":
    "Translation through Gemini failed{reason}; the English result is shown above as is — try your own key in Settings.",
  // agent-composer
  "تعذّرت المعالجة — النص كما هو، أعد المحاولة.":
    "Processing failed — your text is unchanged, try again.",
  "لا توجد نسخة إنجليزية لهذا التحليل (الوضع المحلي أو حجبها فحص السلامة) — الوكلاء يستقبلون الإنجليزية فقط.":
    "There is no English version for this analysis (local mode, or the safety check blocked it) — agents only receive English.",
  "عولج وأُرسل مباشرة إلى {label}{delta}.":
    "Processed and sent straight to {label}{delta}.",
  " — {n} توكن": " — {n} tokens",
  "جاهز{delta}. راجع الإنجليزية أو عدّلها ثم أرسل.":
    "Ready{delta}. Review the English or edit it, then send.",
  ": {n} توكن": ": {n} tokens",
  "أُرسل إلى {label} — الأصل والإنجليزية في سجل IN / OUT.":
    "Sent to {label} — the original and the English are in the IN / OUT log.",
  "عاد نصك الأصلي — عدّله ثم عالجه من جديد.":
    "Your original text is back — edit it and process again.",
  "يعالج…": "Processing…",
  "مدخل {label}": "{label} input",
  "جاهز — English": "Ready — English",
  "مسودة — بلغتك": "Draft — your language",
  "إرسال مباشرة بعد المعالجة": "Send right after processing",
  "تلقينة {label}": "{label} prompt",
  "اكتب تلقينتك لـ {label} بلغتك هنا":
    "Write your prompt for {label} here, in your language",
  "الأصل:": "Original:",
  "{label} ما زال يعمل على دورة سابقة":
    "{label} is still working on a previous turn",
  "إرسال إلى {label}": "Send to {label}",
  "إخفاء الأصل": "Hide original",
  "عرض الأصل": "Show original",
  تراجع: "Undo",
  "معالجة وإرسال إلى {label}": "Process and send to {label}",
  معالجة: "Process",
  // agent-session-log
  "انقطع الالتقاط بتحديث الصفحة — الرد في الطرفية أعلاه.":
    "Capture was interrupted by a page reload — the reply is in the terminal above.",
  "مجلد {label} غير مفحوص بعد": "{label}'s folder has not been checked yet",
  "لم يُحدَّد مجلد مشروع لـ {label}": "No project folder is set for {label}",
  "— لا يُرسل إليه شيء قبل الخطوة ①.": "— nothing is sent to it before step ①.",
  "افتح تبويب {label}": "Open the {label} tab",
  "مشروع مختلف — النص سيُنفَّذ في مشروع {label}:":
    "Different project — the text will run in {label}'s project:",
  "النصوص المحددة أُرسلت في أكثر من مشروع — ستُنفَّذ كلها في مشروع {label}:":
    "The selected texts were sent in more than one project — they will all run in {label}'s project:",
  "أعلم أن النص سيُنفَّذ في مشروع {label}":
    "I understand the text will run in {label}'s project",
  "— المشروع نفسه.": "— the same project.",
  "ستبدأ جلسة {label} تلقائياً عند الإرسال.":
    "A {label} session will start automatically when you send.",
  "{label} يعمل على دورة الآن — تُرسل النصوص بعد انتهائها، بالترتيب.":
    "{label} is busy with a turn — the texts are sent after it finishes, in order.",
  "حدّد الدورة {n} لإعادة إرسالها": "Select turn {n} to re-send it",
  العربية: "Arabic",
  "نصك الأصلي": "Your original text",
  "اطوِ إلى عرض العمودين": "Collapse back to two columns",
  "وسّع النص الإنجليزي": "Expand the English text",
  "وسّع النص العربي": "Expand the Arabic text",
  "وسّع هذا الصندوق فوق العربية": "Expand this box over the Arabic one",
  "وسّع هذا الصندوق فوق الإنجليزية": "Expand this box over the English one",
  "تظهر الدورات هنا مرقّمة.": "Turns appear here, numbered.",
  "من اليمين إلى اليسار": "Right-to-Left",
  "كما كتبته": "As you wrote it",
  "بانتظار رد الوكيل…": "Waiting for the agent's reply…",
  "أعد الترجمة": "Translate again",
  ترجمة: "Translate",
  "تعذّرت الترجمة ({error})": "Translation failed ({error})",
  "الترجمة التلقائية في الطريق": "Automatic translation is on its way",
  "لا دورات بعد مع {label}": "No turns yet with {label}",
  "{n} دورة مع {label} — تُمحى بإغلاق المتصفح":
    "{n} turn with {label} — cleared when the browser closes",
  "{n} دورات مع {label} — تُمحى بإغلاق المتصفح":
    "{n} turns with {label} — cleared when the browser closes",
  "أعد إرسال نصوص سبق إرسالها إلى وكيل آخر — بلا معالجة جديدة":
    "Re-send texts you already sent to another agent — no new processing",
  "إلغاء الإرسال": "Cancel sending",
  "إرسال أيضاً": "Also send",
  "مسح {label}": "Clear {label}",
  "مسح الكل": "Clear all",
  "حدّد النصوص الإنجليزية التي تريد إرسالها إلى وكيل آخر.":
    "Select the English texts you want to send to another agent.",
  "نص محدد": "text selected",
  "نصوص محددة": "texts selected",
  "— إلى": "— to",
  "الوكيل المستلم": "Receiving agent",
  "ترجمة من العربية إلى الإنجليزية": "Your text, rewritten in English",
  "ترجمة من الإنجليزية إلى العربية": "The reply, translated for you",
  "العربية ← الإنجليزية": "Your text → English",
  "الإنجليزية ← العربية": "English → your language",
  // agent-tabs
  "لم يعمل بعد": "Not run yet",
  "يعمل الآن": "Running now",
  "وكلاء CLI": "CLI agents",
  "الوكيل الافتراضي — تبويبه يُفتح أولاً، ويُحدَّد من الإعدادات":
    "Default agent — its tab opens first; chosen in Settings",
  الافتراضي: "Default",
  مدعوم: "Supported",
  "مدعوم تلقائياً": "Automatic",
  "غير مربوط": "Not wired",
  "غير مدعوم": "Unsupported",
  "لا يحتاج تفعيلاً": "Nothing to enable",
  "لا يسأل هذا الوكيل عن ثقة المجلد أصلاً — لا شيء لتفعيله":
    "This agent never asks whether to trust a folder — nothing to enable",
  "الوكيل يملك الآلية ولم تُربط بـTOSO بعد":
    "The agent has the mechanism, but TOSO has not wired it yet",
  "آلية الثقة موجودة لدى الوكيل لكنها غير مربوطة بـTOSO بعد":
    "The agent has a trust mechanism, but TOSO has not connected it yet",
  "اختياري — يُفتح بعد فحص المجلد": "Optional — unlocks after the folder check",
  "اختياري — مُفعّل": "Optional — enabled",
  "ثقة دائمة": "Permanent trust",
  "موثوق دائماً": "Trusted permanently",
  "اختياري — اضغط للتفعيل": "Optional — press to enable",
  "يكتب في ملف إعدادات الوكيل نفسه — أثره يشمل جلساتك اليدوية خارج TOSO أيضاً":
    "Writes to the agent's own settings file — it also affects your manual sessions outside TOSO",
  "هذا الوكيل لا يملك ملف ثقة معروفاً — ثقته تُدار من داخله":
    "This agent has no known trust file — its trust is managed from inside",
  "لا ملف ثقة لديه — أجب سؤال الثقة داخل الطرفية":
    "It has no trust file — answer the trust question in the terminal",
  "ثقة لكل تشغيلة": "Per-run trust",
  "ثقة لكل تشغيلة: مفعّلة": "Per-run trust: enabled",
  "اختياري — يسري عند إعادة التشغيل": "Optional — applies on restart",
  "اختياري — اضغط للتبديل": "Optional — press to toggle",
  "مفتاح مؤقت يُزرع في عملية الوكيل ويموت معها — لا يُكتب أي ملف":
    "A temporary switch planted in the agent's process that dies with it — no file is written",
  "لا يملك هذا الوكيل متغير ثقة موثقاً لكل تشغيلة":
    "This agent has no documented per-run trust variable",
  "لا متغير مؤقت لديه — استخدم ② أو أجب داخل الطرفية":
    "No temporary variable — use ② or answer in the terminal",
  "مشروع {label}": "{label} project",
  "اكتب مسار مجلد المشروع المستهدف، ثم ابدأ بالخطوة ①.":
    "Type the path of the target project folder, then start with step ①.",
  "كل تشغيل وكل طرفية لهذا الوكيل تبدأ داخل هذا المجلد — ولا تتأثر بمشاريع الوكلاء الآخرين.":
    "Every run and every terminal for this agent starts inside this folder — other agents' projects don't affect it.",
  "افحص المجلد أولاً — الفحص يفتح بقية الخطوات.":
    "Check the folder first — the check unlocks the other steps.",
  "إعداد {label}": "{label} setup",
  مفحوص: "Checked",
  "فحص المجلد": "Check folder",
  إلزامي: "Required",
  "يفحص أن المجلد موجود على جهازك قبل التشغيل":
    "Checks that the folder exists on your machine before running",
  "المجلد موجود — {label} سيعمل داخل: {v2}":
    "The folder exists — {label} will work inside: {v2}",
  "المجلد موثوق مسبقاً لدى {label} — لم يتغير شيء.":
    "The folder was already trusted by {label} — nothing changed.",
  "سُجّل المجلد موثوقاً دائماً في {file}.":
    "The folder was recorded as permanently trusted in {file}.",
  "ملف ثقة الوكيل": "the agent's trust file",
  "الجلسة تعمل": "Session running",
  "تبدأ…": "Starting…",
  "تشغيل الجلسة": "Start session",
  "طرفية مدمجة غير متاحة — تشغيل أحادي":
    "Embedded terminal unavailable — one-shot run",
  "إيقاف وإعادة التشغيل من رأس الطرفية":
    "Stop and restart from the terminal header",
  "الخطوة الأخيرة": "Last step",
  "يشغّل واجهة الوكيل التفاعلية داخل المجلد المفحوص":
    "Starts the agent's interactive UI inside the checked folder",
  "نافذة PowerShell خارجية منفصلة — جلسة أخرى لا تشارك سياق الطرفية المدمجة، ولا يقرؤها TOSO":
    "A separate external PowerShell window — a different session that doesn't share the embedded terminal's context, and TOSO doesn't read it",
  "يفتح…": "Opening…",
  "أو افتح نافذة خارجية منفصلة": "Or open a separate external window",
  // agent-terminal
  "غير مشغّلة": "Not started",
  حيّة: "Live",
  انتهت: "Ended",
  "غير متاحة": "Unavailable",
  "تعذّر التشغيل": "Could not start",
  "{v1} غير مثبّت أو غير موجود في PATH.":
    "{v1} is not installed or not on PATH.",
  "انتهت الجلسة (exit {v1}) — أعد التشغيل لمتابعة العمل.":
    "The session ended (exit {v1}) — restart it to keep working.",
  "انقطع البث من الجسر — أعد تشغيل الجسر أو الجلسة.":
    "The stream from the bridge was cut — restart the bridge or the session.",
  "افحص مجلد المشروع أولاً — الخطوة ① أعلى هذه اللوحة — فالجلسة لا تبدأ قبل نجاح الفحص.":
    "Check the project folder first — step ① above this panel — the session won't start before the check passes.",
  "الطرفيات المدمجة غير متاحة على هذا الجسر (node-pty) — يُستخدم التشغيل الأحادي بدلها.":
    "Embedded terminals aren't available on this bridge (node-pty) — one-shot runs are used instead.",
  "الجسر غير متصل — شغّله بأمر npm run bridge.":
    "The bridge is offline — start it with npm run bridge.",
  "توكن الجسر مرفوض — راجع الإعدادات.":
    "The bridge token was rejected — check Settings.",
  "مجلد المشروع مرفوض{v1}.": "The project folder was rejected{v1}.",
  "الجسر وصل حدّه الأقصى (8 جلسات حيّة) — الجلسات تبقى بعد إغلاق الصفحة. أنهِ جلسة لا تحتاجها من قسم «جلسات الجسر» أعلاه ثم أعد المحاولة.":
    "The bridge reached its limit (8 live sessions) — sessions outlive the page. End one you don't need from the “Bridge sessions” section above, then try again.",
  "تعذّر تشغيل الجلسة{v1}.": "Could not start the session{v1}.",
  "{v1} ينتظر قراراً منك في الطرفية أعلاه ({decision}) — أجب عليه ثم أعد الإرسال.":
    "{v1} is waiting for your decision in the terminal above ({decision}) — answer it, then send again.",
  "دورة سابقة لهذا الوكيل لم تنتهِ بعد.":
    "A previous turn for this agent hasn't finished yet.",
  "الجلسة غير حيّة.": "The session is not live.",
  "{v1} ينتظر قراراً منك في الطرفية أعلاه ({late}) — أجب عليه ثم أعد الإرسال.":
    "{v1} is waiting for your decision in the terminal above ({late}) — answer it, then send again.",
  "{v1} ينتظر قراراً منك في الطرفية أعلاه ({pending}) — أجب عليه ثم أعد الإرسال.":
    "{v1} is waiting for your decision in the terminal above ({pending}) — answer it, then send again.",
  "{v1} لم يستلم النص — بقي في خانة الإدخال دون إرسال. اضغط Enter في الطرفية أعلاه أو أعد الإرسال.":
    "{v1} didn't take the text — it stayed in the input box unsent. Press Enter in the terminal above or send again.",
  "{label} — طرفية تفاعلية": "{label} — interactive terminal",
  "اعتبر الرد مكتملاً والتقطه الآن":
    "Treat the reply as complete and capture it now",
  "يلتقط الرد… التقط الآن": "Capturing the reply… capture now",
  "إعادة تشغيل": "Restart",
  "ينهي جلسة هذا التبويب فقط (يُغلق الوكيل) — الجلسات الأخرى لا تتأثر":
    "Ends only this tab's session (the agent is closed) — other sessions are unaffected",
  "إنهاء الجلسة": "End session",
  "مسار المشروع تغيّر منذ بدء الجلسة — أعد التشغيل لتطبيقه.":
    "The project path changed since the session started — restart to apply it.",
  "الجلسة غير مشغّلة — اضغط «④ تشغيل الجلسة» أعلاه، أو أرسل نصاً من مدخل الوكيل أدناه فتبدأ تلقائياً.":
    "The session isn't started — press “④ Start session” above, or send text from the agent's input below and it will start automatically.",
  "الجلسة غير مشغّلة — ابدأ بالخطوة ① «فحص» أعلاه.":
    "The session isn't started — begin with step ① “Check” above.",
  // agent-view-tabs
  التيرمينال: "Terminal",
  "الطرفية الحيّة للوكيل": "The agent's live terminal",
  "سجل IN": "IN log",
  "ما أُرسل إلى الوكيل — بلغتك وبالإنجليزية":
    "What was sent to the agent — in your language and in English",
  "سجل OUT": "OUT log",
  "ما ردّ به الوكيل — بالإنجليزية وبلغتك":
    "What the agent replied — in English and in your language",
  "عروض الوكيل": "Agent views",
  "رد جديد لم تقرأه": "New reply you haven't read",
  // arabic-on-demand
  "عرض النسخة العربية": "Show the Arabic version",
  "تعذّرت الترجمة عبر Gemini{reason}؛ النسخة الإنجليزية هي المعتمدة للإرسال على أي حال.":
    "Translation through Gemini failed{reason}; the English version is the one sent anyway.",
  "النسخة العربية (للقراءة فقط — لا تُرسل)":
    "Arabic version (read-only — never sent)",
  // bridge-badge
  "الجسر المحلي متصل — اضغط لعرض جلساته":
    "The local bridge is connected — press to see its sessions",
  قديم: "outdated",
  "الجسر يعمل لكنه أقدم من ميزة عرض الجلسات — أعد تشغيله":
    "The bridge works but is older than the sessions view — restart it",
  "توكن مرفوض": "token rejected",
  "توكن الجسر مرفوض — راجع الإعدادات":
    "The bridge token was rejected — check Settings",
  "غير متصل": "offline",
  "الجسر غير متصل — شغّله بـ npm run bridge":
    "The bridge is offline — start it with npm run bridge",
  // bridge-sessions
  "جلسات الجسر": "Bridge sessions",
  "حيّة {live}/{max}": "live {live}/{max}",
  " — ممتلئ": " — full",
  "الجسر الحالي بإصدار أقدم لا يعرض جلساته — أعد تشغيله (npm run dev:all بعد إيقاف الجسر القديم).":
    "The current bridge is an older version and can't list its sessions — restart it (npm run dev:all after stopping the old bridge).",
  "الجسر غير متصل.": "The bridge is offline.",
  "تبقى بعد إغلاق الصفحة وإعادة تشغيل المشروع":
    "They outlive the page and a project restart",
  "الجلسات الحية": "Live sessions",
  "لا جلسات حيّة على الجسر.": "No live sessions on the bridge.",
  متصلة: "Connected",
  "الاتصال بالجلسة": "Connect to session",
  "يُغلق الوكيل في هذه الجلسة": "Closes the agent in this session",
  "و{n} جلسات حيّة أخرى لا تُعرض.": "and {n} more live sessions not shown.",
  "الجلسات المغلقة": "Closed sessions",
  "لا جلسات مغلقة مؤخراً.": "No recently closed sessions.",
  "يبدأ جلسة جديدة للوكيل في المجلد نفسه — محادثة الجلسة السابقة لا تُستعاد":
    "Starts a new session for the agent in the same folder — the previous conversation is not restored",
  "فتح الجلسة": "Open session",
  "و{n} جلسات مغلقة أقدم.": "and {n} older closed sessions.",
  // gemini-key-guide
  "الانتقال إلى صفحة المفاتيح": "Go to the keys page",
  "افتح صفحة المفاتيح في": "Open the keys page in",
  "وسجّل الدخول بحساب Google إن طُلب منك.":
    "and sign in with your Google account if asked.",
  "ابدأ الإنشاء": "Start creating",
  "اضغط زر": "Press the button",
  "في الزاوية العلوية من الصفحة.": "at the top of the page.",
  "إعداد المفتاح": "Set up the key",
  "ستظهر نافذة": "You'll see the window",
  "أدخل اسماً للمفتاح (اختياري).": "Enter a name for the key (optional).",
  "اختر مشروعك الحالي، أو اضغط": "Pick your current project, or press",
  "إن لم يكن لديك مشروع — ستفتح نافذة": "if you don't have one — the window",
  ": أضف الاسم ثم اضغط": "opens: add the name, then press",
  اضغط: "Press",
  "انسخ وألصق": "Copy and paste",
  "انسخ المفتاح الظاهر لك — يبدأ عادةً بـ":
    "Copy the key shown — it usually starts with",
  "— ثم ألصقه في حقل «مفتاح Gemini» هنا؛ يعمل فوراً وتُحمَّل طلباتك على حصتك.":
    "— then paste it into the “Gemini key” field here; it works immediately and your requests use your own quota.",
  "كيف أحصل على مفتاح مجاني؟": "How do I get a free key?",
  "يُخزَّن المفتاح محلياً في متصفحك (":
    "The key is stored locally in your browser (",
  ") فقط.": ") only.",
  "يُرسل مع طلباتك إلى خادمك المحلي دون تسجيله أو تخزينه في الخادم.":
    "It is sent with your requests to your local server without being logged or stored there.",
  "إذا تُرك فارغاً يُعتمد تلقائياً على مفتاح الخادم إن وُجد، وإلا تعمل التنقية المحلية.":
    "If left empty, the server key is used when there is one; otherwise only the local cleanup runs.",
  // language-toggle
  "لغة الواجهة": "Interface language",
  // measure-gauges
  مجاني: "free",
  "{label}: {value} توكن من {max}": "{label}: {value} tokens of {max}",
  "{label}: لا قياس بعد": "{label}: not measured yet",
  "عدّادات القياس": "Measurement gauges",
  الأصل: "Original",
  الناتج: "Output",
  "يقيس…": "Measuring…",
  "اكتب في مدخل أي وكيل ثم «معالجة» لتتحرك العدّادات.":
    "Type in any agent's input and press “Process” to move the gauges.",
  "مصدر عدّ الأصل غير مصدر عدّ الناتج — النسبة غير محسوبة.":
    "The original and the output were counted by different sources — no percentage is computed.",
  "أرقام تقديرية — لا قياس حقيقي من Gemini في هذا التشغيل.":
    "Estimated numbers — no real measurement from Gemini in this run.",
  "تكلفة الإرسال قبل": "Send cost before",
  "تكلفة الإرسال بعد": "Send cost after",
  "لا كيانات تحتاج حماية": "No entities needing protection",
  "الكيانات محفوظة ({v1})": "Entities preserved ({v1})",
  "كيانات ناقصة": "Entities missing",
  "فحص الجودة: اجتاز": "Quality check: passed",
  "فحص الجودة: تنبيه": "Quality check: warning",
  // optimizer-workspace
  "لم يُرسَل شيء: الوكلاء يستقبلون الإنجليزية فقط (لتقليل التوكنز)، وهذا النص ليس إنجليزياً — عالجه أولاً من مدخل الوكيل.":
    "Nothing was sent: agents only receive English (to save tokens) and this text isn't English — process it first from the agent's input.",
  "افحص مجلد مشروع {label} أولاً (الخطوة ①) — نافذة خارجية بلا مجلد مفحوص قد تعمل على مجلد TOSO نفسه.":
    "Check {label}'s project folder first (step ①) — an external window without a checked folder might run in TOSO's own folder.",
  "فُتحت نافذة خارجية لـ {label} — جلسة منفصلة عن الطرفية المدمجة، لا يقرؤها TOSO.":
    "An external window was opened for {label} — a session separate from the embedded terminal that TOSO doesn't read.",
  "يقيس الـTokens…": "Counting tokens…",
  "يفهم ويعيد الصياغة…": "Understanding and rewriting…",
  "يقيس الناتج…": "Measuring the output…",
  "{v1} يعمل على دورة في هذا التبويب — انتظر انتهاءها ثم اتصل بالجلسة.":
    "{v1} is busy with a turn in this tab — wait for it to finish, then connect to the session.",
  "الجلسة لم تعد حيّة على الجسر.":
    "The session is no longer live on the bridge.",
  "تعذّر فتح الجلسة: {v1}": "Could not open the session: {v1}",
  "{v1} يعمل على دورة في هذا التبويب — انتظر انتهاءها ثم افتح الجلسة.":
    "{v1} is busy with a turn in this tab — wait for it to finish, then open the session.",
  "تعذّر إكمال التحليل. نصك ما زال في مدخل الوكيل؛ أعد المحاولة.":
    "The analysis could not finish. Your text is still in the agent's input; try again.",
  "لم يُرسَل النص: افحص مجلد مشروع {v1} أولاً — الخطوة ① «فحص المجلد».":
    "The text was not sent: check {v1}'s project folder first — step ① “Check folder”.",
  "لم يُرسَل النص: حدّد مجلد مشروع {v1} ثم افحصه — الخطوة ①.":
    "The text was not sent: set {v1}'s project folder, then check it — step ①.",
  "مجلد مشروع هذا الوكيل مرفوض{v1} — صحّحه من تبويبه.":
    "This agent's project folder was rejected{v1} — fix it in its tab.",
  "التوكن غير صحيح — انسخ التوكن الذي طبعه الجسر عند تشغيله إلى الإعدادات.":
    "The token is wrong — copy the token the bridge printed at startup into Settings.",
  "عنوان الجسر غير صالح في الإعدادات.":
    "The bridge address in Settings is not valid.",
  "الجسر غير متصل على هذا العنوان.":
    "The bridge is not reachable at this address.",
  "انقطع الاتصال بالجسر أثناء التشغيل.":
    "The connection to the bridge dropped during the run.",
  "انتهت مهلة الالتقاط — الرد الكامل في الطرفية أعلاه.":
    "Capture timed out — the full reply is in the terminal above.",
  "لم يُلتقط رد نصي — راجع الطرفية أعلاه.":
    "No text reply was captured — check the terminal above.",
  "تعذّر الإرسال إلى الطرفية.": "Could not send to the terminal.",
  الإعدادات: "Settings",
  "مُحسّن التلقينة العربية": "Prompt Optimizer",
  "TOSO — قياس وتقليص تكلفة التلقينة / Prompt Workbench":
    "TOSO — measure and cut your prompt's token cost / Prompt Workbench",
  "تعذّر الوصول إلى تخزين المتصفح؛ لا يمكن ضمان حفظ المفتاح أو مسحه بعد إغلاق الصفحة. يمكنك المتابعة في هذه الجلسة.":
    "Browser storage is unavailable; saving or clearing the key can't be guaranteed after the page closes. You can continue in this session.",
  "وكيل CLI": "CLI agent",
  "اكتب في تبويب الوكيل، عالج، ثم أرسل — الوكيل يستلم الإنجليزية فقط":
    "Write in the agent's tab, process, then send — the agent only receives English",
  العدّاد: "Gauges",
  "قبل المعالجة وبعدها — الخلاصة": "Before and after processing — the summary",
  " · مفتاحك": " · your key",
  محلي: "Local",
  "بطاقة لغة المستخدم": "Your language",
  "النسخة المنقّحة بلغتك من آخر معالجة — للقراءة والنسخ":
    "The polished version in your language from the last run — to read and copy",
  "تظهر هنا النسخة المنقّحة بلغتك بعد المعالجة":
    "The polished version in your language appears here after processing",
  "تنقية محلية": "Local cleanup",
  "حُجبت النسخة العربية لأن مخرج Gemini لم يجتز فحوص السلامة؛ عُرض النص المنقّى محلياً.":
    "The Arabic version was withheld because Gemini's output failed the safety checks; the locally cleaned text is shown.",
  "الترجمة العربية غير متاحة في الوضع المحلي أو عند تعذّر Gemini.":
    "The Arabic version isn't available in local mode or when Gemini fails.",
  "التعليمات والتفاصيل": "Instructions and details",
  "نتائج المحطات والتحليل والتكلفة لآخر معالجة":
    "Stage results, analysis and cost for the last run",
  "نتائج المحطات": "Stage results",
  "قياس الأصل": "Measuring the original",
  "Token Analysis — قياس النص الأصلي":
    "Token Analysis — measuring the original text",
  "Tokens حقيقية": "Real tokens",
  "Tokens تقديرية": "Estimated tokens",
  كلمة: "words",
  حرف: "characters",
  "نسبة العربية": "Arabic share",
  "ستظهر قياسات النص الأصلي هنا":
    "The original text's measurements appear here",
  المعالجة: "Processing",
  "تنقية محلية ثم إعادة صياغة عبر Gemini عند توفره":
    "Local cleanup, then a rewrite through Gemini when available",
  "يُنقّى النص محلياً، ويُنشئ Gemini النسخة الإنجليزية المختصرة عند توفره":
    "The text is cleaned locally, and Gemini produces the concise English version when available",
  التحليل: "Analysis",
  "تظهر خريطة الثقل وتفصيل التوفير هنا بعد أول معالجة":
    "The weight map and the savings breakdown appear here after the first run",
  التكلفة: "Cost",
  ملاحظات: "Notes",
  "لكل وكيل مدخله: ما تكتبه في تبويب وكيل يُرسل إليه هو. «معالجة» تستبدل مسودتك بالإنجليزية المختصرة، و«عرض الأصل» و«تراجع» يعيدانها حتى الإرسال.":
    "Each agent has its own input: what you write in an agent's tab goes to that agent. “Process” replaces your draft with the concise English; “Show original” and “Undo” bring it back until you send.",
  "الوكلاء يستلمون الإنجليزية فقط لتقليل التوكنز؛ نصك بلغتك يُحفظ في عمود لغتك من سجل IN / OUT.":
    "Agents only receive English to save tokens; your text in your own language is kept in your language's column of the IN / OUT log.",
  "«إرسال أيضاً» في السجل يعيد إرسال نصوص عولجت سابقاً إلى وكيل آخر — بلا معالجة جديدة ولا تكلفة إضافية.":
    "“Also send” in the log re-sends already-processed texts to another agent — no new processing and no extra cost.",
  "القياس عبر Gemini countTokens عند توفره، وإلا بتقدير محلي · مفتاحك يبقى في متصفحك.":
    "Measured with Gemini countTokens when available, otherwise a local estimate · your key stays in your browser.",
  "جارٍ المعالجة…": "Processing…",
  "مفتاح محفوظ لم يُفحص بعد — اضغط «تحقق» في الإعدادات":
    "A saved key that hasn't been checked yet — press “Verify” in Settings",
  "يعمل — آخر تشغيل أو فحص نجح على مفتاحك":
    "Working — your key's last run or check succeeded",
  "مرفوض من Google في آخر محاولة": "Rejected by Google on the last attempt",
  "حصة مفتاحك مستنزفة مؤقتاً": "Your key's quota is temporarily used up",
  "تعذّر الفحص — الشبكة أو الخادم": "Check failed — network or server",
  "معنى ألوان حالة المفتاح": "What the key status colors mean",
  "حالة مفتاحك المحفوظ": "Your saved key's status",
  "تُستكمل القياسات…": "Finishing the measurements…",
  "الناتج المحسّن سيظهر هنا": "The optimized output will appear here",
  عربي: "Arabic",
  "قياس حقيقي": "Real measurement",
  "BPE محلي": "Local BPE",
  تقدير: "Estimate",
  "نُسخ!": "Copied!",
  "تعذّر النسخ": "Copy failed",
  نسخ: "Copy",
  "خفيف · نحو 1": "Light · about 1",
  "متوسط · نحو 2–3": "Medium · about 2–3",
  "مرتفع · نحو 4+": "Heavy · about 4+",
  "خريطة ثقل المقاطع": "Segment weight map",
  "شاهد مواضع الثقل التقريبي في النص الأصلي والمخرجات، من دون إرسال كل مقطع إلى مزود الخدمة.":
    "See where the approximate weight sits in the original text and the outputs, without sending each segment to the provider.",
  "تقدير محلي": "Local estimate",
  "مفتاح ألوان الخريطة الحرارية": "Heat map color key",
  "{label} توكن لكل مقطع": "{label} tokens per segment",
  "النسخة العربية": "Arabic version",
  "النسخة الإنجليزية": "English version",
  "النص الأصلي": "Original text",
  "الألوان تقدير لطول المقطع ونوع حروفه، وليست تفكيكاً رسمياً من Gemini. لا تجمع تقديرات المقاطع لتطابق إجمالي countTokens؛ الأرقام الرسمية والتكلفة المعروضة أعلاه/أدناه منفصلة عن هذه الخريطة.":
    "The colors estimate a segment's length and script, not an official breakdown from Gemini. Don't add up segment estimates to match the countTokens total; the official numbers and the cost shown above/below are separate from this map.",
  "غير متاحة في هذا التشغيل؛ لا توجد خريطة لنص غير موجود.":
    "Not available in this run; there is no map for text that doesn't exist.",
  "{n} مقطع في المعاينة": "{n} segments in the preview",
  "{part} — نحو {tokens} توكن (تقدير محلي)":
    "{part} — about {tokens} tokens (local estimate)",
  "{part}: نحو {tokens} توكن بتقدير محلي":
    "{part}: about {tokens} tokens by local estimate",
  "لا توجد مقاطع قصيرة قابلة للمعاينة.": "No short segments to preview.",
  "معاينة محدودة: أول {n} مقطع ضمن 2000 حرف؛ بقية النص لم تُحلَّل بصرياً.":
    "Limited preview: the first {n} segments within 2000 characters; the rest of the text isn't analyzed visually.",
  "أثقل المقاطع في المعاينة": "Heaviest segments in the preview",
  "النسخة العربية غير متاحة للفحص.":
    "The Arabic version isn't available to check.",
  "النسخة الإنجليزية غير متاحة للفحص.":
    "The English version isn't available to check.",
  "تفصيل التوفير في توكنز الإدخال": "Input token savings breakdown",
  "مقارنة النص الأصلي بالمنقّح محلياً، ثم بالنسخة {lang} النهائية.":
    "Comparing the original text with the locally cleaned one, then with the final {lang} version.",
  الإنجليزية: "English",
  "التنقية المحلية": "Local cleanup",
  "إعادة صياغة Gemini": "Gemini rewrite",
  "تعديل إضافي محلي": "Extra local adjustment",
  "عرض النص بعد التنقية المحلية": "Show the text after local cleanup",
  "العربية نسخة مرافقة منقولة للمعنى؛ لا تُضاف وفوراتها إلى الإنجليزية.":
    "The Arabic is a companion version carried over by meaning; its savings are not added to the English's.",
  "الإنجليزية بديل مستقل مقارنة بالنص الأصلي؛ لا تُضاف وفوراتها إلى العربية.":
    "The English is an independent alternative compared with the original; its savings are not added to the Arabic's.",
  "فحص الكيانات والجودة الظاهرة": "Visible entity and quality checks",
  "رُفض مخرج Gemini لعدم اجتيازه فحوص السلامة المحلية. المعروض تنقية محلية، والترجمة محجوبة.":
    "Gemini's output was rejected for failing the local safety checks. A local cleanup is shown, and the translation is withheld.",
  "فحوص الكيانات والجودة تقيس عناصر ظاهرة قابلة للمطابقة (لغة، نفي، كلمات محتوى)؛ ليست ضماناً لحفظ المعنى أو جميع المتطلبات.":
    "The entity and quality checks measure visible, matchable elements (language, negation, content words); they don't guarantee that the meaning or every requirement was kept.",
  "لا يمكن حساب الفرق بدقة لاختلاف مصدر العد":
    "The difference can't be computed exactly because the counting sources differ",
  "توفير {saved} توكن ({percent}%)": "Saved {saved} tokens ({percent}%)",
  "زيادة {v1} توكن ({percent}%)": "Increased by {v1} tokens ({percent}%)",
  "لا تغير في عدد التوكنز": "No change in token count",
  "قياس بمصادر مختلفة: Gemini أو تقدير محلي":
    "Measured by different sources: Gemini or a local estimate",
  "{label} — فحص الجودة: ": "{label} — quality check: ",
  "سليم ظاهرياً — تغطية كلمات المحتوى ~{v1}%":
    "Looks fine — content-word coverage ~{v1}%",
  "سليم ظاهرياً": "Looks fine",
  "؛ ": "; ",
  "لا توجد كيانات مدعومة للفحص": "No supported entities to check",
  "لم يُرصد فقد في {v1} كيان قابل للفحص":
    "No loss detected across {v1} checkable entities",
  "تعذّر حفظ {v1} من {v2} كيان": "{v1} of {v2} entities were not preserved",
  "المفقود:": "Missing:",
  "، ": ", ",
  "مدخلات الاستدعاء": "Call inputs",
  المخرجات: "Outputs",
  التفكير: "Thinking",
  "المخزّن مؤقتاً": "Cached",
  "استخدام الأدوات": "Tool use",
  "الإجمالي حسب Gemini": "Total per Gemini",
  "استهلاك استدعاء التحسين الفعلي": "Actual usage of the optimization call",
  "حدث استدعاء Gemini فعلي، لكن حارس الكيانات رفض مخرجه؛ الأرقام تخص الاستدعاء المرفوض.":
    "A real Gemini call happened, but the entity guard rejected its output; the numbers belong to the rejected call.",
  "أرقام Gemini لهذا الاستدعاء الناجح فقط؛ مدخلاته تشمل تعليمات النظام، وليست عدّ التلقينة وحدها. الحقول التفصيلية لا تُجمع يدويًا؛ الإجمالي معروض كما أعاده Gemini.":
    "Gemini's numbers for this one successful call only; its inputs include the system instructions, so they are not the prompt's count alone. The detailed fields aren't summed by hand; the total is shown as Gemini returned it.",
  "لا تتوفر بيانات استهلاك فعلية لهذا التشغيل؛ لن نعرض رقماً مفترضاً.":
    "No actual usage data is available for this run; we won't show an assumed number.",
  "تقدير التكلفة أدناه يخص استخدام النص الناتج لاحقاً، وليس فاتورة هذا الاستدعاء. لا تشمل هذه الأرقام طلبات عدّ التوكنز أو المحاولات الأخرى.":
    "The cost estimate below is for using the resulting text later, not this call's bill. These numbers exclude token-counting requests and other attempts.",
  "تقدير تكلفة الإدخال · {model}": "Input cost estimate · {model}",
  "بدء جديد": "Start over",
  "توفير النسخة العربية يظهر مع الترجمة":
    "The Arabic version's savings appear with the translation",
  "توفير النسخة الإنجليزية يظهر مع الترجمة":
    "The English version's savings appear with the translation",
  "تختلف مصادر عد التوكنز بين المدخل والمخرج؛ أُخفيت نسبة التوفير لأنها غير قابلة للمقارنة بدقة.":
    "Token-counting sources differ between input and output; the savings percentage is hidden because it can't be compared exactly.",
  "يُحسب التقدير…": "Calculating the estimate…",
  "سيظهر تحليل التكلفة هنا بعد تشغيل التحسين":
    "The cost analysis appears here after an optimization run",
  قبل: "Before",
  بعد: "After",
  التوفير: "Savings",
  "مقياس حقيقي · {v1}": "Real measurement · {v1}",
  "تقدير BPE محلي": "Local BPE estimate",
  "تقدير تجريبي": "Heuristic estimate",
  // settings-modal
  محفوظ: "Saved",
  يعمل: "Working",
  مرفوض: "Rejected",
  "الحصة منتهية": "Quota used up",
  "تعذّر الفحص": "Check failed",
  "تأكد أنه منسوخ كاملاً من AI Studio ويبدأ بـ AQ.":
    "Make sure it was copied in full from AI Studio and starts with AQ.",
  "راجع حصتك في AI Studio.": "Check your quota in AI Studio.",
  "أعد المحاولة بعد قليل أو راجع الاتصال.":
    "Try again in a moment or check your connection.",
  تم: "Done",
  "مفتاح الخادم": "Server key",
  "يفحص…": "Checking…",
  "لا مفتاح": "No key",
  إغلاق: "Close",
  "المفتاح والوصول": "Key and access",
  "BYOK أو مفتاح الخادم": "BYOK or the server key",
  "مفتاح Gemini الخاص بك": "Your Gemini key",
  "اختياري — استخدم حصتك أنت (BYOK)": "Optional — use your own quota (BYOK)",
  "مفتاح AI Studio — يُحفظ في متصفحك فقط": "AI Studio key — browser only",
  تحقق: "Verify",
  مسح: "Clear",
  "يُفحص مفتاح الخادم…": "Checking the server key…",
  "يُستخدم مفتاح الخادم — لا حاجة لمفتاحك.":
    "The server key is in use — you don't need your own.",
  "لا مفتاح على الإطلاق — أضف مفتاحك هنا أو اضبط مفتاح الخادم، وإلا تعمل التنقية المحلية فقط.":
    "No key at all — add yours here or set the server key; otherwise only the local cleanup runs.",
  "تعذّر فحص مفتاح الخادم — الخادم غير متاح.":
    "Could not check the server key — the server is unavailable.",
  النموذج: "Model",
  "المعالجة والترجمة": "Processing and translation",
  "نموذج المعالجة والترجمة": "Processing and translation model",
  " — غير متاح": " — unavailable",
  "يفحص النماذج…": "Checking models…",
  "تحقق من النماذج": "Check models",
  "لا يوجد مفتاح للفحص — أضف مفتاحك أعلاه أو اضبط مفتاح الخادم.":
    "There's no key to check with — add yours above or set the server key.",
  "تعذّر الوصول — راجع الاتصال وأعد المحاولة.":
    "Couldn't reach it — check your connection and try again.",
  "تعذّر الوصول": "Unreachable",
  "نماذج أخرى متاحة لحسابك غير مسجلة بعد:":
    "Other models available to your account but not registered yet:",
  "عبر {key} — فحص حرّ بلا تكلفة": "via {key} — a free, cost-less check",
  مفتاحك: "your key",
  "جسر وكيل CLI": "CLI agent bridge",
  "إرسال الناتج إلى وكيل محلي — اختياري":
    "Send the output to a local agent — optional",
  مُهيأ: "Configured",
  "ما الجسر؟": "What is the bridge?",
  "الجسر خادم صغير على جهازك (":
    "The bridge is a small server on your machine (",
  ") — المتصفح لا يستطيع تشغيل الوكيل، فيستقبل الجسر طلبات الواجهة ويشغّل الوكيل في مجلد مشروعك.":
    ") — a browser can't run an agent, so the bridge takes the UI's requests and runs the agent in your project folder.",
  "عنوان الجسر:": "Bridge address:",
  "أين يستمع (الافتراضي": "where it listens (default",
  "توكن الجسر:": "Bridge token:",
  "كلمة سر مؤقتة يولّدها الجسر كل تشغيل ويرفض الطلبات بدونها — لا تخرج من جهازك.":
    "A temporary secret the bridge generates on every start and refuses requests without — it never leaves your machine.",
  "القاعدة البسيطة: كلما كان الجسر على جهازك بالإعدادات الافتراضية لا تلمس الحقلين؛ كلما خرج عن الافتراضي تكتبهما بنفسك.":
    "The simple rule: while the bridge runs on your machine with default settings, leave both fields alone; the moment it deviates from the defaults, fill them in yourself.",
  "عنوان الجسر": "Bridge address",
  "توكن الجسر": "Bridge token",
  "يُطبع في الطرفية عند تشغيل npm run bridge":
    "Printed in the terminal when you run npm run bridge",
  "الرمادية أعلاه هي قيم الجسر العامل — اكتُشفت تلقائياً وتُستخدم كما هي ما دام الحقل فارغاً.":
    "The grey values above are the running bridge's — auto-detected and used as they are while the field stays empty.",
  "الوكيل الافتراضي": "Default agent",
  "تبويبه يُفتح أولاً. لكل وكيل مدخله الخاص، والإرسال المباشر مفتاح داخل مدخل كل وكيل.":
    "Its tab opens first. Every agent has its own input, and direct sending is a switch inside each agent's input.",
  "فحص الاتصال": "Test connection",
  "الجسر متصل وجاهز لاستقبال التلقينات.":
    "The bridge is connected and ready to receive prompts.",
  "التوكن مرفوض — انسخ التوكن الظاهر في طرفية الجسر كاملاً.":
    "The token was rejected — copy the token shown in the bridge's terminal in full.",
  "لا يوجد جسر على هذا العنوان — شغّله بأمر npm run bridge.":
    "There is no bridge at this address — start it with npm run bridge.",
  "ردود الوكيل (تبويب OUT)": "Agent replies (OUT view)",
  "الترجمة والتنظيف": "Translation and cleanup",
  "ترجمة تلقائية لكل رد": "Automatically translate every reply",
  "مفعّل: يظهر كل رد بالعربية فور التقاطه (استدعاء ترجمة لكل رد). معطّل: زر «ترجمة» بجانب كل رد تضغطه عند الحاجة.":
    "On: every reply appears in Arabic as soon as it's captured (one translation call per reply). Off: a “Translate” button sits beside each reply for when you need it.",
  "تنظيف ذكي للمخرجات عبر Gemini": "Smart output cleanup through Gemini",
  "بعد الاستخراج المحلي من شاشة الطرفية، تمرّر Gemini الالتقاط لتجمع الأسطر المكسورة بعرض الطرفية وتحذف بقايا الواجهة. يُرفض أي ناتج فيه كلمات ليست في الالتقاط، ويبقى الاستخراج المحلي.":
    "After the local extraction from the terminal screen, Gemini gets the capture to rejoin lines broken at the terminal's width and drop UI leftovers. Any result containing words that aren't in the capture is rejected and the local extraction stays.",
  // terminal-clean (decision labels)
  "الثقة بالمجلد": "folder trust",
  "السماح بالعمل في المجلد": "permission to work in the folder",
  "إذن تنفيذ أداة": "tool execution permission",
  "اختيار من قائمة": "a choice from a list",
  "سؤال إعداد أولي": "a first-run setup question",
  "سؤال نعم/لا": "a yes/no question",
  "ضغط Enter للمتابعة": "press Enter to continue",
  // llm-optimizer
  "فُهمت النية وأُعيدت الصياغة عبر Gemini دون فقدان المعلومات الأساسية.":
    "The intent was understood and rewritten through Gemini without losing the essential information.",
  "تنقية النص محلياً": "local text cleanup",
  "النسخة العربية غير متاحة": "the Arabic version is unavailable",
  "الترجمة الإنجليزية غير متاحة": "the English translation is unavailable",
  "وضع محلي بدون مفتاح Gemini: {cleanup} فقط — {missing}.":
    "Local mode without a Gemini key: {cleanup} only — {missing}.",
  "تعذّر الاتصال بـ Gemini؛ استُخدمت {cleanup} — {missing}.":
    "Could not reach Gemini; {cleanup} was used — {missing}.",
  "أعاد Gemini ردًا غير صالح؛ استُخدمت {cleanup} — {missing}.":
    "Gemini returned an invalid reply; {cleanup} was used — {missing}.",
  "حصة مفتاحك في AI Studio استُنزفت مؤقتاً؛ استُخدمت {cleanup}. راجع حصتك أو امسح المفتاح من الإعدادات.":
    "Your AI Studio key's quota is temporarily used up; {cleanup} was used. Check your quota or clear the key in Settings.",
  "مفتاحك مرفوض من Google؛ تحقق منه في الإعدادات — استُخدمت {cleanup}.":
    "Google rejected your key; verify it in Settings — {cleanup} was used.",
  "حصة نماذج Gemini مستنزفة حالياً؛ استُخدمت {cleanup} — {missing}.":
    "Gemini's model quota is used up right now; {cleanup} was used — {missing}.",
  "تعذّر استدعاء Gemini بمفتاحك ({reason})؛ استُخدمت {cleanup} — {missing}.":
    "Could not call Gemini with your key ({reason}); {cleanup} was used — {missing}.",
  "تعذّر استدعاء Gemini ({reason})؛ استُخدمت {cleanup} — {missing}.":
    "Could not call Gemini ({reason}); {cleanup} was used — {missing}.",
  // quality-guard
  "المخرج العربي ليس مكتوباً بالعربية":
    "The Arabic output isn't written in Arabic",
  "المخرج الإنجليزي ليس مكتوباً بالإنجليزية":
    "The English output isn't written in English",
  "لم تُحفظ أدوات النفي الموجودة في المدخل":
    "The negation words in the input were not kept",
  "تغطية كلمات المحتوى منخفضة (~{percent}%)":
    "Content-word coverage is low (~{percent}%)",
  // agent-service
  "الجسر بإصدار أقدم لا يعرف هذه الميزة — أعد تشغيله":
    "The bridge is an older version that doesn't know this feature — restart it",
  "تم.": "Done.",
  "مجلد مساحة العمل غير صالح{v1}.": "The workspace folder is not valid{v1}.",
  "هذا الوكيل لا يملك ملف ثقة معروفاً — ثقته تُدار من داخله.":
    "This agent has no known trust file — its trust is managed from inside.",
  "ملف الثقة الخاص بالوكيل غير قابل للقراءة — لم يُعدَّل شيء.":
    "The agent's trust file is unreadable — nothing was changed.",
  "المجلد مسجّل في إعدادات الوكيل بمستوى ثقة آخر — لم يُعدَّل شيء؛ غيّره من داخل الوكيل.":
    "The folder is recorded in the agent's settings with a different trust level — nothing was changed; change it from inside the agent.",
  "مسار المجلد يحوي علامة ' لا يقبلها ملف إعدادات الوكيل — لم يُعدَّل شيء.":
    "The folder path contains a ' character the agent's settings file doesn't accept — nothing was changed.",
  "الوكيل غير مثبّت أو غير موجود في PATH.":
    "The agent is not installed or not on PATH.",
  "لم يُعثر على تطبيق طرفية على هذا النظام.":
    "No terminal application was found on this system.",
  "تعذّر التنفيذ{v1}.": "Could not run it{v1}.",
  "الجسر بإصدار أقدم لا يعرف الطرفيات المدمجة — أعد تشغيله":
    "The bridge is an older version that doesn't know embedded terminals — restart it",
  // optimization-service
  "لم يجتز مخرج Gemini فحوص السلامة المحلية؛ عُرض النص المنقّى محلياً والنسخة العربية محجوبة.":
    "Gemini's output failed the local safety checks; the locally cleaned text is shown and the Arabic version is withheld.",
  "لم يجتز مخرج Gemini فحوص السلامة المحلية (كيانات أو لغة)؛ استُخدمت تنقية محلية آمنة دون ترجمة.":
    "Gemini's output failed the local safety checks (entities or language); a safe local cleanup was used, without translation.",
  // page metadata
  "نموذج أولي لتحليل وتحسين تكلفة التلقينات العربية":
    "A prototype for analyzing and cutting the token cost of prompts",
  // English-UI wording for texts that have an Arabic-UI twin
};
