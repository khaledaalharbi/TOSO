import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  existsSync,
  copyFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const SESSION_FILE = path.join(tmpdir(), "toso-bridge-session.json");
const BACKUP_DIR = mkdtempSync(path.join(tmpdir(), "toso-session-backup-"));
const BACKUP_FILE = path.join(BACKUP_DIR, "session.json");
const hadSession = existsSync(SESSION_FILE);
if (hadSession) copyFileSync(SESSION_FILE, BACKUP_FILE);

function writeSession(data: unknown) {
  writeFileSync(SESSION_FILE, JSON.stringify(data));
}

const healthy = () =>
  ({ ok: true, json: async () => ({ ok: true }) }) as Response;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/bridge/session", () => {
  it("returns 404 when no session file exists", async () => {
    rmSync(SESSION_FILE, { force: true });
    const res = await GET();
    expect(res.status).toBe(404);
    expect((await res.json()).reason).toBe("no_session");
  });

  it("returns the url+token after proving the bridge is alive", async () => {
    writeSession({
      port: 8676,
      token: "tok-123",
      pid: 1234,
      startedAt: Date.now(),
    });
    const fetchMock = vi.fn().mockResolvedValue(healthy());
    vi.stubGlobal("fetch", fetchMock);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      url: "http://127.0.0.1:8676",
      token: "tok-123",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8676/health",
      expect.objectContaining({
        headers: { "x-toso-token": "tok-123" },
      }),
    );
  });

  it("never serves a stale or dead-bridge session", async () => {
    writeSession({
      port: 8676,
      token: "old",
      pid: 1,
      startedAt: Date.now() - 25 * 60 * 60 * 1000,
    });
    const res = await GET();
    expect(res.status).toBe(404);

    writeSession({ port: 8676, token: "x", startedAt: Date.now() });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("refused")));
    const dead = await GET();
    expect(dead.status).toBe(404);
    expect((await dead.json()).reason).toBe("dead_bridge");
  });

  it("rejects malformed session payloads", async () => {
    writeSession({ port: "8676", token: 42 });
    const res = await GET();
    expect(res.status).toBe(404);
  });
});

// Restore whatever session file existed before the suite ran.
process.on("exit", () => {
  try {
    if (hadSession) copyFileSync(BACKUP_FILE, SESSION_FILE);
    else rmSync(SESSION_FILE, { force: true });
    rmSync(BACKUP_DIR, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
});
