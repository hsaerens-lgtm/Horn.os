// How wide does the pendant's cone have to be for its shadows to land inside it?
//
// test/rays.mjs traced every large object from every light and found the same
// verdict every time: OUTSIDE CONE. The shadows are computed, they go exactly
// where the geometry says, and they land where the light does not reach — and
// outside a spot's cone there is no light to block, so there is nothing to see.
//
// The arithmetic is small. A spot 1.9 m above the floor with a half-angle A
// lights a circle of radius 1.9 tan(A). At 56 degrees that is 2.8 m. A player
// sits 1.2 m from the axis and its head throws a shadow out to 2.5-4 m, which
// is past the edge of the circle. Widening to 65 degrees reaches 4.1 m.
//
// This sweeps angle and range and counts, for a fixed set of subjects, how many
// of their shadows land somewhere lit — and then whether the pixel there really
// does go darker. Both numbers matter: the first is geometry, the second is
// whether three.js agrees.

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "out");
mkdirSync(OUT, { recursive: true });
const SHOT = { pos: [0.62, 1.58, 2.52], target: [-0.05, 0.94, -0.05] };

// angle in radians, distance in metres, intensity
const CASES = [
  { name: "as-is            0.98rad/5.2m", angle: 0.98, distance: 5.2, intensity: 38 },
  { name: "wider            1.13rad/6.5m", angle: 1.13, distance: 6.5, intensity: 38 },
  { name: "wider            1.25rad/7.5m", angle: 1.25, distance: 7.5, intensity: 38 },
  { name: "wider+dimmer     1.25rad/7.5m", angle: 1.25, distance: 7.5, intensity: 26 },
  { name: "widest           1.4rad/9m", angle: 1.4, distance: 9, intensity: 38 },
];

const browser = await chromium.launch({ channel: "chromium", args: ["--enable-unsafe-swiftshader"] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 704 } })).newPage();
page.on("pageerror", (e) => console.log("  [page error]", e.message));
await page.goto("http://localhost:4330/dnd/?debug=1", { waitUntil: "load" });
await page.waitForFunction(() => document.getElementById("loader")?.classList.contains("hidden"), null, { timeout: 180000 });
await page.waitForFunction(() => !!window.__debug, null, { timeout: 90000 });
await page.evaluate(([p, t]) => window.__debug.pin(p, t), [SHOT.pos, SHOT.target]);
await page.waitForTimeout(400);

