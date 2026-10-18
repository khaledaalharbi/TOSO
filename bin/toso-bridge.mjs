#!/usr/bin/env node
/**
 * TOSO Bridge — the local companion that lets the web UI reach CLI agents.
 *
 * A browser page cannot type into a terminal; this tiny zero-dependency
 * server is the honest path around that sandbox. It runs each agent
 * headless (claude -p / codex exec / gemini -p), captures its stdout, and
 * hands it back — so the UI can then translate the result to Arabic.
 *
 *   node bin/toso-bridge.mjs            # or: npm run bridge
 *
 * Security model — read before relaxing anything:
 *  - Binds 127.0.0.1 only. Never expose it to a network.
 *  - Every endpoint requires `x-toso-token`: the token printed on start is
 *    pasted once into the app's settings and kept in browser storage.
 *  - The agent list is a fixed allowlist; requests can only pick an id,
 *    never supply a command. Prompts travel over stdin so nothing is
 *    interpreted by a shell.
 *  - Env: TOSO_BRIDGE_PORT (default 8676), TOSO_BRIDGE_TOKEN (default:
 *    generated), TOSO_BRIDGE_ORIGINS (extra CORS origins, comma-separated),
 *    TOSO_AGENTS_FILE (JSON file extending the agent registry),
 *    TOSO_AGENT_CMD_<ID> (override an adapter's binary path).
 */

import http from "node:http";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const VERSION = "0.1.0";
const DEFAULT_PORT = 8676;
const MAX_BODY = 256 * 1024;
const MAX_PROMPT = 200_000;
const MAX_OUTPUT = 4 * 1024 * 1024;
const MAX_STDERR = 256 * 1024;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_TIMEOUT_MS = 30 * 60 * 1000;
const JOB_TTL_MS = 30 * 60 * 1000;
const JOB_SWEEP_MS = 60 * 1000;

/**
 * Built-in adapters — each spawns the CLI headless. `promptVia` decides how
 * the prompt is delivered, matching each CLI's documented contract:
 *   "stdin" — written to child stdin, never touches argv or a shell.
 *   "argv"  — a single argv element ({prompt} placeholder), guarded by
 *             the OS command-line length limit (~32K on Windows).
 *   "file"  — a temp file path substituted into {file} (e.g. devin
 *             --prompt-file) for CLIs that take long prompts best that way.
 * `TOSO_AGENT_CMD_<ID>` overrides the binary for non-standard installs.
 */
const BUILTIN_AGENTS = {
  claude: { label: "Claude Code", cmd: "claude", args: ["-p"] },
  codex: { label: "OpenAI Codex", cmd: "codex", args: ["exec"] },
  gemini: {
    label: "Gemini CLI",
    cmd: "gemini",
    args: ["-p", "{prompt}"],
    promptVia: "argv",
  },
  devin: {
    label: "Devin",
    cmd: "devin",
    args: ["-p", "--prompt-file", "{file}"],
    promptVia: "file",
  },
  hermes: {
    label: "Hermes",
    cmd: "hermes",
    args: ["--oneshot", "{prompt}"],
    promptVia: "argv",
  },
};

/** Windows CreateProcess tops out near 32K chars — guard argv delivery. */
const MAX_ARGV_PROMPT = 30_000;

const isWin = process.platform === "win32";

/** PowerShell single-quoted literal — the only escaping that matters. */
const psQuote = (s) => `'${String(s).replace(/'/g, "''")}'`;

/**
 * Windows reality: npm-installed CLIs are `.cmd` shims (no real .exe), and
 * CreateProcess cannot run them — a shell is unavoidable. We wrap once in
 * PowerShell -Command, and the prompt NEVER enters that command line:
 * stdin stays piped through PowerShell to the native child, and argv/file
 * adapters read the prompt from a temp file inside the command. No %env%
 * expansion, no quoting pitfalls, no argv length cap — the user text is
 * out-of-band end to end.
 */
