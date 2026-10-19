/**
 * LIVE probe of the real CLI agents through the real bridge — skipped unless
 * TOSO_LIVE_AGENTS is set (it spends real model calls on your accounts):
 *
 *   $env:TOSO_LIVE_AGENTS="all"; npx vitest run lib/bridge/agents.live.test.ts
 *   $env:TOSO_LIVE_AGENTS="gemini,claude"; ...   # a subset
 *
 * For each agent it exercises exactly what the UI does:
 *   1. Embedded terminal: /pty/start → stream rendered by an xterm buffer →
 *      two turns typed in (the second asks about the first: context memory)
 *      → reply extracted by lib/bridge/terminal-clean.ts.
 *   2. One-shot fallback: POST /run with the adapter's headless contract.
 * Writes outputs/agent-live-probe.md (table + raw captures for misses).
 * Folder-trust dialogs on first run are accepted (Enter) for the probe's own
 * scratch folder only — noted in the report.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Terminal } from "@xterm/headless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  extractReply,
  isAgentBusy,
  pendingDecision,
  turnRegion,
} from "./terminal-clean";

const LIVE = process.env.TOSO_LIVE_AGENTS?.trim();
const ALL = ["gemini", "claude", "codex", "devin", "hermes"];
const AGENTS = !LIVE
  ? []
  : LIVE === "all"
    ? ALL
    : LIVE.split(",")
        .map((a) => a.trim())
        .filter(Boolean);

const BRIDGE = path.resolve(__dirname, "../../bin/toso-bridge.mjs");
const TOKEN = "live-probe-token";
const COLS = 120;
const ROWS = 32;
const PROMPT_1 = "Remember the code word BLUE-HERON. Reply with exactly: noted";
const PROMPT_2 =
  "What was the code word I gave you? Reply with only the code word.";
const PROMPT_ONESHOT = "Reply with exactly the single word: PONG";

/**
 * The probe (not the product) answers first-run dialogs for its scratch
 * folder: the affirmative option for trust menus — moving off a "No"
 * default first (Claude's dialog defaults to "No, exit") — and the default
 * for setup questions (Hermes telemetry → "No thanks").
 */
