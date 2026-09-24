// Merging small static pieces into single meshes.
//
// A bookcase built as seventy books is seventy draw calls, seventy materials
// and seventy entries in the shadow pass, for something nobody will ever look
// at one book at a time. Baked into one mesh it is one of each, and the books
// keep their individual colours through a vertex-colour attribute.
//
// Only merge things that never move relative to each other. The furniture still
// moves as a whole — a natural 1 throws the bookcase across the room — so each
// piece of furniture is merged into itself, not into its neighbours.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const KEEP = ["position", "normal", "uv"];

/**
 * Bakes `{ geometry, matrix?, colour? }` parts into one BufferGeometry.
 *
 * Inputs are cloned, never touched: several of these geometries come out of the
 * rounded-box cache and are shared by other meshes in the scene.
 */
export function mergeParts(parts, { colours = false } = {}) {
  const white = new THREE.Color(1, 1, 1);

  const prepared = parts.map(({ geometry, matrix, colour }) => {
    // mergeGeometries refuses a mix of indexed and non-indexed inputs, and this
    // scene has both — extrusions are non-indexed, cylinders are indexed. Going
    // non-indexed everywhere is the only combination that always works.
    const g = (geometry.index ? geometry.toNonIndexed() : geometry.clone());

    for (const name of Object.keys(g.attributes)) {
      if (!KEEP.includes(name)) g.deleteAttribute(name);
    }
    const n = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    if (matrix) g.applyMatrix4(matrix);

    if (colours) {
      const c = new Float32Array(n * 3);
      const col = colour ?? white;
      for (let i = 0; i < n; i++) {
        c[i * 3] = col.r;
        c[i * 3 + 1] = col.g;
        c[i * 3 + 2] = col.b;
      }
      g.setAttribute("color", new THREE.BufferAttribute(c, 3));
    }
    return g;
  });

  const merged = mergeGeometries(prepared, false);
  for (const g of prepared) g.dispose();
  return merged;
}

/** The transform of one part, as a matrix. */
export function at(x, y, z, rot = [0, 0, 0], scale = 1) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
    new THREE.Vector3(scale, scale, scale)
  );
}
