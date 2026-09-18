// Rounded boxes.
//
// Nothing in the real world has a knife edge. A BoxGeometry does, and a room
// built out of them reads as blocked-out rather than made — the corners are the
// first thing the eye uses to tell a model from an object. Every noticeable
// slab in the scene goes through this instead.
//
// The shape is an extruded rounded rectangle: the corner radius rounds the face
// the box is widest on, and the extrude bevel rounds the two edges around it.
// Geometries are cached by their dimensions, because the scene asks for the
// same table leg four times and the same wall segment twelve.

import * as THREE from "three";

const cache = new Map();

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = w / 2;
  const y = h / 2;
  r = Math.min(r, x * 0.999, y * 0.999);
  s.moveTo(-x + r, -y);
  s.lineTo(x - r, -y);
  s.quadraticCurveTo(x, -y, x, -y + r);
  s.lineTo(x, y - r);
  s.quadraticCurveTo(x, y, x - r, y);
  s.lineTo(-x + r, y);
  s.quadraticCurveTo(-x, y, -x, y - r);
  s.lineTo(-x, -y + r);
  s.quadraticCurveTo(-x, -y, -x + r, -y);
  return s;
}

/**
 * A box of w x h x d with every edge softened by `r`.
 *
 * `r` is capped at a third of the smallest side: asking for a 2 cm radius on a
 * 1 cm thick panel would otherwise collapse the extrusion into nothing.
 */
export function roundedBox(w, h, d, r = 0.008, curve = 3) {
  const lim = Math.min(w, h, d) / 3;
  r = Math.max(0.0005, Math.min(r, lim));
  const key = `${w.toFixed(4)}|${h.toFixed(4)}|${d.toFixed(4)}|${r.toFixed(4)}|${curve}`;
  const hit = cache.get(key);
  if (hit) return hit;

  // Extrude along the THINNEST axis, always. A table top is 2.1 x 0.05 x 1.35;
  // extruded along its depth, the large top surface becomes a side wall of the
  // extrusion and any texture on it is smeared across 5 cm of edge. Extruded
  // through its thickness, the two large faces are the rect itself and map
  // exactly the way the BoxGeometry this replaces did.
  let a, b, t, spin;
  if (d <= w && d <= h) [a, b, t, spin] = [w, h, d, null];
  else if (h <= w && h <= d) [a, b, t, spin] = [w, d, h, "x"];
  else [a, b, t, spin] = [d, h, w, "y"];

  const bevel = Math.min(r, t / 2.01);
  const geo = new THREE.ExtrudeGeometry(roundedRect(a, b, r), {
    depth: t - bevel * 2,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: curve,
    curveSegments: curve + 1,
  });
  // Extrude runs from -bevelThickness to depth + bevelThickness, so the solid is
  // exactly t thick but sits in front of the origin. Centre it.
  geo.translate(0, 0, -t / 2 + bevel);

  // Flat-project the UVs across the rect, before any rotation: ExtrudeGeometry
  // lays them out in world units, which would tile a wood grain or stretch a
  // poster depending on how big the box happens to be.
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / a + 0.5, pos.getY(i) / b + 0.5);
  uv.needsUpdate = true;

  if (spin === "x") geo.rotateX(-Math.PI / 2);
  else if (spin === "y") geo.rotateY(Math.PI / 2);

  geo.computeVertexNormals();
  cache.set(key, geo);
  return geo;
}
