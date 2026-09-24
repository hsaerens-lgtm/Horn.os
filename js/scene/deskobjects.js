// The things on the desk, modelled for close-ups: a 75% mechanical keyboard
// with sculpted, printed keycaps; a sculpted mouse; a thrown and glazed mug of
// coffee with steam; and a felt desk mat under them.

import * as THREE from "three";
import { roundedBox } from "../lib/shapes.js";
import { mergeParts, at } from "../lib/merge.js";

function canvasTexture(w, h, draw, { srgb = true } = {}) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
}

const shadowed = (m) => {
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

/* ------------------------------------------------------------------ *
 *  Keyboard: 75% layout, aluminium case, two-tone caps with legends
 * ------------------------------------------------------------------ */
// [label, width in units, kind] per row; kind: a = alpha, m = modifier, x = accent, _ = gap
const LAYOUT = [
  [["Esc", 1, "x"], ["", 0.25, "_"], ["F1", 1, "m"], ["F2", 1, "m"], ["F3", 1, "m"], ["F4", 1, "m"], ["", 0.25, "_"], ["F5", 1, "a"], ["F6", 1, "a"], ["F7", 1, "a"], ["F8", 1, "a"], ["", 0.25, "_"], ["F9", 1, "m"], ["F10", 1, "m"], ["F11", 1, "m"], ["F12", 1, "m"], ["", 0.25, "_"], ["Del", 1, "m"]],
  [["`", 1, "a"], ["1", 1, "a"], ["2", 1, "a"], ["3", 1, "a"], ["4", 1, "a"], ["5", 1, "a"], ["6", 1, "a"], ["7", 1, "a"], ["8", 1, "a"], ["9", 1, "a"], ["0", 1, "a"], ["-", 1, "a"], ["=", 1, "a"], ["⌫", 2, "m"], ["", 0.25, "_"], ["PgUp", 1, "m"]],
  [["Tab", 1.5, "m"], ["Q", 1, "a"], ["W", 1, "a"], ["E", 1, "a"], ["R", 1, "a"], ["T", 1, "a"], ["Y", 1, "a"], ["U", 1, "a"], ["I", 1, "a"], ["O", 1, "a"], ["P", 1, "a"], ["[", 1, "a"], ["]", 1, "a"], ["\\", 1.5, "m"], ["", 0.25, "_"], ["PgDn", 1, "m"]],
  [["Caps", 1.75, "m"], ["A", 1, "a"], ["S", 1, "a"], ["D", 1, "a"], ["F", 1, "a"], ["G", 1, "a"], ["H", 1, "a"], ["J", 1, "a"], ["K", 1, "a"], ["L", 1, "a"], [";", 1, "a"], ["'", 1, "a"], ["Enter", 2.25, "x"], ["", 0.25, "_"], ["End", 1, "m"]],
  [["Shift", 2.25, "m"], ["Z", 1, "a"], ["X", 1, "a"], ["C", 1, "a"], ["V", 1, "a"], ["B", 1, "a"], ["N", 1, "a"], ["M", 1, "a"], [",", 1, "a"], [".", 1, "a"], ["/", 1, "a"], ["Shift", 1.75, "m"], ["", 0.25, "_"], ["↑", 1, "m"]],
  [["Ctrl", 1.25, "m"], ["⌘", 1.25, "m"], ["Alt", 1.25, "m"], ["", 6.25, "a"], ["Alt", 1, "m"], ["Fn", 1, "m"], ["", 0.25, "_"], ["←", 1, "m"], ["↓", 1, "m"], ["→", 1, "m"]],
];
const COLOURS = { a: "#e9e2d2", m: "#8d9196", x: "#d86a2c" };
const INK = { a: "#3b3a36", m: "#f1efe9", x: "#fff4ea" };

export function buildKeyboard() {
  const U = 0.0185; // one key unit
  const GAP = 0.0012;
  const rows = LAYOUT.length;
  const widthU = 16.25;
  const W = widthU * U;
  const D = rows * U + 0.25 * U; // the F-row sits a quarter unit apart
  const PAD = 0.011;
  const g = new THREE.Group();

  // Case: anodised aluminium, a shallow tray with a wedge to it.
  const alu = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.38, metalness: 0.75 });
  const caseMesh = shadowed(new THREE.Mesh(roundedBox(W + 2 * PAD, 0.016, D + 2 * PAD, 0.004), alu));
  caseMesh.position.y = 0.008;
  g.add(caseMesh);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(W + 0.004, 0.001, D + 0.004), new THREE.MeshStandardMaterial({ color: 0x151618, roughness: 0.6 }));
  plate.position.y = 0.0162;
  g.add(plate);

  // One texture seen from above: each key's colour and legend at its place.
  const PX = 2048 / (W + 2 * PAD);
  const tex = canvasTexture(2048, Math.round((D + 2 * PAD) * PX), (c, w, h) => {
    c.fillStyle = "#1b1c1e";
    c.fillRect(0, 0, w, h);
    let z = PAD;
    LAYOUT.forEach((row, ri) => {
      let x = PAD;
      for (const [label, u, kind] of row) {
        if (kind !== "_") {
          const x0 = x * PX;
          const y0 = z * PX;
          const kw = u * U * PX;
          const kh = U * PX;
          c.fillStyle = COLOURS[kind];
          c.fillRect(x0, y0, kw, kh);
          // a soft darker rim towards the edge of each cap
          const grd = c.createLinearGradient(0, y0, 0, y0 + kh);
          grd.addColorStop(0, "rgba(255,255,255,0.12)");
          grd.addColorStop(1, "rgba(0,0,0,0.12)");
          c.fillStyle = grd;
          c.fillRect(x0, y0, kw, kh);
          if (label) {
            c.fillStyle = INK[kind];
            const size = label.length > 2 ? kh * 0.2 : kh * 0.32;
            c.font = `600 ${size}px Inter, Arial, sans-serif`;
            c.textAlign = label.length > 2 ? "left" : "center";
            c.textBaseline = "middle";
            c.fillText(label, label.length > 2 ? x0 + kh * 0.22 : x0 + kw / 2, y0 + kh * 0.42);
          }
        }
        x += u * U;
      }
      z += U + (ri === 0 ? 0.25 * U : 0);
    });
  });

  // Keycaps: rounded blocks whose tops lean in (a sculpted profile), each
  // row tilted a little more towards the typist, all merged into one mesh.
  const caps = [];
  let z = PAD;
  const profile = [0.011, 0.0095, 0.0088, 0.0086, 0.009, 0.0092];
  LAYOUT.forEach((row, ri) => {
    let x = PAD;
    for (const [, u, kind] of row) {
      if (kind !== "_") {
        const w = u * U - GAP;
        const d = U - GAP;
        const h = profile[ri];
        const geo = roundedBox(w, h, d, 0.0016, 2).clone();
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          if (pos.getY(i) > 0) {
            pos.setX(i, pos.getX(i) * (1 - 0.0028 / w));
            pos.setZ(i, pos.getZ(i) * 0.8);
          }
        }
        geo.computeVertexNormals();
        geo.translate(x + (u * U) / 2 - (W / 2 + PAD), 0.0165 + h / 2, z + U / 2 - (D / 2 + PAD));
        geo.rotateX(0); // rows share one plane; the case wedge does the tilt
        caps.push({ geometry: geo });
      }
      x += u * U;
    }
    z += U + (ri === 0 ? 0.25 * U : 0);
  });
  const capGeo = mergeParts(caps);
  // planar UVs from above, matching the legend texture
  const pos = capGeo.attributes.position;
  const uv = capGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + W / 2 + PAD) / (W + 2 * PAD), 1 - (pos.getZ(i) + D / 2 + PAD) / (D + 2 * PAD));
  const capMesh = shadowed(new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62 })));
  g.add(capMesh);

  // the cable, leaving the back edge
  g.rotation.x = 0.06; // wedge: the back stands higher
  return { group: g, width: W + 2 * PAD, depth: D + 2 * PAD };
}

