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

const WIDE = [[0.9, 1.46, 0.95], [-0.9, 1.0, -1.5]];
const CLOSE = {
  cat: [[-1.55, 1.12, -0.05], [-2.2, 0.86, -0.62]],
  guitar: [[0.45, 0.95, -0.95], [0.12, 0.6, -1.8]],
  window: [[-1.2, 1.55, -0.3], [-8, 0.2, -1.2]],
  shelf: [[0.6, 1.2, -0.4], [1.0, 0.95, -1.95]],
  hanging: [[-0.9, 1.9, -0.2], [-1.9, 1.75, -1.0]],
  desk: [[-0.72, 1.08, -1.1], [-0.72, 0.76, -1.62]],
  mug: [[-0.25, 0.95, -1.3], [-0.42, 0.8, -1.66]],
  mouse: [[-0.37, 0.9, -1.28], [-0.49, 0.77, -1.55]],
  pens: [[-1.15, 1.02, -1.5], [-1.3, 0.86, -1.94]],
  corner: [[-1.2, 1.3, -0.6], [-2.05, 0.9, -1.75]],
  lamp: [[-0.9, 1.25, -1.0], [-1.35, 0.95, -1.8]],
  poster: [[-0.8, 1.6, -0.9], [-0.83, 1.68, -2.1]],
};

const extra = process.argv[2] ?? "";
const server = await startServer(4344);
const { page, errors, failed, close } = await openPage(`${server.url}?debug=1&phase=day${extra}`, { width: 1440, height: 900 });
const shot = async (name) => {
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT, `${name}${process.argv[3] ?? ""}.png`), timeout: 180000 });
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
    await page.evaluate((p) => window.__debug.pin(...p), WIDE);
    await page.waitForTimeout(400);
    await shot(`office-${phase}`);
    await page.evaluate((p) => window.__debug.pin(...p), CLOSE.window);
    await shot(`office-window-${phase}`);
    await page.evaluate((p) => window.__debug.pin(...p), CLOSE.lamp);
    await shot(`office-lamp-${phase}`);
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
