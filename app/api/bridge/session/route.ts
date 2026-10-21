/**
 * Bridge auto-pairing — lets the UI discover a locally-running TOSO bridge
 * without the user copying the token by hand.
 *
 * The bridge writes %TMP%/toso-bridge-session.json on start. This route
 * reads it, then *proves* the session live by calling /health with that
 * token — a stale file (dead bridge, rebooted machine, recycled port owned
 * by another process) answers 404 instead of handing out a dead token. Only
 * that proof counts: a bridge running for days is still a valid session.
 *
 * Same-origin only by construction: another website can reach neither this
 * route's response nor the tmp file, so the token stays scoped to the app
 * origin — matching the manual paste flow's trust boundary.
 */

import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SESSION_FILE = path.join(tmpdir(), "toso-bridge-session.json");

/**
 * Liveness is proven by /health answering with THIS token — never by the
 * file's age. A 24h cutoff once refused a healthy dev:all bridge up for 29h,
 * leaving the UI with no token ("token rejected" everywhere).
 */
export async function GET(): Promise<NextResponse> {
  let session: { port?: unknown; token?: unknown };
  try {
    session = JSON.parse(
      await readFile(SESSION_FILE, "utf8"),
    ) as typeof session;
  } catch {
    return NextResponse.json(
      { ok: false, reason: "no_session" },
      { status: 404 },
    );
  }
  if (
    typeof session?.port !== "number" ||
    !Number.isSafeInteger(session.port) ||
    session.port <= 0 ||
    session.port > 65535 ||
    typeof session.token !== "string" ||
    !session.token
  ) {
    return NextResponse.json(
      { ok: false, reason: "no_session" },
      { status: 404 },
    );
  }

  const url = `http://127.0.0.1:${session.port}`;
  try {
    const health = await fetch(`${url}/health`, {
      headers: { "x-toso-token": session.token },
      signal: AbortSignal.timeout(2000),
      cache: "no-store",
    });
    if (!health.ok) throw new Error(String(health.status));
    const payload = (await health.json().catch(() => null)) as {
      ok?: boolean;
    } | null;
    if (!payload?.ok) throw new Error("bad health");
  } catch {
    return NextResponse.json(
      { ok: false, reason: "dead_bridge" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, url, token: session.token });
}