/* ------------------------------------------------------------------ *
 *  Mouse: an ergonomic shell modelled as a height field over its
 *  footprint — wide at the back, narrow at the nose, a thumb flare on the
 *  left — with split buttons, a knurled wheel in its slot, side buttons and
 *  a sole. +z is the nose.
 * ------------------------------------------------------------------ */
export function buildMouse() {
  const g = new THREE.Group();
  const L = 0.062; // half length
  const HMAX = 0.037;
  const SEG = 96;
  const RINGS = 28;

  // footprint: a superellipse, narrower at the nose, flared under the thumb
  const outline = (a) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    let ax = s > 0 ? 0.031 - 0.006 * s : 0.032;
    // The mouse is turned nose-to-screen, so model +x is the user's left: the thumb side.
    if (c > 0) ax *= 1 + 0.1 * Math.exp(-((s + 0.1) * (s + 0.1)) * 5); // thumb flare
    const n = 2.7;
    return 1 / Math.pow(Math.pow(Math.abs(c / ax), n) + Math.pow(Math.abs(s / L), n), 1 / n);
  };
  // height over the footprint: the hump behind the middle, falling to the nose
  const height = (x, z) => {
    const zn = z / L;
    const xn = x / 0.032;
    let h = HMAX * (1 - 0.58 * Math.pow((zn + 0.22) / 1.22, 2)) * (1 - 0.12 * xn * xn);
    if (zn > 0.12) h -= 0.0009 * Math.exp(-Math.pow(xn / 0.05, 2)) * Math.min(1, (zn - 0.12) * 4); // the button split
    return h;
  };

  const pos = [];
  const uv = [];
  const idx = [];
  pos.push(0, height(0, 0), 0);
  uv.push(0.5, 0.5);
  for (let r = 1; r <= RINGS; r++) {
    const s = r / RINGS;
    for (let k = 0; k < SEG; k++) {
      const a = (k / SEG) * Math.PI * 2;
      const R = outline(a) * s;
      const x = Math.cos(a) * R;
      const z = Math.sin(a) * R;
      // flat top, then the sides roll steeply down to the sole
      const fall = Math.pow(Math.max(0, 1 - Math.pow(s, 7)), 0.5);
      const y = 0.002 + height(x, z) * fall;
      pos.push(x, y, z);
      uv.push(0.5 + x / 0.08, 0.5 + z / (2.2 * L));
    }
  }
  for (let k = 0; k < SEG; k++) idx.push(0, 1 + ((k + 1) % SEG), 1 + k);
  for (let r = 1; r < RINGS; r++) {
    for (let k = 0; k < SEG; k++) {
      const a = 1 + (r - 1) * SEG + k;
      const b = 1 + (r - 1) * SEG + ((k + 1) % SEG);
      const c = a + SEG;
      const d = b + SEG;
      idx.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  // the shell's surface: soft-touch graphite, the buttons a touch glossier,
  // hairline seams where the buttons meet the body
  const skin = canvasTexture(512, 512, (c, w, h) => {
    c.fillStyle = "#34373c";
    c.fillRect(0, 0, w, h);
    const r = seeded(61);
    for (let i = 0; i < 20000; i++) {
      c.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.05)";
      c.fillRect(r() * w, r() * h, 1, 1);
    }
    // v grows towards the nose (canvas top). Seam across the back of the buttons:
    const seamY = h * (1 - (0.5 + (0.1 * L) / (2.2 * L)));
    c.strokeStyle = "rgba(10,10,12,0.9)";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, seamY + 30);
    c.quadraticCurveTo(w / 2, seamY - 26, w, seamY + 30);
    c.stroke();
    // the split between left and right buttons
    c.beginPath();
    c.moveTo(w / 2, 0);
    c.lineTo(w / 2, seamY - 8);
    c.stroke();
    // the slot the wheel sits in
    const slotY = h * (1 - (0.5 + (0.46 * L) / (2.2 * L)));
    c.fillStyle = "#0c0d0f";
    c.beginPath();
    c.ellipse(w / 2, slotY, 12, 48, 0, 0, Math.PI * 2);
    c.fill();
  });
  const shell = shadowed(new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ map: skin, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.45 })));
  g.add(shell);

  // the sole: a dark plate just inside the footprint
  const sole = new THREE.Shape();
  for (let k = 0; k <= SEG; k++) {
    const a = (k / SEG) * Math.PI * 2;
    const R = outline(a) * 0.97;
    const x = Math.cos(a) * R;
    const z = Math.sin(a) * R;
    if (k === 0) sole.moveTo(x, -z);
    else sole.lineTo(x, -z);
  }
  const soleMesh = new THREE.Mesh(new THREE.ShapeGeometry(sole, 1), new THREE.MeshStandardMaterial({ color: 0x151618, roughness: 0.9 }));
  soleMesh.rotation.x = -Math.PI / 2;
  soleMesh.position.y = 0.0015;
  g.add(soleMesh);

  // the wheel: knurled rubber on a metal hub, sunk into its slot
  const knurl = canvasTexture(256, 32, (c, w, h) => {
    c.fillStyle = "#1c1d20";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#3a3c41";
    for (let x = 0; x < w; x += 8) c.fillRect(x, 0, 4, h);
  });
  knurl.wrapS = THREE.RepeatWrapping;
  const wz = 0.46 * L;
  const wheelR = 0.0072;
  const wheel = new THREE.Mesh(
    new THREE.CylinderGeometry(wheelR, wheelR, 0.0055, 40, 1, false).rotateZ(Math.PI / 2),
    [new THREE.MeshStandardMaterial({ map: knurl, roughness: 0.85 }), new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.25, metalness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.25, metalness: 0.9 })],
  );
  wheel.position.set(0, 0.002 + height(0, wz) - wheelR + 0.0035, wz);
  g.add(wheel);

  // two thumb buttons on the thumb-side flank
  for (const [z0, len] of [
    [0.004, 0.016],
    [-0.016, 0.014],
  ]) {
    const a = Math.atan2(z0, 1);
    const R = outline(a) * 0.95;
    const b = shadowed(new THREE.Mesh(roundedBox(0.004, 0.006, len, 0.0018), new THREE.MeshPhysicalMaterial({ color: 0x2a2c30, roughness: 0.35, clearcoat: 0.6 })));
    b.position.set(Math.cos(a) * R, 0.019, z0);
    b.rotation.z = -0.35;
    g.add(b);
  }
  return g;
}

