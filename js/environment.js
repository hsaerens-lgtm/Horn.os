// The room's own ambient light, as an environment map.
//
// What was here before was three.js's `RoomEnvironment`: a generic bright studio
// box that every three.js scene uses as a default, and which is the right answer
// for a product turntable and the wrong one for this. It lights a candlelit room
// with even grey light from all sides, so every material's indirect term is the
// same neutral lift wherever it faces. That is what a flat ambient does to an
// image: it raises the floor of the histogram without putting anything in it.
//
// Measured, before this existed: 38.6% of the frame below luminance 0.125 with a
// single 30% spike in one narrow dark band, 54% below 0.25, and nothing at all
// above 0.94 — a picture with no highlights and no midtones, only a dark mass
// and the pool on the table.
//
// The fix is not more ambient. It is ambient that comes from somewhere. This
// builds a small box whose walls are the actual sources in the room — hearth
// warm on one side, two cold windows on the other, the pendant's bounce
// overhead, the television's blue on the right — and hands it to the PMREM
// generator. Indirect light then has a direction and a colour, so a surface
// facing the fire is warmer than one facing the window, and the difference
// between them is midtones that were not there before.
//
// Only direction matters to an environment map: it is sampled as if from a
// single point. So these panels sit where the sources are *relative to the
// table*, not where they are in the room.

import * as THREE from "three";

// Radiance, linear, not clamped to 1. A source in an environment is allowed to
// be brighter than white — that is what makes it a source.
//
// The absolute level was found by sweeping it against a histogram of the final
// frame, not by eye: the ratios between these panels are the design, the
// overall scale is whatever puts the picture where it should sit. See the
// numbers in the README.
const lit = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });

/**
 * Builds the scene the environment map is baked from. Call it, hand it to
 * `PMREMGenerator.fromScene`, and dispose of it.
 */
export function createAmbience() {
  const env = new THREE.Scene();

  const panel = (mat, w, h, pos, rot = [0, 0, 0]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(...pos);
    m.rotation.set(...rot);
    env.add(m);
    return m;
  };

  // The shell. Almost black, and that is the point. Whatever value this has is
  // added to every surface in the room no matter which way it faces, so it is
  // the one number here that cannot shape anything — it is flat ambient by
  // another name. The first version of this file had it at 0.30 and the room
  // came out evenly lit like an afternoon, with the wall as bright as the
  // table. The light has to come from the panels.
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(10, 7, 10),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.045, 0.036, 0.028), side: THREE.BackSide })
  );
  env.add(shell);

  // Floor: darker still, and warmer, because what is down there is parquet.
  panel(lit(0.043, 0.03, 0.021), 10, 10, [0, -3.49, 0], [-Math.PI / 2, 0, 0]);

  // Ceiling: the pendant is shaded, so what comes back down is the small hot
  // patch it throws straight up, not a lit ceiling.
  panel(lit(0.082, 0.071, 0.058), 10, 10, [0, 3.49, 0], [Math.PI / 2, 0, 0]);
  panel(lit(25.4, 18.8, 11.1), 2.2, 2.2, [0, 3.4, 0], [Math.PI / 2, 0, 0]);

  // The hearth, low and to the left. The biggest coloured source in the room
  // and the one that has to win: everything facing left should be warm.
  panel(lit(17.5, 7.0, 2.3), 3.4, 2.2, [-4.9, -1.5, -1.2], [0, Math.PI / 2, 0]);
  // and its spill onto the floor in front of it
  panel(lit(6.05, 2.66, 0.97), 3.0, 3.0, [-3.2, -3.44, -0.8], [-Math.PI / 2, 0, 0]);

  // The two windows, high and behind, cold. They are what keeps the shadow side
  // from going brown as well as dark — a room lit only by fire has no colour
  // anywhere in its shadows, which reads as sepia rather than as evening.
  for (const x of [-3.6, 3.6]) {
    panel(lit(4.36, 6.29, 10.4), 2.0, 1.7, [x, 1.5, -4.9]);
  }

  // The television, right and low. Small, and the only reason it is worth a
  // panel is that it is the one thing in the room that is cold and close.
  panel(lit(2.42, 4.11, 7.26), 1.6, 1.2, [4.9, -0.7, -2.0], [0, -Math.PI / 2, 0]);

  // The near half of the room — everything on the camera's side, which is
  // floor, rug, sofa and the light bouncing off them. Leaving it out was the
  // single worst thing about the first version of this file, and not for a
  // reason that is obvious until you look for it: the back wall, the chimney
  // breast and the bookcase all *face this way*, so with nothing here they were
  // lit by the shell alone. Measured on a nine-cell grid of the frame, the
  // top-left cell — hearth, mantel, bookcase — was 53% crushed to black against
  // 7% in the middle. This one panel takes it to 11%, and the picture keeps its
  // falloff because it only reaches what turns towards the viewer.
  //
  // Warm, because what it is standing in for is bounce off parquet.
  panel(lit(0.7, 0.56, 0.4), 7.0, 4.5, [0, -0.3, 4.9], [0, Math.PI, 0]);

  // The floor lamp, right and high, warm.
  panel(lit(7.5, 5.08, 2.66), 1.1, 1.1, [4.6, 1.2, -1.0], [0, -Math.PI / 2, 0]);

  return env;
}
