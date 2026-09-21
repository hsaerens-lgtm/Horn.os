// The players' bodies, built rather than bought.
//
// Until now the four agents wore one body: three.js's CC0 RobotExpressive,
// folded into a chair bone by bone, with its head cut off and a television put
// in its place. It was the only thing at the table that was not made here, and
// after the room got its scans, its plants and its lighting it was the thing
// that read as borrowed — an asset with no UVs, one silhouette for four very
// different characters, and a rig that had to be argued into sitting down.
//
// These are primitives, placed in a seated pose by construction rather than by
// posing a skeleton. The first version of them was capsules and spheres set
// next to each other, and it read as what it was: a tube for an arm, a ball
// for an elbow, two blocks for a hand, each floating beside the next. What
// separates a designed robot from a stack of primitives is not the count of
// parts but that every joint is *housed* — a pauldron over the shoulder, a cap
// over the knee, a hinge at the elbow, a ring at the wrist — and that every
// limb runs from one joint to the next with no gap, because it is built
// between two points rather than placed near them. That is what this does.
// Limbs are solved from explicit joint positions (shoulder, elbow, wrist), the
// hands are palms with three curled fingers and a thumb resting on the table,
// and the table-side points are corrected for the body's lean so the hands
// land on the wood whichever way the figure sits.
//
// Each agent still has its own silhouette, which is the point: the Platform is
// broad and armoured with a rack on its back, the Messenger is a spindle with
// fins and aerials, the Navigator carries a dish and a rolled chart, the
// Artificer has gauntlets and a tool rack. You should be able to tell them
// apart across the room with the screens off.
//
// Each body is three merged meshes — painted shell, bare metal, lit accents —
// per moving group. Sixty-odd parts become six draw calls, and the cavity
// occlusion in js/occlusion.js runs on the result once it is posed.

import * as THREE from "three";
import { mergeParts } from "./merge.js";
import { boxProjectUVs, along, between, ring } from "./shapes.js";

const X = new THREE.Vector3(1, 0, 0);

/** A part's transform: position, Euler rotation, and a per-axis scale. */
const M = (x, y, z, rot = [0, 0, 0], scale = [1, 1, 1]) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
    new THREE.Vector3(...scale)
  );

// `along`, `between` and `ring` — the joint-to-joint builders every limb is
// made with — live in shapes.js now, because the chairs wanted them too.

const sphere = (p, r, scale = [1, 1, 1], seg = 18) => ({
  geometry: new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7)),
  matrix: M(p.x, p.y, p.z, [0, 0, 0], scale),
});

/** The point `t` of the way from `a` to `b`. */
const lerp = (a, b, t) => a.clone().lerp(b, t);

