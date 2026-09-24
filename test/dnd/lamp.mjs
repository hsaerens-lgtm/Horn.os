// Sweeping the task lamp's head, scored on the table shot.
//
// The rig bench found a head position that took deep shadow from 0.06% of the
// frame to 2.42%. Built into the scene twenty centimetres away from it, the
// same lamp scored 0.06% again — which is the useful kind of surprise, because
// it says the result is sharply positional and not a general property of "a
// lamp on the left". This finds where the cliff is.

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "out");
mkdirSync(OUT, { recursive: true });
const SHOT = { pos: [0.1, 1.32, 1.35], target: [0.05, 0.76, -0.05] };

// head position, then aim point
const CASES = [
  { name: "code-as-built", head: [-0.86, 1.14, 0.26], aim: [0.35, 0.75, -0.25] },
  { name: "bench-03", head: [-1.02, 1.12, 0.42], aim: [0.35, 0.75, -0.25] },
  { name: "bench-03-x", head: [-1.02, 1.12, 0.26], aim: [0.35, 0.75, -0.25] },
  { name: "bench-03-z", head: [-0.86, 1.12, 0.42], aim: [0.35, 0.75, -0.25] },
  { name: "lower-1.02", head: [-1.02, 1.02, 0.42], aim: [0.35, 0.75, -0.25] },
  { name: "higher-1.22", head: [-1.02, 1.22, 0.42], aim: [0.35, 0.75, -0.25] },
  { name: "aim-flatter", head: [-1.02, 1.12, 0.42], aim: [0.6, 0.76, -0.1] },
];

const browser = await chromium.launch({ channel: "chromium", args: ["--enable-unsafe-swiftshader"] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 704 } })).newPage();
page.on("pageerror", (e) => console.log("  [page error]", e.message));
await page.goto("http://localhost:4330/dnd/?debug=1", { waitUntil: "load" });
await page.waitForFunction(() => document.getElementById("loader")?.classList.contains("hidden"), null, { timeout: 180000 });
await page.waitForFunction(() => !!window.__debug, null, { timeout: 60000 });
await page.evaluate(([p, t]) => window.__debug.pin(p, t), [SHOT.pos, SHOT.target]);

await page.evaluate(() => {
  const { scene } = window.__debug;
  // the task lamp is the only casting spot that is not the pendant
  scene.traverse((o) => {
    if (o.isSpotLight && o.castShadow && o.position.y < 1.5) window.__task = o;
  });
});

const score = () =>
  page.evaluate(async () => {
    const THREE = await import("three");
    const { scene, renderer, camera } = window.__debug;
    const W = 800;
    const H = 440;
    const grab = () => {
      const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(prev);
      const b = new Uint16Array(W * H * 4);
      renderer.readRenderTargetPixels(rt, 0, 0, W, H, b);
      rt.dispose();
      return b;
    };
    const h2f = (h) => {
      const s = h & 0x8000 ? -1 : 1;
      const e = (h >> 10) & 0x1f;
      const f = h & 0x3ff;
      if (e === 0) return s * Math.pow(2, -14) * (f / 1024);
      if (e === 31) return NaN;
      return s * Math.pow(2, e - 15) * (1 + f / 1024);
    };
    const filmic = (x) => {
      x *= 0.88;
      return Math.max(0, Math.min(1, (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)));
    };
    const srgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
    const tone = (b, i) => srgb(filmic(0.2126 * h2f(b[i]) + 0.7152 * h2f(b[i + 1]) + 0.0722 * h2f(b[i + 2])));
    const t = window.__task;
    const on = grab();
    t.castShadow = false;
    const off = grab();
    t.castShadow = true;
    t.shadow.needsUpdate = true;
    let f = 0;
    let r = 0;
    let d = 0;
    for (let i = 0; i < W * H; i++) {
      const delta = Math.abs(tone(on, i * 4) - tone(off, i * 4));
      if (delta > 0.02) f++;
      if (delta > 0.1) r++;
      if (delta > 0.25) d++;
    }
    const pct = (n) => +((n / (W * H)) * 100).toFixed(2);
    return { faint: pct(f), readable: pct(r), deep: pct(d) };
  });

for (const c of CASES) {
  await page.evaluate((cc) => {
    const t = window.__task;
    t.position.set(...cc.head);
    t.target.position.set(...cc.aim);
    t.target.updateMatrixWorld(true);
    t.shadow.needsUpdate = true;
  }, c);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, `lamp-${c.name}.png`), timeout: 180000 });
  const s = await score();
  console.log(`${c.name.padEnd(16)} head ${JSON.stringify(c.head).padEnd(22)} faint ${String(s.faint).padStart(6)}%  readable ${String(s.readable).padStart(6)}%  deep ${String(s.deep).padStart(6)}%`);
}
await browser.close();
