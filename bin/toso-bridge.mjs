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
 *    TOSO_AGENT_CMD_<ID> (override an adapter's binary path),
 *    TOSO_BRIDGE_WORKSPACE (default agent working directory when a request
 *    names none — otherwise agents inherit the bridge's own cwd).
 *  - Workspace isolation: the agent works in the folder the request names
 *    (`cwd`), never implicitly inside TOSO. Trust is per run (adapter env,
 *    dies with the process) unless the user explicitly asks the bridge to
 *    record the folder in the agent's own trust file.
 */

import http from "node:http";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const VERSION = "0.3.0";
const DEFAULT_PORT = 8676;
const MAX_BODY = 256 * 1024;
const MAX_PROMPT = 200_000;
const MAX_OUTPUT = 4 * 1024 * 1024;
const MAX_STDERR = 256 * 1024;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_TIMEOUT_MS = 30 * 60 * 1000;
const JOB_TTL_MS = 30 * 60 * 1000;
const JOB_SWEEP_MS = 60 * 1000;
const MAX_PTY_SESSIONS = 8;
const PTY_BUFFER_CHARS = 2 * 1024 * 1024;
const PTY_EXITED_TTL_MS = 5 * 60 * 1000;
const MAX_PTY_INPUT = 256 * 1024;

/**
 * Built-in adapters — each spawns the CLI headless. `promptVia` decides how
 * the prompt is delivered, matching each CLI's documented contract:
 *   "stdin" — written to child stdin, never touches argv or a shell.
 *   "argv"  — a single argv element ({prompt} placeholder), guarded by
 *             the OS command-line length limit (~32K on Windows).
 *   "file"  — a temp file path substituted into {file} (e.g. devin
 *             --prompt-file) for CLIs that take long prompts best that way.
 * `TOSO_AGENT_CMD_<ID>` overrides the binary for non-standard installs.
 *
 * Trust (folder-trust gates only — never permission bypasses):
 *   trustEnv  — env injected into ONE run/terminal when the user enables
 *               auto-trust; it dies with the process.
 *   trustArgs — flags appended to ONE headless run (/run) when auto-trust is
 *               on: the agent's documented "skip the folder check" switch
 *               for non-interactive mode, where no trust dialog can be shown.
 *   trustFile — the agent's own trust registry (JSON map path→TRUST_FOLDER)
 *               written only on an explicit "trust permanently" request.
 * Claude has no folder-gate flag for print mode; its skip-permission flags
 * (and Codex's --full-auto) authorize ACTIONS, a different class, and are
 * deliberately not wired here.
 */
const BUILTIN_AGENTS = {
  claude: { label: "Claude Code", cmd: "claude", args: ["-p"] },
  codex: {
    label: "OpenAI Codex",
    cmd: "codex",
    args: ["exec"],
    // `codex exec` refuses folders outside a trusted git repo without it.
    trustArgs: ["--skip-git-repo-check"],
  },
  gemini: {
    label: "Gemini CLI",
    cmd: "gemini",
    args: ["-p", "{prompt}"],
    promptVia: "argv",
    trustEnv: { GEMINI_CLI_TRUST_WORKSPACE: "true" },
    trustFile: "~/.gemini/trustedFolders.json",
  },
  devin: {
    label: "Devin",
    cmd: "devin",
    args: ["-p", "--prompt-file", "{file}"],
    promptVia: "file",
    // Print mode cannot show devin's trust prompt and fails in untrusted folders.
    trustArgs: ["--respect-workspace-trust", "false"],
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

/**
 * Host-integration variables that must not leak into agent processes. A
 * bridge started from an IDE terminal (Devin Desktop / Windsurf) inherits
 * ACP_BACKEND, which makes `devin` think it is an ACP backend: it then
 * ignores the user's login ("Not logged in") — verified live.
 */
const HOST_ENV_BLOCKLIST = ["ACP_BACKEND"];

function agentEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  for (const key of HOST_ENV_BLOCKLIST) delete env[key];
  return env;
}

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

const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

function validEnvMap(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.entries(value).every(
      ([key, v]) => ENV_NAME.test(key) && typeof v === "string",
    )
  );
}

const expandHome = (p) =>
  p === "~" || p.startsWith("~/") || p.startsWith("~\\")
    ? path.join(os.homedir(), p.slice(1))
    : p;

/**
 * Workspace resolution: the request's `cwd` → TOSO_BRIDGE_WORKSPACE → null
 * (inherit the bridge's cwd). A named folder must be absolute and exist —
 * an invalid one is refused, never silently swapped for another folder.
 */
function resolveWorkspace(raw, { fallback = true } = {}) {
  if (raw !== undefined && raw !== null && typeof raw !== "string") {
    return { ok: false, detail: "المسار يجب أن يكون نصاً" };
  }
  const value =
    raw?.trim() || (fallback ? process.env.TOSO_BRIDGE_WORKSPACE?.trim() : "");
  if (!value) return { ok: true, cwd: null };
  if (!path.isAbsolute(value)) {
    return {
      ok: false,
      detail: "المسار يجب أن يكون مطلقاً (مثل C:\\Projects\\App)",
    };
  }
  const resolved = path.resolve(value);
  try {
    if (!fs.statSync(resolved).isDirectory()) {
      return { ok: false, detail: "المسار موجود لكنه ليس مجلداً" };
    }
  } catch {
    return { ok: false, detail: "المجلد غير موجود" };
  }
  return { ok: true, cwd: resolved };
}

/** Gemini's trust registry keys Windows paths lower-cased with forward slashes. */
const trustKey = (dir) => (isWin ? dir.replace(/\\/g, "/").toLowerCase() : dir);

/** Records `dir` in the adapter's trust file — explicit user request only. */
function writeTrust(adapter, dir) {
  const file = expandHome(adapter.trustFile);
  const key = trustKey(dir);
  let data = {};
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      return { ok: false, error: "trust_file_unreadable", file };
    }
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "trust_file_unreadable", file };
  }
  const already = data[key] === "TRUST_FOLDER";
  if (!already) {
    data[key] = "TRUST_FOLDER";
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  }
  return { ok: true, file, key, already };
}

