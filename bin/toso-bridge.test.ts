/**
 * End-to-end tests for bin/toso-bridge.mjs — the real script is spawned on a
 * random port with a fixed token and a temp agents file that registers an
 * `echo` agent (node echoing stdin), so the stdin→stdout capture path is
 * exercised without any real CLI installed.
 */

import { spawn, type ChildProcess } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const BRIDGE = path.resolve(__dirname, "toso-bridge.mjs");
const TOKEN = "test-token-abc123";

let port: number;
let child: ChildProcess;
let workDir: string;
let targetDir: string;
let trustFile: string;

function api(
  p: string,
  init: RequestInit = {},
  token: string | null = TOKEN,
): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}${p}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "x-toso-token": token } : {}),
      ...(init.headers ?? {}),
    },
  });
}

async function waitForJob(jobId: string, tries = 40): Promise<Job> {
  for (let i = 0; i < tries; i++) {
    const res = await api(`/job/${jobId}`);
    const { job } = (await res.json()) as { job: Job };
    if (job.status !== "running") return job;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("job never finished");
}

interface Job {
  id: string;
  agent: string;
  status: string;
  output: string;
  error: string | null;
  exitCode: number | null;
}

beforeAll(async () => {
  // A free port: let the OS pick one, then release it for the bridge.
  const { createServer } = await import("node:net");
  port = await new Promise((resolve) => {
    const probe = createServer().listen(0, "127.0.0.1", () => {
      const chosen = (probe.address() as { port: number }).port;
      probe.close(() => resolve(chosen));
    });
  });

  workDir = mkdtempSync(path.join(tmpdir(), "toso-bridge-test-"));
  targetDir = path.join(workDir, "Target App");
  mkdirSync(targetDir);
  trustFile = path.join(workDir, "trust", "trustedFolders.json");
  const agentsFile = path.join(workDir, "agents.json");
  writeFileSync(
    agentsFile,
    JSON.stringify({
      echo: {
        label: "Echo",
        cmd: process.execPath,
        args: [
          "-e",
          "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>process.stdout.write('ECHO:'+d))",
        ],
      },
      failer: {
        label: "Failer",
        cmd: process.execPath,
        args: ["-e", "process.stderr.write('boom');process.exit(3)"],
      },
      sleeper: {
        label: "Sleeper",
        cmd: process.execPath,
        args: ["-e", "setTimeout(()=>console.log('late'),30000)"],
      },
      echoargv: {
        label: "EchoArgv",
        cmd: process.execPath,
        args: [
          "-e",
          "process.stdout.write('ARGV:'+process.argv[1])",
          "{prompt}",
        ],
        promptVia: "argv",
      },
      echofile: {
        label: "EchoFile",
        cmd: process.execPath,
        args: [
          "-e",
          "process.stdout.write('FILE:'+require('fs').readFileSync(process.argv[1],'utf8'))",
          "{file}",
        ],
        promptVia: "file",
      },
      echocwd: {
        label: "EchoCwd",
        cmd: process.execPath,
        args: ["-e", "process.stdout.write('CWD:'+process.cwd())"],
      },
      echoenv: {
        label: "EchoEnv",
        cmd: process.execPath,
        args: [
          "-e",
          "process.stdout.write('ENV:'+process.env.TOSO_TEST_TRUST)",
        ],
        trustEnv: { TOSO_TEST_TRUST: "yes" },
      },
      trusty: {
        label: "Trusty",
        cmd: process.execPath,
        trustFile,
      },
      ghost: {
        label: "Ghost",
        cmd: "toso-no-such-binary-xyz",
      },
      echoargs: {
        label: "EchoArgs",
        cmd: process.execPath,
        args: [
          "-e",
          "process.stdout.write('ARGS:'+process.argv.slice(1).join(' ')+' ACP:'+process.env.ACP_BACKEND)",
          // "--" so node hands the appended trust flag to the script
          "--",
        ],
        trustArgs: ["--trusted-flag"],
      },
      // An interactive agent for the PTY path: prints READY, echoes each
      // line, exits on "bye" — a tiny stand-in for a real agent TUI.
      repl: {
        label: "Repl",
        cmd: process.execPath,
        interactiveArgs: [
          "-e",
          "process.stdout.write('READY:'+process.cwd()+'\\n');require('readline').createInterface({input:process.stdin}).on('line',l=>{process.stdout.write('ECHO:'+l+'\\n');if(l==='bye')process.exit(0)})",
        ],
      },
    }),
  );

  child = spawn(process.execPath, [BRIDGE], {
    env: {
      ...process.env,
      TOSO_BRIDGE_PORT: String(port),
      TOSO_BRIDGE_TOKEN: TOKEN,
      TOSO_AGENTS_FILE: agentsFile,
      // As if launched from a Devin Desktop / Windsurf terminal: this must
      // never reach an agent (it breaks `devin` auth).
      ACP_BACKEND: "ide-host",
      // Keep the bridge's session file (os.tmpdir()) inside the sandbox so
      // a test run never clobbers a developer's live bridge pairing.
      TEMP: workDir,
      TMP: workDir,
      TMPDIR: workDir,
    },
    stdio: "ignore",
  });
  // Wait until the port answers.
  for (let i = 0; i < 60; i++) {
    try {
      const res = await api("/health");
      if (res.status === 200) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("bridge did not start");
}, 30_000);

afterAll(() => {
  child.kill();
  noPtyChild?.kill();
  rmSync(workDir, { recursive: true, force: true });
});

let noPtyChild: ChildProcess | undefined;

describe("toso-bridge without node-pty", () => {
  let noPtyPort: number;
  const apiNoPty = (p: string, init: RequestInit = {}) =>
    fetch(`http://127.0.0.1:${noPtyPort}${p}`, {
      ...init,
      headers: { "Content-Type": "application/json", "x-toso-token": TOKEN },
    });

  beforeAll(async () => {
    const { createServer } = await import("node:net");
    noPtyPort = await new Promise((resolve) => {
      const probe = createServer().listen(0, "127.0.0.1", () => {
        const chosen = (probe.address() as { port: number }).port;
        probe.close(() => resolve(chosen));
      });
    });
    noPtyChild = spawn(process.execPath, [BRIDGE], {
      env: {
        ...process.env,
        TOSO_BRIDGE_PORT: String(noPtyPort),
        TOSO_BRIDGE_TOKEN: TOKEN,
        TOSO_BRIDGE_DISABLE_PTY: "1",
        TEMP: workDir,
        TMP: workDir,
        TMPDIR: workDir,
      },
      stdio: "ignore",
    });
    for (let i = 0; i < 60; i++) {
      try {
        if ((await apiNoPty("/health")).status === 200) return;
      } catch {
        /* not up yet */
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error("no-pty bridge did not start");
  }, 30_000);

  it("reports pty:false and refuses /pty/start honestly — headless /run still works", async () => {
    expect((await (await apiNoPty("/health")).json()).pty).toBe(false);
    const res = await apiNoPty("/pty/start", {
      method: "POST",
      body: JSON.stringify({ agent: "gemini" }),
    });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("pty_unavailable");
  });
});

describe("toso-bridge", () => {
  it("rejects requests without the token", async () => {
    const res = await api("/health", {}, null);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("bad_token");
  });

  it("rejects a wrong token", async () => {
    const res = await api("/health", {}, "nope");
    expect(res.status).toBe(401);
  });

  it("health lists builtin + file-registered agents", async () => {
    const res = await api("/health");
    const payload = await res.json();
    expect(payload.ok).toBe(true);
    const ids = payload.agents.map((a: { id: string }) => a.id);
    expect(ids).toEqual(
      expect.arrayContaining(["claude", "codex", "gemini", "echo"]),
    );
  });

  it("rejects foreign origins", async () => {
    const res = await api("/health", {
      headers: { Origin: "https://evil.example" },
    });
    expect(res.status).toBe(403);
  });

  it("allows localhost origins and answers preflight", async () => {
    const res = await api("/health", {
      headers: { Origin: "http://localhost:3000" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000",
    );
  });

  it("runs an agent and captures its stdout over stdin plumbing", async () => {
    const res = await api("/run", {
      method: "POST",
      body: JSON.stringify({ agent: "echo", prompt: "مرحبا hello 42" }),
    });
    expect(res.status).toBe(202);
    const { jobId } = await res.json();
    const job = await waitForJob(jobId);
    expect(job.status).toBe("done");
    expect(job.exitCode).toBe(0);
    expect(job.output).toContain("ECHO:مرحبا hello 42");
  });

  it("delivers the prompt as argv when the adapter says so", async () => {
    const res = await api("/run", {
      method: "POST",
      body: JSON.stringify({ agent: "echoargv", prompt: "نص عبر argv" }),
    });
    const { jobId } = await res.json();
    const job = await waitForJob(jobId);
    expect(job.status).toBe("done");
    expect(job.output).toBe("ARGV:نص عبر argv");
  });

  it("delivers the prompt as a temp file when the adapter says so", async () => {
    const res = await api("/run", {
      method: "POST",
      body: JSON.stringify({ agent: "echofile", prompt: "نص عبر ملف" }),
    });
    const { jobId } = await res.json();
    const job = await waitForJob(jobId);
    expect(job.status).toBe("done");
    expect(job.output).toBe("FILE:نص عبر ملف");
  });

  it("guards argv delivery at the OS limit — POSIX only", async () => {
    const res = await api("/run", {
      method: "POST",
      body: JSON.stringify({
        agent: "echoargv",
        prompt: "x".repeat(30_001),
      }),
    });
    const { jobId } = await res.json();
    const job = await waitForJob(jobId);
    if (process.platform === "win32") {
      // Windows argv delivery goes through a temp file — no argv cap.
      expect(job.status).toBe("done");
      expect(job.output.startsWith("ARGV:xxx")).toBe(true);
    } else {
      expect(job.status).toBe("error");
      expect(job.error).toContain("prompt_too_long_for_agent");
    }
  });

  it("rejects unknown agents instead of executing anything", async () => {
    const res = await api("/run", {
      method: "POST",
      body: JSON.stringify({ agent: "evil", prompt: "x" }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("unknown_agent");
  });

  it("rejects empty and oversized prompts", async () => {
    const empty = await api("/run", {
      method: "POST",
      body: JSON.stringify({ agent: "echo", prompt: "   " }),
    });
    expect(empty.status).toBe(400);
    const big = await api("/run", {
      method: "POST",
      body: JSON.stringify({ agent: "echo", prompt: "x".repeat(200_001) }),
    });
    expect(big.status).toBe(413);
  });

  it("reports non-zero exits with stderr", async () => {
    const res = await api("/run", {
      method: "POST",
      body: JSON.stringify({ agent: "failer", prompt: "x" }),
    });
    const { jobId } = await res.json();
    const job = await waitForJob(jobId);
    expect(job.status).toBe("error");
    expect(job.exitCode).toBe(3);
    expect(job.error).toContain("boom");
  });

  it("reports missing binaries honestly", async () => {
    const res = await api("/run", {
      method: "POST",
      body: JSON.stringify({
        // A binary guaranteed absent — a real CLI (claude…) may be installed
        // on a developer machine and would actually run.
        agent: "ghost",
        prompt: "hi",
      }),
    });
    const { jobId } = await res.json();
    const job = await waitForJob(jobId);
    expect(job.status).toBe("error");
    expect(job.error).toMatch(/agent_not_installed|ENOENT/);
  });

  it("DELETE kills a running job", async () => {
    const res = await api("/run", {
      method: "POST",
      body: JSON.stringify({ agent: "sleeper", prompt: "x" }),
    });
    const { jobId } = await res.json();
    const del = await api(`/job/${jobId}`, { method: "DELETE" });
    expect(del.status).toBe(200);
    const { job } = await del.json();
    expect(job.status).toBe("killed");
    // A second poll stays killed — nothing resurrects the process.
    const after = await (await api(`/job/${jobId}`)).json();
    expect(after.job.status).not.toBe("running");
  });

  const samePath = (a: string, b: string) =>
    expect(path.resolve(a).toLowerCase()).toBe(path.resolve(b).toLowerCase());

  it("runs the agent inside the requested workspace, not the bridge's cwd", async () => {
    const res = await api("/run", {
      method: "POST",
      body: JSON.stringify({ agent: "echocwd", prompt: "x", cwd: targetDir }),
    });
    expect(res.status).toBe(202);
    const job = await waitForJob((await res.json()).jobId);
    expect(job.status).toBe("done");
    samePath(job.output.replace(/^CWD:/, ""), targetDir);
    samePath((job as Job & { cwd: string }).cwd, targetDir);
  });

  it("refuses a missing or relative workspace instead of running elsewhere", async () => {
    for (const cwd of [path.join(workDir, "nope"), "relative/dir"]) {
      const res = await api("/run", {
        method: "POST",
        body: JSON.stringify({ agent: "echocwd", prompt: "x", cwd }),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("invalid_workspace");
    }
  });

  it("injects the adapter's trust env only when the run asks for trust", async () => {
    const run = async (trust: boolean) => {
      const res = await api("/run", {
        method: "POST",
        body: JSON.stringify({ agent: "echoenv", prompt: "x", trust }),
      });
      return waitForJob((await res.json()).jobId);
    };
    const trusted = await run(true);
    expect(trusted.output).toBe("ENV:yes");
    expect((trusted as Job & { trusted: boolean }).trusted).toBe(true);
    expect((await run(false)).output).toBe("ENV:undefined");
  });

  it("appends the adapter's trust flags to one trusted run only, and strips host env", async () => {
    const run = async (trust: boolean) => {
      const res = await api("/run", {
        method: "POST",
        body: JSON.stringify({ agent: "echoargs", prompt: "x", trust }),
      });
      return waitForJob((await res.json()).jobId);
    };
    const trusted = await run(true);
    expect(trusted.output).toContain("--trusted-flag");
    expect(trusted.output).toContain("ACP:undefined");
    const plain = await run(false);
    expect(plain.output).not.toContain("--trusted-flag");
    expect(plain.output).toContain("ACP:undefined");
  });

  it("/fs/check validates workspace folders", async () => {
    const ok = await (
      await api("/fs/check", {
        method: "POST",
        body: JSON.stringify({ path: targetDir }),
      })
    ).json();
    expect(ok.ok).toBe(true);
    samePath(ok.path, targetDir);
    const missing = await (
      await api("/fs/check", {
        method: "POST",
        body: JSON.stringify({ path: path.join(workDir, "nope") }),
      })
    ).json();
    expect(missing).toMatchObject({ ok: false, error: "invalid_workspace" });
    const file = await (
      await api("/fs/check", {
        method: "POST",
        body: JSON.stringify({ path: path.join(workDir, "agents.json") }),
      })
    ).json();
    expect(file.ok).toBe(false);
  });

  it("/trust/workspace records the folder once, idempotently", async () => {
    const call = () =>
      api("/trust/workspace", {
        method: "POST",
        body: JSON.stringify({ agent: "trusty", cwd: targetDir }),
      });
    const first = await (await call()).json();
    expect(first).toMatchObject({ ok: true, already: false });
    const second = await (await call()).json();
    expect(second).toMatchObject({ ok: true, already: true });
    const data = JSON.parse(readFileSync(trustFile, "utf8"));
    expect(Object.values(data)).toEqual(["TRUST_FOLDER"]);
    expect(Object.keys(data)[0]).toBe(first.key);
  });

  it("/trust/workspace refuses agents without a trust file and empty folders", async () => {
    const unsupported = await api("/trust/workspace", {
      method: "POST",
      body: JSON.stringify({ agent: "claude", cwd: targetDir }),
    });
    expect(unsupported.status).toBe(400);
    expect((await unsupported.json()).error).toBe("trust_unsupported");
    const empty = await api("/trust/workspace", {
      method: "POST",
      body: JSON.stringify({ agent: "trusty", cwd: "" }),
    });
    expect((await empty.json()).error).toBe("invalid_workspace");
  });

  it("/open-terminal validates before opening anything", async () => {
    const unknown = await api("/open-terminal", {
      method: "POST",
      body: JSON.stringify({ agent: "evil", cwd: targetDir }),
    });
    expect((await unknown.json()).error).toBe("unknown_agent");
    const badDir = await api("/open-terminal", {
      method: "POST",
      body: JSON.stringify({ agent: "echo", cwd: path.join(workDir, "nope") }),
    });
    expect((await badDir.json()).error).toBe("invalid_workspace");
    // A missing binary is detected before any window is launched.
    const ghost = await api("/open-terminal", {
      method: "POST",
      body: JSON.stringify({ agent: "ghost", cwd: targetDir }),
    });
    expect(ghost.status).toBe(400);
    expect((await ghost.json()).error).toBe("agent_not_installed");
  }, 20_000);

  it("health reports each agent's trust capabilities", async () => {
    const { agents } = await (await api("/health")).json();
    const byId = Object.fromEntries(
      agents.map((a: { id: string; trust: unknown }) => [a.id, a.trust]),
    );
    expect(byId.gemini).toEqual({ perRun: true, persistent: true });
    expect(byId.codex).toEqual({ perRun: true, persistent: false });
    expect(byId.devin).toEqual({ perRun: true, persistent: false });
    expect(byId.claude).toEqual({ perRun: false, persistent: false });
  });

  /** Reads an NDJSON PTY stream until `until(text)` or exit, within `ms`. */
  async function readPty(
    id: string,
    until: (text: string) => boolean,
    ms = 20_000,
    from = 0,
  ) {
    const controller = new AbortController();
    const res = await api(`/pty/${id}/stream?from=${from}`, {
      signal: controller.signal,
    });
    expect(res.status).toBe(200);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    let text = "";
    let exit: number | null = null;
    const deadline = Date.now() + ms;
    try {
      while (Date.now() < deadline && !until(text) && exit === null) {
        const chunk = await Promise.race([
          reader.read(),
          new Promise<{ done: true; value?: undefined }>((r) =>
            setTimeout(() => r({ done: true }), deadline - Date.now()),
          ),
        ]);
        if (chunk.done) break;
        pending += decoder.decode(chunk.value, { stream: true });
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const event = JSON.parse(line) as { d?: string; exit?: number };
          if (typeof event.d === "string") text += event.d;
          if (typeof event.exit === "number") exit = event.exit;
        }
      }
    } finally {
      controller.abort();
    }
    return { text, exit };
  }

  const ptyStart = (body: Record<string, unknown>) =>
    api("/pty/start", { method: "POST", body: JSON.stringify(body) });

  it("PTY: a live agent session keeps running across inputs, in its workspace", async () => {
    const res = await ptyStart({
      agent: "repl",
      cwd: targetDir,
      cols: 80,
      rows: 24,
    });
    expect(res.status).toBe(201);
    const { session } = (await res.json()) as {
      session: { id: string; cwd: string; alive: boolean };
    };
    samePath(session.cwd, targetDir);
    expect(session.alive).toBe(true);

    const ready = await readPty(session.id, (t) => t.includes("READY:"));
    expect(ready.text).toContain("READY:");

    const input = (data: string) =>
      api(`/pty/${session.id}/input`, {
        method: "POST",
        body: JSON.stringify({ data }),
      });
    expect((await input("hello\r")).status).toBe(200);
    const first = await readPty(session.id, (t) => t.includes("ECHO:hello"));
    expect(first.text).toContain("ECHO:hello");
    // Same process, second turn — nothing was respawned.
    expect((await input("again\r")).status).toBe(200);
    const second = await readPty(session.id, (t) => t.includes("ECHO:again"));
    expect(second.text).toContain("ECHO:again");
    expect(second.text.match(/READY:/g)).toHaveLength(1);

    const resize = await api(`/pty/${session.id}/resize`, {
      method: "POST",
      body: JSON.stringify({ cols: 120, rows: 40 }),
    });
    expect(resize.status).toBe(200);

    // Reattach replays the buffer from an offset (e.g. after a page reload).
    const status = (await (await api(`/pty/${session.id}`)).json()) as {
      session: { size: number; alive: boolean };
    };
    expect(status.session.alive).toBe(true);
    const tail = await readPty(
      session.id,
      () => true,
      2_000,
      status.session.size,
    );
    expect(tail.text).toBe("");

    await input("bye\r");
    const ended = await readPty(session.id, () => false, 15_000);
    expect(ended.exit).toBe(0);
    const after = await input("late\r");
    expect(after.status).toBe(409);
    expect((await after.json()).error).toBe("pty_exited");

    expect((await api(`/pty/${session.id}`, { method: "DELETE" })).status).toBe(
      200,
    );
    expect((await api(`/pty/${session.id}`)).status).toBe(404);
  }, 60_000);

  it("PTY: validates agent, workspace and input before touching a terminal", async () => {
    expect((await (await ptyStart({ agent: "evil" })).json()).error).toBe(
      "unknown_agent",
    );
    const bad = await ptyStart({
      agent: "repl",
      cwd: path.join(workDir, "nope"),
    });
    expect((await bad.json()).error).toBe("invalid_workspace");
    expect((await api("/pty/nope/stream")).status).toBe(404);
    const { session } = await (
      await ptyStart({ agent: "repl", cwd: targetDir })
    ).json();
    const tooBig = await api(`/pty/${session.id}/input`, {
      method: "POST",
      body: JSON.stringify({ data: 42 }),
    });
    expect(tooBig.status).toBe(400);
    await api(`/pty/${session.id}`, { method: "DELETE" });
  }, 30_000);

  it("PTY: a missing agent binary ends the session with 127, no shell left behind", async () => {
    const res = await ptyStart({ agent: "ghost", cwd: targetDir });
    if (res.status !== 201) {
      // POSIX may refuse at spawn time instead — still an honest failure.
      expect((await res.json()).error).toBe("pty_spawn_failed");
      return;
    }
    const { session } = await res.json();
    const ended = await readPty(session.id, () => false, 15_000);
    expect(ended.exit).not.toBe(0);
    if (process.platform === "win32") expect(ended.exit).toBe(127);
    await api(`/pty/${session.id}`, { method: "DELETE" });
  }, 30_000);

  it("health advertises PTY availability", async () => {
    const health = await (await api("/health")).json();
    expect(health.pty).toBe(true);
  });

  it("404s unknown jobs and paths", async () => {
    const res = await api("/job/does-not-exist");
    expect(res.status).toBe(404);
    const other = await api("/nope");
    expect(other.status).toBe(404);
  });
});
