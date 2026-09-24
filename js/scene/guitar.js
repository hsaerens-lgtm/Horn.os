// The guitar in the corner: a sunburst OM steel-string resting on a floor stand.
//
// It is built to a real guitar's measurements (645 mm scale, 14 frets clear of
// the body), so every part lands where it should: the bridge sits in the lower
// bout, and the fretboard runs onto the top and stops over the rosette. The
// body is hollow: a top with a hole cut in it, bent sides with bound edges,
// and a tapered back. Looking through the sound hole shows the back braces and
// the maker's label, lying in the shadow of the top.

import * as THREE from "three";
import { roundedBox, between } from "../lib/shapes.js";
import { mergeParts, at } from "../lib/merge.js";

const L = 0.495; // body length, tail to neck joint
const SCALE = 0.645;
const fret = (n) => SCALE * (1 - Math.pow(2, -n / 12)); // nut to fret n
const NUT = L + fret(14); // the 14th fret meets the body
const SADDLE = NUT - SCALE;
const BOARD_END = NUT - fret(20) - 0.005;
const HOLE = { y: 0.355, r: 0.05 };
const EDGE = 0.0025; // radius of the rounded, bound edge
const W = 0.4; // width the top texture covers
const depthAt = (y) => 0.104 - 0.02 * (y / L); // the body is shallower at the neck
const widthAt = (y) => 0.0445 + 0.011 * ((NUT - y) / fret(14)); // neck and fretboard
const HEAD_TILT = -0.244; // 14° back from the nut
const SADDLE_TOP = 0.0118;
const NUT_SLOT = 0.0078;

const rng = (seed) => {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
};