// Fix the subject list once, so every case is scored on the same objects. The
// players are picked by name; the rest by size.
await page.evaluate(async () => {
  const THREE = await import("three");
  const { scene } = window.__debug;
  const tmp = new THREE.Box3();
  const out = [];
  const seen = new Set();
  const PLAYER = /^(Torso|Head)/;
  scene.traverse((o) => {
    if (!o.isMesh || o.isSprite || o.isSkinnedMesh || !o.visible) return;
    tmp.setFromObject(o);
    if (!isFinite(tmp.min.y)) return;
    const h = tmp.max.y - tmp.min.y;
    const w = Math.max(tmp.max.x - tmp.min.x, tmp.max.z - tmp.min.z);
    const player = PLAYER.test(o.name);
    if (!player && (h < 0.18 || h > 1.2 || w > 1.4 || tmp.min.y > 1.15)) return;
    const cx = (tmp.min.x + tmp.max.x) / 2;
    const cz = (tmp.min.z + tmp.max.z) / 2;
    const key = `${Math.round(cx * 6)},${Math.round(cz * 6)},${player ? "p" : Math.round(h * 6)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ name: (player ? "PLAYER " : "") + (o.name || "(item)"), top: [cx, tmp.max.y - 0.02, cz], at: [+cx.toFixed(2), +cz.toFixed(2)] });
  });
  // Players first: the room is built before them, so a plain traversal order
  // put every one of them past the cut and the first run of this scored nothing
  // but furniture while claiming to be about the characters.
  out.sort((a, b) => (b.name.startsWith("PLAYER") ? 1 : 0) - (a.name.startsWith("PLAYER") ? 1 : 0));
  window.__subjects = out.slice(0, 24);
  scene.traverse((o) => {
    if (o.isSpotLight && o.position.y > 1.5 && Math.abs(o.position.x) < 0.2) window.__key = o;
  });
});

const evaluateCase = () =>
  page.evaluate(async () => {
    const THREE = await import("three");
    const { scene, renderer, camera } = window.__debug;
    const key = window.__key;
    const lp = key.getWorldPosition(new THREE.Vector3());
    const axis = key.target.getWorldPosition(new THREE.Vector3()).sub(lp).normalize();

    const W = 900;
    const H = 500;
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
    const lum = (b, x, y) => {
      if (x < 0 || x >= W || y < 0 || y >= H) return null;
      const o = (y * W + x) * 4;
      return 0.2126 * h2f(b[o]) + 0.7152 * h2f(b[o + 1]) + 0.0722 * h2f(b[o + 2]);
    };
    const on = grab();
    key.castShadow = false;
    const off = grab();
    key.castShadow = true;
    key.shadow.needsUpdate = true;

    const solids = [];
    scene.traverse((o) => o.isMesh && !o.isSprite && o.visible && solids.push(o));
    const ray = new THREE.Raycaster();
    ray.far = 40;

    let lit = 0;
    let dark = 0;
    let players = 0;
    let playersDark = 0;
    let total = 0;
    for (const s of window.__subjects) {
      const target = new THREE.Vector3(...s.top);
      ray.set(lp, target.clone().sub(lp).normalize());
      const reach = lp.distanceTo(target) + 0.06;
      const past = ray.intersectObjects(solids, false).find((h) => h.distance > reach);
      if (!past) continue;
      total++;
      const isPlayer = s.name.startsWith("PLAYER");
      if (isPlayer) players++;
      const d = past.point.distanceTo(lp);
      const ang = Math.acos(Math.min(1, axis.dot(past.point.clone().sub(lp).normalize())));
      const inside = ang <= key.angle && d <= key.distance;
      if (!inside) continue;
      lit++;
      const v = past.point.clone().project(camera);
      const px = [Math.round((v.x * 0.5 + 0.5) * (W - 1)), H - 1 - Math.round((-v.y * 0.5 + 0.5) * (H - 1))];
      const a = lum(on, px[0], px[1]);
      const b = lum(off, px[0], px[1]);
      if (a != null && b != null && b > 1e-5 && (b - a) / b > 0.03) {
        dark++;
        if (isPlayer) playersDark++;
      }
    }
    // and the overall picture, so a win here can be checked against a loss there
    let mean = 0;
    let crushed = 0;
    for (let i = 0; i < W * H; i++) {
      const l = lum(on, i % W, Math.floor(i / W));
      mean += l;
      if (l < 0.004) crushed++;
    }
    return { total, lit, dark, players, playersDark, frameMean: +(mean / (W * H)).toFixed(4), crushedPct: +((crushed / (W * H)) * 100).toFixed(1) };
  });

// A directional light has no distance term at all, so a shadow three metres
// from the subject is exactly as dark as one three centimetres from it. That is
// the only kind of light that can put a readable shadow on a floor this far
// from any lamp — and there is one in the room already in all but name: the
// window.
await page.evaluate(async () => {
  const THREE = await import("three");
  const { scene } = window.__debug;
  const d = new THREE.DirectionalLight(0x9fc0f0, 0);
  d.position.set(-3.3, 3.2, -3.0);
  d.target.position.set(0.2, 0.4, 0.4);
  d.castShadow = true;
  d.shadow.mapSize.set(2048, 2048);
  d.shadow.camera.left = -4.2;
  d.shadow.camera.right = 4.2;
  d.shadow.camera.top = 3.4;
  d.shadow.camera.bottom = -2.2;
  d.shadow.camera.near = 0.2;
  d.shadow.camera.far = 12;
  d.shadow.bias = -0.0012;
  d.shadow.normalBias = 0.03;
  d.shadow.camera.updateProjectionMatrix();
  scene.add(d);
  scene.add(d.target);
  window.__sun = d;
});

const evaluateSun = () =>
  page.evaluate(async () => {
    const THREE = await import("three");
    const { scene, renderer, camera } = window.__debug;
    const sun = window.__sun;
    const dir = sun.target.getWorldPosition(new THREE.Vector3()).sub(sun.getWorldPosition(new THREE.Vector3())).normalize();
    const W = 900;
    const H = 500;
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
    const lum = (b, x, y) => {
      if (x < 0 || x >= W || y < 0 || y >= H) return null;
      const o = (y * W + x) * 4;
      return 0.2126 * h2f(b[o]) + 0.7152 * h2f(b[o + 1]) + 0.0722 * h2f(b[o + 2]);
    };
    const on = grab();
    sun.castShadow = false;
    const off = grab();
    sun.castShadow = true;
    sun.shadow.needsUpdate = true;
    const solids = [];
    scene.traverse((o) => o.isMesh && !o.isSprite && o.visible && solids.push(o));
    const ray = new THREE.Raycaster();
    ray.far = 40;
    let lit = 0;
    let dark = 0;
    let players = 0;
    let playersDark = 0;
    let total = 0;
    for (const s of window.__subjects) {
      const target = new THREE.Vector3(...s.top);
      // a directional light comes from infinitely far: back off along -dir
      const origin = target.clone().addScaledVector(dir, -8);
      ray.set(origin, dir);
      const reach = origin.distanceTo(target) + 0.06;
      const past = ray.intersectObjects(solids, false).find((h) => h.distance > reach);
      if (!past) continue;
      total++;
      lit++; // no cone, no range: a directional light reaches everywhere
      const isPlayer = s.name.startsWith("PLAYER");
      if (isPlayer) players++;
      const v = past.point.clone().project(camera);
      const px = [Math.round((v.x * 0.5 + 0.5) * (W - 1)), H - 1 - Math.round((-v.y * 0.5 + 0.5) * (H - 1))];
      const a = lum(on, px[0], px[1]);
      const b = lum(off, px[0], px[1]);
      if (a != null && b != null && b > 1e-5 && (b - a) / b > 0.03) {
        dark++;
        if (isPlayer) playersDark++;
      }
    }
    let mean = 0;
    let crushed = 0;
    for (let i = 0; i < W * H; i++) {
      const l = lum(on, i % W, Math.floor(i / W));
      mean += l;
      if (l < 0.004) crushed++;
    }
    return { total, lit, dark, players, playersDark, frameMean: +(mean / (W * H)).toFixed(4), crushedPct: +((crushed / (W * H)) * 100).toFixed(1) };
  });

for (const c of CASES) {
  await page.evaluate((cc) => {
    const k = window.__key;
    k.angle = cc.angle;
    k.distance = cc.distance;
    k.intensity = cc.intensity;
    k.shadow.needsUpdate = true;
  }, c);
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(OUT, `cone-${c.angle}-${c.distance}.png`), timeout: 180000 });
  const r = await evaluateCase();
  console.log(
    `${c.name.padEnd(30)} shadows landing in the lit circle ${String(r.lit).padStart(2)}/${r.total}` +
      `   actually darker ${String(r.dark).padStart(2)}   players ${r.playersDark}/${r.players}   frame ${r.frameMean}`
  );
}
// Now the same measurement, but scoring the directional light's own shadow.
await page.evaluate((c) => {
  const k = window.__key;
  k.angle = c.angle;
  k.distance = c.distance;
  k.intensity = c.intensity;
  k.shadow.needsUpdate = true;
}, CASES[0]);
console.log("\n--- a directional light through the window, scored on its own shadow ---");
for (const intensity of [0.6, 1.2, 2.0, 3.0]) {
  await page.evaluate((i) => {
    window.__sun.intensity = i;
    window.__sun.shadow.needsUpdate = true;
    // score the sun, not the pendant
    window.__scoreLight = window.__sun;
  }, intensity);
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(OUT, `sun-${intensity}.png`), timeout: 180000 });
  const r = await evaluateSun();
  console.log(
    `directional intensity ${String(intensity).padEnd(4)}  shadows in range ${String(r.lit).padStart(2)}/${r.total}` +
      `   actually darker ${String(r.dark).padStart(2)}   players ${r.playersDark}/${r.players}   frame ${r.frameMean}  crushed ${r.crushedPct}%`
  );
}
await browser.close();
