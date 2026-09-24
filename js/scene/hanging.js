// Hanging golden pothos in macramé hangers: a glazed pot, a crown of leaves,
// and long vines falling from the rim with a heart-shaped leaf every few
// centimetres, smaller towards the tip.

import * as THREE from "three";
import { mergeParts } from "../lib/merge.js";
import { between } from "../lib/shapes.js";
import { planter } from "./models.js";

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
}

/* --- one leaf: a cupped heart, tip up, attached at the notch (origin) --- */
function leafGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.22, -0.1, 0.6, 0.18, 0.42, 0.58);
  s.bezierCurveTo(0.32, 0.8, 0.1, 0.92, 0, 1.0);
  s.bezierCurveTo(-0.1, 0.92, -0.32, 0.8, -0.42, 0.58);
  s.bezierCurveTo(-0.6, 0.18, -0.22, -0.1, 0, 0);
  const geo = new THREE.ShapeGeometry(s, 10);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    uv.setXY(i, x + 0.5, y);
    // cup across the width, and let the tip curl back a little
    pos.setZ(i, -0.35 * x * x + 0.18 * y * y);
  }
  geo.computeVertexNormals();
  return geo;
}

function leafTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createLinearGradient(0, 256, 0, 0);
  grd.addColorStop(0, "#2f5e2a");
  grd.addColorStop(1, "#4a8038");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const r = seeded(5);
  // golden variegation: pale streaks fanning out from the midrib
  for (let i = 0; i < 12; i++) {
    const y0 = 20 + r() * 220;
    const side = r() < 0.5 ? -1 : 1;
    g.strokeStyle = `rgba(${210 + r() * 30}, ${215 + r() * 25}, ${120 + r() * 40}, ${0.15 + r() * 0.25})`;
    g.lineWidth = 2 + r() * 6;
    g.beginPath();
    g.moveTo(128, 256 - y0);
    g.quadraticCurveTo(128 + side * (30 + r() * 40), 256 - y0 - 20 - r() * 30, 128 + side * (60 + r() * 60), 256 - y0 - 50 - r() * 40);
    g.stroke();
  }
  // midrib and side veins
  g.strokeStyle = "rgba(190, 220, 140, 0.4)";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(128, 256);
  g.lineTo(128, 0);
  g.stroke();
  g.lineWidth = 1.2;
  for (let y = 40; y < 240; y += 26) {
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(128, 256 - y);
      g.quadraticCurveTo(128 + side * 40, 256 - y - 16, 128 + side * 95, 256 - y - 50);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let LEAF = null;
let LEAF_MAT = null;
const STEM_MAT = new THREE.MeshStandardMaterial({ color: 0x4d7a36, roughness: 0.7 });
const CORD_MAT = new THREE.MeshStandardMaterial({ color: 0xdccdb0, roughness: 0.95 });

/**
 * A hanging plant. The group's origin is the hook point; the pot hangs
 * `drop` metres below it.
 */
export function hangingPlant({ seed = 1, glaze = "white", vines = 11, length = 0.9, drop = 0.55, potR = 0.09, potH = 0.11 } = {}) {
  LEAF ??= leafGeometry();
  LEAF_MAT ??= new THREE.MeshStandardMaterial({ map: leafTexture(), side: THREE.DoubleSide, roughness: 0.5 });
  const r = seeded(seed);
  const group = new THREE.Group();

  // the pot
  const pot = planter(potR, potH, glaze);
  const potY = -drop - potH;
  pot.group.position.y = potY;
  group.add(pot.group);
  const soilY = potY + pot.top;

  // macramé: four cords from under the pot up to the hook, knotted at the rim
  const cords = [];
  const knots = [];
  const apex = new THREE.Vector3(0, 0, 0);
  const under = new THREE.Vector3(0, potY - 0.05, 0);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const rim = new THREE.Vector3(Math.cos(a) * potR * 1.06, potY + potH * 1.02, Math.sin(a) * potR * 1.06);
    const belly = new THREE.Vector3(Math.cos(a) * potR * 0.95, potY + potH * 0.35, Math.sin(a) * potR * 0.95);
    cords.push(between(under, belly, 0.0025, 0.0025, 5), between(belly, rim, 0.0025, 0.0025, 5), between(rim, apex, 0.0025, 0.0025, 5));
    knots.push({ geometry: new THREE.SphereGeometry(0.007, 8, 6), matrix: new THREE.Matrix4().makeTranslation(rim.x, rim.y + 0.03, rim.z) });
  }
  knots.push({ geometry: new THREE.SphereGeometry(0.012, 10, 8), matrix: new THREE.Matrix4().makeTranslation(0, -0.02, 0) });
  knots.push({ geometry: new THREE.SphereGeometry(0.014, 10, 8), matrix: new THREE.Matrix4().makeTranslation(under.x, under.y, under.z) });
  // tassel under the pot
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    cords.push(between(under, new THREE.Vector3(Math.cos(a) * 0.012, under.y - 0.09 - r() * 0.03, Math.sin(a) * 0.012), 0.002, 0.0015, 4));
  }
  const cordMesh = new THREE.Mesh(mergeParts([...cords, ...knots]), CORD_MAT);
  cordMesh.castShadow = true;
  group.add(cordMesh);

  // vines and leaves
  const stems = [];
  const leaves = []; // Matrix4 per leaf
  const down = new THREE.Vector3(0, -1, 0);
  const place = (p, tipDir, faceDir, size, twist) => {
    const yAxis = tipDir.clone().normalize();
    let zAxis = faceDir.clone().sub(yAxis.clone().multiplyScalar(faceDir.dot(yAxis))).normalize();
    const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
    zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis);
    const m = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
    m.multiply(new THREE.Matrix4().makeRotationY(twist));
    m.scale(new THREE.Vector3(size, size, size));
    m.setPosition(p);
    leaves.push(m);
  };
  for (let v = 0; v < vines; v++) {
    const a = (v / vines) * Math.PI * 2 + r() * 0.5;
    const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const L = length * (0.45 + r() * 0.6);
    const start = new THREE.Vector3(out.x * potR * 0.8, soilY + 0.01, out.z * potR * 0.8);
    const pts = [start, start.clone().addScaledVector(out, 0.07).add(new THREE.Vector3(0, 0.03, 0))];
    let p = pts[1].clone();
    const steps = 6;
    for (let k = 1; k <= steps; k++) {
      p = p.clone().addScaledVector(out, 0.04 * (1 - k / steps) + 0.01).add(new THREE.Vector3((r() - 0.5) * 0.04, -L / steps, (r() - 0.5) * 0.04));
      pts.push(p);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    stems.push({ geometry: new THREE.TubeGeometry(curve, 40, 0.0022, 5, false) });
    const len = curve.getLength();
    const n = Math.floor(len / 0.042);
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 0.5);
      const pos = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      const side = i % 2 ? 1 : -1;
      const sideways = new THREE.Vector3().crossVectors(tan, out).normalize().multiplyScalar(side);
      // leaves hang tip-down, turned outwards, alternating left and right
      const tip = down.clone().multiplyScalar(0.7).add(sideways.clone().multiplyScalar(0.6)).add(out.clone().multiplyScalar(0.25));
      const face = out.clone().add(new THREE.Vector3(0, 0.35, 0)).add(sideways.clone().multiplyScalar(0.3));
      const size = 0.06 - t * 0.028 + (r() - 0.5) * 0.008;
      place(pos, tip, face, size, (r() - 0.5) * 0.5);
    }
  }
  // the crown: bigger leaves standing up out of the pot
  for (let i = 0; i < 12; i++) {
    const a = r() * Math.PI * 2;
    const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const base = new THREE.Vector3(out.x * potR * 0.4 * r(), soilY + 0.005, out.z * potR * 0.4 * r());
    const top = base.clone().addScaledVector(out, 0.03 + r() * 0.05).add(new THREE.Vector3(0, 0.05 + r() * 0.06, 0));
    stems.push(between(base, top, 0.0025, 0.002, 5));
    const tip = out.clone().multiplyScalar(0.6).add(new THREE.Vector3(0, 0.5 + r() * 0.4, 0));
    place(top, tip, out.clone().add(new THREE.Vector3(0, 0.6, 0)), 0.065 + r() * 0.02, (r() - 0.5) * 0.6);
  }
  const stemMesh = new THREE.Mesh(mergeParts(stems), STEM_MAT);
  stemMesh.castShadow = true;
  group.add(stemMesh);

  const leafMesh = new THREE.InstancedMesh(LEAF, LEAF_MAT, leaves.length);
  const tint = new THREE.Color();
  leaves.forEach((m, i) => {
    leafMesh.setMatrixAt(i, m);
    const k = 0.82 + r() * 0.3;
    leafMesh.setColorAt(i, tint.setRGB(k, k * (0.97 + r() * 0.06), k * 0.92));
  });
  leafMesh.castShadow = true;
  leafMesh.receiveShadow = true;
  group.add(leafMesh);

  return group;
}
