// Where does each shadow actually land, and is that place lit?
//
// The question this answers: the pendant and the windows both hang higher than
// the players, so every player ought to throw a shadow down onto the floor, and
// none is visible. Is the shadow missing, or is it landing somewhere that
// cannot show it?
//
// The method is the obvious one and it is worth doing properly. For each light
// that casts, and each object worth casting, trace a ray from the light through
// the object. The first surface it meets past the object is where the shadow
// lands. Then ask three questions about that place, in order, because the first
// "no" is the answer:
//
//   1. Is it inside the light's cone at all? A spot lights a circle; outside it
//      there is no light to block, so there can be no shadow.
//   2. Is it inside the shadow camera's frustum? Outside near/far, three.js
//      writes no depth for the caster and the receiver comes out fully lit.
//   3. Does the pixel there actually go darker when the shadow is switched off?
//      That is the only test that cannot be argued with.
//
// Run: node test/rays.mjs

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
await page.waitForFunction(() => !!window.__debug, null, { timeout: 60000 });
await page.evaluate(([p, t]) => window.__debug.pin(p, t), [SHOT.pos, SHOT.target]);
await page.waitForTimeout(400);

const report = await page.evaluate(async () => {
  const THREE = await import("three");
  const { scene, renderer, camera } = window.__debug;

  /* ---- the things worth casting a shadow ----
   *
   * One entry per mesh, not per group. Grouping by the top-level scene child
   * looked tidier and was wrong: each player's group also carries the flat
   * plane its character sheet is projected onto, which is 480 units wide before
   * it is scaled, and the union came out eleven metres across — so every robot
   * was filtered out as "too big" and the first run of this test reported on
   * table legs and terminal screens while saying nothing about the players.
   *
   * Skinned meshes are skipped outright: Box3.setFromObject measures those in
   * their bind pose, which is why an earlier pass had the robots' hands at a
   * hundred and twenty-six units tall.
   */
  const tmp = new THREE.Box3();
  const subjects = [];
  const seen = new Set();
  scene.traverse((o) => {
    if (!o.isMesh || o.isSprite || o.isSkinnedMesh || !o.visible) return;
    tmp.setFromObject(o);
    if (!isFinite(tmp.min.y)) return;
    const h = tmp.max.y - tmp.min.y;
    const w = Math.max(tmp.max.x - tmp.min.x, tmp.max.z - tmp.min.z);
    // Standing on something, tall enough that a missing shadow would be
    // noticed, and not a wall, a floor or a tabletop.
    if (h < 0.16 || h > 1.2 || w > 1.4 || tmp.min.y > 1.15) return;
    const cx = (tmp.min.x + tmp.max.x) / 2;
    const cz = (tmp.min.z + tmp.max.z) / 2;
    const key = `${Math.round(cx * 8)},${Math.round(cz * 8)},${Math.round(h * 8)}`;
    if (seen.has(key)) return;
    seen.add(key);
    subjects.push({
      name: o.name || "(unnamed)",
      top: [cx, tmp.max.y - 0.02, cz],
      height: +h.toFixed(2),
      at: [+cx.toFixed(2), +cz.toFixed(2)],
      obj: o,
    });
  });
  subjects.sort((a, b) => b.height - a.height);
  const picked = subjects.slice(0, 12);

  /* ---- the lights ---- */
  const lights = [];
  scene.traverse((o) => {
    if (o.isSpotLight || o.isPointLight || o.isDirectionalLight) lights.push(o);
  });

  const casters = lights.filter((l) => l.castShadow);

  /* ---- render once with shadows and once without ---- */
  const W = 1000;
  const H = 550;
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
  const withShadow = grab();
  for (const l of casters) l.castShadow = false;
  const without = grab();
  for (const l of casters) {
    l.castShadow = true;
    l.shadow.needsUpdate = true;
  }

  // world point -> readback pixel (readback rows run bottom-up)
  const toPixel = (p) => {
    const v = new THREE.Vector3(...p).project(camera);
    if (v.z > 1) return null;
    return [Math.round((v.x * 0.5 + 0.5) * (W - 1)), H - 1 - Math.round((-v.y * 0.5 + 0.5) * (H - 1))];
  };

  const ray = new THREE.Raycaster();
  ray.far = 30;
  // Sprites raycast against the camera and there is none here; and a speech
  // bubble is not a thing that stops light anyway. Meshes only.
  const solids = [];
  scene.traverse((o) => {
    if (o.isMesh && !o.isSprite && o.visible) solids.push(o);
  });
  const rows = [];

  for (const light of lights) {
    const lp = light.getWorldPosition(new THREE.Vector3());
    // a spot's axis and half-angle, for the "is this place lit at all" test
    const axis = light.isSpotLight
      ? light.target.getWorldPosition(new THREE.Vector3()).sub(lp).normalize()
      : null;

    for (const s of picked) {
      const target = new THREE.Vector3(...s.top);
      const dir = target.clone().sub(lp).normalize();
      ray.set(lp, dir);
      const hits = ray.intersectObjects(solids, false);
      // The first surface past the subject is where its shadow lands. Measured
      // by distance rather than by object identity, because the subject may be
      // several meshes and whatever is immediately attached to it — a chair
      // under a player, a tray under a mini — is part of the same thing.
      const reach = lp.distanceTo(target) + 0.06;
      const past = hits.find((h) => h.distance > reach) ?? null;
      if (!past) continue;

      const land = past.point;
      const dist = land.distanceTo(lp);
      const inRange = !light.distance || dist <= light.distance;
      const coneDeg = axis ? (Math.acos(Math.min(1, axis.dot(land.clone().sub(lp).normalize()))) * 180) / Math.PI : null;
      const inCone = axis ? coneDeg <= (light.angle * 180) / Math.PI : true;
      const inFrustum = light.castShadow ? dist >= light.shadow.camera.near && dist <= (light.distance || light.shadow.camera.far) : null;

      const px = toPixel(land.toArray());
      let darkened = null;
      if (px) {
        const a = lum(withShadow, px[0], px[1]);
        const b = lum(without, px[0], px[1]);
        if (a != null && b != null && b > 1e-5) darkened = +(((b - a) / b) * 100).toFixed(1);
      }

      rows.push({
        light: `${light.type}@${lp.toArray().map((v) => v.toFixed(2))}`,
        casts: !!light.castShadow,
        subject: `${s.name} h${s.height}@${s.at}`,
        landsOn: past.object.name || "(surface)",
        landAt: land.toArray().map((v) => +v.toFixed(2)),
        distFromLight: +dist.toFixed(2),
        coneHalfAngleDeg: axis ? +((light.angle * 180) / Math.PI).toFixed(0) : null,
        angleToLandDeg: coneDeg == null ? null : +coneDeg.toFixed(0),
        inCone,
        inRange,
        inFrustum,
        onScreen: !!px,
        pctDarker: darkened,
      });
    }
  }
  return { subjects: picked.map((s) => `${s.name} h${s.height}@${s.at}`), lights: lights.length, casting: casters.length, rows };
});

