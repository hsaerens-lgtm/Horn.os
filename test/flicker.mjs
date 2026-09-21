// Where does the frame flicker, and what is doing it?
//
// A pixel that changes smoothly between frames is something moving: a player
// breathing, rain, the hearth. A pixel that flips back and forth, frame after
// frame, is the depth buffer changing its mind, a shadow map's acne crawling, a
// specular highlight sparkling on a bumpy surface, or a one-pixel edge popping
// in and out of the ink pass. This captures the canvas *as displayed* — after
// the watercolour pass — on consecutive frames, with the camera on its idle
// drift (a pinned camera hides depth fights: the test is then deterministic),
// and for every pixel counts how many times the luminance delta changes sign.
//
// It then does the same with one suspect at a time switched off — dust, shadows,
// the ink, the sampling wobble, the clearcoat's sharpness — so the cause is a
// number, not a guess. Overlays go to test/out/flicker-<variant>.png.
//
//   node test/flicker.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "out");
mkdirSync(OUT, { recursive: true });

// Each variant is measured three times and the median kept: the idle camera's
// speed varies along its path and a single capture is noisy.
const VARIANTS = ["base", "floor", "nomoon", "nowindowlight", "nowobble", "noink", "base"];
const REPEAT = 4;

const b = await chromium.launch({ channel: "chromium", args: ["--enable-unsafe-swiftshader"] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 704 } })).newPage();
p.on("pageerror", (e) => console.log("  [page error]", e.message));
await p.goto("http://localhost:4330/?debug=1", { waitUntil: "load" });
await p.waitForFunction(() => document.getElementById("loader")?.classList.contains("hidden"), null, { timeout: 180000 });
await p.waitForFunction(() => !!window.__debug, null, { timeout: 90000 });
// let the idle camera settle onto its path
await p.waitForTimeout(6000);

for (const variant of VARIANTS) {
  const runs = [];
  for (let rep = 0; rep < REPEAT; rep++) {
  const r = await p.evaluate(async (variant) => {
    const { scene, renderer, painter } = window.__debug;
    const W = renderer.domElement.width;
    const H = renderer.domElement.height;
    const FRAMES = 10;

    /* ---- apply the variant, remembering how to undo it ---- */
    const undo = [];
    const set = (obj, key, value) => {
      const was = obj[key];
      obj[key] = value;
      undo.push(() => (obj[key] = was));
    };
    const U = painter.pass.uniforms;
    if (variant === "nodust") scene.traverse((o) => o.isPoints && o.material.size < 0.01 && set(o, "visible", false));
    if (variant === "noshadow") scene.traverse((o) => o.isLight && o.castShadow && set(o, "castShadow", false));
    if (variant === "noink") set(U.uEdge, "value", 0);
    if (variant === "nowobble") set(U.uBleed, "value", 0);
    if (variant === "matte") {
      scene.traverse((o) => {
        const m = o.material;
        if (m && m.clearcoat > 0) {
          set(m, "clearcoatRoughness", 0.3);
          if (m.normalScale) set(m.normalScale, "x", m.normalScale.x * 0.4), set(m.normalScale, "y", m.normalScale.y * 0.4);
        }
      });
    }
    if (variant === "floor") {
      // the parquet: a specular that sparkles is a rough surface with a fine
      // normal map under a hard light
      scene.traverse((o) => {
        if (o.isMesh && o.material?.map?.image?.src?.includes("herringbone")) {
          set(o.material, "roughness", 0.8);
          set(o.material.normalScale, "x", 0.15), set(o.material.normalScale, "y", 0.15);
        }
      });
    }
    if (variant === "nomoon") scene.traverse((o) => o.isDirectionalLight && set(o, "intensity", 0));
    if (variant === "nowindowlight") scene.traverse((o) => o.isPointLight && o.color.getHex() === 0x8fb2e0 && set(o, "intensity", 0));
    if (variant === "norain") scene.traverse((o) => o.isMesh && o.material?.blending === 2 && o.material.map && set(o, "visible", false));

    /* ---- capture the displayed canvas on consecutive frames ---- */
    const grabber = document.createElement("canvas");
    grabber.width = W;
    grabber.height = H;
    const g = grabber.getContext("2d", { willReadFrequently: true });
    const frames = [];
    await new Promise((done) => {
      const orig = painter.render;
      painter.render = () => {
        orig();
        // same task as the draw, so the WebGL canvas still holds the frame
        g.drawImage(renderer.domElement, 0, 0);
        const d = g.getImageData(0, 0, W, H).data;
        const L = new Float32Array(W * H);
        for (let i = 0; i < W * H; i++) L[i] = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
        frames.push(L);
        if (frames.length >= FRAMES) {
          painter.render = orig;
          done();
        }
      };
    });
    for (const u of undo.reverse()) u();

    /* ---- count the flips ---- */
    const flagged = new Uint8Array(W * H);
    let count = 0;
    let countRoom = 0;
    // the windows' screen footprint on the idle path, top-down fractions: the
    // rain there flips by design and would swamp everything else
    const WINDOWS = [
      [0.0, 0.17, 0.02, 0.36],
      [0.72, 1.0, 0.0, 0.36],
    ];
    for (let i = 0; i < W * H; i++) {
      let flips = 0;
      let amp = 0;
      let prevD = 0;
      for (let k = 1; k < FRAMES; k++) {
        const d = frames[k][i] - frames[k - 1][i];
        amp = Math.max(amp, Math.abs(d));
        if (k > 1 && d * prevD < 0 && Math.abs(d) > 0.03) flips++;
        prevD = d;
      }
      if (flips >= 4 && amp > 0.08) {
        flagged[i] = 1;
        count++;
        const fx = (i % W) / W;
        const fy = Math.floor(i / W) / H;
        if (!WINDOWS.some(([x0, x1, y0, y1]) => fx >= x0 && fx <= x1 && fy >= y0 && fy <= y1)) countRoom++;
      }
    }

    /* ---- the overlay ---- */
    const img = g.createImageData(W, H);
    for (let i = 0; i < W * H; i++) {
      const v = Math.round(frames[0][i] * 150 + 30);
      const o = i * 4;
      if (flagged[i]) {
        img.data[o] = 255;
        img.data[o + 1] = 40;
        img.data[o + 2] = 40;
      } else img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
      img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return { pct: +((count / (W * H)) * 100).toFixed(3), pctRoom: +((countRoom / (W * H)) * 100).toFixed(3), png: grabber.toDataURL("image/png") };
  }, variant);
  runs.push(r);
  }
  runs.sort((a, b) => a.pctRoom - b.pctRoom);
  const med = runs[Math.floor(REPEAT / 2)];
  writeFileSync(join(OUT, `flicker-${variant}.png`), Buffer.from(med.png.split(",")[1], "base64"));
  console.log(`${variant.padEnd(9)} flickering: ${String(med.pct).padStart(6)}%   outside the windows: ${String(med.pctRoom).padStart(6)}%   (runs: ${runs.map((x) => x.pctRoom).join(" / ")})`);
}
await b.close();
