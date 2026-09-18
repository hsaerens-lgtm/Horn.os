// Houseplants.
//
// Foliage is the one thing a room can have a lot of without looking cluttered,
// and it is the fastest way to stop a set reading as a set: a plant is the only
// object in a room whose shape nobody designed, so its irregularity gives the
// eye something the rest of the geometry cannot.
//
// The cost problem is obvious — a monstera is nine leaves, a fern is forty
// leaflets, and eleven plants at one draw call each is not what the naive build
// gives you. So every plant bakes its whole canopy into a single mesh through
// the same merge path the bookcase uses, with the colour variation between
// leaves carried on a vertex attribute. Eleven plants cost eleven canopy
// meshes, not four hundred.
//
// The leaves themselves are flat outlines that are then bent twice: down along
// their length, and up along their width. A leaf modelled as a flat card
// disappears when you look at it edge-on and catches light as a single tone;
// the second bend is what makes a canopy read as many surfaces at many angles
// rather than as a green cloud.

import * as THREE from "three";
import { mergeParts, at } from "./merge.js";

/* ------------------------------------------------------------------ *
 *  Leaves
 * ------------------------------------------------------------------ */

// Half-width of the leaf as a fraction of its widest point, along its length.
// The exponent is what separates a laurel from a banana: below 0.5 the leaf is
// nearly parallel-sided with a sudden tip, above 0.8 it is almost a circle.
const PROFILE = {
  oval: (t) => Math.pow(Math.sin(Math.PI * t), 0.6),
  heart: (t) => Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.04)), 0.48),
  blade: (t) => Math.pow(Math.sin(Math.PI * t), 0.26),
  round: (t) => Math.pow(Math.sin(Math.PI * t), 0.9),
};

// The slits in a monstera leaf, as bands of `t` where the outline dives in
// towards the midrib. They are what the plant is recognised by; without them it
// is an unusually large pothos.
// Three, not four, and cut to two fifths of the way in rather than to the rib.
// Four deep slits chop the leaf into five lobes, and at the size it appears on
// screen five lobes stop reading as a monstera and start reading as a conifer.
const SLITS = [0.34, 0.56, 0.76];
const cut = (t) => {
  for (const c of SLITS) if (Math.abs(t - c) < 0.026) return 0.44;
  return 1;
};

/**
 * One leaf, growing along +Y from the origin, facing +Z.
 *
 * `split` adds the monstera slits. `steps` is per side — small leaves get
 * fewer, because a two-centimetre leaf with sixty outline points is sixty
 * points nobody will ever resolve.
 */
function leafGeometry({ kind = "oval", len = 0.2, wid = 0.1, split = false, steps = 26, droop = 0.35, fold = 0.35 } = {}) {
  const profile = PROFILE[kind] ?? PROFILE.oval;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = profile(t) * (split ? cut(t) : 1);
    pts.push(new THREE.Vector2((r * wid) / 2, t * len));
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const r = profile(t) * (split ? cut(t) : 1);
    pts.push(new THREE.Vector2((-r * wid) / 2, t * len));
  }
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts));

  // Bend it. `droop` arcs the whole leaf away from the stem, quadratically so
  // the base stays stiff and only the tip really falls. `fold` lifts the two
  // edges relative to the midrib, which is the channel every real leaf has.
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const t = Math.max(0, p.getY(i) / len);
    p.setZ(i, -droop * len * t * t + fold * Math.abs(x));
    // A leaf that bends keeps its arc length, so it covers less ground.
    p.setY(i, p.getY(i) * (1 - 0.14 * t * t));
  }
  geo.computeVertexNormals();
  return geo;
}

/* ------------------------------------------------------------------ *
 *  Materials
 * ------------------------------------------------------------------ */

// Darker and less saturated than the first pass, which lit up like plastic. The
// room is a hearth, a pendant and a television; nothing green in it should be
// brighter than the paper on the table.
const GREENS = [0x30552c, 0x3b6136, 0x274525, 0x446d3b, 0x213d21, 0x365730];
const STEM = new THREE.Color(0x4a6b3a);
const SOIL = new THREE.Color(0x241c15);

