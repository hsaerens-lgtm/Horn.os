// The office: a bright room with a big steel window, a walnut desk, a lot of
// plants, and Horn.os on the monitor.
//
// Two renderers share one camera. The CSS3D layer sits UNDER the WebGL canvas
// and carries the real Horn.os DOM on the monitor; the screen mesh in WebGL
// writes transparent pixels, so the page shows through exactly where the
// screen is and anything in front of it (a leaf, the lamp) still hides it.

import * as THREE from "three";
import { CSS3DRenderer, CSS3DObject } from "three/addons/renderers/CSS3DRenderer.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { roundedBox, between } from "../lib/shapes.js";
import { mergeParts, at } from "../lib/merge.js";
import { plant } from "../lib/plants.js";
import { buildCat, buildGuitar, buildClock } from "./props.js";
import { model, planter } from "./models.js";
import { PHASES, PRESETS, phaseFor, mixPreset, skyTextures } from "./daycycle.js";

/* ------------------------------------------------------------------ *
 *  Dimensions (metres)
 * ------------------------------------------------------------------ */
const ROOM = { x0: -2.3, x1: 2.3, z0: -2.1, z1: 2.9, h: 2.7 };
const WIN = { z0: -1.95, z1: 0.55, y0: 0.78, y1: 2.45 }; // opening in the left wall
const DESK = { x: -0.95, z: -1.72, w: 1.6, d: 0.72, y: 0.74, t: 0.035 };
const SCREEN = { w: 0.6, h: 0.375 }; // 16:10
const OS_PX = { w: 1280, h: 800 };
const TOP = DESK.y + DESK.t / 2;
const SCREEN_POS = new THREE.Vector3(DESK.x, TOP + 0.335, DESK.z - 0.13);

const WIDE = { pos: new THREE.Vector3(0.78, 1.46, 0.95), target: new THREE.Vector3(-1.02, 1.0, -1.5) };

/* ------------------------------------------------------------------ *
 *  Small helpers
 * ------------------------------------------------------------------ */
const texLoader = new THREE.TextureLoader();

function pbr(name, repeat, { color = 0xffffff, rough = 1 } = {}) {
  const load = (suffix, srgb) => {
    const t = texLoader.load(`assets/textures/${name}_${suffix}.jpg`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const arm = load("arm", false);
  return new THREE.MeshStandardMaterial({
    color,
    map: load("diff", true),
    normalMap: load("nor_gl", false),
    roughnessMap: arm,
    aoMap: arm,
    roughness: rough,
    metalness: 0,
  });
}

function canvasTexture(w, h, draw, { srgb = true, repeat = null } = {}) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  t.anisotropy = 8;
  return t;
}

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
}

function mesh(geometry, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

// Plaster: a very quiet mottling so the walls are not a flat fill.
const plasterTex = canvasTexture(
  512,
  512,
  (g, w, h) => {
    g.fillStyle = "#808080";
    g.fillRect(0, 0, w, h);
    const r = seeded(9);
    for (let i = 0; i < 2600; i++) {
      const v = 118 + Math.floor(r() * 20);
      g.fillStyle = `rgba(${v},${v},${v},0.18)`;
      const s = 2 + r() * 14;
      g.beginPath();
      g.arc(r() * w, r() * h, s, 0, Math.PI * 2);
      g.fill();
    }
  },
  { srgb: false, repeat: [3, 2] },
);

/* ------------------------------------------------------------------ *
 *  Materials
 * ------------------------------------------------------------------ */
const M = {
  wall: new THREE.MeshStandardMaterial({ color: 0xf1ebe0, roughness: 0.94, roughnessMap: plasterTex, bumpMap: plasterTex, bumpScale: 0.6 }),
  ceiling: new THREE.MeshStandardMaterial({ color: 0xf6f2ea, roughness: 0.95 }),
  skirting: new THREE.MeshStandardMaterial({ color: 0xe9e2d4, roughness: 0.6 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x1d1f21, roughness: 0.42, metalness: 0.6 }),
  graphite: new THREE.MeshStandardMaterial({ color: 0x232427, roughness: 0.35, metalness: 0.45 }),
  alu: new THREE.MeshStandardMaterial({ color: 0xb9bcc0, roughness: 0.3, metalness: 0.9 }),
  keycap: new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.55 }),
  bezel: new THREE.MeshStandardMaterial({ color: 0x0e0f11, roughness: 0.18, metalness: 0.2 }),
  keybase: new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.5, metalness: 0.3 }),
  ceramic: new THREE.MeshStandardMaterial({ color: 0xece5d8, roughness: 0.35 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb08a4a, roughness: 0.3, metalness: 0.85 }),
  fabric: new THREE.MeshStandardMaterial({ color: 0x3f4a44, roughness: 0.95 }),
  rope: new THREE.MeshStandardMaterial({ color: 0xcdb892, roughness: 0.9 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.08 }),
};
// The veneer scan is a grey-stained wood; the colour multiplies it into oak or walnut.
const OAK = () => pbr("american_walnut_veneer", [1.5, 1], { color: 0xffd9a8 });
const WALNUT = () => pbr("american_walnut_veneer", [1.5, 1], { color: 0xc98d5e });
const OAK_FLOOR = () => pbr("herringbone_parquet", [2.2, 2.4], { color: 0xf4e6d2 });

