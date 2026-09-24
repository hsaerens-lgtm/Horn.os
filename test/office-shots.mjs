// Screenshots of the 3D office for judging it by eye: the wide shot, and the
// camera zoomed onto the monitor with Horn.os on it. Written to test/out/.
//
//   node test/office-shots.mjs

import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startServer, openPage } from "./e2e/harness.mjs";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "out");
mkdirSync(OUT, { recursive: true });

const server = await startServer(4344);
const { page, errors, failed, close } = await openPage(`${server.url}?debug=1&theme=light`, { width: 1440, height: 900 });
try {
  await page.waitForFunction(() => document.getElementById("loader")?.classList.contains("hidden"), null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__debug.pin([0.95, 1.48, 1.15], [-0.9, 0.98, -1.45]));
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, "office-wide.png"), timeout: 180000 });
  console.log("office-wide.png");

  await page.evaluate(() => window.__debug.pin(null));
  await page.evaluate(() => window.__office.focus());
  await page.waitForTimeout(2200);
  await page.screenshot({ path: join(OUT, "office-focus.png"), timeout: 180000 });
  console.log("office-focus.png");

  if (errors.length) console.log("errors:", errors.join(" | "));
  if (failed.length) console.log("failed:", failed.join(" | "));
} finally {
  await close();
  server.stop();
}
