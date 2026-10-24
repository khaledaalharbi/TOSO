#!/usr/bin/env node
/**
 * dev:all — one command, whole loop: `next dev` + `toso-bridge`.
 * start:all (`--prod`) — the same loop on a production build: builds once if
 * `.next` is missing, then `next start` + `toso-bridge`. Still local-only:
 * TOSO is a personal tool that runs on the machine that has your agents.
 *
 * The bridge prints its token, but you rarely need it: it also writes a
 * session file that /api/bridge/session serves, so the UI auto-pairs on the
 * first send to an agent. Ctrl+C stops both.
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next");
const BRIDGE_PORT =
  Number.parseInt(process.env.TOSO_BRIDGE_PORT ?? "", 10) || 8676;

const prod = process.argv.includes("--prod");
const nextArgs = process.argv.slice(2).filter((arg) => arg !== "--prod");
// Personal tool: listen on this machine only unless the user asks otherwise
// (-H 0.0.0.0) — the app's API routes can carry a server key and must not
// be reachable from the LAN by default.
if (!nextArgs.some((arg) => arg === "-H" || arg.startsWith("--hostname"))) {
  nextArgs.push("-H", "127.0.0.1");
}
const children = [];

/** Something already answering on the bridge port → reuse it, don't fight it. */
function portInUse(port) {
  return new Promise((resolve) => {
    const probe = net.connect(port, "127.0.0.1");
    probe.once("connect", () => {
      probe.destroy();
      resolve(true);
    });
    probe.once("error", () => resolve(false));
    probe.setTimeout(1200, () => {
      probe.destroy();
      resolve(false);
    });
  });
}

/** Open the app URL in the default browser — once, when Next prints it. */
let opened = false;
function maybeOpenBrowser(line) {
  if (opened) return;
  const match = line.match(/Local:\s+(https?:\/\/\S+)/);
  if (!match) return;
  opened = true;
  const url = match[1].replace(/\x1b\[[0-9;]*m/g, "").trim();
  const [cmd, args] =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : process.platform === "darwin"
        ? ["open", [url]]
        : ["xdg-open", [url]];
  spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
}

function run(name, args, color) {
  // Everything goes through process.execPath — no shell, no quoting issues
  // on Windows paths containing spaces ("C:\Program Files\nodejs").
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const prefix = (chunk) => {
    const text = chunk.toString();
    if (name === "app") text.split("\n").forEach(maybeOpenBrowser);
    return text
      .split("\n")
      .filter((line, i, arr) => line !== "" || i < arr.length - 1)
      .map((line) => `${color}[${name.padEnd(6)}]${"\u001b[0m"} ${line}`)
      .join("\n");
  };
  child.stdout.on("data", (chunk) =>
    process.stdout.write(prefix(chunk) + "\n"),
  );
  child.stderr.on("data", (chunk) =>
    process.stderr.write(prefix(chunk) + "\n"),
  );
  child.on("exit", (code) => {
    if (name === "app") {
      shutdown(code ?? 0); // the app is the lifecycle owner
    } else {
      // The bridge is optional — its failure must not kill the app.
      console.log(
        `[${name}] exited (${code}) — the app keeps running without a bridge (restart it with npm run bridge)`,
      );
    }
  });
  children.push(child);
  return child;
}

let exiting = false;
function shutdown(code) {
  if (exiting) return;
  exiting = true;
  for (const child of children) {
    try {
      child.kill();
    } catch {
      /* already gone */
    }
  }
  setTimeout(() => process.exit(code), 300).unref();
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

if (prod && !existsSync(path.join(root, ".next", "BUILD_ID"))) {
  console.log("[app   ] no production build yet — running next build once…");
  const build = spawnSync(process.execPath, [nextCli, "build"], {
    cwd: root,
    stdio: "inherit",
  });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

run("app", [nextCli, prod ? "start" : "dev", ...nextArgs], "\u001b[36m");

if (await portInUse(BRIDGE_PORT)) {
  console.log(
    `[bridge] port ${BRIDGE_PORT} already answering — reusing the running bridge`,
  );
} else {
  run("bridge", ["bin/toso-bridge.mjs"], "\u001b[35m");
}