// One entry per agent id. Numbers are relative to the Platform, which is the
// broadest of the four and sets the scale everything else deviates from.
const ARCHETYPES = {
  perseus: { chest: "slab", w: 1.22, torsoH: 0.42, shoulder: 0.25, arm: 1.12, leg: 1.12 },
  // The spindle is narrow, and the first cut hung its arms three centimetres
  // clear of it. The pauldrons cover that now, so the shoulder can sit where a
  // shoulder should rather than where the column happens to end.
  hermes: { chest: "spindle", w: 0.86, torsoH: 0.48, shoulder: 0.165, arm: 0.86, leg: 0.92 },
  odysseus: { chest: "barrel", w: 1.0, torsoH: 0.44, shoulder: 0.215, arm: 1.0, leg: 1.0 },
  codex: { chest: "box", w: 1.06, torsoH: 0.42, shoulder: 0.225, arm: 1.0, leg: 1.02 },
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
   * Three per body. The shell is painted and lacquered; the joints, hands and
   * hardware are bare metal; the accents glow in the agent's own colour,
   * because a screen-headed thing with no other light on it reads as switched
   * off.
   */
  // The paint. The accent is the agent's screen colour, which is a light: cyan
  // at 93% saturation, amber at 100%. Painted on a body it came out as toy
  // plastic, and a uniform multiply did not help — it darkens without touching
  // chroma. This goes through HSL and takes the saturation down by nearly half
  // while setting the lightness to that of a paint under lacquer, so the four
  // read as sage, teal, ochre and mauve on metal rather than as their own
  // screens.
  const paint = (() => {
    const hsl = { h: 0, s: 0, l: 0 };
    accent.getHSL(hsl);
    return new THREE.Color().setHSL(hsl.h, hsl.s * 0.52, Math.min(0.38, Math.max(0.26, hsl.l * 0.6)));
  })();
  const shell = new THREE.MeshPhysicalMaterial({
    color: paint,
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
  // Gunmetal, and reflective. At roughness 0.9 the "metal" parts were a flat
  // grey with no highlight on them, which is the one thing a metal never is;
  // at 0.45 the joints pick up the room and the hands catch the lamp.
  const dark = new THREE.MeshStandardMaterial({
    color: 0x6b7079,
    roughnessMap: tex.shell.roughnessMap,
    roughness: 0.45,
    metalness: 0.88,
    envMapIntensity: 1.3,
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
  const part = (group, mat, p) => add(group, mat, p.geometry, p.matrix);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  /* ---------------- legs and pelvis (static) ----------------
   * Absolute heights: the seat is under them and does not move.
   */
  const L = k.leg;
  const hipX = 0.105 * k.w;
  // pelvis, with a dark waist band the torso turns on
  add("legs", "shell", roundedBox(0.32 * k.w, 0.13, 0.25, 0.024), M(0, HIP_Y - 0.035, 0.0));
  add("legs", "dark", roundedBox(0.33 * k.w, 0.022, 0.26, 0.008), M(0, HIP_Y + 0.02, 0.0));
  for (const s of [-1, 1]) {
    const hip = V(s * hipX, HIP_Y - 0.03, 0.09);
    const knee = V(s * hipX, HIP_Y - 0.025, 0.31);
    const ankle = V(s * hipX, 0.075, 0.35);
    // hip joint, half housed in the pelvis
    part("legs", "dark", sphere(hip, 0.06 * L));
    // thigh, run hip to knee; a seam ring before the knee
    part("legs", "shell", between(lerp(hip, knee, 0.12), knee, 0.072 * L, 0.062 * L));
    part("legs", "dark", ring(lerp(hip, knee, 0.8), knee.clone().sub(hip), 0.064 * L, 0.006));
    // knee: a dark ball with a painted cap over its top and front — the cap is
    // what makes a ball read as a kneecap rather than as a ball
    part("legs", "dark", sphere(knee, 0.06 * L));
    add(
      "legs",
      "shell",
      new THREE.SphereGeometry(0.07 * L, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
      M(knee.x, knee.y + 0.004, knee.z + 0.008, [0.7, 0, 0], [1, 0.9, 0.95])
    );
    // shin, knee to ankle, with a plate down its front
    part("legs", "shell", between(knee, ankle, 0.06 * L, 0.046 * L));
    const shinDir = ankle.clone().sub(knee);
    const shinMid = lerp(knee, ankle, 0.5);
    add("legs", "dark", roundedBox(0.062 * L, 0.2, 0.014, 0.005), along(V(shinMid.x, shinMid.y, shinMid.z + 0.058 * L), shinDir));
    part("legs", "dark", ring(ankle, shinDir, 0.048 * L, 0.008));
    // foot: a dark boot with a painted toe cap and a sole
    add("legs", "dark", roundedBox(0.095 * L, 0.05, 0.2, 0.014), M(s * hipX, 0.03, 0.4));
    add("legs", "shell", roundedBox(0.1 * L, 0.048, 0.085, 0.016), M(s * hipX, 0.036, 0.458));
    add("legs", "dark", roundedBox(0.1 * L, 0.012, 0.21, 0.004), M(s * hipX, 0.011, 0.405));
  }

  /* ---------------- torso (in `upper`, origin at the hip) ---------------- */
  const T = k.torsoH;
  const base = 0.1; // the chest starts here; below it is the dark abdomen
  const torsoY = base + T / 2;
  const top = base + T; // where the shoulders sit
  // the abdomen: the dark core the chest plate sits on, visible at the waist
  add("upper", "dark", new THREE.CylinderGeometry(0.12 * k.w, 0.135 * k.w, 0.16, 26), M(0, 0.06, -0.01));
  add("upper", "dark", new THREE.TorusGeometry(0.128 * k.w, 0.008, 10, 30), M(0, 0.1, -0.01, [Math.PI / 2, 0, 0]));

  if (k.chest === "slab") {
    // The Platform: broad, plated, and tapered — a straight box read as a
    // filing cabinet in the wide shot. A trapezoid extruded with a bevel is
    // square across the shoulders and narrows to the waist, which is the one
    // thing a body has that a cabinet does not.
    const SH = 0.215 * k.w;
    const WA = 0.15 * k.w;
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
    // a horizontal seam across the chest, two flanking panels, bolt rows
    add("upper", "dark", roundedBox(0.36 * k.w, 0.008, 0.02, 0.003), M(0, torsoY + 0.03, 0.135));
    for (const s of [-1, 1]) {
      add("upper", "dark", roundedBox(0.1, 0.24, 0.026, 0.008), M(s * 0.145 * k.w, torsoY - 0.01, 0.125, [0, s * 0.3, 0]));
      for (let r = 0; r < 3; r++) {
        add("upper", "dark", new THREE.CylinderGeometry(0.007, 0.007, 0.008, 8), M(s * 0.07, torsoY - 0.1 + r * 0.07, 0.135, [Math.PI / 2, 0, 0]));
      }
    }
    add("upper", "glow", roundedBox(0.16, 0.012, 0.008, 0.003), M(0, torsoY + 0.1, 0.138));
    // the rack on its back: a server, because that is what a platform is
    add("upper", "dark", roundedBox(0.28 * k.w, 0.3, 0.1, 0.014), M(0, torsoY - 0.02, -0.19));
    for (let i = 0; i < 3; i++) {
      add("upper", "dark", roundedBox(0.24 * k.w, 0.006, 0.02, 0.002), M(0, torsoY + 0.08 - i * 0.07, -0.24));
      add("upper", "glow", roundedBox(0.01, 0.01, 0.006, 0.002), M(0.11 * k.w, torsoY + 0.105 - i * 0.07, -0.243));
    }
  } else if (k.chest === "spindle") {
    // The Messenger: a tapered column, light, with fins.
    add("upper", "shell", new THREE.CylinderGeometry(0.115, 0.15, T, 26), M(0, torsoY, 0));
    add("upper", "dark", new THREE.CylinderGeometry(0.125, 0.115, 0.035, 26), M(0, top - 0.005, 0));
    add("upper", "dark", new THREE.TorusGeometry(0.14, 0.01, 10, 30), M(0, torsoY - 0.1, 0, [Math.PI / 2, 0, 0]));
    add("upper", "dark", new THREE.TorusGeometry(0.128, 0.008, 10, 30), M(0, torsoY + 0.08, 0, [Math.PI / 2, 0, 0]));
    for (const s of [-1, 1]) {
      // fins, swept back, with a dark leading edge
      add("upper", "shell", roundedBox(0.022, 0.26, 0.13, 0.008), M(s * 0.09, torsoY + 0.05, -0.13, [0, 0, s * 0.3]));
      add("upper", "dark", roundedBox(0.026, 0.27, 0.012, 0.004), M(s * 0.085, torsoY + 0.05, -0.197, [0, 0, s * 0.3]));
      // an aerial off each shoulder, lit at the tip
      add("upper", "dark", new THREE.CylinderGeometry(0.004, 0.006, 0.18, 8), M(s * 0.12, top + 0.11, -0.03, [0, 0, s * -0.18]));
      add("upper", "glow", new THREE.SphereGeometry(0.011, 10, 8), M(s * 0.136, top + 0.2, -0.03));
    }
    add("upper", "glow", roundedBox(0.03, 0.1, 0.008, 0.003), M(0, torsoY, 0.146));
    add("upper", "glow", roundedBox(0.012, 0.22, 0.006, 0.002), M(0, torsoY - 0.02, -0.14));
  } else if (k.chest === "barrel") {
    // The Navigator: a drum with a dish on one shoulder and a compass on its chest.
    add("upper", "shell", new THREE.CylinderGeometry(0.155, 0.165, T, 28), M(0, torsoY, 0));
    add("upper", "shell", new THREE.SphereGeometry(0.155, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(0, top, 0));
    add("upper", "dark", new THREE.TorusGeometry(0.157, 0.009, 10, 32), M(0, torsoY + 0.1, 0, [Math.PI / 2, 0, 0]));
    add("upper", "dark", new THREE.TorusGeometry(0.163, 0.009, 10, 32), M(0, torsoY - 0.12, 0, [Math.PI / 2, 0, 0]));
    // rivets around the upper hoop
    for (let i = 0; i < 12; i++) {
      const th = (i / 12) * Math.PI * 2;
      add("upper", "dark", new THREE.SphereGeometry(0.006, 8, 6), M(Math.sin(th) * 0.158, torsoY + 0.1, Math.cos(th) * 0.158));
    }
    // the dish: a shallow cone, open, on a short stalk
    add("upper", "dark", new THREE.CylinderGeometry(0.006, 0.006, 0.07, 8), M(-0.2, top + 0.03, -0.03, [0, 0, 0.5]));
    add("upper", "dark", new THREE.ConeGeometry(0.085, 0.035, 22, 1, true), M(-0.235, top + 0.08, -0.02, [-0.9, 0.3, 0.5]));
    add("upper", "glow", new THREE.SphereGeometry(0.009, 8, 8), M(-0.235, top + 0.083, -0.02));
    // compass rose: a lit ring with a needle
    add("upper", "glow", new THREE.TorusGeometry(0.044, 0.005, 8, 28), M(0, torsoY + 0.02, 0.158));
    add("upper", "glow", roundedBox(0.006, 0.064, 0.005, 0.002), M(0, torsoY + 0.02, 0.159, [0, 0, 0.6]));
    // a rolled chart slung across the back
    add("upper", "shell", new THREE.CylinderGeometry(0.03, 0.03, 0.36, 16), M(0.02, torsoY + 0.02, -0.2, [0, 0, 1.15]));
    for (const e of [-1, 1]) {
      add("upper", "dark", new THREE.CylinderGeometry(0.033, 0.033, 0.016, 16), M(0.02 + e * 0.165, torsoY + 0.02 - e * 0.075, -0.2, [0, 0, 1.15]));
    }
  } else {
    // The Artificer: a workshop box, a front panel, gauntlets and tools.
    add("upper", "shell", roundedBox(0.36 * k.w, T, 0.26, 0.026), M(0, torsoY, -0.01));
    add("upper", "dark", roundedBox(0.25, 0.2, 0.02, 0.006), M(0, torsoY - 0.02, 0.125));
    for (let i = 0; i < 4; i++) {
      add("upper", "glow", roundedBox(0.012, 0.012, 0.006, 0.002), M(-0.075 + i * 0.05, torsoY - 0.08, 0.137));
    }
    add("upper", "dark", roundedBox(0.2, 0.016, 0.016, 0.004), M(0, torsoY + 0.05, 0.135));
    // corner bolts on the chest plate
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        add("upper", "dark", new THREE.CylinderGeometry(0.008, 0.008, 0.008, 8), M(sx * 0.16 * k.w, torsoY + sy * (T / 2 - 0.035), 0.124, [Math.PI / 2, 0, 0]));
      }
    }
    // the tool rack on the left shoulder: three cylinders of different lengths
    for (let i = 0; i < 3; i++) {
      add("upper", "dark", new THREE.CylinderGeometry(0.006, 0.006, 0.09 + i * 0.03, 8), M(-k.shoulder + 0.03 + i * 0.028, top + 0.07 + i * 0.012, -0.07, [0.2, 0, 0.1]));
    }
    // a tool belt at the waist, with a pouch either side
    add("upper", "dark", roundedBox(0.38 * k.w, 0.03, 0.28, 0.008), M(0, base + 0.03, -0.01));
    for (const s of [-1, 1]) add("upper", "dark", roundedBox(0.06, 0.07, 0.03, 0.008), M(s * 0.12, base + 0.02, 0.14));
    // and a power pack on the back — a box with a carry handle, two lit
    // gauges and a hose down to the belt. Seen from behind, the Artificer was
    // a plain box; every other player carries something there.
    add("upper", "dark", roundedBox(0.26, 0.24, 0.09, 0.016), M(0, torsoY + 0.02, -0.185));
    add("upper", "shell", roundedBox(0.2, 0.16, 0.02, 0.008), M(0, torsoY + 0.02, -0.235));
    add("upper", "dark", new THREE.TorusGeometry(0.05, 0.008, 8, 20, Math.PI), M(0, torsoY + 0.145, -0.185, [0, 0, 0]));
    for (const s of [-1, 1]) add("upper", "glow", roundedBox(0.03, 0.012, 0.006, 0.002), M(s * 0.055, torsoY - 0.02, -0.247));
    add("upper", "dark", new THREE.TorusGeometry(0.075, 0.009, 8, 24, Math.PI * 0.55), M(0.11, torsoY - 0.09, -0.19, [0, Math.PI / 2, Math.PI]));
  }

  // the yoke across the shoulders, and the neck the television stands on. A
  // bar on the square torsos, a disc on the round ones — a slab set on top of
  // a column read as a lid.
  if (k.chest === "slab" || k.chest === "box") {
    add("upper", "dark", roundedBox(2 * k.shoulder - 0.02, 0.045, 0.15, 0.014), M(0, top + 0.02, -0.01));
  } else if (k.chest === "spindle") {
    add("upper", "dark", new THREE.CylinderGeometry(0.135, 0.128, 0.04, 26), M(0, top + 0.02, 0));
  }
  add("upper", "dark", new THREE.CylinderGeometry(0.075, 0.085, 0.03, 20), M(0, top + 0.05, 0.005));
  add("upper", "dark", new THREE.CylinderGeometry(0.036, 0.046, 0.09, 16), M(0, top + 0.1, 0.01));
  // bellows: a neck that reads as one that turns
  for (let i = 0; i < 3; i++) add("upper", "dark", new THREE.TorusGeometry(0.043, 0.006, 8, 20), M(0, top + 0.075 + i * 0.02, 0.01, [Math.PI / 2, 0, 0]));
  const headY = top + 0.145 + 0.104; // stalk top plus half the television's height

  /* ---------------- arms (in `upper`) ----------------
   * Three points a side — shoulder, elbow, wrist — and everything is built
   * between them. The wrist is where the hand meets the table, and the table
   * is in the room while the arm is in `upper`, which leans: the point is put
   * where it should be in the room and rotated back by the lean, so the palm
   * lands on the wood at every posture instead of seven centimetres into it.
   */
  const A = k.arm;
  const S = k.shoulder;
  const unlean = (p) => p.applyAxisAngle(X, -lean);
  // The wrist ring's centre, 3.4 cm over the table; the palm hangs 2.2 cm
  // below it, so its underside is on the wood. At 2.6 cm with the palm centred
  // on the wrist, the hands hovered a clear centimetre over their own shadows.
  const hy = TABLE_Y + 0.034 - HIP_Y;

  for (const s of [-1, 1]) {
    const shoulder = V(s * S, top - 0.01, 0.0);
    const elbow = V(s * (S + 0.06), 0.3, 0.13);
    const wrist = unlean(V(s * (S + 0.05), hy, 0.36 + reach));

    // pauldron: a painted cap over the shoulder joint, with a dark rim and a
    // bolt. Cap, rim and bolt share one frame, because the first cut gave the
    // rim its own tilt and it came out leaning the other way from the cap — a
    // hoop floating beside a dome, which the close-up caught at once.
    part("upper", "dark", sphere(shoulder, 0.055 * A));
    const PR = 0.088 * A;
    const padM = new THREE.Matrix4().compose(
      V(shoulder.x + s * 0.012, shoulder.y + 0.026, shoulder.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, 0, s * 0.35)),
      new THREE.Vector3(1, 1, 1)
    );
    add("upper", "shell", new THREE.SphereGeometry(PR, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), padM.clone().scale(new THREE.Vector3(1, 0.8, 0.95)));
    add("upper", "dark", new THREE.TorusGeometry(PR * 0.975, 0.006, 10, 30), padM.clone().multiply(M(0, 0, 0, [Math.PI / 2, 0, 0], [1, 0.95, 1])));
    add("upper", "dark", new THREE.CylinderGeometry(0.008, 0.008, 0.008, 10), padM.clone().multiply(M(0, PR * 0.8, 0)));

    // upper arm, shoulder to elbow, with a seam before the elbow
    part("upper", "shell", between(shoulder, elbow, 0.052 * A, 0.046 * A));
    part("upper", "dark", ring(lerp(shoulder, elbow, 0.78), elbow.clone().sub(shoulder), 0.048 * A, 0.006));

    // elbow: a ball, and a hinge disc either side of it
    part("upper", "dark", sphere(elbow, 0.052 * A));
    for (const e of [-1, 1]) {
      add("upper", "dark", new THREE.CylinderGeometry(0.036 * A, 0.036 * A, 0.014, 16), M(elbow.x + e * 0.05 * A, elbow.y, elbow.z, [0, 0, Math.PI / 2]));
    }

    // forearm, elbow to wrist: wide at the elbow, narrowing to the wrist
    const fore = wrist.clone().sub(elbow);
    if (k.chest === "box") {
      // gauntlets, which is where an artificer keeps the interesting parts
      part("upper", "shell", between(elbow, wrist, 0.05 * A, 0.04 * A));
      const gm = lerp(elbow, wrist, 0.5);
      add("upper", "dark", roundedBox(0.105, 0.135, 0.085, 0.014), along(gm, fore));
      add("upper", "glow", new THREE.CylinderGeometry(0.014, 0.014, 0.006, 12), along(gm, fore).multiply(M(0, 0, 0.044, [Math.PI / 2, 0, 0])));
    } else {
      part("upper", "shell", between(elbow, wrist, 0.056 * A, 0.038 * A));
      part("upper", "dark", ring(lerp(elbow, wrist, 0.3), fore, 0.052 * A, 0.006));
    }
    part("upper", "dark", ring(wrist, fore, 0.038 * A, 0.009));

    // the hand: a palm on the table, three fingers curled to it, a thumb inside.
    // Built flat in its own frame, then set down at the wrist, turned a little
    // in, and pitched back by the lean so it lies on the table plane.
    const handAt = new THREE.Matrix4().compose(
      wrist,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(-lean, s * -0.14, 0, "YXZ")),
      new THREE.Vector3(1, 1, 1)
    );
    const hand = (mat, p, local) => add("upper", mat, p.geometry ?? p, handAt.clone().multiply(local ?? p.matrix));
    hand("dark", roundedBox(0.07, 0.02, 0.075, 0.009), M(0, -0.022, 0.04));
    hand("shell", roundedBox(0.056, 0.01, 0.045, 0.004), M(0, -0.009, 0.035));
    for (const fx of [-0.024, 0, 0.024]) {
      // knuckle, first segment pitched a little down, second segment more
      const k0 = V(fx, -0.018, 0.078);
      const k1 = k0.clone().addScaledVector(V(0, -Math.sin(0.15), Math.cos(0.15)), 0.03);
      const k2 = k1.clone().addScaledVector(V(0, -Math.sin(0.42), Math.cos(0.42)), 0.024);
      hand("dark", new THREE.SphereGeometry(0.0105, 10, 8), M(k0.x, k0.y, k0.z));
      hand("dark", between(k0, k1, 0.0095, 0.009, 10));
      hand("dark", new THREE.SphereGeometry(0.0092, 10, 8), M(k1.x, k1.y, k1.z));
      hand("dark", between(k1, k2, 0.0088, 0.0075, 10));
      hand("dark", new THREE.SphereGeometry(0.0078, 10, 8), M(k2.x, k2.y, k2.z));
    }
    {
      // the thumb, on the inner side, pointing in and forward
      const t0 = V(-s * 0.038, -0.02, 0.03);
      const t1 = t0.clone().addScaledVector(V(-s * 0.7, -0.15, 0.65).normalize(), 0.03);
      hand("dark", new THREE.SphereGeometry(0.0105, 10, 8), M(t0.x, t0.y, t0.z));
      hand("dark", between(t0, t1, 0.0095, 0.008, 10));
      hand("dark", new THREE.SphereGeometry(0.008, 10, 8), M(t1.x, t1.y, t1.z));
    }
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
  // as a forty-centimetre torso. The primitives' own UVs are thrown away after
  // the merge and replaced by a box projection in metres, which makes texel
  // density a physical constant: one tile every 25 cm, whatever the part.
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
