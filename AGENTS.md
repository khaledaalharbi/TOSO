<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# قواعد المشروع — TOSO

## المهارات (`.devin/skills/`)

- **`gemini-api-dev`** — قبل كتابة أو تعديل أي كود يستدعي Gemini API (التوليد، الإخراج المهيكل، streaming، الأدوات، الترحيل بين الإصدارات أو النماذج): راجع `.devin/skills/gemini-api-dev/SKILL.md` أولًا، وتحقق من التوثيق الرسمي المستضاف المرتبط فيه (`ai.google.dev`) قبل افتراض عقود API من الذاكرة.

## قواعد أخرى

- `GEMINI_API_KEY` يُقرأ فقط في Route Handlers — لا يصل للمتصفح أبدًا.
- التحسين عبر Interactions API (`POST /v1beta/interactions` + هيدر `Api-Revision`)؛ قياس الـTokens عبر `countTokens` في `/api/tokens/count`.
- عند غياب المفتاح أو فشل النماذج: سقوط صادق إلى mock محلي — لا تختلق مخرجات إنجليزية في وضع محلي.
- التحقق بعد أي تعديل: `npx tsc --noEmit` + `npm run lint` + `npm test` (Vitest).
