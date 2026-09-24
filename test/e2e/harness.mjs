// Shared plumbing for the end-to-end tests: a static server per test file and
// a real Chromium page that records what went wrong while it loaded.
//
// The "chromium" channel is the full browser, not Playwright's headless shell:
// the shell lost WebGL on this machine during the D&D work, and the D&D smoke
// test needs WebGL.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chromium } from "playwright";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function startServer(port) {
  const proc = spawn("python", ["serve.py", String(port)], { cwd: ROOT, stdio: "ignore" });
  const url = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return { url, stop: () => proc.kill() };
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  proc.kill();
  throw new Error(`static server did not start on port ${port}`);
}

export async function openPage(url, { width = 1280, height = 800, reducedMotion = "no-preference" } = {}) {
  const browser = await chromium.launch({ channel: "chromium" });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion });
  const page = await ctx.newPage();
  const errors = [];
  const failed = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(url, { waitUntil: "load" });
  return { page, errors, failed, close: () => browser.close() };
}
