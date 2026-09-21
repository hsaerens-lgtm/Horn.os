// Is the shadow missing, too weak, or simply hidden?
//
// The previous runs reported almost no landing point going darker, even when
// the geometry said the shadow fell somewhere lit. There is a third possibility
// they could not tell apart, and it is the one that matters: a shadow cast
// directly away from the camera lands *behind* the thing casting it, where the
// caster itself hides it. Sampling that pixel reads the caster, not the shadow.
//
// So every landing point now gets a visibility test first — a ray back to the
// camera — and the verdict separates three cases:
//
//   HIDDEN      the camera cannot see that spot at all
//   TOO WEAK    visible, lit, but the pixel barely moves
//   READS       visible and measurably darker
//
// Which tells us what to change. HIDDEN is a direction problem and no amount of
// intensity fixes it; TOO WEAK is an intensity or falloff problem and moving
// the light will not help.

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "out");
mkdirSync(OUT, { recursive: true });
const SHOT = { pos: [0.62, 1.58, 2.52], target: [-0.05, 0.94, -0.05] };

const browser = await chromium.launch({ channel: "chromium", args: ["--enable-unsafe-swiftshader"] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 704 } })).newPage();
page.on("pageerror", (e) => console.log("  [page error]", e.message));
await page.goto("http://localhost:4330/?debug=1", { waitUntil: "load" });
await page.waitForFunction(() => document.getElementById("loader")?.classList.contains("hidden"), null, { timeout: 180000 });
await page.waitForFunction(() => !!window.__debug, null, { timeout: 90000 });
await page.evaluate(([p, t]) => window.__debug.pin(p, t), [SHOT.pos, SHOT.target]);
await page.waitForTimeout(400);

const out = await page.evaluate(async () => {
  const THREE = await import("three");
  const { scene, renderer, camera } = window.__debug;

  /* subjects: the players by name, then the biggest other things */
  const tmp = new THREE.Box3();
  const all = [];
  const seen = new Set();
  scene.traverse((o) => {
    if (!o.isMesh || o.isSprite || o.isSkinnedMesh || !o.visible) return;
    tmp.setFromObject(o);
    if (!isFinite(tmp.min.y)) return;
    const h = tmp.max.y - tmp.min.y;
    const w = Math.max(tmp.max.x - tmp.min.x, tmp.max.z - tmp.min.z);
    const player = /^Torso/.test(o.name);
    if (!player && (h < 0.18 || h > 1.2 || w > 1.4 || tmp.min.y > 1.15)) return;
    const cx = (tmp.min.x + tmp.max.x) / 2;
    const cz = (tmp.min.z + tmp.max.z) / 2;
    const key = `${Math.round(cx * 6)},${Math.round(cz * 6)},${player ? "p" : Math.round(h * 6)}`;
    if (seen.has(key)) return;
    seen.add(key);
    all.push({ player, name: (player ? "PLAYER" : "item") + `@${cx.toFixed(1)},${cz.toFixed(1)}`, top: [cx, tmp.max.y - 0.03, cz] });
  });
  all.sort((a, b) => (b.player ? 1 : 0) - (a.player ? 1 : 0));
  const subjects = all.slice(0, 18);

  const solids = [];
  scene.traverse((o) => o.isMesh && !o.isSprite && o.visible && solids.push(o));
  const ray = new THREE.Raycaster();
  ray.far = 40;

  /* a directional light standing in for the window, strong enough to matter */
  const sun = new THREE.DirectionalLight(0xa8c6f0, 3.2);
  sun.position.set(-3.4, 3.0, -2.6);
  sun.target.position.set(0.3, 0.3, 0.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -4.5, right: 4.5, top: 3.6, bottom: -2.4, near: 0.2, far: 14 });
  sun.shadow.bias = -0.0012;
  sun.shadow.normalBias = 0.03;
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);
  scene.add(sun.target);

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

  const camPos = camera.position.clone();
  const rows = [];

  const run = (label, light, dirOf) => {
    const on = grab();
    light.castShadow = false;
    const off = grab();
    light.castShadow = true;
    light.shadow.needsUpdate = true;

    for (const s of subjects) {
      const target = new THREE.Vector3(...s.top);
      const { origin, dir } = dirOf(target);
      ray.set(origin, dir);
      const reach = origin.distanceTo(target) + 0.06;
      const past = ray.intersectObjects(solids, false).find((h) => h.distance > reach);
      if (!past) continue;
      const land = past.point;

      // can the camera see that spot? a ray from the camera should arrive there
      // without meeting anything first
      const toCam = camPos.clone().sub(land);
      const camDist = toCam.length();
      ray.set(camPos, toCam.normalize().negate());
      const first = ray.intersectObjects(solids, false)[0];
      const visible = !!first && first.distance > camDist - 0.06;

      const v = land.clone().project(camera);
      const px = [Math.round((v.x * 0.5 + 0.5) * (W - 1)), H - 1 - Math.round((-v.y * 0.5 + 0.5) * (H - 1))];
      const a = lum(on, px[0], px[1]);
      const b = lum(off, px[0], px[1]);
      const drop = a != null && b != null && b > 1e-5 ? ((b - a) / b) * 100 : null;

      rows.push({
        light: label,
        subject: s.name,
        land: land.toArray().map((n) => +n.toFixed(2)),
        visible,
        drop: drop == null ? null : +drop.toFixed(1),
        verdict: !visible ? "HIDDEN" : drop == null ? "off screen" : drop >= 3 ? "READS" : "TOO WEAK",
      });
    }
  };

  let pendant = null;
  scene.traverse((o) => {
    if (o.isSpotLight && o.position.y > 1.5 && Math.abs(o.position.x) < 0.2) pendant = o;
  });
  const pp = pendant.getWorldPosition(new THREE.Vector3());
  run("pendant", pendant, (t) => ({ origin: pp.clone(), dir: t.clone().sub(pp).normalize() }));

  const sdir = sun.target.getWorldPosition(new THREE.Vector3()).sub(sun.getWorldPosition(new THREE.Vector3())).normalize();
  run("window(dir)", sun, (t) => ({ origin: t.clone().addScaledVector(sdir, -9), dir: sdir.clone() }));

  scene.remove(sun);
  scene.remove(sun.target);
  return rows;
});

const tally = {};
for (const r of out) {
  const k = `${r.light}|${r.verdict}`;
  tally[k] = (tally[k] || 0) + 1;
}
for (const r of out) {
  console.log(
    `${r.light.padEnd(12)} ${r.subject.padEnd(20)} -> ${String(r.land).padEnd(22)} ${r.verdict.padEnd(10)} ${r.drop == null ? "" : r.drop + "%"}`
  );
}
console.log("\n" + JSON.stringify(tally, null, 1));
await browser.close();