/* ------------------------------------------------------------------ *
 *  The room shell
 * ------------------------------------------------------------------ */
function buildRoom(scene) {
  const { x0, x1, z0, z1, h } = ROOM;
  const W = x1 - x0;
  const D = z1 - z0;

  const floorMat = OAK_FLOOR();
  const floor = mesh(new THREE.PlaneGeometry(W, D), floorMat, { cast: false });
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
  scene.add(floor);

  const ceiling = mesh(new THREE.PlaneGeometry(W, D), M.ceiling, { cast: false });
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set((x0 + x1) / 2, h, (z0 + z1) / 2);
  scene.add(ceiling);

  const T = 0.12; // wall thickness, so the window has a reveal
  const box = (w, hh, d, x, y, z, mat = M.wall) => {
    const m = mesh(new THREE.BoxGeometry(w, hh, d), mat);
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  };

  // Back wall (behind the desk), right wall, front wall.
  box(W + 2 * T, h, T, (x0 + x1) / 2, h / 2, z0 - T / 2);
  box(T, h, D, x1 + T / 2, h / 2, (z0 + z1) / 2);
  box(W + 2 * T, h, T, (x0 + x1) / 2, h / 2, z1 + T / 2);

  // Left wall, built around the window opening.
  const lx = x0 - T / 2;
  box(T, WIN.y0, D, lx, WIN.y0 / 2, (z0 + z1) / 2); // below
  box(T, h - WIN.y1, D, lx, (WIN.y1 + h) / 2, (z0 + z1) / 2); // above
  const midY = (WIN.y0 + WIN.y1) / 2;
  const oh = WIN.y1 - WIN.y0;
  box(T, oh, WIN.z0 - z0, lx, midY, (z0 + WIN.z0) / 2); // behind
  box(T, oh, z1 - WIN.z1, lx, midY, (WIN.z1 + z1) / 2); // in front

  // Skirting boards.
  const sk = 0.08;
  box(W, sk, 0.015, (x0 + x1) / 2, sk / 2, z0 + 0.0075, M.skirting);
  box(0.015, sk, D, x1 - 0.0075, sk / 2, (z0 + z1) / 2, M.skirting);
  box(0.015, sk, WIN.z0 - z0, x0 + 0.0075, sk / 2, (z0 + WIN.z0) / 2, M.skirting);
  box(0.015, sk, z1 - WIN.z0, x0 + 0.0075, sk / 2, (WIN.z0 + z1) / 2, M.skirting);

  // The window: a black steel atelier frame, three bays and a transom.
  const frame = new THREE.Group();
  const fx = x0 - 0.02;
  const bar = (w, hh, d, y, z) => {
    const m = mesh(new THREE.BoxGeometry(w, hh, d), M.steel);
    m.position.set(fx, y, z);
    frame.add(m);
  };
  const fw = 0.045;
  const wz = WIN.z1 - WIN.z0;
  bar(0.05, fw, wz, WIN.y0 + fw / 2, (WIN.z0 + WIN.z1) / 2);
  bar(0.05, fw, wz, WIN.y1 - fw / 2, (WIN.z0 + WIN.z1) / 2);
  bar(0.05, 0.03, wz, WIN.y1 - 0.5, (WIN.z0 + WIN.z1) / 2);
  for (let i = 0; i <= 3; i++) bar(0.05, oh, i === 0 || i === 3 ? fw : 0.03, midY, WIN.z0 + (i / 3) * wz + (i === 0 ? fw / 2 : i === 3 ? -fw / 2 : 0));
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(wz / 3, oh), M.glass);
    g.rotation.y = Math.PI / 2;
    g.position.set(fx, midY, WIN.z0 + ((i + 0.5) / 3) * wz);
    frame.add(g);
  }
  scene.add(frame);

  // A deep wooden sill, where the cat will sleep.
  const sill = mesh(roundedBox(0.3, 0.035, wz + 0.1, 0.006), WALNUT());
  sill.position.set(x0 + 0.1, WIN.y0 - 0.0175 + 0.001, (WIN.z0 + WIN.z1) / 2);
  scene.add(sill);

  // Outside: a painted sky with a tree line and a few far buildings.
  // One plane per phase, stacked; the day cycle fades between them.
  const tex = skyTextures();
  const skies = {};
  PHASES.forEach((name, i) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 12),
      new THREE.MeshBasicMaterial({ map: tex[name], toneMapped: false, transparent: true, opacity: name === "day" ? 1 : 0, depthWrite: false }),
    );
    m.rotation.y = Math.PI / 2;
    m.position.set(x0 - 7 + i * 0.01, 3.2, -0.6);
    m.renderOrder = -10 + i;
    scene.add(m);
    skies[name] = m;
  });

  return { sill, skies };
}

