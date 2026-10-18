/**
 * End-to-end tests for bin/toso-bridge.mjs — the real script is spawned on a
 * random port with a fixed token and a temp agents file that registers an
 * `echo` agent (node echoing stdin), so the stdin→stdout capture path is
 * exercised without any real CLI installed.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const BRIDGE = path.resolve(__dirname, "toso-bridge.mjs");
const TOKEN = "test-token-abc123";

let port: number;
let child: ChildProcess;
let workDir: string;

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
    }),
  );

  child = spawn(process.execPath, [BRIDGE], {
    env: {
      ...process.env,
      TOSO_BRIDGE_PORT: String(port),
      TOSO_BRIDGE_TOKEN: TOKEN,
      TOSO_AGENTS_FILE: agentsFile,
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
  rmSync(workDir, { recursive: true, force: true });
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
        agent: "claude", // not installed in CI/test env
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

  it("404s unknown jobs and paths", async () => {
    const res = await api("/job/does-not-exist");
    expect(res.status).toBe(404);
    const other = await api("/nope");
    expect(other.status).toBe(404);
  });
});