function dialogKeys(screen: string): string[] {
  if (/choice \[default/i.test(screen)) return ["\r"];
  const cursor = screen.split("\n").find((l) => /^\s*[❯❭>]\s+\S/.test(l)) ?? "";
  return /\b(no|exit|cancel|deny)\b/i.test(cursor) ? ["\x1b[B", "\r"] : ["\r"];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface AgentReport {
  agent: string;
  ready: string;
  turn1: string;
  turn2: string;
  oneShot: string;
  notes: string[];
  raw: string[];
}
const reports: AgentReport[] = [];

let port = 0;
let bridge: ChildProcess | undefined;
let sandbox = "";
let probeDir = "";

const api = (p: string, init: RequestInit = {}) =>
  fetch(`http://127.0.0.1:${port}${p}`, {
    ...init,
    headers: { "Content-Type": "application/json", "x-toso-token": TOKEN },
  });

function bufferLines(term: Terminal): string[] {
  const buffer = term.buffer.active;
  const lines: string[] = [];
  for (let i = 0; i < buffer.length; i++) {
    const line = buffer.getLine(i);
    if (!line) continue;
    const text = line.translateToString(true);
    if (line.isWrapped && lines.length) lines[lines.length - 1] += text;
    else lines.push(text);
  }
  return lines;
}

function viewport(term: Terminal): string {
  const buffer = term.buffer.active;
  const rows: string[] = [];
  for (let i = buffer.baseY; i < buffer.baseY + term.rows; i++) {
    rows.push(buffer.getLine(i)?.translateToString(true) ?? "");
  }
  return rows.join("\n");
}

/** Drives one embedded session the way components/agent-terminal.tsx does. */
async function probeTerminal(agent: string, report: AgentReport) {
  const started = await api("/pty/start", {
    method: "POST",
    body: JSON.stringify({
      agent,
      cwd: probeDir,
      trust: true,
      cols: COLS,
      rows: ROWS,
    }),
  });
  const body = await started.json();
  if (!body.ok) {
    report.ready = `start failed: ${body.error}${body.detail ? ` (${body.detail})` : ""}`;
    return;
  }
  const id: string = body.session.id;
  const term = new Terminal({
    cols: COLS,
    rows: ROWS,
    scrollback: 5000,
    allowProposedApi: true,
  });
  let lastOutput = Date.now();
  let firstOutput = 0;
  let exit: number | null = null;
  const controller = new AbortController();
  const pump = (async () => {
    const res = await api(`/pty/${id}/stream?from=0`, {
      signal: controller.signal,
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines.filter(Boolean)) {
        const event = JSON.parse(line) as { d?: string; exit?: number };
        if (event.d) {
          term.write(event.d);
          lastOutput = Date.now();
          firstOutput ||= Date.now();
        }
        if (typeof event.exit === "number") exit = event.exit;
      }
    }
  })().catch(() => {});
  const input = (data: string) =>
    api(`/pty/${id}/input`, { method: "POST", body: JSON.stringify({ data }) });

  try {
    // Readiness: bracketed paste on (Ink-style ready signal) or long quiet.
    const t0 = Date.now();
    let trustAnswers = 0;
    let signal = "";
    while (Date.now() - t0 < 120_000 && exit === null) {
      const screen = viewport(term);
      const decision = pendingDecision(screen);
      if (decision && Date.now() - lastOutput > 1500) {
        if (trustAnswers >= 3) break;
        trustAnswers++;
        const keys = dialogKeys(screen);
        report.notes.push(
          `answered "${decision}" (${keys.map((k) => (k === "\r" ? "Enter" : "Down")).join("+")})`,
        );
        for (const key of keys) {
          await input(key);
          await sleep(300);
        }
        await sleep(2500);
        continue;
      }
      const settled = !isAgentBusy(screen);
      const quiet = Date.now() - lastOutput;
      if (term.modes.bracketedPasteMode && settled && quiet > 800) {
        signal = "bracketed-paste";
        break;
      }
      if (firstOutput && settled && quiet > 6000) {
        signal = "quiet-6s";
        break;
      }
      await sleep(250);
    }
    if (exit !== null) {
      report.ready = `exited early (exit ${exit})`;
      report.raw.push(bufferLines(term).join("\n").trim().slice(-2500));
      return;
    }
    report.ready = signal
      ? `ready via ${signal} in ${Math.round((Date.now() - t0) / 1000)}s`
      : "never became ready (120s)";
    if (!signal) {
      report.raw.push(viewport(term).trim());
      return;
    }

    const turn = async (text: string) => {
      await sleep(400);
      const late = pendingDecision(viewport(term));
      if (late) {
        report.notes.push(`dialog still open before typing: ${late}`);
        for (const key of dialogKeys(viewport(term))) {
          await input(key);
          await sleep(300);
        }
        await sleep(2500);
      }
      const before = bufferLines(term);
      const payload = term.modes.bracketedPasteMode
        ? `\x1b[200~${text}\x1b[201~`
        : text;
      await input(payload);
      await sleep(300);
      await input("\r");
      const start = Date.now();
      let sawBusy = false;
      await sleep(1500);
      while (exit === null && Date.now() - start < 240_000) {
        const busy = isAgentBusy(viewport(term));
        sawBusy ||= busy;
        if (
          !busy &&
          Date.now() - lastOutput >= 1500 &&
          (sawBusy || Date.now() - start > 8000)
        )
          break;
        await sleep(250);
      }
      await sleep(300);
      const after = bufferLines(term);
      return {
        reply: extractReply(before, after, text),
        region: turnRegion(before, after),
        seconds: Math.round((Date.now() - start) / 1000),
        sawBusy,
      };
    };

    const one = await turn(PROMPT_1);
    report.turn1 = `${one.reply || "∅"} (${one.seconds}s${one.sawBusy ? "" : ", no busy marker"})`;
    const two = await turn(PROMPT_2);
    report.turn2 = `${two.reply || "∅"} (${two.seconds}s${two.sawBusy ? "" : ", no busy marker"})`;
    if (!/noted/i.test(one.reply))
      report.raw.push(`turn1 region:\n${one.region}`);
    if (!/BLUE-HERON/i.test(two.reply))
      report.raw.push(`turn2 region:\n${two.region}`);
    expect.soft(two.reply, `${agent} context memory`).toMatch(/BLUE-HERON/i);
  } finally {
    controller.abort();
    await api(`/pty/${id}`, { method: "DELETE" }).catch(() => {});
    await pump;
    term.dispose();
  }
}

async function probeOneShot(agent: string, report: AgentReport) {
  const res = await api("/run", {
    method: "POST",
    body: JSON.stringify({
      agent,
      prompt: PROMPT_ONESHOT,
      cwd: probeDir,
      trust: true,
      timeoutMs: 240_000,
    }),
  });
  const { jobId } = await res.json();
  const t0 = Date.now();
  while (Date.now() - t0 < 250_000) {
    await sleep(1500);
    const { job } = await (await api(`/job/${jobId}`)).json();
    if (job.status !== "running") {
      const out = (job.output as string).trim();
      report.oneShot =
        job.status === "done"
          ? `${out.slice(-120) || "∅"} (${Math.round((Date.now() - t0) / 1000)}s)`
          : `${job.status}: ${String(job.error).slice(0, 160)}`;
      expect.soft(out, `${agent} one-shot`).toMatch(/PONG/i);
      return;
    }
  }
  report.oneShot = "timeout";
}

function writeReport() {
  const row = (r: AgentReport) =>
    `| ${r.agent} | ${r.ready} | ${r.turn1} | ${r.turn2} | ${r.oneShot} | ${r.notes.join("; ") || "—"} |`;
  const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
  const lines = [
    "# فحص حي للوكلاء — TOSO",
    "",
    `تاريخ: ${new Date().toISOString()} · المولّد: \`lib/bridge/agents.live.test.ts\``,
    "",
    "| الوكيل | جاهزية الطرفية | الدورة 1 (noted) | الدورة 2 (الذاكرة: BLUE-HERON) | التشغيل الأحادي (PONG) | ملاحظات |",
    "|---|---|---|---|---|---|",
    ...reports.map((r) =>
      row({
        ...r,
        ready: cell(r.ready),
        turn1: cell(r.turn1),
        turn2: cell(r.turn2),
        oneShot: cell(r.oneShot),
      }),
    ),
    "",
    ...reports
      .filter((r) => r.raw.length)
      .flatMap((r) => [
        `## ${r.agent} — الالتقاط الخام للحالات غير المطابقة`,
        "",
        "```",
        ...r.raw,
        "```",
        "",
      ]),
  ];
  writeFileSync(
    path.resolve(__dirname, "../../outputs/agent-live-probe.md"),
    lines.join("\n"),
  );
}

describe.skipIf(AGENTS.length === 0)(
  "live CLI agents (real model calls)",
  () => {
    beforeAll(async () => {
      const { createServer } = await import("node:net");
      port = await new Promise((resolve) => {
        const probe = createServer().listen(0, "127.0.0.1", () => {
          const chosen = (probe.address() as { port: number }).port;
          probe.close(() => resolve(chosen));
        });
      });
      sandbox = mkdtempSync(path.join(tmpdir(), "toso-live-"));
      probeDir = path.join(tmpdir(), "toso-agent-probe");
      mkdirSync(probeDir, { recursive: true });
      writeFileSync(
        path.join(probeDir, "README.md"),
        "TOSO live agent probe scratch folder.\n",
      );
      bridge = spawn(process.execPath, [BRIDGE], {
        env: {
          ...process.env,
          TOSO_BRIDGE_PORT: String(port),
          TOSO_BRIDGE_TOKEN: TOKEN,
          TEMP: sandbox,
          TMP: sandbox,
          TMPDIR: sandbox,
        },
        stdio: "ignore",
      });
      for (let i = 0; i < 60; i++) {
        try {
          if ((await api("/health")).ok) return;
        } catch {
          /* not up yet */
        }
        await sleep(200);
      }
      throw new Error("bridge did not start");
    }, 30_000);

    afterAll(() => {
      writeReport();
      bridge?.kill();
      rmSync(sandbox, { recursive: true, force: true });
    });

    for (const agent of AGENTS) {
      it(
        agent,
        async () => {
          const report: AgentReport = {
            agent,
            ready: "—",
            turn1: "—",
            turn2: "—",
            oneShot: "—",
            notes: [],
            raw: [],
          };
          reports.push(report);
          await probeTerminal(agent, report);
          await probeOneShot(agent, report);
        },
        900_000,
      );
    }
  },
);
