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
import { shelfBooks } from "./books.js";
import { hangingPlant } from "./hanging.js";
import { buildKeyboard, buildMouse, buildMug, buildDeskMat } from "./deskobjects.js";
import { PHASES, PRESETS, phaseFor, mixPreset } from "./daycycle.js";
import { buildCity } from "./city.js";

/* ------------------------------------------------------------------ *
 *  Dimensions (metres)
 * ------------------------------------------------------------------ */
const ROOM = { x0: -2.3, x1: 2.3, z0: -2.1, z1: 2.9, h: 2.7 };
const WIN = { z0: -1.95, z1: 0.55, y0: 0.78, y1: 2.45 }; // opening in the left wall
const DESK = { x: -0.8, z: -1.72, w: 1.6, d: 0.72, y: 0.74, t: 0.035 };
const SCREEN = { w: 0.6, h: 0.375 }; // 16:10
const OS_PX = { w: 1280, h: 800 };
const TOP = DESK.y + DESK.t / 2;
const SCREEN_POS = new THREE.Vector3(DESK.x, TOP + 0.335, DESK.z - 0.13);

const WIDE = { pos: new THREE.Vector3(0.9, 1.46, 0.95), target: new THREE.Vector3(-0.9, 1.0, -1.5) };

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
  return { sill };
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
  const legs = mesh(mergeParts(legParts), M.steel);
  group.add(legs);

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
  // a power LED and a quiet maker's mark on the chin
  const led = new THREE.Mesh(new THREE.CircleGeometry(0.0016, 12), new THREE.MeshBasicMaterial({ color: 0xbfe6ff }));
  led.position.set(SCREEN.w / 2 - 0.012, -SCREEN.h / 2 - chin / 2 + 0.001, 0.0074);
  mon.add(led);
  const mark = new THREE.Mesh(
    new THREE.PlaneGeometry(0.03, 0.006),
    new THREE.MeshStandardMaterial({
      map: canvasTexture(256, 52, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        g.fillStyle = "#3a3d42";
        g.font = "600 34px Inter, Arial, sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText("HORN", w / 2, h / 2 + 2);
      }),
      transparent: true,
      roughness: 0.4,
    }),
  );
  mark.position.set(0, -SCREEN.h / 2 - chin / 2 + 0.001, 0.0074);
  mon.add(mark);
  // cables: one from the back of the neck down behind the desk, one coiled
  // from the keyboard to the monitor
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.6 });
  const neckBack = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.14, -0.1),
    new THREE.Vector3(0.02, -drop + 0.05, -0.16),
    new THREE.Vector3(0.05, -drop + 0.004, -0.2),
    new THREE.Vector3(0.08, -drop + 0.002, -0.24),
    new THREE.Vector3(0.1, -drop - 0.12, -0.25),
  ]);
  mon.add(mesh(new THREE.TubeGeometry(neckBack, 40, 0.0028, 8, false), cableMat));
  const coil = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.04, -drop + 0.012, 0.215),
    new THREE.Vector3(-0.05, -drop + 0.004, 0.17),
    new THREE.Vector3(-0.08, -drop + 0.003, 0.08),
    new THREE.Vector3(-0.07, -drop + 0.003, -0.02),
    new THREE.Vector3(-0.03, -drop + 0.02, -0.06),
  ]);
  mon.add(mesh(new THREE.TubeGeometry(coil, 60, 0.0022, 8, false), new THREE.MeshStandardMaterial({ color: 0xd86a2c, roughness: 0.5 })));

  // The screen: a cut-out that lets the CSS3D layer show through.
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(SCREEN.w, SCREEN.h),
    new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: THREE.NoBlending, side: THREE.FrontSide }),
  );
  screen.position.z = 0.0115;
  screen.name = "screen";
  mon.add(screen);

  // A felt mat under a mechanical keyboard and a sculpted mouse.
  const deskMat = buildDeskMat(0.8, 0.33);
  deskMat.position.set(0.1, TOP, 0.15);
  group.add(deskMat);
  const kb = buildKeyboard();
  kb.group.position.set(-0.02, TOP + 0.003, 0.14);
  kb.group.rotation.y = 0.03;
  group.add(kb.group);
  const mouse = buildMouse();
  mouse.position.set(0.31, TOP + 0.003, 0.17);
  mouse.rotation.y = Math.PI - 0.18; // buttons towards the screen
  group.add(mouse);

  // A mug of coffee, steaming.
  const mug = buildMug();
  mug.group.position.set(0.55, TOP, 0.05);
  mug.group.rotation.y = -0.6;
  group.add(mug.group);

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
  // clamped to the back edge of the desk, on the left; the arm reaches forward
  lamp.position.set(-0.6, TOP, -0.16);
  lamp.rotation.y = Math.PI - 0.55;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.016, 16, 12), new THREE.MeshStandardMaterial({ color: 0xfff4e0, emissive: 0xffd9a0, emissiveIntensity: 0 }));
  lamp.add(bulb);
  const lampLight = new THREE.SpotLight(0xffd6a0, 0, 3, 0.75, 0.6, 2);
  const lampTarget = new THREE.Object3D();
  lamp.add(lampLight, lampTarget);
  lampLight.target = lampTarget;
  group.add(lamp);

  return { group, screen, lampLight, lampTarget, bulb, lamp, top, legs, mug };
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

  // Books: every shelf filled differently, standing, leaning and stacked.
  const top = (i) => shelfY[i] + 0.0125;
  const L = -W / 2 + 0.03;
  const R = W / 2 - 0.03;
  g.add(shelfBooks(top(0), L, R, [{ kind: "row", type: "art", width: 0.3 }, { kind: "gap", width: 0.04 }, { kind: "stack", type: "art", count: 4 }, { kind: "row", width: 0.3 }], 11));
  g.add(shelfBooks(top(1), 0.05, R, [{ kind: "gap", width: 0.22 }, { kind: "row", width: 0.2, type: "paperback", lean: true }], 12));
  g.add(shelfBooks(top(2), L, R, [{ kind: "row", width: 0.42, lean: true }, { kind: "gap", width: 0.1 }, { kind: "stack", type: "hardback", count: 3 }, { kind: "row", type: "paperback", width: 0.2 }], 13));
  g.add(shelfBooks(top(3), L, R, [{ kind: "stack", type: "paperback", count: 5 }, { kind: "gap", width: 0.06 }, { kind: "row", width: 0.36, type: "paperback" }, { kind: "gap", width: 0.2 }, { kind: "row", width: 0.2, type: "hardback", lean: true }], 14));
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
  // An architecture print above the desk — a nod to the architecture studies
  // in Grenoble: a Swiss-style composition on paper, in a white mat, a thin
  // oak frame and a pane of glass that catches the room.
  const W = 0.5;
  const H = 0.7;
  const art = canvasTexture(1400, 1960, (g, w, h) => {
    // paper, with a little grain
    g.fillStyle = "#f2ede2";
    g.fillRect(0, 0, w, h);
    const r = seeded(12);
    for (let i = 0; i < 40000; i++) {
      g.fillStyle = r() < 0.5 ? "rgba(120,100,70,0.04)" : "rgba(255,255,255,0.05)";
      g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
    }
    const u = w / 14;
    // the composition: a sun, a slab, a column, a stair — a building reduced to shapes
    g.fillStyle = "#c8553d";
    g.beginPath();
    g.arc(u * 9.2, u * 5.2, u * 3.1, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#1f5c5a";
    g.fillRect(u * 1.5, u * 8.2, u * 8.5, u * 1.1);
    g.fillStyle = "#e1a93a";
    g.fillRect(u * 3.2, u * 9.3, u * 1.1, u * 7.2);
    g.fillStyle = "#22201d";
    for (let k = 0; k < 6; k++) g.fillRect(u * (6.2 + k * 0.9), u * (15.2 - k * 0.9), u * 0.9, u * (0.9 + k * 0.9));
    g.fillRect(u * 1.5, u * 16.5, u * 11, u * 0.18);
    // hairline construction lines, as on a drawing
    g.strokeStyle = "rgba(34,32,29,0.35)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(u * 1.5, u * 2);
    g.lineTo(u * 12.5, u * 16.4);
    g.moveTo(u * 12.5, u * 2);
    g.lineTo(u * 1.5, u * 16.4);
    g.stroke();
    g.beginPath();
    g.arc(u * 9.2, u * 5.2, u * 4.2, 0, Math.PI * 2);
    g.stroke();
    // type
    g.fillStyle = "#22201d";
    g.font = `800 ${u * 0.95}px Inter, Arial, sans-serif`;
    g.fillText("FORM", u * 1.5, u * 17.7);
    g.fillText("FOLLOWS", u * 1.5, u * 18.65);
    g.fillText("LIGHT", u * 1.5, u * 19.6);
    g.font = `500 ${u * 0.3}px Inter, Arial, sans-serif`;
    g.fillText("ARCHITECTURE STUDIES  ·  GRENOBLE", u * 7.4, u * 17.5);
    g.fillText("PLAN  ·  SECTION  ·  ELEVATION", u * 7.4, u * 18.0);
    g.fillText("MMXIII — MMXV", u * 7.4, u * 18.5);
    g.fillStyle = "#c8553d";
    g.fillRect(u * 7.4, u * 18.95, u * 0.5, u * 0.5);
  });
  const x = DESK.x + 0.12;
  const y = 1.72;
  const zWall = ROOM.z0;
  // oak frame: four mitred-looking bars
  const oak = OAK();
  const fw = 0.022;
  const depth = 0.028;
  const bars = [
    { geometry: new THREE.BoxGeometry(W + 2 * fw, fw, depth), matrix: at(0, H / 2 + fw / 2, 0) },
    { geometry: new THREE.BoxGeometry(W + 2 * fw, fw, depth), matrix: at(0, -H / 2 - fw / 2, 0) },
    { geometry: new THREE.BoxGeometry(fw, H, depth), matrix: at(-W / 2 - fw / 2, 0, 0) },
    { geometry: new THREE.BoxGeometry(fw, H, depth), matrix: at(W / 2 + fw / 2, 0, 0) },
  ];
  const frame = mesh(mergeParts(bars), oak);
  frame.position.set(x, y, zWall + depth / 2 + 0.002);
  scene.add(frame);
  // white mat, the print inset in it, and the glass
  const matBoard = mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ color: 0xf7f5f0, roughness: 0.95 }), { cast: false });
  matBoard.position.set(x, y, zWall + 0.006);
  scene.add(matBoard);
  const print = mesh(new THREE.PlaneGeometry(W - 0.09, (W - 0.09) * 1.4), new THREE.MeshStandardMaterial({ map: art, roughness: 0.9 }), { cast: false });
  print.position.set(x, y + 0.01, zWall + 0.0065);
  scene.add(print);
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.12, envMapIntensity: 1.5, clearcoat: 1 }),
  );
  glass.position.set(x, y, zWall + 0.02);
  scene.add(glass);
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

  // Golden pothos in macramé hangers, in front of the window and over the
  // bookcase. Each group's origin is its ceiling hook, so the sway is a pendulum.
  for (const [x, z, seed, glaze, length] of [
    [ROOM.x0 + 0.42, -1.05, 131, "white", 0.95],
    [ROOM.x0 + 0.46, 0.1, 137, "terracotta", 0.8],
    [1.55, ROOM.z0 + 0.45, 139, "sage", 0.7],
  ]) {
    const hookY = ROOM.h - 0.22;
    const hp = hangingPlant({ seed, glaze, length, drop: 0.42 });
    hp.position.set(x, hookY, z);
    scene.add(hp);
    swaying.push({ p: hp, phase: swaying.length * 2.1, amp: 0.02 });
    scene.add(mesh(mergeParts([between(new THREE.Vector3(x, hookY, z), new THREE.Vector3(x, ROOM.h, z), 0.003, 0.003, 5)]), M.rope, { cast: false }));
  }
  void sill;
  return swaying;
}

