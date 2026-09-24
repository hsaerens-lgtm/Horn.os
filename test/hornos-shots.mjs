// Screenshots of Horn.os for judging the design by eye: desktop light and dark,
// the Projects window, and a phone. Written to test/out/. Read them as images.

import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startServer, openPage } from "./e2e/harness.mjs";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "out");
mkdirSync(OUT, { recursive: true });

const SHOTS = [
  { name: "hornos-light", query: "?flat&theme=light", width: 1440, height: 900 },
  { name: "hornos-dark", query: "?flat&theme=dark", width: 1440, height: 900 },
  { name: "hornos-projects", query: "?flat&theme=light&debug=1", width: 1440, height: 900, projects: "freescout" },
  { name: "hornos-phone", query: "?flat&theme=light", width: 390, height: 844 },
];

const server = await startServer(4343);
try {
  for (const s of SHOTS) {
    const { page, errors, close } = await openPage(server.url + s.query, { width: s.width, height: s.height, reducedMotion: "reduce" });
    await page.waitForSelector(".chat-chips .chip");
    await page.locator(".chat-chips").getByRole("button", { name: "What has he built?", exact: true }).click();
    await page.waitForSelector(".chip-back");
    if (s.projects) await page.evaluate((id) => window.__os.open("projects", id), s.projects);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(OUT, `${s.name}.png`) });
    console.log(`${s.name}.png${errors.length ? `  errors: ${errors.join(" | ")}` : ""}`);
    await close();
  }
} finally {
  server.stop();
}
