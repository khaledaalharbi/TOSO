import { afterEach, describe, expect, it, vi } from "vitest";
import { agentCommand } from "@/lib/bridge/agents";
import {
  appendTurn,
  patchTurn,
  type AgentLog,
} from "@/components/agent-session-log";
import {
  checkBridge,
  checkWorkspace,
  listPtySessions,
  openAgentTerminal,
  sendPromptToAgent,
  translateToArabic,
  trustWorkspace,
} from "./agent-service";

const BRIDGE = { url: "http://127.0.0.1:8676", token: "tok" };

const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listPtySessions", () => {
  it("returns the bridge's sessions and cap", async () => {
    const session = { id: "s1", agent: "hermes", cwd: "C:\\A", alive: true };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(200, { ok: true, max: 8, sessions: [session] }),
        ),
    );
    expect(await listPtySessions(BRIDGE)).toMatchObject({
      state: "ok",
      max: 8,
      sessions: [session],
    });
  });

  it("names an old bridge (no GET /pty) instead of reporting zero sessions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(404, { error: "not_found" })),
    );
    expect(await listPtySessions(BRIDGE)).toEqual({ state: "outdated" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, {})));
    expect(await listPtySessions(BRIDGE)).toEqual({ state: "bad_token" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await listPtySessions(BRIDGE)).toEqual({ state: "offline" });
  });
});

describe("checkBridge", () => {
  it("reports ok with the agent list", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(200, { ok: true, agents: [{ id: "claude" }] }),
        ),
    );
    const status = await checkBridge(BRIDGE);
    expect(status).toEqual({ state: "ok", agents: [{ id: "claude" }] });
  });

  it("maps 401 to bad_token and network failure to offline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, {})));
    expect(await checkBridge(BRIDGE)).toEqual({ state: "bad_token" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await checkBridge(BRIDGE)).toEqual({ state: "offline" });
  });
});

describe("workspace + terminal bridge actions", () => {
  it("sendPromptToAgent forwards cwd and trust to /run", async () => {
    const job = { id: "j9", status: "done", output: "ok", cwd: "C:\\App" };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { ok: true, agents: [] }))
      .mockResolvedValueOnce(jsonResponse(202, { jobId: "j9", job }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendPromptToAgent(
      BRIDGE,
      "gemini",
      "hi",
      undefined,
      undefined,
      { cwd: "  C:\\App ", trust: true },
    );
    expect(result).toEqual({ ok: true, job });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      agent: "gemini",
      prompt: "hi",
      cwd: "C:\\App",
      trust: true,
    });
  });

  it("omits cwd/trust when unset so the bridge default applies", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { ok: true, agents: [] }))
      .mockResolvedValueOnce(
        jsonResponse(202, { jobId: "j", job: { id: "j", status: "done" } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await sendPromptToAgent(BRIDGE, "gemini", "hi");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      agent: "gemini",
      prompt: "hi",
    });
  });

  it("surfaces an invalid workspace as its own state, not 'offline'", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, { ok: true, agents: [] }))
        .mockResolvedValueOnce(
          jsonResponse(400, {
            error: "invalid_workspace",
            detail: "المجلد غير موجود",
          }),
        ),
    );
    const result = await sendPromptToAgent(
      BRIDGE,
      "gemini",
      "hi",
      undefined,
      undefined,
      { cwd: "C:\\nope" },
    );
    expect(result).toEqual({
      ok: false,
      status: { state: "invalid_workspace", detail: "المجلد غير موجود" },
    });
  });

  it("maps bridge action outcomes honestly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { ok: true, path: "C:\\A" })),
    );
    expect(await checkWorkspace(BRIDGE, "C:\\A")).toEqual({
      state: "ok",
      path: "C:\\A",
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(400, { error: "trust_unsupported", agent: "claude" }),
        ),
    );
    expect((await trustWorkspace(BRIDGE, "claude", "C:\\A")).state).toBe(
      "trust_unsupported",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(404, { error: "not_found" })),
    );
    const old = await openAgentTerminal(BRIDGE, "gemini");
    expect(old.state).toBe("failed");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await openAgentTerminal(BRIDGE, "gemini")).toEqual({
      state: "offline",
    });
  });
});

