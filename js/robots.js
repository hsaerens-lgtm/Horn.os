// The players' bodies, built rather than bought.
//
// Until now the four agents wore one body: three.js's CC0 RobotExpressive,
// folded into a chair bone by bone, with its head cut off and a television put
// in its place. It was the only thing at the table that was not made here, and
// after the room got its scans, its plants and its lighting it was the thing
// that read as borrowed — an asset with no UVs, one silhouette for four very
// different characters, and a rig that had to be argued into sitting down.
//
// These are primitives, the way the suited figures in scene.js already are:
// capsules, cylinders, extruded and rounded boxes, placed in a seated pose by
// construction rather than by posing a skeleton. That buys three things. The
// pose is exactly what is written. Every part has UVs, so the painted-shell
// maps that were bolted onto the old model apply the ordinary way. And each
// agent can have its own silhouette, which is the point: the Platform is
// broad and armoured, the Messenger is a spindle with fins, the Navigator
// carries a dish, the Artificer has gauntlets and a tool rack. You should be
// able to tell them apart across the room with the screens off.
//
// Each body is three merged meshes — painted shell, bare metal, lit accents —
// per moving group. Twenty-odd parts become six draw calls, and the cavity
// occlusion in js/occlusion.js runs on the result once it is posed.

import * as THREE from "three";
import { mergeParts } from "./merge.js";
import { boxProjectUVs } from "./shapes.js";

/** A part's transform: position, Euler rotation, and a per-axis scale. */
const M = (x, y, z, rot = [0, 0, 0], scale = [1, 1, 1]) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
    new THREE.Vector3(...scale)
  );

// One entry per agent id. Numbers are relative to the Platform, which is the
// broadest of the four and sets the scale everything else deviates from.
const ARCHETYPES = {
  perseus: { chest: "slab", w: 1.22, torsoH: 0.4, shoulder: 0.235, arm: 1.15, leg: 1.12 },
  // Shoulder at 0.14, not 0.17: the spindle is only 0.11 across at the top, and
  // at 0.17 the upper arms hung three centimetres clear of the body — two
  // capsules floating beside a column, which is the wide shot's first read.
  hermes: { chest: "spindle", w: 0.86, torsoH: 0.46, shoulder: 0.14, arm: 0.85, leg: 0.92 },
  odysseus: { chest: "barrel", w: 1.0, torsoH: 0.42, shoulder: 0.2, arm: 1.0, leg: 1.0 },
  codex: { chest: "box", w: 1.06, torsoH: 0.4, shoulder: 0.21, arm: 1.0, leg: 1.02 },
};

/**
 * Builds one seated body for agent `a`, facing +Z.
 *
 * Returns `legs` (static, sits on the seat) and `upper` (leans and breathes),
 * both ready to be added to the player's group, and `headY`: where the
 * television goes, in `upper`'s space.
 *
 * `ctx` carries what the body needs from the scene: the painted-shell maps, the
 * rounded-box factory, the seat and table heights.
 */