// One material for every canopy in the room. Leaves are thin enough to be lit
// from the wrong side, so they are double-sided; the deduplication pass would
// have collapsed these anyway, and doing it here saves it the work.
const canopyMat = new THREE.MeshStandardMaterial({
  vertexColors: true,
  side: THREE.DoubleSide,
  roughness: 0.68,
  envMapIntensity: 0.45,
});

const POTS = {
  terracotta: new THREE.MeshStandardMaterial({ color: 0xa5613f, roughness: 0.82, envMapIntensity: 0.7 }),
  cream: new THREE.MeshStandardMaterial({ color: 0xd8cdb8, roughness: 0.55, envMapIntensity: 0.9 }),
  slate: new THREE.MeshStandardMaterial({ color: 0x555b5e, roughness: 0.6, envMapIntensity: 0.8 }),
  brass: new THREE.MeshStandardMaterial({ color: 0x8a6a34, roughness: 0.38, metalness: 0.7, envMapIntensity: 1.4 }),
};

/* ------------------------------------------------------------------ *
 *  Plants
 * ------------------------------------------------------------------ */

/**
 * Builds one plant.
 *
 * Returns a Group holding a pot, its soil, and exactly one canopy mesh. The
 * caller positions the group; `sway` marks the ones worth animating.
 */
