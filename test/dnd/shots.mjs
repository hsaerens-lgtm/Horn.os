// Deterministic captures and shadow measurements, through a real browser.
//
// Why this exists: every judgement made about this scene up to now went through
// a preview pane that resized itself, stopped drawing when the window went
// behind another one, and throttled requestAnimationFrame to nothing. Three
// separate frame-rate readings taken that way were artefacts. A screenshot from
// it is a different picture every time, because the idle camera is a function
// of elapsed time, so no two captures could be compared.
//
// This pins the camera, waits for the scene to finish loading, and writes PNGs
// to test/out. It launches the full Chromium (channel "chromium"), not
// Playwright's headless_shell: the shell lost WebGL entirely partway through the
// day — every flag set returned no context — while the full binary runs on the
// machine's real GPU, which is both what users see and about a hundred times
// faster than SwiftShader. It also measures shadow depth the only way that means anything:
// render the frame twice, once with the casting light's shadow on and once
// with it off, and count how many pixels moved and by how much. "There are no
// shadows" is then a number rather than an impression.
//
//   node test/shots.mjs            against the local server on :4330
//   node test/shots.mjs --live     against GitHub Pages

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "out");
mkdirSync(OUT, { recursive: true });

const BASE = process.argv.includes("--live")
  ? "https://hsaerens-lgtm.github.io/Horn.os/dnd/"
  : "http://localhost:4330/dnd/";

// The poses. Chosen to be the shots that actually get looked at, and fixed so
// that two runs produce two comparable images.
const SHOTS = {
  wide: { pos: [0.62, 1.58, 2.52], target: [-0.05, 0.94, -0.05] },
  table: { pos: [0.1, 1.32, 1.35], target: [0.05, 0.76, -0.05] },
  players: { pos: [-1.05, 1.42, 1.35], target: [-0.35, 1.05, -0.9] },
  floor: { pos: [1.5, 1.15, 1.9], target: [-0.4, 0.05, -0.3] },
};

const page = await (async () => {
  const browser = await chromium.launch({ channel: "chromium", args: ["--enable-unsafe-swiftshader"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 704 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on("console", (m) => {
    if (m.type() === "error") console.log("  [console error]", m.text());
  });
  p.on("pageerror", (e) => console.log("  [page error]", e.message));
  p.browser = browser;
  return p;
})();

console.log(`loading ${BASE}?debug=1 …`);
await page.goto(`${BASE}?debug=1`, { waitUntil: "load" });

// The loader hides when scene.ready resolves, which is the only honest signal
// that the room, the players and the occlusion bake are all done.
await page.waitForFunction(() => document.getElementById("loader")?.classList.contains("hidden"), null, {
  timeout: 180000,
});
await page.waitForFunction(() => !!window.__debug, null, { timeout: 60000 });
console.log("scene ready");

/** Renders the current scene twice and reports what the shadows are worth. */
const measureShadows = () =>
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

    let over2 = 0;
    let over10 = 0;
    let over25 = 0;
    let mean = 0;
    for (let i = 0; i < W * H; i++) {
      const d = Math.abs(tone(on, i * 4) - tone(off, i * 4));
      mean += d;
      if (d > 0.02) over2++;
      if (d > 0.1) over10++;
      if (d > 0.25) over25++;
    }
    const pct = (n) => +((n / (W * H)) * 100).toFixed(2);
    return {
      castingLights: casters.length,
      meanDelta: +(mean / (W * H)).toFixed(4),
      // The one that decides whether a shadow is a shadow or a smudge.
      pctFaint: pct(over2),
      pctReadable: pct(over10),
      pctDeep: pct(over25),
    };
  });

const results = {};
for (const [name, { pos, target }] of Object.entries(SHOTS)) {
  await page.evaluate(([p, t]) => window.__debug.pin(p, t), [pos, target]);
  // Two frames: one to apply the pin, one drawn with it.
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, `${name}.png`), timeout: 180000 });
  results[name] = await measureShadows();
  console.log(`${name.padEnd(8)} ${JSON.stringify(results[name])}`);
}

await page.browser.close();

const worst = Math.max(...Object.values(results).map((r) => r.pctReadable));
console.log(`\nwritten to ${OUT}`);
console.log(`best readable-shadow coverage across the four shots: ${worst}% of pixels`);