/* ------------------------------------------------------------------ *
 *  Mug: thrown profile with a wall, a dipped glaze, coffee and steam
 * ------------------------------------------------------------------ */
export function buildMug() {
  const g = new THREE.Group();
  const R = 0.041;
  const H = 0.098;
  const T = 0.0045; // wall
  // outer wall up and over the rim, inner wall back down to the floor
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(R * 0.82, 0.0),
    new THREE.Vector2(R * 0.9, 0.004),
    new THREE.Vector2(R * 0.97, 0.03),
    new THREE.Vector2(R, 0.07),
    new THREE.Vector2(R * 1.01, H - 0.004),
    new THREE.Vector2(R * 1.005, H),
    new THREE.Vector2(R - T * 0.5, H + 0.0015),
    new THREE.Vector2(R - T, H - 0.004),
    new THREE.Vector2(R - T, 0.02),
    new THREE.Vector2(R * 0.6, 0.009),
    new THREE.Vector2(0.0, 0.008),
  ];
  // glaze: speckled cream stoneware dipped into a deep teal from the rim down
  const glaze = canvasTexture(512, 512, (c, w, h) => {
    c.fillStyle = "#e9e0cf";
    c.fillRect(0, 0, w, h);
    const r = seeded(33);
    for (let i = 0; i < 3500; i++) {
      c.fillStyle = `rgba(${90 + r() * 40},${70 + r() * 30},${50 + r() * 20},${0.3 + r() * 0.5})`;
      const d = 0.6 + r() * 1.6;
      c.fillRect(r() * w, r() * h, d, d);
    }
    // the dip line wobbles; v runs along the profile, top of the canvas is the rim
    c.fillStyle = "#1f5c5a";
    c.beginPath();
    c.moveTo(0, 0);
    for (let x = 0; x <= w; x += 8) c.lineTo(x, h * 0.62 + Math.sin(x * 0.03) * 10 + Math.sin(x * 0.11) * 4);
    c.lineTo(w, 0);
    c.closePath();
    c.fill();
    for (let i = 0; i < 1500; i++) {
      c.fillStyle = `rgba(${20 + r() * 40},${80 + r() * 40},${80 + r() * 40},${0.25 + r() * 0.3})`;
      c.fillRect(r() * w, r() * h * 0.6, 1 + r() * 2, 1 + r() * 2);
    }
  });
  glaze.wrapS = THREE.RepeatWrapping;
  const lathe = new THREE.LatheGeometry(pts, 56);
  // LatheGeometry's v runs 0 → 1 up the profile; flip so the dip is at the rim
  const uv = lathe.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i));
  const ceramic = new THREE.MeshPhysicalMaterial({ map: glaze, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const body = shadowed(new THREE.Mesh(lathe, ceramic));
  g.add(body);
  // handle: an elliptical tube on a C-shaped curve
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(R * 0.98, H * 0.78, 0),
    new THREE.Vector3(R + 0.022, H * 0.8, 0),
    new THREE.Vector3(R + 0.03, H * 0.52, 0),
    new THREE.Vector3(R + 0.02, H * 0.26, 0),
    new THREE.Vector3(R * 0.98, H * 0.22, 0),
  ]);
  const handleGeo = new THREE.TubeGeometry(curve, 40, 0.0055, 12, false);
  handleGeo.scale(1, 1, 1.6);
  const handle = shadowed(new THREE.Mesh(handleGeo, new THREE.MeshPhysicalMaterial({ color: 0x1f5c5a, roughness: 0.28, clearcoat: 0.8 })));
  g.add(handle);
  // coffee, with a ring of crema
  const crema = canvasTexture(256, 256, (c, w, h) => {
    const grd = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, "#3b2213");
    grd.addColorStop(0.6, "#5a3219");
    grd.addColorStop(0.85, "#a0673a");
    grd.addColorStop(1, "#c08450");
    c.fillStyle = grd;
    c.fillRect(0, 0, w, h);
    const r = seeded(4);
    for (let i = 0; i < 400; i++) {
      c.fillStyle = `rgba(210,160,110,${r() * 0.25})`;
      c.beginPath();
      c.arc(w / 2 + (r() - 0.5) * w * 0.8, h / 2 + (r() - 0.5) * h * 0.8, 1 + r() * 3, 0, Math.PI * 2);
      c.fill();
    }
  });
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(R - T - 0.0002, 40), new THREE.MeshPhysicalMaterial({ map: crema, roughness: 0.15, clearcoat: 1 }));
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = H - 0.014;
  g.add(coffee);

  // steam: three soft wisps rising and fading, on a loop
  const puff = canvasTexture(128, 256, (c, w, h) => {
    const grd = c.createRadialGradient(w / 2, h * 0.6, 2, w / 2, h * 0.6, w * 0.5);
    grd.addColorStop(0, "rgba(255,255,255,0.35)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = grd;
    c.fillRect(0, 0, w, h);
  });
  const wisps = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.1), new THREE.MeshBasicMaterial({ map: puff, transparent: true, depthWrite: false, opacity: 0 }));
    m.userData.phase = i / 3;
    g.add(m);
    wisps.push(m);
  }

  return {
    group: g,
    update(t, camera, amount = 1) {
      for (const m of wisps) {
        const k = (t * 0.18 + m.userData.phase) % 1;
        m.position.set(Math.sin(t * 0.7 + m.userData.phase * 6) * 0.008, H + 0.02 + k * 0.12, 0);
        m.scale.setScalar(0.7 + k * 0.9);
        m.material.opacity = Math.sin(k * Math.PI) * 0.5 * amount;
        m.quaternion.copy(camera.quaternion);
      }
    },
  };
}

/* ------------------------------------------------------------------ *
 *  Desk mat: charcoal felt with a stitched edge
 * ------------------------------------------------------------------ */
export function buildDeskMat(w = 0.78, d = 0.34) {
  const felt = canvasTexture(1024, 512, (c, cw, ch) => {
    c.fillStyle = "#3a3d40";
    c.fillRect(0, 0, cw, ch);
    const r = seeded(17);
    for (let i = 0; i < 60000; i++) {
      c.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)";
      c.fillRect(r() * cw, r() * ch, 1 + r() * 2, 1);
    }
    c.strokeStyle = "rgba(20,20,22,0.8)";
    c.setLineDash([6, 5]);
    c.lineWidth = 2;
    c.strokeRect(10, 10, cw - 20, ch - 20);
  });
  const mat = shadowed(new THREE.Mesh(roundedBox(w, 0.003, d, 0.0015), new THREE.MeshStandardMaterial({ map: felt, roughness: 1 })));
  mat.position.y = 0.0015;
  return mat;
}
