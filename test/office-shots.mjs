// Screenshots of the 3D office for judging it by eye: the wide shot in each
// phase of the day, the camera zoomed onto the monitor, and two close-ups.
// Written to test/out/.
//
//   node test/office-shots.mjs

import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startServer, openPage } from "./e2e/harness.mjs";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "out");
mkdirSync(OUT, { recursive: true });

const WIDE = [[0.78, 1.46, 0.95], [-1.02, 1.0, -1.5]];
const CLOSE = {
  cat: [[-1.3, 1.25, 0.2], [-2.2, 0.85, -0.62]],
  guitar: [[0.6, 1.0, -0.6], [0.1, 0.55, -1.8]],
};

const server = await startServer(4344);
const { page, errors, failed, close } = await openPage(`${server.url}?debug=1&phase=day`, { width: 1440, height: 900 });
const shot = async (name) => {
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT, `${name}.png`), timeout: 180000 });
  console.log(`${name}.png`);
};
try {
  await page.waitForFunction(() => document.getElementById("loader")?.classList.contains("hidden"), null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  await page.evaluate((p) => window.__debug.pin(...p), WIDE);
  await shot("office-day");
  for (const [name, p] of Object.entries(CLOSE)) {
    await page.evaluate((p) => window.__debug.pin(...p), p);
    await shot(`office-${name}`);
  }
  await page.evaluate((p) => window.__debug.pin(...p), WIDE);
  for (const phase of ["sunset", "night"]) {
    await page.evaluate((ph) => window.__office.setPhase(ph, 10), phase);
    await page.waitForTimeout(400);
    await shot(`office-${phase}`);
  }
  await page.evaluate(() => window.__office.setPhase("day", 10));
  await page.evaluate(() => window.__debug.pin(null));
  await page.evaluate(() => window.__office.focus());
  await page.waitForTimeout(1800);
  await shot("office-focus");
  if (errors.length) console.log("errors:", errors.join(" | "));
  if (failed.length) console.log("failed:", failed.join(" | "));
} finally {
  await close();
  server.stop();
}