/* ------------------------------------------------------------------ *
 *  Furniture
 * ------------------------------------------------------------------ */
function buildDesk(scene) {
  const group = new THREE.Group();
  group.position.set(DESK.x, 0, DESK.z);
  scene.add(group);

  // Top
  const top = mesh(roundedBox(DESK.w, DESK.t, DESK.d, 0.008), OAK());
  top.position.y = DESK.y;
  group.add(top);

  // Steel frame: two sled legs joined by a rail.
  const legParts = [];
  for (const sx of [-1, 1]) {
    const x = sx * (DESK.w / 2 - 0.08);
    legParts.push({ geometry: new THREE.BoxGeometry(0.04, DESK.y - DESK.t / 2, 0.04), matrix: at(x, (DESK.y - DESK.t / 2) / 2, -DESK.d / 2 + 0.07) });
    legParts.push({ geometry: new THREE.BoxGeometry(0.04, DESK.y - DESK.t / 2, 0.04), matrix: at(x, (DESK.y - DESK.t / 2) / 2, DESK.d / 2 - 0.07) });
    legParts.push({ geometry: new THREE.BoxGeometry(0.04, 0.03, DESK.d - 0.1), matrix: at(x, 0.015, 0) });
    legParts.push({ geometry: new THREE.BoxGeometry(0.04, 0.03, DESK.d - 0.1), matrix: at(x, DESK.y - DESK.t / 2 - 0.015, 0) });
  }
  legParts.push({ geometry: new THREE.BoxGeometry(DESK.w - 0.2, 0.05, 0.02), matrix: at(0, DESK.y - 0.08, -DESK.d / 2 + 0.07) });
  group.add(mesh(mergeParts(legParts), M.steel));

  // Monitor: a slim panel with a chin, a thicker housing behind, and an
  // aluminium stand whose neck curves down to an oval foot.
  const mon = new THREE.Group();
  mon.position.copy(SCREEN_POS).sub(group.position);
  group.add(mon);
  const bez = 0.008;
  const chin = 0.022;
  const panel = mesh(roundedBox(SCREEN.w + 2 * bez, SCREEN.h + bez + chin, 0.014, 0.005), M.bezel);
  panel.position.y = -(chin - bez) / 2;
  mon.add(panel);
  const chinStrip = mesh(roundedBox(SCREEN.w + 2 * bez - 0.002, chin - 0.004, 0.0142, 0.004), M.alu);
  chinStrip.position.y = -SCREEN.h / 2 - chin / 2 + 0.001;
  mon.add(chinStrip);
  const housing = mesh(roundedBox(SCREEN.w * 0.94, SCREEN.h * 0.9, 0.022, 0.02), M.alu);
  housing.position.set(0, -0.01, -0.016);
  mon.add(housing);
  const drop = SCREEN_POS.y - TOP;
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.02, -0.03),
    new THREE.Vector3(0, -0.12, -0.075),
    new THREE.Vector3(0, -drop + 0.12, -0.085),
    new THREE.Vector3(0, -drop + 0.012, -0.03),
  ]);
  const neck = mesh(new THREE.TubeGeometry(neckCurve, 40, 0.014, 16, false), M.alu);
  neck.scale.x = 2.4;
  mon.add(neck);
  const foot = mesh(new THREE.CylinderGeometry(0.11, 0.115, 0.008, 48), M.alu);
  foot.scale.z = 0.7;
  foot.position.set(0, -drop + 0.004, -0.02);
  mon.add(foot);

  // The screen: a cut-out that lets the CSS3D layer show through.
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(SCREEN.w, SCREEN.h),
    new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: THREE.NoBlending, side: THREE.FrontSide }),
  );
  screen.position.z = 0.0115;
  screen.name = "screen";
  mon.add(screen);

  // Keyboard: an aluminium base and a merged grid of keycaps.
  const kb = new THREE.Group();
  kb.position.set(0.0, TOP, 0.14);
  group.add(kb);
  kb.add(mesh(roundedBox(0.36, 0.012, 0.125, 0.004), M.keybase));
  const keys = [];
  const kw = 0.0205;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 15; col++) {
      if (row === 4 && col > 3 && col < 11) {
        if (col === 4) keys.push({ geometry: roundedBox(kw * 7 - 0.003, 0.008, kw - 0.003, 0.002), matrix: at(-0.1535 + 7 * kw, 0.009, -0.045 + row * kw) });
        continue;
      }
      keys.push({ geometry: roundedBox(kw - 0.003, 0.008, kw - 0.003, 0.002), matrix: at(-0.1535 + col * kw, 0.009, -0.045 + row * kw) });
    }
  }
  kb.add(mesh(mergeParts(keys), M.keycap));

  // Mouse
  const mouse = mesh(roundedBox(0.06, 0.028, 0.1, 0.013), M.keycap);
  mouse.position.set(0.3, TOP + 0.014, 0.16);
  group.add(mouse);

  // Mug
  const mug = new THREE.Group();
  mug.position.set(0.52, TOP, 0.06);
  mug.add(mesh(new THREE.CylinderGeometry(0.04, 0.037, 0.095, 24, 1, true), M.ceramic));
  const inside = mesh(new THREE.CircleGeometry(0.038, 24), new THREE.MeshStandardMaterial({ color: 0x3b2417, roughness: 0.2 }));
  inside.rotation.x = -Math.PI / 2;
  inside.position.y = 0.075;
  mug.add(inside);
  const bottom = mesh(new THREE.CircleGeometry(0.037, 24), M.ceramic);
  bottom.rotation.x = Math.PI / 2;
  bottom.position.y = -0.0475;
  mug.add(bottom);
  mug.children.forEach((c) => (c.position.y += 0.0475));
  const handle = mesh(new THREE.TorusGeometry(0.024, 0.006, 8, 20, Math.PI * 1.2), M.ceramic);
  handle.position.set(0.042, 0.05, 0);
  handle.rotation.z = -Math.PI * 0.6;
  mug.add(handle);
  group.add(mug);

  // Notebooks
  const r = seeded(5);
  [0x2f5d50, 0xd9c7a3, 0x7a3b2e].forEach((c, i) => {
    const b = mesh(roundedBox(0.16, 0.014, 0.22, 0.003), new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
    b.position.set(-0.56, TOP + 0.007 + i * 0.014, 0.08);
    b.rotation.y = 0.18 + (r() - 0.5) * 0.12;
    group.add(b);
  });

  // Desk lamp: the body is a real model (see furnish); the bulb and the spot
  // live here so the day cycle can drive them.
  const lamp = new THREE.Group();
  lamp.position.set(-0.64, TOP, -0.2);
  lamp.rotation.y = 0.85;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.016, 16, 12), new THREE.MeshStandardMaterial({ color: 0xfff4e0, emissive: 0xffd9a0, emissiveIntensity: 0 }));
  lamp.add(bulb);
  const lampLight = new THREE.SpotLight(0xffd6a0, 0, 3, 0.75, 0.6, 2);
  const lampTarget = new THREE.Object3D();
  lamp.add(lampLight, lampTarget);
  lampLight.target = lampTarget;
  group.add(lamp);

  return { group, screen, lampLight, lampTarget, bulb, lamp };
}