/* ------------------------------------------------------------------ *
 *  Real models (Poly Haven, CC0)
 * ------------------------------------------------------------------ */

// The stationery set lays its pens and pencils out on the desk beside the
// cup. Stand them in it instead: each one is baked into world space, turned
// upright about its own centre, dropped to the bottom of the cup and leant
// against the rim, fanned round it.
function standPensInCup(stationery, scene) {
  scene.updateMatrixWorld(true); // the desk group may not have been positioned in world space yet
  let cup = null;
  const pens = [];
  const loose = [];
  stationery.traverse((o) => {
    if (!o.isMesh) return;
    if (/pencilcup/.test(o.name)) cup = o;
    else if (/pen|pencil/.test(o.name)) pens.push(o);
    else loose.push(o);
  });
  if (!cup) return;
  const cupBox = new THREE.Box3().setFromObject(cup);
  const c = cupBox.getCenter(new THREE.Vector3());
  const cupR = Math.min(cupBox.max.x - cupBox.min.x, cupBox.max.z - cupBox.min.z) / 2;
  const floor = cupBox.min.y + 0.012;
  pens.forEach((pen, i) => {
    const geo = pen.geometry.clone().applyMatrix4(pen.matrixWorld);
    geo.computeBoundingBox();
    const size = geo.boundingBox.getSize(new THREE.Vector3());
    // turn the long axis upright
    if (size.x >= size.y && size.x >= size.z) geo.rotateZ(Math.PI / 2);
    else if (size.z >= size.y && size.z >= size.x) geo.rotateX(Math.PI / 2);
    geo.center();
    geo.computeBoundingBox();
    const len = geo.boundingBox.max.y - geo.boundingBox.min.y;
    geo.translate(0, len / 2, 0); // origin at the bottom end
    // foot on the far side of the cup, top leaning out over the near rim
    const a = (i / pens.length) * Math.PI * 2 + 0.4;
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const lean = 0.1 + (i % 3) * 0.045;
    const m = new THREE.Mesh(geo, pen.material);
    m.castShadow = m.receiveShadow = true;
    m.position.copy(c).addScaledVector(dir, -cupR * 0.22); // the cup narrows towards its foot
    m.position.y = floor;
    const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0).cross(dir).normalize(), lean);
    const spin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 1.7);
    m.quaternion.copy(tilt).multiply(spin);
    scene.add(m);
    pen.visible = false;
  });
  // whatever else was lying on the pencils (the eraser) goes down on the desk
  const deskTop = cupBox.min.y;
  for (const o of loose) {
    const box = new THREE.Box3().setFromObject(o);
    const lift = box.min.y - deskTop;
    if (lift > 0.002) o.position.y -= lift / o.parent.getWorldScale(new THREE.Vector3()).y;
  }
}
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
    inPlanter("pachira_aquatica_01", { variant: "a", height: 1.45 }, { r: 0.18, h: 0.36, glaze: "charcoal" }, ROOM.x0 + 0.52, 0, -1.74, 2.4).then((o) => sway(o, 0.006)),
    model("potted_plant_01", { height: 1.4 }).then((o) => sway(put(o, 1.78, 0, ROOM.z0 + 0.38, 0.4), 0.006)),
    model("potted_plant_02", { height: 0.8 }).then((o) => sway(put(o, ROOM.x0 + 0.5, 0, -0.2, 1.2), 0.008)),
    // On the sill, beside the cat.
    inPlanter("anthurium_botany_01", { variant: "a", height: 0.32 }, { r: 0.075, h: 0.11, glaze: "white" }, sillX, sillY, -1.45, 0.3),
    model("potted_plant_04", { height: 0.22 }).then((o) => put(o, sillX, sillY, -1.12, 0.5)),
    // On top of the bookcase, and on its middle shelf.
    inPlanter("calathea_orbifolia_01", { variant: "a", height: 0.34 }, { r: 0.11, h: 0.15, glaze: "sage" }, 0.72, shelfTop, ROOM.z0 + 0.2, 0.2),
    model("ceramic_vase_01", { height: 0.26 }).then((o) => put(o, 0.14, shelf.shelfY[1] + 0.0125, 0, 0, shelf.group)),
    // One encyclopedia set on the middle shelf; the rest are painted spines.
    model("book_encyclopedia_set_01", { scale: 0.85 }).then((o) => put(o, -0.22, shelf.shelfY[1] + 0.0125, 0.02, 0, shelf.group)),
    // On the desk: the lamp, a succulent, a pencil cup.
    model("desk_lamp_arm_01", { height: 0.6 }).then((o) => {
      // A clamp lamp: its origin is the tabletop and the clamp hangs below it,
      // so undo the lift model() gave it to stand on its lowest point.
      o.position.y -= 0.088 * o.scale.y;
      desk.lamp.add(o);
      desk.lamp.updateWorldMatrix(true, true);
      // The shade is at the far end of the arm; its bulb is its own small mesh.
      // Put our glow and the spot exactly there, aimed out of the shade's mouth.
      let bulbMesh = null;
      o.traverse((m) => {
        if (m.isMesh && /_1$/.test(m.name)) bulbMesh = m;
      });
      const bulbWorld = new THREE.Box3().setFromObject(bulbMesh ?? o).getCenter(new THREE.Vector3());
      const bulbLocal = desk.lamp.worldToLocal(bulbWorld.clone());
      desk.bulb.position.copy(bulbLocal);
      desk.bulb.scale.setScalar(0.7);
      desk.lampLight.position.copy(bulbLocal);
      desk.lampTarget.position.copy(bulbLocal).add(new THREE.Vector3(0, -0.45, -0.22));
      if (bulbMesh) {
        bulbMesh.material = bulbMesh.material.clone();
        bulbMesh.material.emissive = new THREE.Color(0xffd9a0);
        bulbMesh.material.emissiveIntensity = desk.bulb.material.emissiveIntensity;
        desk.bulbExtra = bulbMesh.material;
      }
    }),
    model("potted_plant_04", { height: 0.2 }).then((o) => put(o, 0.64, TOP, -0.2, 0.3, desk.group)),
    model("stationery_supplies", { height: 0.15 }).then((o) => {
      put(o, -0.52, TOP, -0.22, 0.4, desk.group);
      standPensInCup(o, scene);
    }),
    // The chair, pulled out and turned towards the room.
    // A leather chair pushed in at the desk; the lounge chair by the window.
    model("dining_chair_02", { height: 0.95 }).then((o) => put(o, DESK.x + 0.12, 0, DESK.z + 0.66, Math.PI - 0.25)),
    model("modern_arm_chair_01", { height: 0.9 }).then((o) => put(o, ROOM.x0 + 0.75, 0, 0.35, 2.2)),
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

  const camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.08, 900);
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
  const city = buildCity(scene);

  // The cat asleep on the sill, in the sun.
  const cat = buildCat();
  cat.group.position.set(ROOM.x0 + 0.1, WIN.y0 + 0.001, -0.62);
  cat.group.rotation.y = 0.15;
  scene.add(cat.group);

  // The guitar, between the desk and the bookcase.
  const guitar = buildGuitar();
  guitar.position.set(0.24, 0, ROOM.z0 + 0.32);
  guitar.rotation.y = -0.35;
  scene.add(guitar);

  // The wall clock, left of the print.
  const wallClock = buildClock();
  wallClock.group.position.set(DESK.x - 0.62, 1.9, ROOM.z0 + 0.012);
  scene.add(wallClock.group);

  /* --- the day cycle --- */
  let currentNight = 0;
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
    if (desk.bulbExtra) desk.bulbExtra.emissiveIntensity = p.bulb * 2.5;
    lights.glow.intensity = p.glowI;
    lights.fill.intensity = p.fillI;
    dust.material.opacity = p.dust;
    renderer.toneMappingExposure = p.exposure;
    currentNight = p.night;
    city.apply(p);
  }
  let phase = PHASES.includes(initialPhase) ? initialPhase : "day";
  let phaseTween = null;
  applyPreset(PRESETS[phase]);
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
  let lastT = null;
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
      if (k === 1) phaseTween = null;
    }
    cat.update(t, now);
    desk.mug.update(t, camera, 1 - currentNight * 0.5);
    city.update(t, Math.min(0.05, t - (lastT ?? t)));
    lastT = t;
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
