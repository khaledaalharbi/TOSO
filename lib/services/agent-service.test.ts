import { afterEach, describe, expect, it, vi } from "vitest";
import { agentCommand } from "@/lib/bridge/agents";
import {
  checkBridge,
  sendPromptToAgent,
  translateToArabic,
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
  });

  it("escapes quotes and shell metacharacters inside the prompt", () => {
    const command = agentCommand("gemini", 'say "hi" & `rm -rf` $HOME');
    expect(command).toBe('gemini -p "say \\"hi\\" & \\`rm -rf\\` \\$HOME"');
  });
});
