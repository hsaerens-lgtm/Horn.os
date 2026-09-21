// How fast is it, and where does it stall?
//
// Three numbers a frame-rate counter does not give: how long the load takes
// and what it is spent on; the distribution of frame times once the room is
// up (the mean hides the stutters, the 99th percentile does not); and whether
// the shader count keeps growing after load, which is the fingerprint of a
// material compiled the first time it is drawn — a bubble, a spark, a burst —
// and felt as a hitch at exactly that moment.
//
//   node test/perf.mjs
import { chromium } from "playwright";

const b = await chromium.launch({ channel: "chromium", args: ["--enable-unsafe-swiftshader"] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 704 } })).newPage();
const probes = [];
p.on("console", (m) => m.text().startsWith("PROBE") && probes.push(m.text()));
p.on("pageerror", (e) => console.log("  [page error]", e.message));

const t0 = Date.now();
await p.goto("http://localhost:4330/?debug=1", { waitUntil: "load" });
const tLoad = Date.now() - t0;
await p.waitForFunction(() => document.getElementById("loader")?.classList.contains("hidden"), null, { timeout: 180000 });
const tReady = Date.now() - t0;
await p.waitForFunction(() => !!window.__debug, null, { timeout: 90000 });
console.log(`page load ${tLoad} ms, loader hidden at ${tReady} ms`);
for (const s of probes) console.log("  " + s);

const stats = await p.evaluate(async () => {
  const { renderer, painter, scene } = window.__debug;
  const programs0 = renderer.info.programs.length;
  const t = [];
  let last = performance.now();
  const growth = [];
  await new Promise((done) => {
    const orig = painter.render;
    painter.render = () => {
      orig();
      const now = performance.now();
      t.push(now - last);
      last = now;
      const n = renderer.info.programs.length;
      if (n !== (growth.at(-1)?.n ?? programs0)) growth.push({ atFrame: t.length, n });
      if (t.length >= 900) {
        painter.render = orig;
        done();
      }
    };
  });
  t.shift();
  const sorted = [...t].sort((a, b) => a - b);
  const q = (k) => +sorted[Math.floor(sorted.length * k)].toFixed(1);
  let meshes = 0;
  scene.traverse((o) => o.isMesh && o.visible && meshes++);
  return {
    frames: t.length,
    meanMs: +(t.reduce((a, b) => a + b, 0) / t.length).toFixed(1),
    p50: q(0.5),
    p95: q(0.95),
    p99: q(0.99),
    worst: +sorted.at(-1).toFixed(1),
    over33: t.filter((x) => x > 33).length,
    over80: t.filter((x) => x > 80).length,
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    programs: renderer.info.programs.length,
    programGrowth: growth,
    meshes,
    pixelRatio: renderer.getPixelRatio(),
    size: [renderer.domElement.width, renderer.domElement.height],
  };
});
console.log(JSON.stringify(stats, null, 1));
await b.close();
