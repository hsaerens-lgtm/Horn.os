// Collapsing the scene's materials down to the ones that are actually distinct.
//
// This room is built by five modules that each reach for `new
// MeshStandardMaterial` when they need a surface, which is the readable way to
// write them and the expensive way to run them: the scene ended up with 289
// material instances for maybe forty genuinely different surfaces. Every extra
// instance is another uniform block uploaded per frame and another entry the
// renderer has to sort and look up.
//
// Rewriting every construction site to pull from a shared palette would be the
// tidy answer and a large, risky edit across five files. Deduplicating once,
// after everything is built, gets the same result from one pass: materials that
// describe the same surface are collapsed onto a single instance.
//
// What it must not touch: anything whose material is animated. Sprites change
// their map and their opacity every frame — a speech bubble, a flame, a floating
// score — so sharing one would make every sprite show the last thing assigned to
// any of them. Those are skipped, along with anything explicitly marked.

const FIELDS = [
  "type",
  "transparent",
  "opacity",
  "alphaTest",
  "side",
  "blending",
  "depthWrite",
  "depthTest",
  "toneMapped",
  "flatShading",
  "vertexColors",
  "wireframe",
  "roughness",
  "metalness",
  "emissiveIntensity",
  "envMapIntensity",
  "reflectivity",
  "clearcoat",
  "iridescence",
  "transmission",
];

const MAPS = ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap", "bumpMap"];

function key(m) {
  const bits = [m.constructor.name];
  for (const f of FIELDS) bits.push(f + ":" + (m[f] === undefined ? "-" : String(m[f])));
  for (const c of ["color", "emissive", "specular", "attenuationColor", "sheenColor"]) {
    bits.push(c + ":" + (m[c] ? m[c].getHexString() : "-"));
  }
  for (const t of MAPS) bits.push(t + ":" + (m[t] ? m[t].uuid : "-"));
  // normalScale is a Vector2 and genuinely differentiates surfaces
  if (m.normalScale) bits.push(`ns:${m.normalScale.x},${m.normalScale.y}`);
  return bits.join("|");
}

/**
 * Walks `root` and points every mesh at one shared instance per distinct
 * surface. Returns { before, after } so the saving can be stated rather than
 * claimed.
 */
export function dedupeMaterials(root) {
  const seen = new Map();
  const before = new Set();
  const kept = new Set();

  root.traverse((o) => {
    // Sprites and points animate their own materials; leave them alone.
    if (!o.isMesh || o.isSprite) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    if (!list[0]) return;

    const swapped = list.map((m) => {
      before.add(m);
      if (m.userData?.unique) {
        kept.add(m);
        return m;
      }
      const k = key(m);
      const first = seen.get(k);
      if (first && first !== m) {
        m.dispose();
        kept.add(first);
        return first;
      }
      seen.set(k, m);
      kept.add(m);
      return m;
    });

    o.material = Array.isArray(o.material) ? swapped : swapped[0];
  });

  return { before: before.size, after: kept.size };
}