function buildShelf(scene) {
  // An open walnut bookcase against the back wall, right of the desk.
  const g = new THREE.Group();
  g.position.set(0.95, 0, ROOM.z0 + 0.17);
  const wood = WALNUT();
  const W = 1.0;
  const H = 1.9;
  const D = 0.32;
  const parts = [];
  parts.push({ geometry: new THREE.BoxGeometry(0.025, H, D), matrix: at(-W / 2, H / 2, 0) });
  parts.push({ geometry: new THREE.BoxGeometry(0.025, H, D), matrix: at(W / 2, H / 2, 0) });
  const shelfY = [0.06, 0.5, 0.94, 1.38, H - 0.0125];
  for (const y of shelfY) parts.push({ geometry: new THREE.BoxGeometry(W, 0.025, D), matrix: at(0, y, 0) });
  g.add(mesh(mergeParts(parts), wood));

  scene.add(g);
  return { group: g, shelfY };
}

function buildRug(scene) {
  const tex = canvasTexture(1024, 1024, (g, w, h) => {
    g.fillStyle = "#d9cdb6";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(90,80,60,0.35)";
    g.lineWidth = 10;
    g.strokeRect(40, 40, w - 80, h - 80);
    g.lineWidth = 3;
    g.strokeRect(70, 70, w - 140, h - 140);
    const r = seeded(3);
    for (let i = 0; i < 40000; i++) {
      const v = 180 + r() * 40;
      g.fillStyle = `rgba(${v},${v - 10},${v - 30},0.18)`;
      g.fillRect(r() * w, r() * h, 2, 2);
    }
  });
  const rug = mesh(new THREE.PlaneGeometry(2.2, 1.6), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }), { cast: false });
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(DESK.x + 0.35, 0.006, DESK.z + 1.05);
  scene.add(rug);
}

