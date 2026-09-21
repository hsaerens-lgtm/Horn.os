// Time from navigation to the loader hiding, for a given query string.
//   node test/loadtime.mjs "?debug=1" "?debug=1&players=suit"
import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chromium", args: ["--enable-unsafe-swiftshader"] });
for (const q of process.argv.slice(2)) {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 704 } })).newPage();
  const probes = [];
  p.on("console", (m) => /PROBE|took|ms\b/.test(m.text()) && probes.push(m.text()));
  const t0 = Date.now();
  await p.goto("http://localhost:4330/" + q, { waitUntil: "load" });
  const tLoad = Date.now() - t0;
  await p.waitForFunction(() => document.getElementById("loader")?.classList.contains("hidden"), null, { timeout: 300000 });
  const verts = await p.evaluate(() => {
    let robot = 0, total = 0;
    window.__debug?.scene.traverse((o) => {
      if (!o.isMesh) return;
      const n = o.geometry.attributes.position?.count ?? 0;
      total += n;
      if (/-(legs|upper)-/.test(o.name)) robot += n;
    });
    return { robot, total };
  });
  console.log(`${q.padEnd(28)} load ${tLoad} ms, ready ${Date.now() - t0} ms, robot verts ${verts.robot}, scene verts ${verts.total}`);
  for (const s of probes) console.log("   " + s);
  await p.context().close();
}
await b.close();