function buildSpawn(adapter, via, prompt, promptFile) {
  if (!isWin) {
    const args =
      via === "argv"
        ? adapter.args.map((a) => (a === "{prompt}" ? prompt : a))
        : adapter.args.map((a) => (a === "{file}" ? promptFile : a));
    return {
      cmd: adapter.cmd,
      args,
      stdin: via === "stdin",
    };
  }
  const psArgs = adapter.args.map((arg) => {
    // {file} wants the PATH in argv (the agent reads it); {prompt} wants
    // the CONTENT in argv (read here via Get-Content).
    if (arg === "{file}") return psQuote(promptFile);
    if (arg === "{prompt}") return `(Get-Content -Raw ${psQuote(promptFile)})`;
    return psQuote(arg);
  });
  return {
    cmd: "powershell",
    args: [
      "-NoProfile",
      "-Command",
      [
        `if (-not (Get-Command ${psQuote(adapter.cmd)} -ErrorAction SilentlyContinue)) { exit 127 }`,
        `& ${psQuote(adapter.cmd)} ${psArgs.join(" ")}`.trim(),
        "exit $LASTEXITCODE",
      ].join("; "),
    ],
    stdin: via === "stdin",
  };
}

function loadAgents() {
  const agents = { ...BUILTIN_AGENTS };
  const file = process.env.TOSO_AGENTS_FILE;
  if (file) {
    try {
      const extra = JSON.parse(fs.readFileSync(file, "utf8"));
      for (const [id, entry] of Object.entries(extra)) {
        if (
          entry &&
          typeof entry.cmd === "string" &&
          entry.cmd &&
          (entry.args === undefined ||
            (Array.isArray(entry.args) &&
              entry.args.every((a) => typeof a === "string"))) &&
          (entry.label === undefined || typeof entry.label === "string") &&
          (entry.promptVia === undefined ||
            ["stdin", "argv", "file"].includes(entry.promptVia))
        ) {
          agents[id] = {
            label: entry.label || id,
            cmd: entry.cmd,
            args: entry.args ?? [],
            ...(entry.promptVia ? { promptVia: entry.promptVia } : {}),
          };
        }
      }
    } catch (error) {
      console.error(`toso-bridge: could not load ${file}:`, error.message);
    }
  }
  for (const id of Object.keys(agents)) {
    const override = process.env[`TOSO_AGENT_CMD_${id.toUpperCase()}`];
    if (override) agents[id] = { ...agents[id], cmd: override };
  }
  return agents;
}

const AGENTS = loadAgents();
const PORT =
  Number.parseInt(process.env.TOSO_BRIDGE_PORT ?? "", 10) || DEFAULT_PORT;
const TOKEN =
  process.env.TOSO_BRIDGE_TOKEN?.trim() ||
  crypto.randomBytes(16).toString("hex");
const EXTRA_ORIGINS = (process.env.TOSO_BRIDGE_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

/** @type {Map<string, {id:string, agent:string, status:string, output:string, error:?string, exitCode:?number, startedAt:number, endedAt:?number, child:import("node:child_process").ChildProcess, timer:NodeJS.Timeout}>} */
const jobs = new Map();

function originAllowed(origin) {
  if (!origin) return true; // curl / non-browser callers — token still gates.
  if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin))
    return true;
  return EXTRA_ORIGINS.includes(origin);
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && originAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, x-toso-token");
  // Chrome Private Network Access (public https page → loopback fetch).
  if (req.headers["access-control-request-private-network"] === "true") {
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
}