function buildArt(scene) {
  // A framed botanical print above the desk.
  const tex = canvasTexture(768, 1024, (g, w, h) => {
    g.fillStyle = "#f3eee4";
    g.fillRect(0, 0, w, h);
    const r = seeded(12);
    g.strokeStyle = "#2f5d50";
    g.fillStyle = "rgba(47,93,80,0.85)";
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(w / 2, h * 0.9);
    g.bezierCurveTo(w * 0.52, h * 0.6, w * 0.46, h * 0.4, w * 0.5, h * 0.12);
    g.stroke();
    for (let i = 0; i < 9; i++) {
      const t = 0.18 + i * 0.08;
      const y = h * (0.9 - t * 0.85);
      const side = i % 2 ? 1 : -1;
      g.save();
      g.translate(w / 2 + side * 6, y);
      g.rotate(side * (0.9 + r() * 0.3));
      g.beginPath();
      g.ellipse(0, -60, 34, 70, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    g.fillStyle = "#c98f5a";
    g.beginPath();
    g.arc(w * 0.72, h * 0.22, 60, 0, Math.PI * 2);
    g.fill();
  });
  const frame = mesh(roundedBox(0.5, 0.66, 0.025, 0.004), M.steel);
  frame.position.set(DESK.x + 0.1, 1.72, ROOM.z0 + 0.0125);
  scene.add(frame);
  const print = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.6), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  print.position.set(DESK.x + 0.1, 1.72, ROOM.z0 + 0.026);
  print.receiveShadow = true;
  scene.add(print);
}

function buildPlants(scene, { sill, shelf }) {
  const swaying = [];
  const potted = (kind, x, y, z, opts = {}) => {
    const p = plant(kind, opts);
    p.position.set(x, y, z);
    p.rotation.y = opts.spin ?? 0;
    (opts.parent ?? scene).add(p);
    if (opts.sway) swaying.push({ p, phase: swaying.length * 2.1, amp: opts.sway });
    return p;
  };
  const sillY = WIN.y0 + 0.001;
  const sx = ROOM.x0 + 0.12;

  // Hanging in front of the window, on ropes.
  for (const [z, seed] of [
    [-0.95, 131],
    [0.05, 137],
  ]) {
    const y = 1.95;
    const hx = ROOM.x0 + 0.42;
    const p = potted("pothos", hx, y, z, { r: 0.09, h: 0.11, pot: "cream", scale: 1.15, seed, sway: 0.03 });
    const ropes = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      ropes.push(between(new THREE.Vector3(hx + Math.sin(a) * 0.085, y + 0.1, z + Math.cos(a) * 0.085), new THREE.Vector3(hx, ROOM.h, z), 0.003, 0.003, 5));
    }
    scene.add(mesh(mergeParts(ropes), M.rope, { cast: false }));
    void p;
  }
  void sill;
  return swaying;
}

/* ------------------------------------------------------------------ *
 *  Real models (Poly Haven, CC0)
 * ------------------------------------------------------------------ */