console.log(`lights: ${report.lights}, of which casting: ${report.casting}`);
console.log(`subjects: ${report.subjects.join(", ")}\n`);

const casting = report.rows.filter((r) => r.casts);
const idle = report.rows.filter((r) => !r.casts);

const show = (rows, title) => {
  console.log(`--- ${title} ---`);
  for (const r of rows) {
    const why = !r.inCone
      ? "OUTSIDE CONE"
      : !r.inRange
        ? "beyond light range"
        : r.inFrustum === false
          ? "outside shadow frustum"
          : !r.onScreen
            ? "off screen"
            : r.pctDarker == null
              ? "no reading"
              : r.pctDarker < 3
                ? `only ${r.pctDarker}% darker`
                : `${r.pctDarker}% darker`;
    console.log(
      `${r.subject.padEnd(26)} -> ${String(r.landAt).padEnd(22)} ${String(r.angleToLandDeg ?? "-").padStart(3)}deg/${String(r.coneHalfAngleDeg ?? "-").padStart(3)}  ${why}`
    );
  }
  console.log();
};
show(casting, "lights that cast");
show(idle.slice(0, 20), "lights that do not cast (what they would give)");

const good = casting.filter((r) => r.pctDarker >= 3).length;
console.log(`shadows that actually darken their landing point: ${good} of ${casting.length}`);
await browser.close();