/** POSIX: is `cmd` runnable (absolute path or found on PATH)? */
function onPath(cmd) {
  const candidates = cmd.includes("/")
    ? [cmd]
    : (process.env.PATH ?? "")
        .split(path.delimiter)
        .filter(Boolean)
        .map((dir) => path.join(dir, cmd));
  return candidates.some((file) => {
    try {
      fs.accessSync(file, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

const shQuote = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

/**
 * Opens an interactive terminal window running the agent inside `dir` —
 * launch and release: the window belongs to the user, outlives the bridge,
 * and its contents never flow back into TOSO.
 */
function openTerminal(adapter, dir, trust) {
  const trustEnv = trust && adapter.trustEnv ? adapter.trustEnv : {};
  const interactive = [adapter.cmd, ...(adapter.interactiveArgs ?? [])];
  return new Promise((resolve) => {
    if (isWin) {
      // The window's own script travels -EncodedCommand (base64 UTF-16LE),
      // so no quoting survives Start-Process's argument joining to break it.
      const script = [
        `$Host.UI.RawUI.WindowTitle = ${psQuote(`TOSO · ${adapter.label} · ${dir}`)}`,
        ...Object.entries(trustEnv).map(
          ([k, v]) => `$env:${k} = ${psQuote(v)}`,
        ),
        `& ${interactive.map(psQuote).join(" ")}`,
      ].join("; ");
      const encoded = Buffer.from(script, "utf16le").toString("base64");
      const outer = [
        `if (-not (Get-Command ${psQuote(adapter.cmd)} -ErrorAction SilentlyContinue)) { exit 127 }`,
        "$shell = if (Get-Command pwsh -ErrorAction SilentlyContinue) { 'pwsh' } else { 'powershell' }",
        `Start-Process $shell -WorkingDirectory ${psQuote(dir)} -ArgumentList '-NoExit','-EncodedCommand','${encoded}'`,
        "exit 0",
      ].join("; ");
      const child = spawn("powershell", ["-NoProfile", "-Command", outer], {
        stdio: "ignore",
        windowsHide: true,
        env: agentEnv(), // Start-Process hands this env to the window
      });
      child.on("error", (error) =>
        resolve({ ok: false, error: "terminal_failed", detail: error.message }),
      );
      child.on("close", (code) =>
        resolve(
          code === 0
            ? { ok: true }
            : code === 127
              ? { ok: false, error: "agent_not_installed" }
              : { ok: false, error: "terminal_failed", detail: `exit_${code}` },
        ),
      );
      return;
    }
    if (!onPath(adapter.cmd)) {
      resolve({ ok: false, error: "agent_not_installed" });
      return;
    }
    const env = agentEnv(trustEnv);
    if (process.platform === "darwin") {
      const line = [
        `cd ${shQuote(dir)}`,
        ...Object.entries(trustEnv).map(
          ([k, v]) => `export ${k}=${shQuote(v)}`,
        ),
        interactive.map(shQuote).join(" "),
      ].join(" && ");
      const apple = line.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const child = spawn(
        "osascript",
        ["-e", `tell application "Terminal" to do script "${apple}"`],
        { stdio: "ignore" },
      );
      child.on("error", (error) =>
        resolve({ ok: false, error: "terminal_failed", detail: error.message }),
      );
      child.on("close", (code) =>
        resolve(
          code === 0
            ? { ok: true }
            : { ok: false, error: "terminal_failed", detail: `exit_${code}` },
        ),
      );
      return;
    }
    const emulators = [
      ["x-terminal-emulator", ["-e", ...interactive]],
      ["gnome-terminal", ["--", ...interactive]],
      ["konsole", ["-e", ...interactive]],
      ["xterm", ["-e", ...interactive]],
    ];
    const attempt = (i) => {
      if (i >= emulators.length) {
        resolve({ ok: false, error: "no_terminal_found" });
        return;
      }
      const [bin, args] = emulators[i];
      const child = spawn(bin, args, {
        cwd: dir,
        env,
        detached: true,
        stdio: "ignore",
      });
      child.on("error", () => attempt(i + 1));
      child.on("spawn", () => {
        child.unref();
        resolve({ ok: true });
      });
    };
    attempt(0);
  });
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
            ["stdin", "argv", "file"].includes(entry.promptVia)) &&
          (entry.trustEnv === undefined || validEnvMap(entry.trustEnv)) &&
          (entry.trustArgs === undefined ||
            (Array.isArray(entry.trustArgs) &&
              entry.trustArgs.every((a) => typeof a === "string"))) &&
          (entry.trustFile === undefined ||
            (typeof entry.trustFile === "string" && entry.trustFile)) &&
          (entry.interactiveArgs === undefined ||
            (Array.isArray(entry.interactiveArgs) &&
              entry.interactiveArgs.every((a) => typeof a === "string")))
        ) {
          agents[id] = {
            label: entry.label || id,
            cmd: entry.cmd,
            args: entry.args ?? [],
            ...(entry.promptVia ? { promptVia: entry.promptVia } : {}),
            ...(entry.trustEnv ? { trustEnv: entry.trustEnv } : {}),
            ...(entry.trustArgs ? { trustArgs: entry.trustArgs } : {}),
            ...(entry.trustFile ? { trustFile: entry.trustFile } : {}),
            ...(entry.interactiveArgs
              ? { interactiveArgs: entry.interactiveArgs }
              : {}),
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

/*
 * Embedded terminals — one live interactive agent session per PTY. The
 * agent's own TUI runs in a pseudo-terminal; the UI renders it (xterm.js)
 * and types into it. Unlike /run, the process stays alive between prompts
 * and keeps its context.
 *
 * node-pty is the bridge's only (optional, native) dependency: it is loaded
 * lazily, so every other endpoint works without it and /pty/start answers
 * `pty_unavailable` honestly. TOSO_BRIDGE_DISABLE_PTY=1 turns it off.
 *
 * The agent runs WITHOUT a lingering shell: when it exits, the session
 * ends. Input therefore only ever reaches the agent's own prompt (governed
 * by its own approval modes), never a free shell.
 */
let ptyModule; // undefined = not tried yet, null = unavailable
async function loadPty() {
  if (ptyModule !== undefined) return ptyModule;
  if (process.env.TOSO_BRIDGE_DISABLE_PTY === "1") return (ptyModule = null);
  try {
    const mod = await import("node-pty");
    ptyModule = typeof mod.spawn === "function" ? mod : (mod.default ?? null);
  } catch {
    ptyModule = null;
  }
  return ptyModule;
}

/** @type {Map<string, {id:string, agent:string, cwd:string, trusted:boolean, proc:any, buffer:string, base:number, listeners:Set<(e:object)=>void>, exitCode:?number, endedAt:?number, startedAt:number}>} */
const ptySessions = new Map();

function ptySpawnSpec(adapter) {
  const interactive = [adapter.cmd, ...(adapter.interactiveArgs ?? [])];
  if (isWin) {
    // .cmd/.ps1 shims need a shell; it exits with the agent (no -NoExit).
    return {
      file: "powershell.exe",
      args: [
        "-NoLogo",
        "-NoProfile",
        "-Command",
        [
          `if (-not (Get-Command ${psQuote(adapter.cmd)} -ErrorAction SilentlyContinue)) { exit 127 }`,
          `& ${interactive.map(psQuote).join(" ")}`,
          "exit $LASTEXITCODE",
        ].join("; "),
      ],
    };
  }
  return { file: adapter.cmd, args: adapter.interactiveArgs ?? [] };
}

const clampDim = (value, fallback) =>
  Number.isInteger(value) && value >= 2 && value <= 500 ? value : fallback;

function ptyView(session) {
  return {
    id: session.id,
    agent: session.agent,
    cwd: session.cwd,
    trusted: session.trusted,
    alive: session.exitCode === null,
    exitCode: session.exitCode,
    startedAt: session.startedAt,
    size: session.base + session.buffer.length,
  };
}

function ptyEmit(session, event) {
  for (const listener of session.listeners) listener(event);
}

async function startPty(agentId, cwd, trust, cols, rows) {
  const pty = await loadPty();
  if (!pty) return { ok: false, status: 503, error: "pty_unavailable" };
  if (
    [...ptySessions.values()].filter((s) => s.exitCode === null).length >=
    MAX_PTY_SESSIONS
  ) {
    return { ok: false, status: 429, error: "too_many_sessions" };
  }
  const adapter = AGENTS[agentId];
  const trusted = Boolean(trust && adapter.trustEnv);
  const spec = ptySpawnSpec(adapter);
  let proc;
  try {
    proc = pty.spawn(spec.file, spec.args, {
      name: "xterm-256color",
      cols: clampDim(cols, 100),
      rows: clampDim(rows, 30),
      cwd,
      env: agentEnv({
        ...(trusted ? adapter.trustEnv : {}),
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
      }),
    });
  } catch (error) {
    return {
      ok: false,
      status: 400,
      error: "pty_spawn_failed",
      detail: error.message,
    };
  }
  const session = {
    id: crypto.randomUUID(),
    agent: agentId,
    cwd,
    trusted,
    proc,
    buffer: "",
    base: 0,
    listeners: new Set(),
    exitCode: null,
    endedAt: null,
    startedAt: Date.now(),
  };
  proc.onData((data) => {
    const offset = session.base + session.buffer.length;
    session.buffer += data;
    // Bounded replay buffer: drop the oldest output, keep offsets absolute.
    if (session.buffer.length > PTY_BUFFER_CHARS) {
      const drop = session.buffer.length - PTY_BUFFER_CHARS;
      session.buffer = session.buffer.slice(drop);
      session.base += drop;
    }
    ptyEmit(session, { o: offset, d: data });
  });
  proc.onExit(({ exitCode }) => {
    session.exitCode = exitCode ?? -1;
    session.endedAt = Date.now();
    ptyEmit(session, { exit: session.exitCode });
  });
  ptySessions.set(session.id, session);
  return { ok: true, session };
}

function killPty(session) {
  if (session.exitCode !== null) return;
  const pid = session.proc.pid;
  try {
    session.proc.kill();
  } catch {
    /* already gone */
  }
  if (isWin && pid) {
    spawn("taskkill", ["/T", "/F", "/PID", String(pid)], {
      stdio: "ignore",
      windowsHide: true,
    }).on("error", () => {});
  }
}

/**
 * Streams a session as NDJSON over one held response: the buffered output
 * from `from` (so a reload/reattach replays the screen), then live chunks,
 * then `{exit}`. A fetch() stream — not EventSource — so the token header
 * still gates it.
 */
function streamPty(req, res, session, from) {
  res.writeHead(200, {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  });
  const start = Math.max(session.base, Number.isSafeInteger(from) ? from : 0);
  const backlog = session.buffer.slice(start - session.base);
  res.write(
    `${JSON.stringify({ o: start, d: backlog, ...(start > (from || 0) ? { truncated: true } : {}) })}\n`,
  );
  if (session.exitCode !== null) {
    res.end(`${JSON.stringify({ exit: session.exitCode })}\n`);
    return;
  }
  const listener = (event) => {
    res.write(`${JSON.stringify(event)}\n`);
    if (event.exit !== undefined) res.end();
  };
  session.listeners.add(listener);
  const detach = () => session.listeners.delete(listener);
  req.on("close", detach);
  res.on("close", detach);
}

process.on("exit", () => {
  for (const session of ptySessions.values()) killPty(session);
});

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
    cwd: job.cwd, // null → the bridge's own working directory
    trusted: job.trusted,
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

function runAgent(
  agentId,
  prompt,
  timeoutMs,
  { cwd = null, trust = false } = {},
) {
  const adapter = AGENTS[agentId];
  const via = adapter.promptVia ?? "stdin";
  const trusted = Boolean(trust && (adapter.trustEnv || adapter.trustArgs));
  if (via === "argv" && !isWin && prompt.length > MAX_ARGV_PROMPT) {
    const job = {
      id: crypto.randomUUID(),
      agent: agentId,
      cwd,
      trusted,
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
    cwd,
    trusted,
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

  // Per-run folder trust for headless mode: the adapter's documented flag.
  const runAdapter =
    trusted && adapter.trustArgs
      ? { ...adapter, args: [...adapter.args, ...adapter.trustArgs] }
      : adapter;
  const spec = buildSpawn(runAdapter, via, prompt, job.promptFile);
  let child;
  try {
    // POSIX: no shell, argv verbatim. Windows: PowerShell wrapper (see
    // buildSpawn) — either way the prompt never meets a command parser.
    child = spawn(spec.cmd, spec.args, {
      stdio: [spec.stdin ? "pipe" : "ignore", "pipe", "pipe"],
      windowsHide: true,
      ...(cwd ? { cwd } : {}),
      env: agentEnv(trusted && adapter.trustEnv ? adapter.trustEnv : {}),
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
      pty: Boolean(await loadPty()),
      agents: Object.entries(AGENTS).map(([id, a]) => ({
        id,
        label: a.label,
        trust: {
          perRun: Boolean(a.trustEnv || a.trustArgs),
          persistent: Boolean(a.trustFile),
        },
      })),
    });
    return;
  }

  if (
    req.method === "POST" &&
    ["/run", "/fs/check", "/trust/workspace", "/open-terminal"].includes(
      url.pathname,
    )
  ) {
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
    if (url.pathname === "/fs/check") {
      const ws = resolveWorkspace(body.path, { fallback: false });
      sendJson(
        req,
        res,
        200,
        ws.ok && ws.cwd
          ? { ok: true, path: ws.cwd }
          : {
              ok: false,
              error: "invalid_workspace",
              detail: ws.ok ? "المسار فارغ" : ws.detail,
            },
      );
      return;
    }
    const { agent } = body;
    if (typeof agent !== "string" || !AGENTS[agent]) {
      sendJson(req, res, 400, {
        error: "unknown_agent",
        agents: Object.keys(AGENTS),
      });
      return;
    }
    const adapter = AGENTS[agent];
    const ws = resolveWorkspace(body.cwd, {
      fallback: url.pathname !== "/trust/workspace",
    });
    if (!ws.ok) {
      sendJson(req, res, 400, {
        error: "invalid_workspace",
        detail: ws.detail,
      });
      return;
    }
    if (url.pathname === "/trust/workspace") {
      if (!ws.cwd) {
        sendJson(req, res, 400, {
          error: "invalid_workspace",
          detail: "حدّد مجلد مساحة العمل أولاً",
        });
        return;
      }
      if (!adapter.trustFile) {
        sendJson(req, res, 400, { error: "trust_unsupported", agent });
        return;
      }
      const result = writeTrust(adapter, ws.cwd);
      sendJson(req, res, result.ok ? 200 : 409, result);
      return;
    }
    if (url.pathname === "/open-terminal") {
      const dir = ws.cwd ?? process.cwd();
      const result = await openTerminal(adapter, dir, body.trust === true);
      sendJson(req, res, result.ok ? 200 : 400, {
        ...result,
        cwd: dir,
        trusted: body.trust === true && Boolean(adapter.trustEnv),
      });
      return;
    }
    const { prompt, timeoutMs } = body;
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
    const job = runAgent(agent, prompt, timeout, {
      cwd: ws.cwd,
      trust: body.trust === true,
    });
    sendJson(req, res, 202, { jobId: job.id, job: jobView(job) });
    return;
  }

  if (url.pathname.startsWith("/pty/")) {
    await handlePty(req, res, url);
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

async function readJson(req, res) {
  let body;
  try {
    body = JSON.parse((await readBody(req)) || "{}");
  } catch {
    sendJson(req, res, 400, { error: "invalid_json" });
    return null;
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    sendJson(req, res, 400, { error: "invalid_request" });
    return null;
  }
  return body;
}

async function handlePty(req, res, url) {
  if (req.method === "POST" && url.pathname === "/pty/start") {
    const body = await readJson(req, res);
    if (!body) return;
    if (typeof body.agent !== "string" || !AGENTS[body.agent]) {
      sendJson(req, res, 400, {
        error: "unknown_agent",
        agents: Object.keys(AGENTS),
      });
      return;
    }
    const ws = resolveWorkspace(body.cwd);
    if (!ws.ok) {
      sendJson(req, res, 400, {
        error: "invalid_workspace",
        detail: ws.detail,
      });
      return;
    }
    const result = await startPty(
      body.agent,
      ws.cwd ?? process.cwd(),
      body.trust === true,
      body.cols,
      body.rows,
    );
    if (!result.ok) {
      sendJson(req, res, result.status, {
        error: result.error,
        ...(result.detail ? { detail: result.detail } : {}),
      });
      return;
    }
    sendJson(req, res, 201, { ok: true, session: ptyView(result.session) });
    return;
  }

  const match = url.pathname.match(
    /^\/pty\/([\w-]+)(?:\/(stream|input|resize))?$/,
  );
  const session = match ? ptySessions.get(match[1]) : null;
  if (!session) {
    sendJson(req, res, 404, { error: "pty_not_found" });
    return;
  }
  const action = match[2];
  if (req.method === "GET" && !action) {
    sendJson(req, res, 200, { ok: true, session: ptyView(session) });
    return;
  }
  if (req.method === "GET" && action === "stream") {
    streamPty(req, res, session, Number(url.searchParams.get("from") ?? 0));
    return;
  }
  if (req.method === "DELETE" && !action) {
    killPty(session);
    ptySessions.delete(session.id);
    sendJson(req, res, 200, { ok: true });
    return;
  }
  if (req.method === "POST" && (action === "input" || action === "resize")) {
    const body = await readJson(req, res);
    if (!body) return;
    if (session.exitCode !== null) {
      sendJson(req, res, 409, {
        error: "pty_exited",
        exitCode: session.exitCode,
      });
      return;
    }
    if (action === "input") {
      if (typeof body.data !== "string" || body.data.length > MAX_PTY_INPUT) {
        sendJson(req, res, 400, { error: "invalid_input" });
        return;
      }
      session.proc.write(body.data);
    } else {
      session.proc.resize(clampDim(body.cols, 100), clampDim(body.rows, 30));
    }
    sendJson(req, res, 200, { ok: true });
    return;
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
  // Exited terminals linger briefly so the UI can read their last screen.
  const ptyCutoff = Date.now() - PTY_EXITED_TTL_MS;
  for (const [id, session] of ptySessions) {
    if (session.endedAt && session.endedAt < ptyCutoff) ptySessions.delete(id);
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