describe("session log helpers", () => {
  const turn = (jobId: string) => ({
    jobId,
    inputUser: "نص",
    inputWire: "text",
    outputWire: "out",
    status: "done",
  });

  it("numbers turns per agent independently", () => {
    let log: AgentLog = {};
    log = appendTurn(log, "gemini", turn("a"));
    log = appendTurn(log, "devin", turn("b"));
    log = appendTurn(log, "gemini", turn("c"));
    expect(log.gemini.map((t) => t.n)).toEqual([1, 2]);
    expect(log.devin.map((t) => t.n)).toEqual([1]);
  });

  it("patches only the matching job and is a no-op otherwise", () => {
    const log = appendTurn({}, "gemini", turn("a"));
    const patched = patchTurn(log, "gemini", "a", { outputUser: "خرج" });
    expect(patched.gemini[0].outputUser).toBe("خرج");
    expect(patchTurn(log, "gemini", "zzz", { outputUser: "x" })).toBe(log);
    expect(patchTurn(log, "devin", "a", { outputUser: "x" })).toBe(log);
  });
});

describe("sendPromptToAgent", () => {
  it("auto-pairs via /api/bridge/session when no token is stored", async () => {
    const job = { id: "j0", status: "done", output: "auto" };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          ok: true,
          url: "http://127.0.0.1:8676",
          token: "auto-token",
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { ok: true, agents: [] }))
      .mockResolvedValueOnce(jsonResponse(202, { jobId: "j0", job }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendPromptToAgent(
      { url: "", token: "" },
      "claude",
      "hi",
    );
    expect(result).toEqual({ ok: true, job });
    // The discovered token authenticated the health check.
    expect(
      (fetchMock.mock.calls[1][1]?.headers as Record<string, string>)[
        "x-toso-token"
      ],
    ).toBe("auto-token");
  });

  it("fails fast when the bridge is offline — never fabricates a run", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const result = await sendPromptToAgent(BRIDGE, "claude", "hi");
    expect(result).toEqual({ ok: false, status: { state: "offline" } });
  });

  it("returns an immediately-finished job without polling", async () => {
    const job = { id: "j1", agent: "claude", status: "done", output: "x" };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, { ok: true, agents: [] }))
        .mockResolvedValueOnce(jsonResponse(202, { jobId: "j1", job })),
    );
    const result = await sendPromptToAgent(BRIDGE, "claude", "hi");
    expect(result).toEqual({ ok: true, job });
  });

  it("polls until the job leaves running", async () => {
    const running = { id: "j2", status: "running", output: "" };
    const done = { id: "j2", status: "done", output: "final" };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, { ok: true, agents: [] }))
        .mockResolvedValueOnce(jsonResponse(202, { jobId: "j2", job: running }))
        .mockResolvedValue(jsonResponse(200, { job: done })),
    );
    const result = await sendPromptToAgent(BRIDGE, "codex", "hi");
    expect(result).toEqual({ ok: true, job: done });
  }, 10_000);

  it("maps a 401 on /run to bad_token", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, { ok: true, agents: [] }))
        .mockResolvedValueOnce(jsonResponse(401, {})),
    );
    const result = await sendPromptToAgent(BRIDGE, "gemini", "hi");
    expect(result).toEqual({ ok: false, status: { state: "bad_token" } });
  });
});

describe("translateToArabic", () => {
  it("returns the arabic text on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          fallback: false,
          arabic: "ترجمة",
          model: "gemini-3.8-flash",
        }),
      ),
    );
    const result = await translateToArabic("output", "gemini-3.8-flash");
    expect(result).toEqual({
      arabic: "ترجمة",
      model: "gemini-3.8-flash",
    });
  });

  it("forwards the BYOK header when a user key exists", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { fallback: false, arabic: "ت" }));
    vi.stubGlobal("fetch", fetchMock);
    await translateToArabic("x", "m", "user-key");
    expect(
      (fetchMock.mock.calls[0][1]?.headers as Record<string, string>)[
        "x-user-gemini-key"
      ],
    ).toBe("user-key");
  });

  it("surfaces fallback reasons instead of inventing a translation", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(200, { fallback: true, reason: "no_api_key" }),
        ),
    );
    const result = await translateToArabic("x", "m");
    expect(result).toEqual({ arabic: null, fallbackReason: "no_api_key" });
  });

  it("reports network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const result = await translateToArabic("x", "m");
    expect(result).toEqual({ arabic: null, fallbackReason: "network" });
  });
});

describe("agentCommand", () => {
  it("builds a quoted command per agent", () => {
    expect(agentCommand("claude", "do it")).toBe('claude -p "do it"');
    expect(agentCommand("codex", "do it")).toBe('codex exec "do it"');
    expect(agentCommand("gemini", "do it")).toBe('gemini -p "do it"');
    expect(agentCommand("devin", "do it")).toBe('devin -p "do it"');
    expect(agentCommand("hermes", "do it")).toBe('hermes --oneshot "do it"');
  });

  it("escapes quotes and shell metacharacters inside the prompt", () => {
    const command = agentCommand("gemini", 'say "hi" & `rm -rf` $HOME');
    expect(command).toBe('gemini -p "say \\"hi\\" & \\`rm -rf\\` \\$HOME"');
  });
});