function sendJson(req, res, status, payload) {
  setCors(req, res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function authed(req) {
  return req.headers["x-toso-token"] === TOKEN;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("body_too_large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function jobView(job) {
  return {
    id: job.id,
    agent: job.agent,
    status: job.status, // running | done | error | killed
    output: job.output,
    error: job.error,
    exitCode: job.exitCode,
    startedAt: job.startedAt,
    endedAt: job.endedAt,
  };
}

function finish(job, status, error, exitCode) {
  if (job.status !== "running") return;
  job.status = status;
  job.error = error;
  job.exitCode = exitCode;
  job.endedAt = Date.now();
  clearTimeout(job.timer);
  if (job.promptFile) {
    fs.unlink(job.promptFile, () => {}); // best effort
    job.promptFile = null;
  }
}

/** Kill a job's process tree — on Windows the PowerShell wrapper's children
 *  would orphan without taskkill /T. */
function killJob(job) {
  const child = job.child;
  if (!child) return;
  if (isWin) {
    spawn("taskkill", ["/T", "/F", "/PID", String(child.pid)], {
      stdio: "ignore",
      windowsHide: true,
    }).on("error", () => {});
  } else {
    child.kill();
  }
}

function runAgent(agentId, prompt, timeoutMs) {
  const adapter = AGENTS[agentId];
  const via = adapter.promptVia ?? "stdin";
  if (via === "argv" && !isWin && prompt.length > MAX_ARGV_PROMPT) {
    const job = {
      id: crypto.randomUUID(),
      agent: agentId,
      status: "error",
      output: "",
      error: `prompt_too_long_for_agent: ${agentId} يستقبل البرومبت عبر argv (~${MAX_ARGV_PROMPT} حرف كحد أقصى)؛ اختصر النص أو استخدم وكيلاً يقرأه من ملف/stdin`,
      exitCode: null,
      startedAt: Date.now(),
      endedAt: Date.now(),
      child: null,
      timer: null,
    };
    jobs.set(job.id, job);
    return job;
  }
  const job = {
    id: crypto.randomUUID(),
    agent: agentId,
    status: "running",
    output: "",
    error: null,
    exitCode: null,
    startedAt: Date.now(),
    endedAt: null,
    child: null,
    timer: null,
    promptFile: null,
  };
  jobs.set(job.id, job);

  // Prompt file is needed by "file" adapters everywhere, and by "argv"
  // adapters on Windows (where the prompt reaches argv via Get-Content).
  if (via === "file" || (via === "argv" && isWin)) {
    try {
      job.promptFile = path.join(os.tmpdir(), `toso-prompt-${job.id}.txt`);
      fs.writeFileSync(job.promptFile, prompt, { mode: 0o600 });
    } catch (error) {
      finish(job, "error", `prompt_file_failed: ${error.message}`, null);
      return job;
    }
  }

  const spec = buildSpawn(adapter, via, prompt, job.promptFile);
  let child;
  try {
    // POSIX: no shell, argv verbatim. Windows: PowerShell wrapper (see
    // buildSpawn) — either way the prompt never meets a command parser.
    child = spawn(spec.cmd, spec.args, {
      stdio: [spec.stdin ? "pipe" : "ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  } catch (error) {
    finish(job, "error", `agent_spawn_failed: ${error.message}`, null);
    return job;
  }
  job.child = child;

  let stderr = "";
  const append = (chunk, cap, current) => {
    const next = current + chunk.toString("utf8");
    return next.length > cap ? next.slice(0, cap) : next;
  };
  child.stdout.on("data", (chunk) => {
    job.output = append(chunk, MAX_OUTPUT, job.output);
  });
  child.stderr.on("data", (chunk) => {
    stderr = append(chunk, MAX_STDERR, stderr);
  });
  child.on("error", (error) => {
    finish(
      job,
      "error",
      error.code === "ENOENT"
        ? `agent_not_installed: ${adapter.cmd} غير موجود في PATH`
        : `agent_spawn_failed: ${error.message}`,
      null,
    );
  });
  child.on("close", (code) => {
    finish(
      job,
      code === 0 ? "done" : "error",
      code === 0
        ? null
        : code === 127
          ? `agent_not_installed: ${adapter.cmd} غير موجود في PATH`
          : `exit_${code}${stderr.trim() ? `: ${stderr.trim().slice(0, 500)}` : ""}`,
      code,
    );
  });
  job.timer = setTimeout(() => {
    if (job.status === "running") {
      job.error = `timeout: تجاوز ${Math.round(timeoutMs / 1000)} ثانية`;
      killJob(job);
      finish(job, "error", job.error, null);
    }
  }, timeoutMs);
  job.timer.unref?.();

  if (via === "stdin") {
    try {
      child.stdin.write(prompt);
      child.stdin.end();
    } catch (error) {
      finish(job, "error", `stdin_failed: ${error.message}`, null);
    }
  }
  return job;
}

async function handle(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.headers.origin && !originAllowed(req.headers.origin)) {
    sendJson(req, res, 403, { error: "origin_not_allowed" });
    return;
  }
  if (!authed(req)) {
    sendJson(req, res, 401, { ok: false, error: "bad_token" });
    return;
  }

  const url = new URL(req.url, "http://127.0.0.1");

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(req, res, 200, {
      ok: true,
      version: VERSION,
      agents: Object.entries(AGENTS).map(([id, a]) => ({
        id,
        label: a.label,
      })),
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/run") {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      sendJson(req, res, 400, { error: "invalid_json" });
      return;
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      sendJson(req, res, 400, { error: "invalid_request" });
      return;
    }
    const { agent, prompt, timeoutMs } = body;
    if (typeof agent !== "string" || !AGENTS[agent]) {
      sendJson(req, res, 400, {
        error: "unknown_agent",
        agents: Object.keys(AGENTS),
      });
      return;
    }
    if (typeof prompt !== "string" || !prompt.trim()) {
      sendJson(req, res, 400, { error: "empty_prompt" });
      return;
    }
    if (prompt.length > MAX_PROMPT) {
      sendJson(req, res, 413, { error: "prompt_too_long", limit: MAX_PROMPT });
      return;
    }
    const timeout =
      Number.isFinite(timeoutMs) && timeoutMs > 0
        ? Math.min(timeoutMs, MAX_TIMEOUT_MS)
        : DEFAULT_TIMEOUT_MS;
    const job = runAgent(agent, prompt, timeout);
    sendJson(req, res, 202, { jobId: job.id, job: jobView(job) });
    return;
  }

  const jobMatch = url.pathname.match(/^\/job\/([\w-]+)$/);
  if (jobMatch) {
    const job = jobs.get(jobMatch[1]);
    if (!job) {
      sendJson(req, res, 404, { error: "job_not_found" });
      return;
    }
    if (req.method === "GET") {
      sendJson(req, res, 200, { job: jobView(job) });
      return;
    }
    if (req.method === "DELETE") {
      if (job.status === "running") {
        killJob(job);
        finish(job, "killed", "أُلغي من الواجهة", null);
      }
      sendJson(req, res, 200, { job: jobView(job) });
      return;
    }
  }

  sendJson(req, res, 404, { error: "not_found" });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => {
    sendJson(req, res, 500, { error: "internal", detail: String(error) });
  });
});

// Completed jobs expire so a long-running bridge never grows unbounded.
setInterval(() => {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of jobs) {
    if (job.endedAt && job.endedAt < cutoff) jobs.delete(id);
  }
}, JOB_SWEEP_MS).unref();

server.listen(PORT, "127.0.0.1", () => {
  // Session file — the app's /api/bridge/session reads this to auto-pair
  // the UI with the bridge (validated live before being trusted). Local
  // processes can read tmp files, but a local process can also read this
  // console output — same risk class.
  try {
    fs.writeFileSync(
      path.join(os.tmpdir(), "toso-bridge-session.json"),
      JSON.stringify(
        {
          port: PORT,
          token: TOKEN,
          pid: process.pid,
          startedAt: Date.now(),
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
  } catch {
    /* session file is a convenience — never fatal */
  }
  const pad = "─".repeat(52);
  console.log(`┌${pad}┐`);
  console.log(`  TOSO Bridge v${VERSION} — جسر الوكلاء المحلي`);
  console.log(`  http://127.0.0.1:${PORT}`);
  console.log(`  Token: ${TOKEN}`);
  console.log(`  Agents: ${Object.keys(AGENTS).join(", ")}`);
  console.log(`└${pad}┘`);
  console.log(
    "أدخل العنوان والتوكن في إعدادات TOSO. هذا السطر يظهر مرة واحدة عند التشغيل.",
  );
  if (process.env.TOSO_BRIDGE_TOKEN === undefined) {
    console.error(
      "tip: TOSO_BRIDGE_TOKEN env fixes the token across restarts.",
    );
  }
});