export function plant(
  kind,
  { r = 0.15, h = 0.2, pot = "terracotta", scale = 1, seed = 7, sway = 0, fall = null } = {}
) {
  let s = seed >>> 0;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
  const pick = () => new THREE.Color(GREENS[Math.floor(rand() * GREENS.length)]);

  const g = new THREE.Group();
  const parts = [];

  /* --- the pot: body and rim baked together, one mesh --- */
  // Two dozen plants at four meshes each is a hundred draw calls for the pots
  // alone. Body and rim share a material so they merge; the soil does not, so
  // it rides along in the canopy merge with a brown vertex colour instead of
  // costing a mesh of its own. Two meshes a plant, whatever is growing in it.
  if (pot !== "none") {
    const shell = new THREE.Mesh(
      mergeParts([
        { geometry: new THREE.CylinderGeometry(r, r * 0.76, h, 18), matrix: at(0, h / 2, 0) },
        { geometry: new THREE.CylinderGeometry(r * 1.07, r * 1.07, h * 0.12, 18), matrix: at(0, h * 0.94, 0) },
      ]),
      POTS[pot] ?? POTS.terracotta
    );
    shell.castShadow = shell.receiveShadow = true;
    g.add(shell);
    parts.push({
      geometry: new THREE.CircleGeometry(r * 0.95, 18).rotateX(-Math.PI / 2),
      matrix: at(0, h * 0.97, 0),
      colour: SOIL,
    });
  }
  const base = pot === "none" ? 0 : h * 0.96;

  /* --- a stem, as a part rather than a mesh: it merges with the canopy --- */
  const stemPart = (x0, y0, z0, x1, y1, z1, rad) => {
    const a = new THREE.Vector3(x0, y0, z0);
    const b = new THREE.Vector3(x1, y1, z1);
    const dir = b.clone().sub(a);
    const len = dir.length();
    if (len < 1e-4) return;
    const m = new THREE.Matrix4().compose(
      a.clone().addScaledVector(dir, 0.5),
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()),
      new THREE.Vector3(1, 1, 1)
    );
    parts.push({ geometry: new THREE.CylinderGeometry(rad * 0.7, rad, len, 5), matrix: m, colour: STEM });
  };

  // Place one leaf: grown along +Y, then pitched away from vertical by `tilt`
  // and swung round the stem by `yaw`.
  const leafPart = (geo, x, y, z, yaw, tilt, roll = 0) => {
    parts.push({
      geometry: geo,
      matrix: new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, yaw, roll, "YXZ")),
        new THREE.Vector3(1, 1, 1)
      ),
      colour: pick(),
    });
  };

  if (kind === "monstera") {
    // Big, few, and every leaf on its own long petiole reaching out of the pot
    // at a different angle. The stems matter here more than on any other plant:
    // a monstera whose leaves start at the soil is a shrub.
    const n = 8;
    for (let i = 0; i < n; i++) {
      const yaw = (i / n) * Math.PI * 2 + rand() * 0.5;
      const reach = (0.2 + rand() * 0.24) * scale;
      const rise = (0.34 + rand() * 0.36) * scale;
      const ex = Math.sin(yaw) * reach;
      const ez = Math.cos(yaw) * reach;
      stemPart(0, base, 0, ex, base + rise, ez, 0.009 * scale);
      const L = (0.26 + rand() * 0.1) * scale;
      leafPart(
        leafGeometry({ kind: "heart", len: L, wid: L * 0.92, split: true, steps: 44, droop: 0.5, fold: 0.22 }),
        ex,
        base + rise,
        ez,
        yaw + Math.PI,
        1.15 + rand() * 0.35
      );
    }
  } else if (kind === "palm") {
    // A cane with a crown on top. Three canes of different heights, because one
    // reads as a lamp post with leaves.
    // Measured, not guessed: the first pass stood 1.70 m tall on a 0.33 m
    // spread, which is a stick with leaves on it. A real cane palm is roughly
    // as wide as it is tall above the pot, so the canes came down and the
    // fronds went out.
    const canes = [1, 0.72, 0.48];
    canes.forEach((k, ci) => {
      const lean = (rand() - 0.5) * 0.12;
      const top = base + 0.8 * k * scale;
      const tx = lean * 0.7;
      stemPart(ci * 0.03 - 0.03, base, ci * 0.02 - 0.02, tx, top, 0, 0.026 * scale * k);
      const n = 8;
      for (let i = 0; i < n; i++) {
        const yaw = (i / n) * Math.PI * 2 + ci * 0.7;
        const L = (0.38 + rand() * 0.16) * scale * Math.max(0.7, k);
        leafPart(
          leafGeometry({ kind: "blade", len: L, wid: L * 0.24, steps: 16, droop: 0.9, fold: 0.5 }),
          tx,
          top,
          0,
          yaw,
          0.95 + rand() * 0.6
        );
      }
    });
  } else if (kind === "fern") {
    // Fronds: a spine with leaflets in pairs down it, the whole thing arching
    // over. Built as one part list so a forty-leaflet frond is still free.
    const n = 9;
    for (let f = 0; f < n; f++) {
      const yaw = (f / n) * Math.PI * 2 + rand() * 0.4;
      const L = (0.3 + rand() * 0.12) * scale;
      const tilt = 0.75 + rand() * 0.5;
      const dir = new THREE.Vector3(Math.sin(yaw) * Math.sin(tilt), Math.cos(tilt), Math.cos(yaw) * Math.sin(tilt));
      const segs = 7;
      let prev = new THREE.Vector3(0, base, 0);
      for (let k = 1; k <= segs; k++) {
        const t = k / segs;
        const p = new THREE.Vector3(0, base, 0).addScaledVector(dir, L * t);
        p.y -= 0.55 * L * t * t; // the arch
        stemPart(prev.x, prev.y, prev.z, p.x, p.y, p.z, 0.004 * scale);
        for (const side of [-1, 1]) {
          const ll = L * 0.3 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 0.006;
          leafPart(
            leafGeometry({ kind: "oval", len: ll, wid: ll * 0.42, steps: 9, droop: 0.3, fold: 0.3 }),
            p.x,
            p.y,
            p.z,
            yaw + side * 1.5,
            1.5
          );
        }
        prev = p;
      }
    }
  } else if (kind === "pothos") {
    // The trailing one: a small crown, then vines that fall over the edge of
    // whatever it is standing on. Every vine is a curve, so they hang rather
    // than point.
    for (let i = 0; i < 5; i++) {
      const yaw = (i / 5) * Math.PI * 2 + rand();
      const L = (0.07 + rand() * 0.04) * scale;
      stemPart(0, base, 0, Math.sin(yaw) * L * 0.5, base + L * 0.7, Math.cos(yaw) * L * 0.5, 0.005 * scale);
      leafPart(
        leafGeometry({ kind: "heart", len: L, wid: L * 0.8, steps: 16, droop: 0.4, fold: 0.3 }),
        Math.sin(yaw) * L * 0.5,
        base + L * 0.7,
        Math.cos(yaw) * L * 0.5,
        yaw + Math.PI,
        1.0 + rand() * 0.4
      );
    }
    const vines = 3 + Math.floor(rand() * 2);
    for (let v = 0; v < vines; v++) {
      // `fall` aims them. A pothos standing on a bookcase or a windowsill has
      // to spill into the room: vines let loose in every direction hang
      // straight through the shelf behind them, and no amount of shortening
      // fixes that — they have to be pointed.
      const yaw = fall === null ? rand() * Math.PI * 2 : fall + (rand() - 0.5) * 1.7;
      const drop = (0.4 + rand() * 0.5) * scale;
      const out = (0.06 + rand() * 0.07) * scale;
      const segs = 9;
      let prev = new THREE.Vector3(0, base, 0);
      for (let k = 1; k <= segs; k++) {
        const t = k / segs;
        // Out fast, then straight down: a vine leaves the pot sideways and
        // gravity takes over within a hand's width.
        const p = new THREE.Vector3(
          Math.sin(yaw) * out * Math.pow(t, 0.4) + Math.sin(t * 7 + v) * 0.012 * scale,
          base - drop * t * t,
          Math.cos(yaw) * out * Math.pow(t, 0.4) + Math.cos(t * 6 + v) * 0.012 * scale
        );
        stemPart(prev.x, prev.y, prev.z, p.x, p.y, p.z, 0.0035 * scale);
        const ll = (0.035 + rand() * 0.022) * scale;
        leafPart(
          leafGeometry({ kind: "heart", len: ll, wid: ll * 0.82, steps: 12, droop: 0.4, fold: 0.28 }),
          p.x,
          p.y,
          p.z,
          rand() * Math.PI * 2,
          1.9 + rand() * 0.8
        );
        prev = p;
      }
    }
  } else if (kind === "succulent") {
    // Three tiers of fat little paddles, each rotated off the one below.
    const tiers = [
      { n: 5, R: 0.055, tilt: 1.35, L: 0.062 },
      { n: 5, R: 0.034, tilt: 1.0, L: 0.05 },
      { n: 4, R: 0.016, tilt: 0.55, L: 0.035 },
    ];
    tiers.forEach((tr, ti) => {
      for (let i = 0; i < tr.n; i++) {
        const yaw = (i / tr.n) * Math.PI * 2 + ti * 0.6;
        const L = tr.L * scale;
        leafPart(
          leafGeometry({ kind: "round", len: L, wid: L * 0.66, steps: 11, droop: 0.2, fold: 0.5 }),
          Math.sin(yaw) * tr.R * scale,
          base + ti * 0.012 * scale,
          Math.cos(yaw) * tr.R * scale,
          yaw + Math.PI,
          tr.tilt
        );
      }
    });
  } else {
    // "herb" — the catch-all bushy one for a windowsill or a shelf.
    const n = 26;
    for (let i = 0; i < n; i++) {
      const yaw = rand() * Math.PI * 2;
      const up = (0.04 + rand() * 0.1) * scale;
      const out = (0.02 + rand() * 0.06) * scale;
      const ex = Math.sin(yaw) * out;
      const ez = Math.cos(yaw) * out;
      stemPart(0, base, 0, ex, base + up, ez, 0.004 * scale);
      const L = (0.035 + rand() * 0.03) * scale;
      leafPart(
        leafGeometry({ kind: "oval", len: L, wid: L * 0.55, steps: 10, droop: 0.35, fold: 0.3 }),
        ex,
        base + up,
        ez,
        yaw + Math.PI,
        0.9 + rand() * 0.9
      );
    }
  }

  const canopy = new THREE.Mesh(mergeParts(parts, { colours: true }), canopyMat);
  canopy.castShadow = true;
  canopy.receiveShadow = true;
  g.add(canopy);
  g.userData.sway = sway;
  return g;
}