function canvasTexture(w, h, draw, { wrap = false } = {}) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h, c);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const shadowed = (m) => {
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

/* ------------------------------------------------------------------ *
 *  The body outline: half an OM, measured from tail to neck (x, y),
 *  mirrored and smoothed into one closed curve.
 * ------------------------------------------------------------------ */
const HALF = [
  [0, 0], [0.075, 0.008], [0.135, 0.035], [0.172, 0.075], [0.189, 0.125], [0.19, 0.152],
  [0.182, 0.2], [0.158, 0.25], [0.132, 0.285], [0.121, 0.307], [0.124, 0.327], [0.136, 0.36],
  [0.143, 0.395], [0.14, 0.43], [0.122, 0.462], [0.085, 0.484], [0.035, 0.494], [0, L],
];

function bodyOutline(n = 240) {
  const right = HALF.map(([x, y]) => new THREE.Vector3(x, y, 0));
  const left = HALF.slice(1, -1).reverse().map(([x, y]) => new THREE.Vector3(-x, y, 0));
  const curve = new THREE.CatmullRomCurve3([...right, ...left], true, "centripetal");
  const pts = curve.getSpacedPoints(n).slice(0, n).map((p) => new THREE.Vector2(p.x, p.y));
  // anticlockwise, so the outward normal of a tangent (tx, ty) is (ty, -tx)
  const normals = pts.map((_, i) => {
    const a = pts[(i + n - 1) % n];
    const b = pts[(i + 1) % n];
    return new THREE.Vector2(b.y - a.y, a.x - b.x).normalize();
  });
  const arc = [0];
  for (let i = 1; i <= n; i++) arc.push(arc[i - 1] + pts[i % n].distanceTo(pts[i - 1]));
  const inset = (d) => pts.map((p, i) => new THREE.Vector2(p.x - normals[i].x * d, p.y - normals[i].y * d));
  const halfWidth = (y) => {
    let best = 0;
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      if ((a.x < 0 && b.x < 0) || a.y === b.y || (a.y - y) * (b.y - y) > 0) continue;
      best = Math.max(best, a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
    return best;
  };
  return { pts, normals, arc, n, inset, halfWidth };
}

// A band running round the body. Each row gives, for the local depth d, the
// inset from the outline, the height z, and the normal as (outward, up).
function band(o, rows, { inward = false, uScale = 1 / 0.6, vScale = 1 / 0.3 } = {}) {
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  const R = rows.length;
  const f = inward ? -1 : 1;
  for (let i = 0; i <= o.n; i++) {
    const p = o.pts[i % o.n];
    const nn = o.normals[i % o.n];
    const d = depthAt(p.y);
    for (const row of rows) {
      const [ins, z, cn, cz] = row(d);
      pos.push(p.x - nn.x * ins, p.y - nn.y * ins, z);
      nor.push(nn.x * cn * f, nn.y * cn * f, cz * f);
      uv.push(o.arc[i] * uScale, -z * vScale);
    }
  }
  for (let i = 0; i < o.n; i++) {
    for (let r = 0; r < R - 1; r++) {
      const a = i * R + r;
      const b = a + R;
      if (inward) idx.push(a, b, a + 1, a + 1, b, b + 1);
      else idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

const flat = (z) => (d) => [0, typeof z === "function" ? z(d) : z, 1, 0];
const corner = (t0, zc) =>
  Array.from({ length: 6 }, (_, k) => {
    const t = t0 + (k / 5) * (Math.PI / 2);
    return (d) => [EDGE - EDGE * Math.sin(t), zc(d) + EDGE * Math.cos(t), Math.sin(t), Math.cos(t)];
  });

/* ------------------------------------------------------------------ *
 *  Textures
 * ------------------------------------------------------------------ */

// The top: bookmatched spruce under a sunburst, bound and purfled at the
// edge, with a herringbone rosette. One texel per 0.39 mm.
function topTexture(o) {
  const K = 2560; // px per metre
  const w = Math.round(W * K);
  const h = Math.round(L * K);
  const X = (x) => (x + W / 2) * K;
  const Y = (y) => (L - y) * K;
  const path = (c, k = 1, cy = 0.2, pts = o.pts) => {
    c.beginPath();
    pts.forEach((p, i) => {
      const x = X(p.x * k);
      const y = Y(cy + (p.y - cy) * k);
      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    });
    c.closePath();
  };
  return canvasTexture(w, h, (c) => {
    const r = rng(5);
    // spruce, drawn on the left half and mirrored: the two halves of a top
    // are sawn from one billet and opened like a book
    c.fillStyle = "#ecd09a";
    c.fillRect(0, 0, w, h);
    let x = 0.0006;
    while (x < W / 2) {
      const px = X(-x);
      const wob = r() * 6;
      c.strokeStyle = `rgba(150, 96, 42, ${0.28 + r() * 0.3})`;
      c.lineWidth = 0.7 + r() * 1.1;
      c.beginPath();
      for (let y = 0; y <= h; y += 16) c.lineTo(px + Math.sin(y * 0.004 + wob) * 1.2 + Math.sin(y * 0.021 + wob * 3) * 0.35, y);
      c.stroke();
      // the grain opens out towards the edges
      x += 0.0011 + (x / (W / 2)) * 0.0016 + r() * 0.0007;
    }
    for (let i = 0; i < 26; i++) {
      c.fillStyle = `rgba(${r() < 0.5 ? "255, 236, 200" : "170, 110, 50"}, 0.06)`;
      c.fillRect(X(-r() * W * 0.5), 0, 4 + r() * 14, h);
    }
    // silking: the medullary rays that shimmer across quartersawn spruce
    for (let i = 0; i < 3200; i++) {
      c.fillStyle = r() < 0.75 ? "rgba(255, 246, 225, 0.13)" : "rgba(120, 70, 30, 0.08)";
      c.fillRect(r() * (w / 2), r() * h, 5 + r() * 22, 1 + r() * 1.5);
    }
    c.save();
    c.translate(w, 0);
    c.scale(-1, 1);
    c.drawImage(c.canvas, 0, 0, w / 2, h, 0, 0, w / 2, h);
    c.restore();

    // sunburst, following the shape of the body rather than a circle
    const burst = document.createElement("canvas");
    burst.width = w;
    burst.height = h;
    const b = burst.getContext("2d");
    b.fillStyle = "#2c1208";
    b.fillRect(0, 0, w, h);
    b.filter = "blur(46px)";
    b.fillStyle = "#b5601f";
    path(b, 0.88, 0.22);
    b.fill();
    b.filter = "blur(64px)";
    b.fillStyle = "#f8d08a";
    path(b, 0.66, 0.2);
    b.fill();
    b.filter = "none";
    c.globalCompositeOperation = "multiply";
    c.drawImage(burst, 0, 0);
    c.globalCompositeOperation = "source-over";

    // binding and purfling, stroked on the outline from widest to narrowest
    for (const [off, col] of [
      [0.0056, "#171010"],
      [0.0049, "#efe5cc"],
      [0.0043, "#171010"],
      [0.0036, "#efe5cc"],
    ]) {
      path(c);
      c.lineWidth = 2 * off * K;
      c.strokeStyle = col;
      c.stroke();
    }

    // rosette: rings and a herringbone band
    const cx = X(0);
    const cy = Y(HOLE.y);
    const ringFill = (r0, r1, col) => {
      c.beginPath();
      c.arc(cx, cy, r1 * K, 0, Math.PI * 2);
      c.arc(cx, cy, r0 * K, 0, Math.PI * 2, true);
      c.fillStyle = col;
      c.fill("evenodd");
    };
    ringFill(0.0555, 0.0685, "#171010");
    ringFill(0.057, 0.0585, "#efe5cc");
    ringFill(0.0655, 0.067, "#efe5cc");
    const r0 = 0.0592 * K;
    const r1 = 0.0648 * K;
    const rm = (r0 + r1) / 2;
    const steps = 150;
    c.strokeStyle = "#efe5cc";
    c.lineWidth = 1.6;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const da = (0.8 / steps) * Math.PI * 2;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      c.lineTo(cx + Math.cos(a + da) * rm, cy + Math.sin(a + da) * rm);
      c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      c.stroke();
    }
    // lacquer darkens round the sound hole where hands never reach
    c.strokeStyle = "rgba(40, 18, 6, 0.5)";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(cx, cy, HOLE.r * K + 1.5, 0, Math.PI * 2);
    c.stroke();
  });
}

// Wavy grain along u for bent or long parts: rosewood, mahogany, ebony.
function grainTexture({ w, h, base, dark, light, n, amp, seed, alongV = false, pores = 0 }) {
  return canvasTexture(
    w,
    h,
    (c) => {
      const r = rng(seed);
      c.fillStyle = base;
      c.fillRect(0, 0, w, h);
      if (alongV) {
        c.translate(w, 0);
        c.rotate(Math.PI / 2);
      }
      const len = alongV ? h : w;
      const span = alongV ? w : h;
      for (let i = 0; i < n; i++) {
        const y0 = r() * span;
        const k1 = 1 + Math.floor(r() * 3);
        const k2 = 3 + Math.floor(r() * 5);
        const ph = r() * 6.28;
        const a = amp * (0.3 + r());
        const isDark = r() < 0.62;
        c.strokeStyle = isDark ? dark : light;
        c.globalAlpha = 0.15 + r() * 0.45;
        c.lineWidth = 0.6 + r() * (isDark ? 5 : 3);
        for (const off of [-span, 0, span]) {
          c.beginPath();
          for (let x = 0; x <= len; x += 6) {
            const t = (x / len) * Math.PI * 2;
            c.lineTo(x, y0 + off + Math.sin(t * k1 + ph) * a + Math.sin(t * k2 + ph * 2) * a * 0.25);
          }
          c.stroke();
        }
      }
      c.globalAlpha = 1;
      for (let i = 0; i < pores; i++) {
        c.fillStyle = "rgba(10, 4, 2, 0.35)";
        c.fillRect(r() * len, r() * span, 2 + r() * 5, 0.8);
      }
    },
    { wrap: true },
  );
}

function tortoiseTexture() {
  return canvasTexture(
    512,
    512,
    (c, w, h) => {
      const r = rng(21);
      c.fillStyle = "#2a1107";
      c.fillRect(0, 0, w, h);
      c.filter = "blur(4px)";
      for (let i = 0; i < 800; i++) {
        c.fillStyle = ["#6a3212", "#8e4a18", "#b8772e", "#120602", "#4e220b", "#0c0401", "#120602"][Math.floor(r() * 7)];
        c.globalAlpha = 0.25 + r() * 0.45;
        c.beginPath();
        c.ellipse(r() * w, r() * h, 5 + r() * 22, 2 + r() * 8, 0.5 + (r() - 0.5) * 0.6, 0, Math.PI * 2);
        c.fill();
      }
      c.filter = "none";
      c.globalAlpha = 1;
    },
    { wrap: true },
  );
}

// The headstock veneer: black, glossy, with the maker's name in pearl.
function headTexture() {
  return canvasTexture(256, 624, (c, w, h) => {
    c.fillStyle = "#0f0c0b";
    c.fillRect(0, 0, w, h);
    const r = rng(8);
    for (let i = 0; i < 40; i++) {
      c.fillStyle = "rgba(60, 45, 38, 0.18)";
      c.fillRect(r() * w, 0, 1 + r() * 2, h);
    }
    const pearl = c.createLinearGradient(70, 0, 190, 0);
    pearl.addColorStop(0, "#f4efe6");
    pearl.addColorStop(0.35, "#dfe9ef");
    pearl.addColorStop(0.6, "#f3e2ea");
    pearl.addColorStop(1, "#e6f0e4");
    c.fillStyle = pearl;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = "italic 700 60px Georgia, 'Times New Roman', serif";
    c.fillText("Horn", w / 2, 92);
    c.font = "600 13px Georgia, serif";
    c.letterSpacing = "4px";
    c.fillText("AMSTERDAM", w / 2 + 2, 134);
  });
}

// The paper label glued inside the back, read through the sound hole.
function labelTexture() {
  return canvasTexture(512, 256, (c, w, h) => {
    c.fillStyle = "#eee2c4";
    c.fillRect(0, 0, w, h);
    const r = rng(4);
    for (let i = 0; i < 1600; i++) {
      c.fillStyle = `rgba(120, 90, 50, ${r() * 0.06})`;
      c.fillRect(r() * w, r() * h, 2, 2);
    }
    c.strokeStyle = "#6b3a1c";
    c.lineWidth = 3;
    c.strokeRect(14, 14, w - 28, h - 28);
    c.lineWidth = 1;
    c.strokeRect(22, 22, w - 44, h - 44);
    c.fillStyle = "#3a2210";
    c.textAlign = "center";
    c.font = "italic 700 64px Georgia, serif";
    c.fillText("Horn", w / 2, 108);
    c.font = "600 20px Georgia, serif";
    c.fillText("MODEL OM · SITKA & ROSEWOOD", w / 2, 156);
    c.font = "italic 20px Georgia, serif";
    c.fillText("No. 0042 — Amsterdam", w / 2, 196);
  });
}

/* ------------------------------------------------------------------ *
 *  The guitar
 * ------------------------------------------------------------------ */
export function buildGuitar() {
  const root = new THREE.Group();
  const gtr = new THREE.Group(); // guitar space: top face at z = 0, tail at y = 0
  const o = bodyOutline();

  const lacquer = { roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.06 };
  const topMat = new THREE.MeshPhysicalMaterial({ map: topTexture(o), ...lacquer, shadowSide: THREE.DoubleSide });
  const roseTex = grainTexture({ w: 1024, h: 512, base: "#4a1d0d", dark: "#170602", light: "#8a4020", n: 150, amp: 9, seed: 11, pores: 900 });
  const roseMat = new THREE.MeshPhysicalMaterial({ map: roseTex, ...lacquer, shadowSide: THREE.DoubleSide });
  const ivory = new THREE.MeshPhysicalMaterial({ color: 0xece0c4, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
  const blackLine = new THREE.MeshPhysicalMaterial({ color: 0x151010, roughness: 0.3, clearcoat: 1 });
  // The inside is lit only by what comes through the hole, which the renderer
  // cannot work out on its own, so the falloff is painted into the back.
  const raw = new THREE.MeshStandardMaterial({ color: 0x2c1e12, roughness: 0.9, envMapIntensity: 0.2 });
  const innerBackMat = new THREE.MeshStandardMaterial({
    map: canvasTexture(256, 316, (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h * (1 - 0.315 / L), 0, w / 2, h * (1 - 0.315 / L), w * 0.42);
      g.addColorStop(0, "#745335");
      g.addColorStop(0.3, "#4a331e");
      g.addColorStop(1, "#150d06");
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }),
    roughness: 0.9,
    envMapIntensity: 0.2,
  });
  const braceMat = new THREE.MeshStandardMaterial({ color: 0x5a3e25, roughness: 0.9, envMapIntensity: 0.2 });
  const rawDark = new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.9, side: THREE.BackSide });
  const mahogany = new THREE.MeshPhysicalMaterial({
    map: grainTexture({ w: 256, h: 1024, base: "#6e3316", dark: "#3a1507", light: "#9a5226", n: 70, amp: 3, seed: 3, alongV: true, pores: 500 }),
    roughness: 0.42,
    clearcoat: 0.6,
    clearcoatRoughness: 0.25,
  });
  const ebony = new THREE.MeshStandardMaterial({
    map: grainTexture({ w: 256, h: 1024, base: "#1d1612", dark: "#0b0806", light: "#3a2c22", n: 60, amp: 2, seed: 9, alongV: true, pores: 300 }),
    roughness: 0.52,
  });
  const bone = new THREE.MeshStandardMaterial({ color: 0xf0e8d4, roughness: 0.42 });
  const nickel = new THREE.MeshStandardMaterial({ color: 0xdcdcd8, roughness: 0.18, metalness: 1 });
  const bronze = new THREE.MeshStandardMaterial({ color: 0xcf9d5c, roughness: 0.28, metalness: 1 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9b56a, roughness: 0.22, metalness: 1 });
  const pearl = new THREE.MeshPhysicalMaterial({ color: 0xf2ede3, roughness: 0.2, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [250, 650] });

  /* --- body ------------------------------------------------------- */
  const top = new THREE.Shape(o.inset(EDGE));
  const hole = new THREE.Path();
  hole.absarc(0, HOLE.y, HOLE.r, 0, Math.PI * 2, true);
  top.holes.push(hole);
  const topGeo = new THREE.ShapeGeometry(top, 64);
  {
    const p = topGeo.attributes.position;
    const uv = topGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + W / 2) / W, p.getY(i) / L);
  }
  gtr.add(shadowed(new THREE.Mesh(topGeo, topMat)));

  // the edge: binding, a black purfling line, the rosewood sides, and back again
  const bindTop = [...corner(0, () => -EDGE), flat(-0.0062)];
  const bindBack = [flat((d) => -d + 0.0062), ...corner(Math.PI / 2, (d) => -d + EDGE)];
  const binding = mergeParts([{ geometry: band(o, bindTop) }, { geometry: band(o, bindBack) }]);
  gtr.add(shadowed(new THREE.Mesh(binding, ivory)));
  const purfling = mergeParts([
    { geometry: band(o, [flat(-0.0062), flat(-0.0071)]) },
    { geometry: band(o, [flat((d) => -d + 0.0071), flat((d) => -d + 0.0062)]) },
  ]);
  gtr.add(shadowed(new THREE.Mesh(purfling, blackLine)));
  gtr.add(shadowed(new THREE.Mesh(band(o, [flat(-0.0071), flat((d) => -d + 0.0071)]), roseMat)));

  // the back: rosewood, bookmatched along the centre seam
  const backGeo = new THREE.ShapeGeometry(new THREE.Shape(o.inset(EDGE)), 1);
  {
    const p = backGeo.attributes.position;
    const uv = backGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      p.setZ(i, -depthAt(p.getY(i)));
      uv.setXY(i, p.getY(i) / 0.6, Math.abs(p.getX(i)) / 0.3);
    }
    const ix = backGeo.index.array;
    for (let i = 0; i < ix.length; i += 3) [ix[i + 1], ix[i + 2]] = [ix[i + 2], ix[i + 1]];
    backGeo.computeVertexNormals();
  }
  gtr.add(shadowed(new THREE.Mesh(backGeo, roseMat)));

  // inside: unfinished walls and back, back braces, a centre strip and the label
  const inner = new THREE.Group();
  inner.add(new THREE.Mesh(band(o, [(d) => [0.003, -0.003, 1, 0], (d) => [0.003, -d + 0.003, 1, 0]], { inward: true }), raw));
  const innerBack = new THREE.ShapeGeometry(new THREE.Shape(o.inset(0.003)), 1);
  {
    const p = innerBack.attributes.position;
    const uv = innerBack.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      p.setZ(i, -depthAt(p.getY(i)) + 0.003);
      uv.setXY(i, (p.getX(i) + W / 2) / W, p.getY(i) / L);
    }
  }
  inner.add(new THREE.Mesh(innerBack, innerBackMat));
  const slope = Math.atan(0.02 / L);
  const onBack = (y, lift) => at(0, y, -depthAt(y) + 0.003 + lift, [slope, 0, 0]);
  const braces = [0.14, 0.255, 0.415].map((y) => ({ geometry: roundedBox(2 * (o.halfWidth(y) - 0.005), 0.007, 0.012, 0.0028), matrix: onBack(y, 0.006) }));
  braces.push({ geometry: new THREE.BoxGeometry(0.014, L - 0.03, 0.0018), matrix: onBack(L / 2, 0.0009) });
  inner.add(new THREE.Mesh(mergeParts(braces), braceMat));
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.035), new THREE.MeshStandardMaterial({ map: labelTexture(), color: 0x8a8274, roughness: 0.95, envMapIntensity: 0.2 }));
  label.position.set(0, 0.33, -depthAt(0.33) + 0.0034);
  label.rotation.x = slope;
  inner.add(label);
  inner.traverse((m) => (m.receiveShadow = true));
  gtr.add(inner);
  // the cut edge of the top, seen round the rim of the hole
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(HOLE.r, HOLE.r, 0.003, 64, 1, true).rotateX(Math.PI / 2), rawDark);
  rim.position.set(0, HOLE.y, -0.0015);
  gtr.add(rim);

  // pickguard: a teardrop of tortoiseshell on the treble side of the hole
  const P = (deg) => [Math.cos((deg * Math.PI) / 180) * 0.07, HOLE.y + Math.sin((deg * Math.PI) / 180) * 0.07];
  const guard = new THREE.Shape();
  guard.moveTo(...P(12));
  guard.bezierCurveTo(0.098, 0.372, 0.118, 0.325, 0.106, 0.28);
  guard.bezierCurveTo(0.095, 0.245, 0.04, 0.244, ...P(-100));
  guard.absarc(0, HOLE.y, 0.07, (-100 * Math.PI) / 180, (12 * Math.PI) / 180, false);
  const tort = tortoiseTexture();
  tort.repeat.set(1 / 0.09, 1 / 0.09);
  const pick = new THREE.Mesh(
    new THREE.ExtrudeGeometry(guard, { depth: 0.0007, bevelEnabled: false, curveSegments: 24 }),
    new THREE.MeshPhysicalMaterial({ map: tort, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }),
  );
  pick.receiveShadow = true;
  gtr.add(pick);

  // bridge: an ebony belly bridge, a compensated bone saddle, six pins
  const bs = new THREE.Shape();
  bs.moveTo(-0.07, 0.012);
  bs.lineTo(0.07, 0.012);
  bs.quadraticCurveTo(0.077, 0.012, 0.077, 0.005);
  bs.lineTo(0.077, -0.005);
  bs.quadraticCurveTo(0.077, -0.011, 0.068, -0.011);
  bs.bezierCurveTo(0.042, -0.011, 0.03, -0.019, 0, -0.019);
  bs.bezierCurveTo(-0.03, -0.019, -0.042, -0.011, -0.068, -0.011);
  bs.quadraticCurveTo(-0.077, -0.011, -0.077, -0.005);
  bs.lineTo(-0.077, 0.005);
  bs.quadraticCurveTo(-0.077, 0.012, -0.07, 0.012);
  const bridge = shadowed(
    new THREE.Mesh(new THREE.ExtrudeGeometry(bs, { depth: 0.005, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0012, bevelSegments: 3, curveSegments: 12 }), ebony),
  );
  bridge.position.set(0, SADDLE - 0.004, 0.0015);
  gtr.add(bridge);
  const bridgeTop = 0.008;
  const SLANT = 0.05;
  const saddle = shadowed(new THREE.Mesh(roundedBox(0.074, 0.0032, 0.008, 0.0014), bone));
  saddle.position.set(0, SADDLE, SADDLE_TOP - 0.004);
  saddle.rotation.z = SLANT;
  gtr.add(saddle);
  const pinY = SADDLE - 0.013;
  const pins = [];
  for (let i = 0; i < 6; i++) {
    const x = (i - 2.5) * 0.0105;
    pins.push({ geometry: new THREE.CylinderGeometry(0.0027, 0.0029, 0.0016, 14).rotateX(Math.PI / 2), matrix: at(x, pinY, bridgeTop + 0.0008) });
    pins.push({ geometry: new THREE.SphereGeometry(0.0027, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 1, 0.55), matrix: at(x, pinY, bridgeTop + 0.0016) });
  }
  // end pin, where the strap goes
  pins.push({ geometry: new THREE.CylinderGeometry(0.004, 0.0045, 0.004, 16), matrix: at(0, -0.002, -depthAt(0) / 2) });
  pins.push({ geometry: new THREE.SphereGeometry(0.0042, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI), matrix: at(0, -0.004, -depthAt(0) / 2) });
  gtr.add(shadowed(new THREE.Mesh(mergeParts(pins), bone)));

  /* --- neck ------------------------------------------------------- */
  // A C-shaped profile that deepens into the heel at the body and thins to
  // the headstock; built as a lofted half-superellipse under the fretboard.
  {
    const y0 = L - 0.004;
    const y1 = NUT + 0.009;
    const J = 90;
    const K = 26;
    const heelTo = depthAt(L) - 0.001;
    const sm = (a, b, x) => {
      const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    const dn = (y) => {
      let d = 0.0205 + 0.003 * Math.min(1, Math.max(0, (NUT - y) / fret(14)));
      const t = Math.min(1, Math.max(0, (y - L) / 0.085));
      d += (heelTo - d) * Math.pow(1 - t, 2.2);
      return d - (d - 0.0155) * sm(NUT - 0.03, y1, y);
    };
    const pos = [];
    const uv = [];
    const idx = [];
    for (let j = 0; j <= J; j++) {
      const y = y0 + (y1 - y0) * (j / J);
      const hw = widthAt(y) / 2;
      const d = dn(y);
      for (let k = 0; k <= K; k++) {
        const f = (k / K) * Math.PI;
        const c = Math.cos(f);
        const s = Math.sin(f);
        pos.push(hw * Math.sign(c) * Math.pow(Math.abs(c), 0.83), y, -d * Math.pow(s, 0.83));
        uv.push(k / K, y / 0.35);
      }
    }
    for (let j = 0; j < J; j++) {
      for (let k = 0; k < K; k++) {
        const a = j * (K + 1) + k;
        const c = a + K + 1;
        idx.push(a, a + 1, c, a + 1, c + 1, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    gtr.add(shadowed(new THREE.Mesh(geo, mahogany)));
  }

  // fretboard: ebony, tapering, with nickel frets and pearl dots
  const fb = new THREE.Shape([
    new THREE.Vector2(-widthAt(BOARD_END) / 2, BOARD_END),
    new THREE.Vector2(widthAt(BOARD_END) / 2, BOARD_END),
    new THREE.Vector2(widthAt(NUT) / 2, NUT),
    new THREE.Vector2(-widthAt(NUT) / 2, NUT),
  ]);
  const boardGeo = new THREE.ExtrudeGeometry(fb, { depth: 0.006, bevelEnabled: false });
  {
    const p = boardGeo.attributes.position;
    const uv = boardGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 0.03) / 0.06, (p.getY(i) - BOARD_END) / (NUT - BOARD_END));
  }
  gtr.add(shadowed(new THREE.Mesh(boardGeo, ebony)));
  const frets = [];
  for (let n = 1; n <= 20; n++) {
    const y = NUT - fret(n);
    frets.push({ geometry: new THREE.CylinderGeometry(0.00105, 0.00105, widthAt(y) - 0.0008, 8).rotateZ(Math.PI / 2), matrix: at(0, y, 0.006) });
  }
  gtr.add(shadowed(new THREE.Mesh(mergeParts(frets), nickel)));
  const dots = [];
  for (const n of [3, 5, 7, 9, 12, 15, 17]) {
    const y = NUT - (fret(n) + fret(n - 1)) / 2;
    for (const dx of n === 12 ? [-0.0095, 0.0095] : [0]) dots.push({ geometry: new THREE.CircleGeometry(0.0029, 20), matrix: at(dx, y, 0.00605) });
  }
  gtr.add(new THREE.Mesh(mergeParts(dots), pearl));
  const nut = shadowed(new THREE.Mesh(roundedBox(widthAt(NUT), 0.005, 0.009, 0.0015), bone));
  nut.position.set(0, NUT + 0.0025, 0.0045);
  gtr.add(nut);

  /* --- headstock -------------------------------------------------- */
  const head = new THREE.Group();
  head.position.set(0, NUT + 0.005, 0);
  head.rotation.x = HEAD_TILT;
  const hs = new THREE.Shape();
  hs.moveTo(-0.0235, 0);
  hs.lineTo(-0.037, 0.172);
  hs.quadraticCurveTo(-0.0375, 0.186, -0.026, 0.186);
  hs.lineTo(0.026, 0.186);
  hs.quadraticCurveTo(0.0375, 0.186, 0.037, 0.172);
  hs.lineTo(0.0235, 0);
  hs.lineTo(-0.0235, 0);
  const headGeo = new THREE.ExtrudeGeometry(hs, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 2, curveSegments: 8 });
  headGeo.translate(0, 0, -0.015);
  head.add(shadowed(new THREE.Mesh(headGeo, mahogany)));
  const faceGeo = new THREE.ShapeGeometry(hs, 8);
  {
    const p = faceGeo.attributes.position;
    const uv = faceGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 0.04) / 0.08, p.getY(i) / 0.19);
  }
  const face = new THREE.Mesh(faceGeo, new THREE.MeshPhysicalMaterial({ map: headTexture(), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 }));
  face.position.z = 0.0002;
  face.receiveShadow = true;
  head.add(face);

  // tuners: bushings and posts on the face, sealed gears and buttons behind.
  // Low E, A, D down the bass side from the nut; G, B, high E on the treble.
  const halfHead = (y) => 0.0235 + (0.0135 * y) / 0.172;
  const POSTS = [
    [-1, 0.045],
    [-1, 0.09],
    [-1, 0.135],
    [1, 0.135],
    [1, 0.09],
    [1, 0.045],
  ];
  const tuners = [];
  const wraps = [[], []];
  const postAt = [];
  POSTS.forEach(([s, y], i) => {
    const hwid = halfHead(y);
    const x = s * (hwid - 0.0105);
    postAt.push(new THREE.Vector3(x, y, 0.0048));
    tuners.push({ geometry: new THREE.CylinderGeometry(0.0043, 0.0043, 0.0016, 18).rotateX(Math.PI / 2), matrix: at(x, y, 0.0008) });
    tuners.push({ geometry: new THREE.CylinderGeometry(0.0023, 0.0023, 0.011, 12).rotateX(Math.PI / 2), matrix: at(x, y, 0.0055) });
    tuners.push({ geometry: roundedBox(0.016, 0.017, 0.009, 0.003), matrix: at(s * (hwid - 0.006), y, -0.0205) });
    tuners.push({ geometry: new THREE.CylinderGeometry(0.0019, 0.0019, 0.012, 10).rotateZ(Math.PI / 2), matrix: at(s * (hwid + 0.007), y, -0.0205) });
    tuners.push({ geometry: new THREE.SphereGeometry(0.0095, 18, 12).scale(0.34, 1, 0.72), matrix: at(s * (hwid + 0.0165), y, -0.0205) });
    for (let k = 0; k < 3; k++) wraps[i < 4 ? 0 : 1].push({ geometry: new THREE.TorusGeometry(0.0029, 0.0006, 6, 18), matrix: at(x, y, 0.0028 + k * 0.0013) });
  });
  head.add(shadowed(new THREE.Mesh(mergeParts(tuners), gold)));
  head.add(new THREE.Mesh(mergeParts(wraps[0]), bronze));
  head.add(new THREE.Mesh(mergeParts(wraps[1]), nickel));
  gtr.add(head);

  /* --- strings ---------------------------------------------------- */
  // pin → over the saddle → nut → round the post. The four wound strings are
  // phosphor bronze, the top two plain steel.
  head.updateMatrix();
  const RADII = [0.00068, 0.00056, 0.00046, 0.00038, 0.00027, 0.00022];
  const wound = [];
  const plain = [];
  for (let i = 0; i < 6; i++) {
    const r = RADII[i];
    const xs = (i - 2.5) * 0.0106;
    const xn = (i - 2.5) * 0.0072;
    const pin = new THREE.Vector3((i - 2.5) * 0.0105, pinY, bridgeTop + 0.001);
    const sad = new THREE.Vector3(xs, SADDLE + xs * Math.tan(SLANT), SADDLE_TOP + r);
    const nutP = new THREE.Vector3(xn, NUT + 0.0025, NUT_SLOT + r);
    const post = postAt[i].clone().applyMatrix4(head.matrix);
    const list = i < 4 ? wound : plain;
    list.push(between(pin, sad, r, r, 6), between(sad, nutP, r, r, 6), between(nutP, post, r, r, 6));
  }
  gtr.add(new THREE.Mesh(mergeParts(wound), bronze));
  gtr.add(new THREE.Mesh(mergeParts(plain), nickel));

  /* --- the stand -------------------------------------------------- */
  // An A-frame: a foam-padded cradle under the lower bout, a yoke round the
  // neck, an upright that clears the back, and three legs.
  const lean = new THREE.Group();
  gtr.position.z = 0.05;
  lean.add(gtr);
  lean.position.set(0, 0.13, 0.03);
  lean.rotation.x = -0.24;
  root.add(lean);

  const steel = new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 0.38, metalness: 0.75 });
  const foam = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.95 });
  const tube = (pts, r, seg = 40) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, 10);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // in guitar space: cradle arms (foam over steel) and the neck yoke
  const cradleFoam = [];
  const cradleSteel = [];
  for (const s of [-1, 1]) {
    const x = s * 0.1;
    cradleFoam.push({ geometry: tube([V(x, 0.0095, -0.118), V(x, 0.0095, -0.04), V(x, 0.0105, 0.008), V(x, 0.028, 0.02)], 0.0065) });
    cradleSteel.push({ geometry: tube([V(x, 0.0095, -0.13), V(x, 0.0095, -0.116)], 0.0048, 2) });
  }
  cradleSteel.push({ geometry: tube([V(-0.1, 0.0095, -0.13), V(0, 0.0095, -0.134), V(0.1, 0.0095, -0.13)], 0.0055, 16) });
  const yokeY = L + 0.14;
  const nd = 0.0235;
  const nw = widthAt(yokeY) / 2 + 0.0065;
  cradleFoam.push({ geometry: tube([V(-nw, yokeY, 0.006), V(-nw, yokeY, -nd * 0.6), V(-nw * 0.6, yokeY, -nd - 0.006), V(0, yokeY, -nd - 0.0068), V(nw * 0.6, yokeY, -nd - 0.006), V(nw, yokeY, -nd * 0.6), V(nw, yokeY, 0.006)], 0.0062) });
  const gspace = new THREE.Group();
  gspace.position.copy(gtr.position);
  gspace.add(shadowed(new THREE.Mesh(mergeParts(cradleFoam), foam)));
  gspace.add(shadowed(new THREE.Mesh(mergeParts(cradleSteel), steel)));
  lean.add(gspace);

  // in stand space: work out where the cradle and the yoke ended up
  root.updateMatrixWorld(true);
  const toStand = (v) => gtr.localToWorld(v.clone());
  const hub = toStand(V(0, 0.0095, -0.134));
  const yoke = toStand(V(0, yokeY, -nd - 0.013));
  const upright = [hub, V(0, 0.35, -0.125), V(0, 0.6, -0.18), V(0, yoke.y - 0.035, yoke.z - 0.045), yoke];
  const frame = [{ geometry: tube(upright, 0.0075, 60) }];
  const legTop = V(0, 0.32, -0.12);
  const feet = [V(-0.19, 0.012, 0.1), V(0.19, 0.012, 0.1), V(0, 0.012, -0.33)];
  frame.push(between(hub, feet[0], 0.0068, 0.0068, 10), between(hub, feet[1], 0.0068, 0.0068, 10), between(legTop, feet[2], 0.0068, 0.0068, 10));
  root.add(shadowed(new THREE.Mesh(mergeParts(frame), steel)));
  const caps = feet.map((f) => ({ geometry: new THREE.CylinderGeometry(0.012, 0.013, 0.012, 16), matrix: at(f.x, 0.006, f.z) }));
  caps.push({ geometry: new THREE.SphereGeometry(0.011, 16, 12), matrix: at(hub.x, hub.y, hub.z) });
  caps.push({ geometry: new THREE.SphereGeometry(0.01, 16, 12), matrix: at(legTop.x, legTop.y, legTop.z) });
  root.add(shadowed(new THREE.Mesh(mergeParts(caps), foam)));

  return root;
}
