// Several complete lighting rigs, rendered to PNG for looking at.
//
// The measurements said where the shadows land and why they were hidden; that
// part is settled. What they could not say is whether a frame *reads* as having
// shadows, which is a judgement about contrast, shape and edge that no pixel
// count makes for you. So this renders whole rigs — not one parameter at a time
// — and writes each to test/out for inspection, alongside the same numbers as
// before so the two can be compared.
//
// The working hypothesis behind the rigs: the scene has too much fill. Sixteen
// lights, three of which cast, and every one of the other thirteen pours light
// into every shadow the three make. A shadow is a ratio, and the ratio cannot
// be high while the fill is.

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "out");
mkdirSync(OUT, { recursive: true });
const WIDE = { pos: [0.62, 1.58, 2.52], target: [-0.05, 0.94, -0.05] };

const RIGS = [
  { name: "A-as-is" },
  // kill the fills that sit on top of the casters
  { name: "B-no-spill", spill: 0 },
  { name: "C-no-spill-half-env", spill: 0, env: 0.35 },
  { name: "D-no-spill-half-env-moon3", spill: 0, env: 0.35, moon: 3.2 },
  { name: "E-no-spill-env0.45-moon3-key0.5", spill: 0, env: 0.45, moon: 3.2, playerKey: 2.5 },
  { name: "F-no-spill-env0.3-moon4-fire-half", spill: 0, env: 0.3, moon: 4.0, playerKey: 2.0, fire: 1.4 },
];

const browser = await chromium.launch({ channel: "chromium", args: ["--enable-unsafe-swiftshader"] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 704 } })).newPage();
page.on("pageerror", (e) => console.log("  [page error]", e.message));
await page.goto("http://localhost:4330/dnd/?debug=1", { waitUntil: "load" });
await page.waitForFunction(() => document.getElementById("loader")?.classList.contains("hidden"), null, { timeout: 180000 });
await page.waitForFunction(() => !!window.__debug, null, { timeout: 90000 });
await page.evaluate(([p, t]) => window.__debug.pin(p, t), [WIDE.pos, WIDE.target]);

// find the handles once
await page.evaluate(() => {
  const { scene } = window.__debug;
  const L = {};
  scene.traverse((o) => {
    if (o.isSpotLight && o.position.y > 1.5 && Math.abs(o.position.x) < 0.2) L.key = o;
    if (o.isPointLight && Math.abs(o.position.y - 1.86) < 0.02) L.spill = o;
    if (o.isSpotLight && o.position.z > 1.5) L.playerKey = o;
    if (o.isDirectionalLight && o.castShadow) L.moon = o;
    if (o.isPointLight && o.position.x < -2 && o.position.y < 0.7) L.fire = o;
  });
  window.__L = L;
  window.__home = {
    spill: L.spill.intensity,
    env: scene.environmentIntensity,
    moon: L.moon.intensity,
    playerKey: L.playerKey.intensity,
    fire: L.fire.intensity,
  };
});

const measure = () =>
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
    const casters = [];
    scene.traverse((o) => o.isLight && o.castShadow && casters.push(o));
    const on = grab();
    for (const l of casters) l.castShadow = false;
    const off = grab();
    for (const l of casters) {
      l.castShadow = true;
      l.shadow.needsUpdate = true;
    }
    let deep = 0;
    let readable = 0;
    let mean = 0;
    let crushed = 0;
    for (let i = 0; i < W * H; i++) {
      const a = tone(on, i * 4);
      const d = Math.abs(a - tone(off, i * 4));
      if (d > 0.1) readable++;
      if (d > 0.25) deep++;
      mean += a;
      if (a < 0.0625) crushed++;
    }
    const pct = (n) => +((n / (W * H)) * 100).toFixed(1);
    return { readable: pct(readable), deep: pct(deep), mean: +(mean / (W * H)).toFixed(3), crushed: pct(crushed) };
  });

for (const rig of RIGS) {
  await page.evaluate((r) => {
    const { scene } = window.__debug;
    const L = window.__L;
    const H = window.__home;
    L.spill.intensity = r.spill ?? H.spill;
    scene.environmentIntensity = r.env ?? H.env;
    L.moon.intensity = r.moon ?? H.moon;
    L.playerKey.intensity = r.playerKey ?? H.playerKey;
    L.fire.intensity = r.fire ?? H.fire;
  }, rig);
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(OUT, `variant-${rig.name}.png`), timeout: 180000 });
  const m = await measure();
  console.log(`${rig.name.padEnd(38)} readable ${String(m.readable).padStart(5)}%  deep ${String(m.deep).padStart(5)}%  mean ${m.mean}  crushed ${m.crushed}%`);
}
await browser.close();