async function furnish(scene, { desk, shelf, swaying }) {
  const put = (obj, x, y, z, ry = 0, parent = scene) => {
    obj.position.set(x, y, z);
    obj.rotation.y = ry;
    parent.add(obj);
    return obj;
  };
  const sway = (obj, amp) => swaying.push({ p: obj, phase: swaying.length * 2.1, amp });
  const inPlanter = async (id, opts, { r, h, glaze }, x, y, z, ry = 0) => {
    const pot = planter(r, h, glaze);
    const g = new THREE.Group();
    g.add(pot.group);
    const plantModel = await model(id, opts);
    plantModel.position.y = pot.top - 0.01;
    g.add(plantModel);
    return put(g, x, y, z, ry);
  };
  const sillY = WIN.y0 + 0.001;
  const sillX = ROOM.x0 + 0.12;
  const shelfTop = shelf.shelfY[4] + 0.0125;

  const jobs = [
    // Floor: a money tree by the window, a tall leafy plant right of the bookcase,
    // a bushy one under the sill.
    inPlanter("pachira_aquatica_01", { variant: "a", height: 1.45 }, { r: 0.2, h: 0.36, glaze: "charcoal" }, ROOM.x0 + 0.5, 0, -1.62, 0.6).then((o) => sway(o, 0.006)),
    model("potted_plant_01", { height: 1.4 }).then((o) => sway(put(o, 1.78, 0, ROOM.z0 + 0.38, 0.4), 0.006)),
    model("potted_plant_02", { height: 0.8 }).then((o) => sway(put(o, ROOM.x0 + 0.5, 0, -0.2, 1.2), 0.008)),
    // On the sill, beside the cat.
    inPlanter("anthurium_botany_01", { variant: "a", height: 0.32 }, { r: 0.075, h: 0.11, glaze: "white" }, sillX, sillY, -1.45, 0.3),
    model("potted_plant_04", { height: 0.22 }).then((o) => put(o, sillX, sillY, -1.12, 0.5)),
    // On top of the bookcase, and on its middle shelf.
    inPlanter("calathea_orbifolia_01", { variant: "a", height: 0.34 }, { r: 0.11, h: 0.15, glaze: "sage" }, 0.72, shelfTop, ROOM.z0 + 0.2, 0.2),
    model("ceramic_vase_01", { height: 0.26 }).then((o) => put(o, 0.28, shelf.shelfY[1] + 0.0125, 0, 0, shelf.group)),
    // Books on three shelves.
    ...[
      [0, -0.24],
      [0, 0.24],
      [1, -0.22],
      [2, -0.24],
      [2, 0.24],
      [3, 0.2],
    ].map(([row, x]) => model("book_encyclopedia_set_01", { scale: 0.85 }).then((o) => put(o, x, shelf.shelfY[row] + 0.0125, 0.02, 0, shelf.group))),
    // On the desk: the lamp, a succulent, a pencil cup.
    model("desk_lamp_arm_01", { height: 0.6 }).then((o) => {
      // Measured before it is parented, the box is in the lamp's own frame:
      // the shade is at the top of the far end of the arm.
      o.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(o);
      const head = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y - 0.06, box.max.z - 0.06);
      desk.lamp.add(o);
      desk.bulb.position.copy(head);
      desk.lampLight.position.copy(head);
      desk.lampTarget.position.copy(head).add(new THREE.Vector3(0, -0.6, 0.2));
    }),
    model("potted_plant_04", { height: 0.2 }).then((o) => put(o, 0.64, TOP, -0.2, 0.3, desk.group)),
    model("stationery_supplies", { height: 0.15 }).then((o) => put(o, -0.42, TOP, -0.25, 0.4, desk.group)),
    // The chair, pulled out and turned towards the room.
    model("modern_arm_chair_01", { height: 0.9 }).then((o) => put(o, DESK.x + 0.05, 0, DESK.z + 0.95, Math.PI + 0.2)),
  ];
  await Promise.all(jobs);
}

/* ------------------------------------------------------------------ *
 *  Light
 * ------------------------------------------------------------------ */
function buildLights(scene, renderer) {
  RectAreaLightUniformsLib.init();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;

  const hemi = new THREE.HemisphereLight(0xdfe9f5, 0xb89c7c, 0.5);
  scene.add(hemi);

  // The sun comes in through the window, low and from the side, so its shadows
  // fall across the floor and the desk where the camera can see them.
  const sun = new THREE.DirectionalLight(0xfff0d8, 4.2);
  sun.position.set(ROOM.x0 - 5.5, 4.6, 1.4);
  sun.target.position.set(-0.4, 0, -0.9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -4;
  sc.right = 4;
  sc.top = 4;
  sc.bottom = -4;
  sc.near = 1;
  sc.far = 16;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  // Daylight from the whole window opening, soft and unshadowed.
  const sky = new THREE.RectAreaLight(0xe4eefc, 3.2, WIN.z1 - WIN.z0, WIN.y1 - WIN.y0);
  sky.position.set(ROOM.x0 + 0.02, (WIN.y0 + WIN.y1) / 2, (WIN.z0 + WIN.z1) / 2);
  sky.lookAt(ROOM.x0 + 5, (WIN.y0 + WIN.y1) / 2, (WIN.z0 + WIN.z1) / 2);
  scene.add(sky);

  // The screen's own glow on the desk, faint by day.
  const glow = new THREE.PointLight(0xcfe3ff, 0.35, 1.6, 2);
  glow.position.copy(SCREEN_POS).add(new THREE.Vector3(0, -0.12, 0.4));
  scene.add(glow);

  // At night, a warm LED strip hidden on top of the bookcase.
  const fill = new THREE.PointLight(0xffc98a, 0, 5, 2);
  fill.position.set(0.95, 1.85, ROOM.z0 + 0.35);
  scene.add(fill);

  return { sun, sky, hemi, glow, fill };
}

function buildDust(scene) {
  // Motes drifting in the sunbeam.
  const n = 260;
  const pos = new Float32Array(n * 3);
  const r = seeded(77);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = ROOM.x0 + 0.2 + r() * 2.2;
    pos[i * 3 + 1] = 0.3 + r() * 1.9;
    pos[i * 3 + 2] = -1.8 + r() * 2.3;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const dot = canvasTexture(32, 32, (g) => {
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 32, 32);
  });
  const pts = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ size: 0.008, map: dot, transparent: true, opacity: 0.55, depthWrite: false, color: 0xfff2d6, blending: THREE.AdditiveBlending }),
  );
  scene.add(pts);
  return pts;
}

