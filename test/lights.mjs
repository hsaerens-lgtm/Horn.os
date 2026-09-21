// Trying light rigs against the table shot, and scoring them.
//
// The complaint is that there are no shadows on the table. The reason is
// geometry, not settings: the only light that casts hangs 1.16 m directly above
// the tabletop, so a 4 cm die throws a 1 cm shadow straight down, underneath
// itself, where the object it belongs to is already hiding it. Shadow length is
//
//     height of the object  x  its distance from the light axis
//     ------------------------------------------------------------
//          height of the light above the surface
//
// which for anything small under a high central lamp is nothing. No amount of
// map resolution or bias fixes that.
//
// So this tries rigs rather than parameters, and scores each by how much of the
// table shot is darkened by a shadow, at three depths. `deep` is the one that
// decides whether a shadow reads as a shadow.

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "out");
mkdirSync(OUT, { recursive: true });

const SHOT = { pos: [0.1, 1.32, 1.35], target: [0.05, 0.76, -0.05] };

// Each rig is applied in the page. `add` is a spot light described in world
// space; `pendant` moves the existing one.
const RIGS = [
  { name: "00-as-is" },
  { name: "01-pendant-lower", pendant: { y: 1.55 } },
  { name: "02-pendant-lower-harder", pendant: { y: 1.55, penumbra: 0.25, angle: 0.8 } },
  {
    name: "03-desk-lamp-left",
    add: { pos: [-1.02, 1.12, 0.42], target: [0.35, 0.75, -0.25], colour: 0xffd9a8, intensity: 9, angle: 0.95, penumbra: 0.35 },
  },
  {
    name: "04-desk-lamp-left-low",
    add: { pos: [-0.98, 0.99, 0.46], target: [0.5, 0.75, -0.2], colour: 0xffd9a8, intensity: 7, angle: 1.0, penumbra: 0.3 },
  },
  {
    name: "05-desk-lamp-plus-lower-pendant",
    pendant: { y: 1.62 },
    add: { pos: [-0.98, 0.99, 0.46], target: [0.5, 0.75, -0.2], colour: 0xffd9a8, intensity: 7, angle: 1.0, penumbra: 0.3 },
  },
  {
    name: "06-desk-lamp-right",
    add: { pos: [1.0, 1.0, 0.5], target: [-0.5, 0.75, -0.25], colour: 0xffd9a8, intensity: 7, angle: 1.0, penumbra: 0.3 },
  },
];

const browser = await chromium.launch({ channel: "chromium", args: ["--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 704 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("  [page error]", e.message));

await page.goto("http://localhost:4330/?debug=1", { waitUntil: "load" });
await page.waitForFunction(() => document.getElementById("loader")?.classList.contains("hidden"), null, { timeout: 180000 });
await page.waitForFunction(() => !!window.__debug, null, { timeout: 60000 });
await page.evaluate(([p, t]) => window.__debug.pin(p, t), [SHOT.pos, SHOT.target]);

// Remember the pendant so each rig starts from the same place.
await page.evaluate(async () => {
  const { scene } = window.__debug;
  let key = null;
  scene.traverse((o) => {
    if (o.isSpotLight && o.position.y > 1.5 && Math.abs(o.position.x) < 0.2) key = o;
  });
  window.__key = key;
  window.__keyHome = { y: key.position.y, penumbra: key.penumbra, angle: key.angle };
  window.__extra = null;
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

    const casters = [];
    scene.traverse((o) => o.isLight && o.castShadow && casters.push(o));
    const on = grab();
    for (const l of casters) l.castShadow = false;
    const off = grab();
    for (const l of casters) {
      l.castShadow = true;
      l.shadow.needsUpdate = true;
    }
    let f = 0;
    let r = 0;
    let d = 0;
    let mean = 0;
    for (let i = 0; i < W * H; i++) {
      const delta = Math.abs(tone(on, i * 4) - tone(off, i * 4));
      if (delta > 0.02) f++;
      if (delta > 0.1) r++;
      if (delta > 0.25) d++;
      mean += tone(on, i * 4);
    }
    const pct = (n) => +((n / (W * H)) * 100).toFixed(2);
    return { faint: pct(f), readable: pct(r), deep: pct(d), frameMean: +(mean / (W * H)).toFixed(3) };
  });

for (const rig of RIGS) {
  await page.evaluate(async (r) => {
    const THREE = await import("three");
    const { scene } = window.__debug;
    const key = window.__key;
    const home = window.__keyHome;
    key.position.y = r.pendant?.y ?? home.y;
    key.penumbra = r.pendant?.penumbra ?? home.penumbra;
    key.angle = r.pendant?.angle ?? home.angle;
    key.shadow.needsUpdate = true;

    if (window.__extra) {
      scene.remove(window.__extra);
      scene.remove(window.__extra.target);
      window.__extra = null;
    }
    if (r.add) {
      const s = new THREE.SpotLight(r.add.colour, r.add.intensity, 4.5, r.add.angle, r.add.penumbra, 2);
      s.position.set(...r.add.pos);
      s.target.position.set(...r.add.target);
      s.castShadow = true;
      s.shadow.mapSize.set(1024, 1024);
      s.shadow.camera.near = 0.15;
      s.shadow.bias = -0.0008;
      s.shadow.normalBias = 0.012;
      scene.add(s);
      scene.add(s.target);
      window.__extra = s;
    }
  }, rig);
  await page.waitForTimeout(350);
  // SwiftShader draws a frame of this scene in seconds, not milliseconds.
  await page.screenshot({ path: join(OUT, `rig-${rig.name}.png`), timeout: 180000 });
  const s = await score();
  console.log(`${rig.name.padEnd(34)} faint ${String(s.faint).padStart(6)}%  readable ${String(s.readable).padStart(6)}%  deep ${String(s.deep).padStart(6)}%  mean ${s.frameMean}`);
}

await browser.close();
