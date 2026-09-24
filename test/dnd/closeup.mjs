// A close capture of the small parts, for judging texel density.
// node test/closeup.mjs  -> test/out/closeup-hands.png, closeup-aerial.png
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "out");
mkdirSync(OUT, { recursive: true });
// HERMES sits at (0.46, -1.08) facing +Z; hands on the table around z -0.62.
const SHOTS = {
  "closeup-hands": { pos: [0.95, 1.05, 0.05], target: [0.5, 0.79, -0.6] },
  "closeup-aerial": { pos: [0.2, 1.42, -0.35], target: [0.52, 1.28, -1.05] },
  // PERSEUS head-on from across the table, CODEX from the side: one whole body
  // each, for judging proportion and how the joints read.
  "closeup-perseus": { pos: [-0.3, 1.1, 0.15], target: [-0.46, 0.95, -1.08] },
  "closeup-codex": { pos: [0.25, 1.05, 1.0], target: [1.42, 0.9, 0.0] },
  // CODEX's chair from behind and to the side, where a chair is actually seen.
  "closeup-chair": { pos: [2.4, 1.05, 1.15], target: [1.45, 0.5, -0.05] },
};
const b = await chromium.launch({ channel: "chromium", args: ["--enable-unsafe-swiftshader"] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 704 } })).newPage();
await p.goto("http://localhost:4330/dnd/?debug=1", { waitUntil: "load" });
await p.waitForFunction(() => document.getElementById("loader")?.classList.contains("hidden"), null, { timeout: 180000 });
await p.waitForFunction(() => !!window.__debug, null, { timeout: 90000 });
for (const [name, s] of Object.entries(SHOTS)) {
  await p.evaluate(([a, t]) => window.__debug.pin(a, t), [s.pos, s.target]);
  await p.waitForTimeout(400);
  await p.screenshot({ path: join(OUT, `${name}.png`), timeout: 60000 });
  console.log("wrote", name);
}
await b.close();