/* ------------------------------------------------------------------ *
 *  The scene
 * ------------------------------------------------------------------ */
export function createOffice({ container, osElement, onFocus = () => {}, onWide = () => {}, onPhase = () => {}, phase: initialPhase = phaseFor(new Date()) }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = "webgl";

  const css = new CSS3DRenderer();
  css.setSize(container.clientWidth, container.clientHeight);
  css.domElement.className = "css3d";

  container.append(css.domElement, renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf1ebe0);
  const cssScene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.05, 60);
  camera.position.copy(WIDE.pos);
  const lookAt = WIDE.target.clone();
  camera.lookAt(lookAt);

  const room = buildRoom(scene);
  const desk = buildDesk(scene);
  const shelf = buildShelf(scene);
  buildRug(scene);
  buildArt(scene);
  const swaying = buildPlants(scene, { sill: room.sill, shelf });
  const lights = buildLights(scene, renderer);
  const dust = buildDust(scene);

  // The cat asleep on the sill, in the sun.
  const cat = buildCat();
  cat.group.position.set(ROOM.x0 + 0.1, WIN.y0 + 0.001, -0.62);
  cat.group.rotation.y = 0.15;
  scene.add(cat.group);

  // The guitar, between the desk and the bookcase.
  const guitar = buildGuitar();
  guitar.position.set(0.12, 0, ROOM.z0 + 0.32);
  guitar.rotation.y = -0.35;
  scene.add(guitar);

  // The wall clock, left of the print.
  const wallClock = buildClock();
  wallClock.group.position.set(DESK.x - 0.62, 1.9, ROOM.z0 + 0.012);
  scene.add(wallClock.group);

  /* --- the day cycle --- */
  const SUN_TARGET = lights.sun.target.position.clone();
  function applyPreset(p) {
    lights.sun.color.copy(p.sunColor);
    lights.sun.intensity = p.sunI;
    lights.sun.position.copy(p.sunPos);
    lights.sun.target.position.copy(SUN_TARGET);
    lights.hemi.color.copy(p.hemiSky);
    lights.hemi.groundColor.copy(p.hemiGround);
    lights.hemi.intensity = p.hemiI;
    scene.environmentIntensity = p.env;
    lights.sky.color.copy(p.skyLightColor);
    lights.sky.intensity = p.skyLightI;
    desk.lampLight.intensity = p.lampI;
    desk.bulb.material.emissiveIntensity = p.bulb * 2.5;
    lights.glow.intensity = p.glowI;
    lights.fill.intensity = p.fillI;
    dust.material.opacity = p.dust;
    renderer.toneMappingExposure = p.exposure;
  }
  let phase = PHASES.includes(initialPhase) ? initialPhase : "day";
  let phaseTween = null;
  // The incoming sky sits in front of the outgoing one and fades in over it.
  const setSkies = (from, to, w) => {
    for (const name of PHASES) {
      const m = room.skies[name];
      m.material.opacity = name === to ? w : name === from ? 1 : 0;
      m.renderOrder = name === to ? 0 : -1;
    }
  };
  applyPreset(PRESETS[phase]);
  setSkies(phase, phase, 1);
  function setPhase(next, ms = 2500) {
    if (!PHASES.includes(next) || next === phase) return;
    phaseTween = { from: phase, to: next, t0: performance.now(), ms };
    phase = next;
    onPhase(next);
  }
  function nextPhase() {
    setPhase(PHASES[(PHASES.indexOf(phase) + 1) % PHASES.length]);
  }

  // Horn.os on the monitor.
  osElement.style.width = `${OS_PX.w}px`;
  osElement.style.height = `${OS_PX.h}px`;
  const osObject = new CSS3DObject(osElement);
  osObject.position.copy(SCREEN_POS).add(new THREE.Vector3(0, 0, 0.0115));
  osObject.scale.setScalar(SCREEN.w / OS_PX.w);
  cssScene.add(osObject);
  css.render(cssScene, camera); // puts the element in the DOM, with its size

  /* --- camera moves --- */
  const focusPose = () => {
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const dh = SCREEN.h / 2 / Math.tan(fov / 2);
    const dw = SCREEN.w / 2 / (Math.tan(fov / 2) * camera.aspect);
    const d = Math.max(dh, dw) * 1.06;
    return { pos: SCREEN_POS.clone().add(new THREE.Vector3(0, 0, d + 0.0115)), target: SCREEN_POS.clone() };
  };
  let tween = null;
  let mode = "wide";
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function moveTo(pose, ms = 1300) {
    tween = { from: camera.position.clone(), fromT: lookAt.clone(), to: pose.pos, toT: pose.target, t0: performance.now(), ms };
  }
  function focus() {
    if (mode === "focus") return;
    mode = "focus";
    container.classList.add("is-focused");
    moveTo(focusPose());
    onFocus();
  }
  function wide() {
    if (mode === "wide") return;
    mode = "wide";
    container.classList.remove("is-focused");
    moveTo(WIDE);
    onWide();
  }

  /* --- picking --- */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  // What is under the pointer: "screen", "clock", "cat" or null.
  const pick = (e) => {
    const r = container.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(scene.children, true).find((h) => h.object.type !== "Points");
    if (!hit) return null;
    if (hit.object === desk.screen) return "screen";
    for (let o = hit.object; o; o = o.parent) if (o.userData.kind) return o.userData.kind;
    return null;
  };
  const mouse = new THREE.Vector2();
  container.addEventListener("pointermove", (e) => {
    const r = container.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
    if (mode === "wide") container.style.cursor = pick(e) ? "pointer" : "default";
  });
  container.addEventListener("click", (e) => {
    if (mode !== "wide") return;
    const what = pick(e);
    if (what === "screen") focus();
    else if (what === "clock") nextPhase();
    else if (what === "cat") cat.poke(performance.now());
  });

  /* --- resize --- */
  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    css.setSize(w, h);
    if (mode === "focus" && !tween) {
      const p = focusPose();
      camera.position.copy(p.pos);
      lookAt.copy(p.target);
    }
  }
  window.addEventListener("resize", resize);

  /* --- loop --- */
  const clock = new THREE.Clock();
  const dustPos = dust.geometry.attributes.position;
  let pinned = null;
  function frame() {
    const t = clock.getElapsedTime();
    if (tween) {
      const k = Math.min(1, (performance.now() - tween.t0) / tween.ms);
      const e = ease(k);
      camera.position.lerpVectors(tween.from, tween.to, e);
      lookAt.lerpVectors(tween.fromT, tween.toT, e);
      if (k === 1) tween = null;
    } else if (mode === "wide" && !pinned) {
      // A slow drift plus a little parallax from the mouse.
      camera.position.set(WIDE.pos.x + Math.sin(t * 0.12) * 0.06 + mouse.x * 0.12, WIDE.pos.y + mouse.y * -0.05, WIDE.pos.z);
      lookAt.copy(WIDE.target);
    }
    if (pinned) {
      camera.position.copy(pinned.pos);
      lookAt.copy(pinned.target);
    }
    camera.lookAt(lookAt);

    for (const s of swaying) {
      s.p.rotation.z = Math.sin(t * 0.7 + s.phase) * s.amp;
      s.p.rotation.x = Math.cos(t * 0.53 + s.phase) * s.amp * 0.6;
    }
    for (let i = 0; i < dustPos.count; i++) {
      let y = dustPos.getY(i) + 0.0006 * Math.sin(t * 0.3 + i);
      dustPos.setY(i, y);
      dustPos.setX(i, dustPos.getX(i) + 0.0003 * Math.cos(t * 0.2 + i * 1.7));
    }
    dustPos.needsUpdate = true;

    const now = performance.now();
    if (phaseTween) {
      const k = Math.min(1, (now - phaseTween.t0) / phaseTween.ms);
      const w = ease(k);
      applyPreset(mixPreset(PRESETS[phaseTween.from], PRESETS[phaseTween.to], w));
      setSkies(phaseTween.from, phaseTween.to, w);
      if (k === 1) phaseTween = null;
    }
    cat.update(t, now);
    wallClock.update(new Date());

    renderer.render(scene, camera);
    css.render(cssScene, camera);
  }

  const ready = (async () => {
    await furnish(scene, { desk, shelf, swaying });
    await renderer.compileAsync(scene, camera);
    frame();
    renderer.setAnimationLoop(frame);
  })();

  return {
    ready,
    focus,
    wide,
    setPhase,
    nextPhase,
    get phase() {
      return phase;
    },
    get mode() {
      return mode;
    },
    debug: {
      scene,
      renderer,
      camera,
      lights,
      pin(pos, target) {
        pinned = pos ? { pos: new THREE.Vector3(...pos), target: new THREE.Vector3(...target) } : null;
      },
    },
  };
}