export function buildRobotBody(a, seat, { tex, roundedBox, HIP_Y, TABLE_Y, N }) {
  const k = ARCHETYPES[a.id] ?? ARCHETYPES.odysseus;
  const { lean = 0, reach = 0 } = seat;
  const accent = new THREE.Color(a.colour);

  /* ---------------- materials ----------------
   * Three per body. The shell is painted and lacquered, as the old robots were
   * after their fix; the joints and hands are bare metal; the accents glow in
   * the agent's own colour, because a screen-headed thing with no other light
   * on it reads as switched off.
   */
  const shell = new THREE.MeshPhysicalMaterial({
    color: accent.clone().multiplyScalar(0.62),
    map: tex.shell.map,
    normalMap: tex.shell.normalMap,
    normalScale: N(0.8),
    roughnessMap: tex.shell.roughnessMap,
    roughness: 0.95,
    metalness: 0.38,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    envMapIntensity: 0.95,
    vertexColors: true,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x5a6069,
    roughnessMap: tex.shell.roughnessMap,
    roughness: 0.9,
    metalness: 0.78,
    envMapIntensity: 1.25,
    vertexColors: true,
  });
  const glow = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 2.4,
    roughness: 0.4,
    vertexColors: true,
  });

  // parts collect per material, per group, and merge at the end
  const bins = { legs: { shell: [], dark: [], glow: [] }, upper: { shell: [], dark: [], glow: [] } };
  const add = (group, mat, geometry, matrix) => bins[group][mat].push({ geometry, matrix });

  /* ---------------- legs and pelvis (static) ----------------
   * Absolute heights: the seat is under them and does not move.
   */
  const L = k.leg;
  const hipX = 0.1 * k.w;
  add("legs", "shell", roundedBox(0.3 * k.w, 0.14, 0.24, 0.02), M(0, HIP_Y - 0.03, -0.01));
  for (const s of [-1, 1]) {
    // thigh forward to the knee, knee, shin down, foot
    add("legs", "shell", new THREE.CapsuleGeometry(0.068 * L, 0.24, 4, 14), M(s * hipX, HIP_Y - 0.015, 0.16, [Math.PI / 2, 0, 0]));
    add("legs", "dark", new THREE.SphereGeometry(0.064 * L, 14, 12), M(s * hipX, HIP_Y - 0.02, 0.3));
    add("legs", "shell", new THREE.CapsuleGeometry(0.052 * L, 0.26, 4, 14), M(s * hipX, HIP_Y - 0.17, 0.325, [0.1, 0, 0]));
    // a shin plate, which is what makes a cylinder read as a piece of armour
    add("legs", "dark", roundedBox(0.07 * L, 0.2, 0.02, 0.006), M(s * hipX, HIP_Y - 0.17, 0.325 + 0.052 * L + 0.006, [0.1, 0, 0]));
    add("legs", "dark", roundedBox(0.09 * L, 0.05, 0.19, 0.012), M(s * hipX, 0.028, 0.375));
  }

  /* ---------------- torso (in `upper`, origin at the hip) ---------------- */
  const T = k.torsoH;
  const torsoY = 0.13 + T / 2;
  const top = 0.13 + T; // where the shoulders sit
  if (k.chest === "slab") {
    // The Platform: broad, plated, and tapered — a straight box read as a
    // filing cabinet in the wide shot. A trapezoid extruded with a bevel is
    // square across the shoulders and narrows to the waist, which is the one
    // thing a body has that a cabinet does not.
    const SH = 0.215 * k.w;
    const WA = 0.155 * k.w;
    const chest = new THREE.Shape();
    chest.moveTo(-SH, T / 2);
    chest.lineTo(SH, T / 2);
    chest.bezierCurveTo(SH + 0.01, T * 0.1, WA + 0.02, -T * 0.25, WA, -T / 2);
    chest.lineTo(-WA, -T / 2);
    chest.bezierCurveTo(-WA - 0.02, -T * 0.25, -SH - 0.01, T * 0.1, -SH, T / 2);
    add(
      "upper",
      "shell",
      new THREE.ExtrudeGeometry(chest, { depth: 0.22, bevelEnabled: true, bevelSize: 0.028, bevelThickness: 0.026, bevelSegments: 5, curveSegments: 16 }),
      M(0, torsoY, -0.13)
    );
    for (const s of [-1, 1]) {
      add("upper", "dark", roundedBox(0.11, 0.26, 0.026, 0.008), M(s * 0.14 * k.w, torsoY + 0.02, 0.12, [0, s * 0.35, 0]));
      add("upper", "dark", roundedBox(0.15, 0.05, 0.17, 0.014), M(s * (k.shoulder - 0.005), top + 0.035, -0.01));
      for (let r = 0; r < 3; r++) {
        add("upper", "dark", new THREE.CylinderGeometry(0.007, 0.007, 0.008, 8), M(s * 0.065, torsoY - 0.1 + r * 0.075, 0.125, [Math.PI / 2, 0, 0]));
      }
    }
    add("upper", "glow", roundedBox(0.15, 0.012, 0.008, 0.003), M(0, torsoY + 0.09, 0.128));
  } else if (k.chest === "spindle") {
    // The Messenger: a tapered column, light, with fins.
    add("upper", "shell", new THREE.CylinderGeometry(0.11, 0.145, T, 22), M(0, torsoY, 0));
    add("upper", "dark", new THREE.CylinderGeometry(0.12, 0.11, 0.035, 22), M(0, top - 0.005, 0));
    add("upper", "dark", new THREE.TorusGeometry(0.135, 0.012, 10, 28), M(0, torsoY - 0.1, 0, [Math.PI / 2, 0, 0]));
    for (const s of [-1, 1]) {
      add("upper", "shell", roundedBox(0.024, 0.24, 0.11, 0.008), M(s * 0.085, torsoY + 0.06, -0.13, [0, 0, s * 0.32]));
      // an aerial off each shoulder, lit at the tip
      add("upper", "dark", new THREE.CylinderGeometry(0.005, 0.006, 0.17, 8), M(s * 0.11, top + 0.1, -0.03, [0, 0, s * -0.18]));
      add("upper", "glow", new THREE.SphereGeometry(0.012, 10, 8), M(s * 0.125, top + 0.185, -0.03));
    }
    add("upper", "glow", roundedBox(0.03, 0.09, 0.008, 0.003), M(0, torsoY, 0.14));
  } else if (k.chest === "barrel") {
    // The Navigator: a drum with a dish on one shoulder and a compass on its chest.
    add("upper", "shell", new THREE.CylinderGeometry(0.15, 0.16, T, 24), M(0, torsoY, 0));
    add("upper", "shell", new THREE.SphereGeometry(0.15, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(0, top, 0));
    add("upper", "dark", new THREE.TorusGeometry(0.152, 0.01, 10, 30), M(0, torsoY + 0.09, 0, [Math.PI / 2, 0, 0]));
    add("upper", "dark", new THREE.TorusGeometry(0.158, 0.01, 10, 30), M(0, torsoY - 0.11, 0, [Math.PI / 2, 0, 0]));
    // the dish: a shallow cone, open, on a short stalk
    add("upper", "dark", new THREE.CylinderGeometry(0.006, 0.006, 0.07, 8), M(-0.19, top + 0.03, -0.03, [0, 0, 0.5]));
    add("upper", "dark", new THREE.ConeGeometry(0.08, 0.035, 20, 1, true), M(-0.22, top + 0.075, -0.02, [-0.9, 0.3, 0.5]));
    add("upper", "glow", new THREE.SphereGeometry(0.009, 8, 8), M(-0.22, top + 0.078, -0.02));
    // compass rose: a lit ring with a needle
    add("upper", "glow", new THREE.TorusGeometry(0.042, 0.005, 8, 28), M(0, torsoY + 0.02, 0.152));
    add("upper", "glow", roundedBox(0.006, 0.06, 0.005, 0.002), M(0, torsoY + 0.02, 0.153, [0, 0, 0.6]));
  } else {
    // The Artificer: a workshop box, a front panel, gauntlets and tools.
    add("upper", "shell", roundedBox(0.36 * k.w, T, 0.26, 0.022), M(0, torsoY, -0.01));
    add("upper", "dark", roundedBox(0.24, 0.2, 0.02, 0.006), M(0, torsoY - 0.02, 0.125));
    for (let i = 0; i < 4; i++) {
      add("upper", "glow", roundedBox(0.012, 0.012, 0.006, 0.002), M(-0.075 + i * 0.05, torsoY - 0.08, 0.137));
    }
    add("upper", "dark", roundedBox(0.2, 0.016, 0.016, 0.004), M(0, torsoY + 0.05, 0.135));
    // the tool rack on the left shoulder: three cylinders of different lengths
    for (let i = 0; i < 3; i++) {
      add("upper", "dark", new THREE.CylinderGeometry(0.006, 0.006, 0.09 + i * 0.03, 8), M(-k.shoulder + 0.02 + i * 0.028, top + 0.06 + i * 0.012, -0.07, [0.2, 0, 0.1]));
    }
  }

  // neck: a collar and a stalk the television sits on
  add("upper", "dark", new THREE.CylinderGeometry(0.07, 0.08, 0.03, 18), M(0, top + 0.012, 0.005));
  add("upper", "dark", new THREE.CylinderGeometry(0.038, 0.048, 0.09, 16), M(0, top + 0.07, 0.01));
  const headY = top + 0.115 + 0.104; // stalk top plus half the television's height

  /* ---------------- arms (in `upper`) ---------------- */
  const A = k.arm;
  const S = k.shoulder;
  for (const s of [-1, 1]) {
    add("upper", "dark", new THREE.SphereGeometry(0.056 * A, 16, 12), M(s * S, top - 0.02, -0.005, [0, 0, 0], [1, 0.85, 0.95]));
    add("upper", "shell", new THREE.CapsuleGeometry(0.05 * A, 0.16, 4, 14), M(s * (S + 0.022), top - 0.12, 0.035, [0.42, 0, s * 0.14]));
    add("upper", "dark", new THREE.SphereGeometry(0.046 * A, 14, 12), M(s * (S + 0.05), 0.305, 0.115));
    add("upper", "shell", new THREE.CapsuleGeometry(0.042 * A, 0.21, 4, 14), M(s * (S + 0.048), 0.215, 0.255 + reach * 0.5, [1.31, 0, s * 0.05]));
    if (k.chest === "box") {
      // gauntlets, which is where an artificer keeps the interesting parts
      add("upper", "dark", roundedBox(0.105, 0.075, 0.13, 0.012), M(s * (S + 0.048), 0.2, 0.33 + reach * 0.6, [1.31, 0, 0]));
      add("upper", "glow", new THREE.CylinderGeometry(0.014, 0.014, 0.006, 12), M(s * (S + 0.048), 0.245, 0.33 + reach * 0.6, [1.31 - Math.PI / 2, 0, 0]));
    } else {
      add("upper", "dark", new THREE.CylinderGeometry(0.046 * A, 0.046 * A, 0.014, 16), M(s * (S + 0.046), 0.185, 0.365 + reach * 0.8, [1.31, 0, 0]));
    }
    // the hand on the table: a palm and two fingers
    const hy = TABLE_Y + 0.022 - HIP_Y;
    add("upper", "dark", roundedBox(0.07, 0.03, 0.09, 0.01), M(s * (S + 0.046), hy, 0.4 + reach, [0.05, s * -0.12, 0]));
    add("upper", "dark", roundedBox(0.028, 0.024, 0.06, 0.008), M(s * (S + 0.028), hy - 0.002, 0.47 + reach, [0.05, s * -0.12, 0]));
    add("upper", "dark", roundedBox(0.028, 0.024, 0.06, 0.008), M(s * (S + 0.066), hy - 0.002, 0.47 + reach, [0.05, s * -0.12, 0]));
  }

  /* ---------------- merge ---------------- */
  const legs = new THREE.Group();
  const upper = new THREE.Group();
  upper.position.set(0, HIP_Y, 0);
  upper.rotation.x = lean;
  const mats = { shell, dark, glow };
  // The grain has to be the same size on a finger as on a chest, and it was
  // not: every primitive arrives with UVs that run 0..1 across itself, so a
  // three-centimetre finger wore one whole tile of the paint texture, the same
  // as a forty-centimetre torso — and the hands and aerials came out coarse
  // enough to notice from across the room. The primitives' own UVs are thrown
  // away after the merge and replaced by a box projection in metres, which
  // makes texel density a physical constant: one tile every 25 cm, whatever the
  // part. Seams where a face changes projection axis do not show on a grain
  // with no direction; they would on anything with a pattern.
  const TILES_PER_METRE = 4;
  for (const [groupName, group] of [["legs", legs], ["upper", upper]]) {
    for (const [matName, parts] of Object.entries(bins[groupName])) {
      if (!parts.length) continue;
      const geometry = mergeParts(parts);
      if (matName !== "glow") {
        geometry.deleteAttribute("uv");
        boxProjectUVs(geometry, TILES_PER_METRE);
      }
      const mesh = new THREE.Mesh(geometry, mats[matName]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `${a.id}-${groupName}-${matName}`;
      group.add(mesh);
    }
  }
  return { legs, upper, headY };
}
