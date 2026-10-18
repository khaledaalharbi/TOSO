#!/usr/bin/env node
/**
 * dev:all — one command, whole loop: `next dev` + `toso-bridge`.
 *
 * The bridge prints its token, but you rarely need it: it also writes a
 * session file that /api/bridge/session serves, so the UI auto-pairs on the
 * first "إلى الوكيل" click. Ctrl+C stops both.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next");

const children = [];

function run(name, args, color) {
  // Everything goes through process.execPath — no shell, no quoting issues
  // on Windows paths containing spaces ("C:\Program Files\nodejs").
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const prefix = (chunk) =>
    chunk
      .toString()
      .split("\n")
      .filter((line, i, arr) => line !== "" || i < arr.length - 1)
      .map((line) => `${color}[${name}]${"\u001b[0m"} ${line}`)
      .join("\n");
  child.stdout.on("data", (chunk) =>
    process.stdout.write(prefix(chunk) + "\n"),
  );
  child.stderr.on("data", (chunk) =>
    process.stderr.write(prefix(chunk) + "\n"),
  );
  child.on("exit", (code) => {
    console.log(`[${name}] exited (${code}) — shutting down the other`);
    shutdown(code ?? 0);
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

run("app   ", [nextCli, "dev", ...process.argv.slice(2)], "\u001b[36m");
run("bridge", ["bin/toso-bridge.mjs"], "\u001b[35m");
