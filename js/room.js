// The room around the table.
//
// The table itself is the subject; this file is everything that makes the space
// read as somewhere people actually spend evenings rather than a rendering of a
// table in a void. A fire, a sofa facing it, a television left on, and posters
// that have been on the wall since about 2003.
//
// Two rules held throughout: every light here is motivated by something you can
// see (the hearth, the tube, the lamp), and none of it is brighter than the
// pendant over the table — the table has to stay the brightest thing in frame.

import * as THREE from "three";
import { poster, brick, weave, tvScreen, flame, nightView } from "./textures.js";
import { roundedBox } from "./shapes.js";
import { mergeParts, at } from "./merge.js";
import { plant } from "./plants.js";

const N = (x, y = x) => new THREE.Vector2(x, y);

/**
 * Where the two openings are, in wall coordinates: centre and size.
 *
 * Exported because the wall itself is built in scene.js and has to be cut
 * around them — a window is a hole in a wall or it is a poster of a window.
 *
 * The x positions are not a composition choice, they are what is left. Reading
 * the back wall from the left: bookcase, chimney breast, five posters,
 * dartboard, television. The only clear runs are outside all of that, so the
 * windows flank the room rather than sitting behind the party. The head stops
 * just under the picture rail at 2.38, and the sill clears the top of the
 * bookcase that stands under the left one.
 */
export const WINDOWS = [
  { x: -3.52, y: 1.8, w: 1.12, h: 0.96 },
  { x: 3.52, y: 1.8, w: 1.12, h: 0.96 },
];

export function createRoom(scene, { wallZ = -2.1 } = {}) {
  const group = new THREE.Group();
  scene.add(group);

  const add = (geo, mat, x, y, z, { cast = true, receive = true, parent = group } = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = cast;
    m.receiveShadow = receive;
    parent.add(m);
    return m;
  };
  // Radius scales with the piece but is capped: a proportional radius on a 74 cm
  // television gives a 12 cm corner, which stops being a rounded edge and starts
  // being a bar of soap. Real manufactured corners are a centimetre or two
  // whatever the object's size, and upholstery asks for its radius explicitly.
  const B = (w, h, d, r) => roundedBox(w, h, d, r ?? Math.min(0.016, Math.min(w, h, d) * 0.22));
  // Seeded, so the books are in the same disorder on every load.
  const rand = (() => {
    let s = 20260918 >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
  })();

  // ---------- Materials ----------
  const brickTex = brick();
  const weaveTex = weave();
  const mat = {
    brick: new THREE.MeshStandardMaterial({ ...brickTex, color: 0x8b7a70, normalScale: N(0.7), envMapIntensity: 0.5 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x4a443f, roughness: 0.85, envMapIntensity: 0.4 }),
    mantel: new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.5, envMapIntensity: 0.7 }),
    soot: new THREE.MeshStandardMaterial({ color: 0x0d0b0a, roughness: 0.96, envMapIntensity: 0.15 }),
    log: new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.9, envMapIntensity: 0.3 }),
    ember: new THREE.MeshStandardMaterial({ color: 0x2a1408, emissive: 0xff5a14, emissiveIntensity: 1.6, roughness: 1 }),
    sofa: new THREE.MeshStandardMaterial({ ...weaveTex, color: 0x5d6878, normalScale: N(0.8), envMapIntensity: 0.35 }),
    sofaDark: new THREE.MeshStandardMaterial({ ...weaveTex, color: 0x4a5464, normalScale: N(0.7), envMapIntensity: 0.3 }),
    cushion: new THREE.MeshStandardMaterial({ ...weaveTex, color: 0x8a5a3c, normalScale: N(0.9), envMapIntensity: 0.4 }),
    woodLeg: new THREE.MeshStandardMaterial({ color: 0x5a3f2a, roughness: 0.45, envMapIntensity: 0.8 }),
    plastic: new THREE.MeshStandardMaterial({ color: 0x2a2c33, roughness: 0.55, envMapIntensity: 0.9 }),
    plasticPale: new THREE.MeshStandardMaterial({ color: 0x8d8778, roughness: 0.6, envMapIntensity: 0.8 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x8a8f99, roughness: 0.32, metalness: 0.8, envMapIntensity: 1.4 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.4, envMapIntensity: 1.0 }),
    tape: new THREE.MeshStandardMaterial({ color: 0xd8cfae, roughness: 0.8, transparent: true, opacity: 0.6 }),
  };

  /* ------------------------------------------------------------------ *
   *  Posters
   *  Hung at eye level for someone standing, which puts them above the
   *  seated party and inside the top of frame. Two are framed, three are
   *  just taped up — a wall where everything is framed reads as a gallery.
   * ------------------------------------------------------------------ */
  const PH = 0.66;
  const PW = PH * 0.707;
  // Spaced clear of the chimney breast, which stands 28 cm proud of the wall and
  // was hiding the left-hand poster behind it.
  const POSTERS = [
    { kind: "code", x: -1.2, y: 1.94, tilt: 0.015, framed: true },
    { kind: "y2k", x: -0.42, y: 1.99, tilt: -0.03, framed: false },
    { kind: "arcade", x: 0.36, y: 1.92, tilt: 0.022, framed: false },
    { kind: "lan", x: 1.14, y: 1.99, tilt: -0.014, framed: true },
    { kind: "skate", x: 1.92, y: 1.93, tilt: 0.034, framed: false },
  ];

  for (const p of POSTERS) {
    const art = poster(p.kind, { seed: p.x * 100 + 40 });
    const sheet = add(
      B(PW, PH, 0.006, 0.0015),
      // Lit rooms are dark; an emissive copy of the map keeps the print legible
      // without adding a lamp for every poster.
      new THREE.MeshStandardMaterial({
        map: art,
        emissive: 0xffffff,
        emissiveMap: art,
        emissiveIntensity: 0.42,
        roughness: 0.92,
        envMapIntensity: 0.5,
      }),
      p.x,
      p.y,
      wallZ + 0.012
    );
    sheet.rotation.z = p.tilt;
    sheet.castShadow = false;

    if (p.framed) {
      const f = new THREE.Group();
      f.position.set(p.x, p.y, wallZ + 0.014);
      f.rotation.z = p.tilt;
      group.add(f);
      const bar = (w, h, dx, dy) => add(B(w, h, 0.022), mat.frame, dx, dy, 0, { parent: f, receive: false });
      bar(PW + 0.05, 0.025, 0, PH / 2 + 0.012);
      bar(PW + 0.05, 0.025, 0, -PH / 2 - 0.012);
      bar(0.025, PH + 0.05, -PW / 2 - 0.012, 0);
      bar(0.025, PH + 0.05, PW / 2 + 0.012, 0);
    } else {
      for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
        const t = add(B(0.055, 0.03, 0.002), mat.tape, p.x + sx * PW * 0.44, p.y + sy * PH * 0.46, wallZ + 0.02, {
          cast: false,
          receive: false,
        });
        t.rotation.z = p.tilt + sx * sy * 0.6;
      }
    }
  }

  /* ------------------------------------------------------------------ *
   *  Fireplace
   *  Built from four solids around a hole rather than cut out of one, so
   *  there is no CSG and the opening is exactly as wide as the piers say.
   * ------------------------------------------------------------------ */
  // Far enough left to clear the player at that end of the table, near enough
  // that it stays inside the frame as the camera drifts — the camera only ever
  // sees about three metres either side of the table.
  const FIRE_X = -2.15;
  const fire = new THREE.Group();
  fire.position.set(FIRE_X, 0, wallZ + 0.01);
  group.add(fire);

  const PIER = 0.32;
  const OPEN_W = 0.81;
  const OPEN_H = 1.1;
  const DEPTH = 0.34;
  const BREAST_W = PIER * 2 + OPEN_W;

  for (const s of [-1, 1]) {
    add(B(PIER, OPEN_H, DEPTH, 0.008), mat.brick, (s * (OPEN_W + PIER)) / 2, OPEN_H / 2, DEPTH / 2, { parent: fire });
  }
  add(B(BREAST_W, 0.3, DEPTH, 0.008), mat.brick, 0, OPEN_H + 0.15, DEPTH / 2, { parent: fire });
  add(B(BREAST_W - 0.3, 0.86, DEPTH - 0.06, 0.008), mat.brick, 0, OPEN_H + 0.73, DEPTH / 2, { parent: fire });
  add(B(OPEN_W, OPEN_H, 0.02), mat.soot, 0, OPEN_H / 2, 0.02, { parent: fire, cast: false });
  add(B(OPEN_W, 0.05, DEPTH), mat.soot, 0, 0.025, DEPTH / 2, { parent: fire, cast: false });
  add(B(BREAST_W + 0.16, 0.07, DEPTH + 0.1, 0.01), mat.mantel, 0, OPEN_H + 0.335, DEPTH / 2 + 0.03, { parent: fire });
  add(B(BREAST_W + 0.16, 0.06, 0.58, 0.01), mat.stone, 0, 0.03, DEPTH + 0.26, { parent: fire });

  // logs and the grate under them
  for (const s of [-1, 1]) {
    const bar = add(new THREE.CylinderGeometry(0.012, 0.012, OPEN_W * 0.8, 8), mat.metal, 0, 0.09, DEPTH / 2 + s * 0.08, {
      parent: fire,
    });
    bar.rotation.z = Math.PI / 2;
  }
  const LOGS = [
    [-0.13, 0.13, 0.14, -0.22],
    [0.12, 0.14, 0.2, 0.28],
    [0.0, 0.22, 0.16, 0.1],
  ];
  for (const [lx, ly, lz, rot] of LOGS) {
    const log = add(new THREE.CylinderGeometry(0.048, 0.042, 0.42, 9), mat.log, lx, ly, DEPTH / 2 + lz - 0.1, {
      parent: fire,
    });
    log.rotation.set(0.08, rot, Math.PI / 2 + rot * 0.35);
  }
  add(new THREE.SphereGeometry(0.11, 12, 8), mat.ember, 0, 0.09, DEPTH / 2, { parent: fire, cast: false });
  // The soot at the back of a lit firebox is never black; it carries the light
  // of the fire in front of it, and without this the opening reads as a hole.
  add(
    new THREE.PlaneGeometry(OPEN_W * 0.92, OPEN_H * 0.6),
    new THREE.MeshBasicMaterial({ color: 0x622006, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
    0,
    0.3,
    0.05,
    { parent: fire, cast: false, receive: false }
  );

  // The flame: four additive billboards at different scales and rates. Any one
  // of them looks like a smudge; overlapped and beating against each other they
  // read as fire, which is cheaper than a particle system by a wide margin.
  const flameTex = flame();
  const flames = [];
  const FLAME_AT = [
    [-0.16, 0.2, 0.26],
    [-0.05, 0.28, 0.34],
    [0.07, 0.3, 0.32],
    [0.18, 0.21, 0.24],
    [0.0, 0.34, 0.2],
  ];
  FLAME_AT.forEach(([fx, fy, fw], i) => {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: flameTex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    s.position.set(fx, fy, DEPTH / 2 + 0.06);
    s.scale.set(fw, fw * 1.63, 1);
    s.renderOrder = 5;
    fire.add(s);
    flames.push({ s, phase: i * 1.7, w: fw, y: fy });
  });

  const fireLight = new THREE.PointLight(0xff7b2e, 2.8, 3.9, 2);
  fireLight.position.set(FIRE_X, 0.5, wallZ + 0.42);
  scene.add(fireLight);

  // mantel clutter: two candles and a framed something
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.018, 0.02, 0.12, 12), mat.plasticPale, FIRE_X + s * 0.52, OPEN_H + 0.43, wallZ + 0.19);
  }
  const shelfPic = add(B(0.2, 0.15, 0.012), mat.frame, FIRE_X + 0.32, OPEN_H + 0.45, wallZ + 0.14);
  shelfPic.rotation.y = -0.4;

  /* ------------------------------------------------------------------ *
   *  Sofa, facing the fire with its back to the table
   * ------------------------------------------------------------------ */
  const sofa = new THREE.Group();
  sofa.position.set(2.25, 0, -0.98);
  sofa.rotation.y = Math.PI + 0.22; // back to the table, facing the television
  group.add(sofa);

  add(B(1.75, 0.2, 0.86, 0.05), mat.sofaDark, 0, 0.26, 0, { parent: sofa });
  for (const s of [-1, 1]) {
    add(B(0.2, 0.34, 0.88, 0.075), mat.sofa, s * 0.775, 0.47, 0, { parent: sofa });
    const seat = add(B(0.76, 0.17, 0.74, 0.055), mat.sofa, s * 0.39, 0.44, 0.04, { parent: sofa });
    seat.rotation.x = 0.02;
    const back = add(B(0.76, 0.42, 0.18, 0.06), mat.sofa, s * 0.39, 0.66, -0.31, { parent: sofa });
    back.rotation.x = 0.16;
    for (const [lx, lz] of [[s * 0.76, 0.34], [s * 0.76, -0.34]]) {
      add(new THREE.CylinderGeometry(0.022, 0.016, 0.16, 10), mat.woodLeg, lx, 0.08, lz, { parent: sofa });
    }
  }
  add(B(1.75, 0.5, 0.16, 0.05), mat.sofaDark, 0, 0.7, -0.4, { parent: sofa });
  const pillow = add(B(0.3, 0.3, 0.11, 0.045), mat.cushion, -0.5, 0.6, -0.16, { parent: sofa });
  pillow.rotation.set(0.3, 0.2, 0.4);
  const pillow2 = add(B(0.28, 0.28, 0.1, 0.042), mat.cushion, 0.56, 0.58, -0.18, { parent: sofa });
  pillow2.rotation.set(-0.2, -0.3, -0.5);

  // a floor lamp at the end of the sofa, because one warm source is never enough
  const lamp = new THREE.Group();
  lamp.position.set(3.18, 0, -1.52);
  group.add(lamp);
  add(new THREE.CylinderGeometry(0.14, 0.16, 0.03, 16), mat.metal, 0, 0.015, 0, { parent: lamp });
  add(new THREE.CylinderGeometry(0.014, 0.014, 1.42, 10), mat.metal, 0, 0.71, 0, { parent: lamp });
  const shade = add(new THREE.CylinderGeometry(0.17, 0.21, 0.24, 20, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xd8c39a, roughness: 0.85, side: THREE.DoubleSide, emissive: 0xffc98a, emissiveIntensity: 0.5 }),
    0, 1.5, 0, { parent: lamp });
  shade.castShadow = false;
  const lampLight = new THREE.PointLight(0xffc07a, 1.5, 3.4, 2);
  lampLight.position.set(3.18, 1.44, -1.52);
  scene.add(lampLight);

  /* ------------------------------------------------------------------ *
   *  Television and its console
   * ------------------------------------------------------------------ */
  const tv = new THREE.Group();
  tv.position.set(2.3, 0, wallZ + 0.34);
  tv.rotation.y = -0.2;
  group.add(tv);

  // The console is taller than a console needs to be, on purpose: the sofa back
  // in front of it is 0.95 m, and the screen has to clear it from a camera that
  // is only a little above standing height.
  const DECK = 0.64;
  add(B(1.3, 0.06, 0.46), mat.plastic, 0, DECK, 0, { parent: tv });
  add(B(1.3, 0.05, 0.46), mat.plastic, 0, 0.3, 0, { parent: tv });
  for (const s of [-1, 1]) add(B(0.05, DECK, 0.46), mat.plastic, s * 0.625, DECK / 2, 0, { parent: tv });

  // the shelf: a console and a row of cases, the giveaway of the era
  add(B(0.36, 0.08, 0.28), mat.plasticPale, -0.3, 0.37, 0.04, { parent: tv });
  add(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 16), mat.plastic, -0.3, 0.42, 0.04, { parent: tv });
  const SPINES = [0x8c2f22, 0x2f5f8c, 0x2f8c55, 0xb08a2a, 0x6b3f8c, 0x8c4a2f];
  SPINES.forEach((col, i) => {
    const s = add(B(0.018, 0.17, 0.13), new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 }),
      0.18 + i * 0.023, 0.415, 0.02, { parent: tv });
    s.rotation.z = i === 5 ? 0.22 : 0;
  });

  const CRT_W = 0.74;
  const CRT_H = 0.58;
  const CRT_Y = DECK + 0.03 + CRT_H / 2;
  add(B(CRT_W, CRT_H, 0.56, 0.038), mat.plasticPale, 0, CRT_Y, -0.02, { parent: tv });
  add(B(CRT_W - 0.03, CRT_H - 0.03, 0.02, 0.03), mat.plastic, 0, CRT_Y, 0.265, { parent: tv });
  const screen = add(
    new THREE.PlaneGeometry(CRT_W - 0.14, CRT_H - 0.19),
    new THREE.MeshBasicMaterial({ map: tvScreen(), toneMapped: false }),
    0,
    CRT_Y + 0.02,
    0.277,
    { parent: tv, cast: false, receive: false }
  );
  screen.renderOrder = 1;
  for (let i = 0; i < 2; i++) {
    add(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 12), mat.plastic, 0.27 + i * 0.06, CRT_Y - 0.22, 0.272, {
      parent: tv,
    }).rotation.x = Math.PI / 2;
  }
  const tvGlow = new THREE.PointLight(0x86b4e8, 1.1, 3.2, 2);
  tvGlow.position.set(2.3, 1.25, wallZ + 0.9);
  scene.add(tvGlow);

  // a rug, so the floor between the sofa and the fire is not bare parquet
  const rug = add(
    new THREE.PlaneGeometry(2.3, 1.5),
    new THREE.MeshStandardMaterial({ ...weaveTex, color: 0x5c4030, normalScale: N(0.6), roughness: 0.95, envMapIntensity: 0.25 }),
    2.3,
    0.004,
    -1.02,
    { cast: false }
  );
  rug.rotation.x = -Math.PI / 2;
  rug.rotation.z = 0.08;


  /* ------------------------------------------------------------------ *
   *  Dressing
   *  The furniture says what the room is for; this says somebody lives
   *  in it. All of it sits inside the band the camera actually sweeps —
   *  roughly three metres either side of the table — because a detail
   *  outside the frame is only a draw call.
   * ------------------------------------------------------------------ */

  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x5b4634, roughness: 0.62, envMapIntensity: 0.7 });
  const fittingMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c6, roughness: 0.45, envMapIntensity: 1.1 });
  const paleMat = new THREE.MeshStandardMaterial({ color: 0xe9e3d4, roughness: 0.5, envMapIntensity: 1.1 });
  const BOOK_COLOURS = [0x7a3b2c, 0x2f5f8c, 0x3f6b46, 0xb08a2a, 0x5c3f70, 0x8c4a2f, 0x36505e, 0x8a7a4a];

  // A bookcase in the corner past the hearth.
  const bookcase = new THREE.Group();
  bookcase.position.set(-3.52, 0, wallZ + 0.17);  // directly under the left window
  bookcase.rotation.y = 0.07;
  group.add(bookcase);
  add(B(0.92, 0.04, 0.32), shelfMat, 0, 1.14, 0, { parent: bookcase });
  add(B(0.92, 0.04, 0.32), shelfMat, 0, 0.05, 0, { parent: bookcase });
  for (const s of [-1, 1]) add(B(0.04, 1.14, 0.32), shelfMat, s * 0.44, 0.57, 0, { parent: bookcase });
  // Every book on all three shelves is baked into a single mesh; they keep
  // their own colours through a vertex-colour attribute. Seventy meshes and
  // seventy materials become one of each.
  const bookParts = [];
  for (let shelf = 0; shelf < 3; shelf++) {
    const y = 0.07 + shelf * 0.345;
    add(B(0.86, 0.025, 0.3), shelfMat, 0, y + 0.31, 0, { parent: bookcase });
    let x = -0.4;
    while (x < 0.34) {
      const w = 0.018 + rand() * 0.024;
      const h = 0.18 + rand() * 0.095;
      bookParts.push({
        geometry: B(w, h, 0.2 + rand() * 0.07, 0.003),
        // one row has given up and started to lean
        matrix: at(x + w / 2, y + h / 2, 0.01, [0, 0, shelf === 1 && x > 0.18 ? 0.24 : 0]),
        colour: new THREE.Color(BOOK_COLOURS[Math.floor(rand() * BOOK_COLOURS.length)]),
      });
      x += w + 0.004;
    }
  }
  const books = new THREE.Mesh(
    mergeParts(bookParts, { colours: true }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, envMapIntensity: 0.6 })
  );
  books.castShadow = true;
  books.receiveShadow = true;
  bookcase.add(books);

  // The stack of boxes every table accumulates, on the floor beside it.
  const BOX_TOPS = [0x8c2f22, 0x2f5f8c, 0xb08a2a, 0x3f6b46];
  BOX_TOPS.forEach((col, i) => {
    const box = add(
      B(0.31 - i * 0.014, 0.055, 0.31 - i * 0.014),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, envMapIntensity: 0.7 }),
      -3.04,
      0.029 + i * 0.056,
      wallZ + 0.58,
      { receive: false }
    );
    box.rotation.y = 0.12 + i * 0.14;
  });

  // A clock on the chimney breast, reading twenty past eleven — which is when
  // a session is actually running.
  const clock = new THREE.Group();
  clock.position.set(FIRE_X, 1.96, wallZ + 0.35);
  group.add(clock);
  const clockParts = [
    { geometry: new THREE.CylinderGeometry(0.15, 0.15, 0.04, 26), matrix: at(0, 0, 0, [Math.PI / 2, 0, 0]) },
    { geometry: B(0.009, 0.086, 0.004), matrix: at(0.012, 0.037, 0.026, [0, 0, -0.3]) },
    { geometry: B(0.007, 0.112, 0.004), matrix: at(0.048, -0.03, 0.028, [0, 0, 2.1]) },
  ];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    clockParts.push({ geometry: B(0.008, 0.019, 0.003), matrix: at(Math.sin(a) * 0.112, Math.cos(a) * 0.112, 0.023, [0, 0, -a]) });
  }
  const clockBody = new THREE.Mesh(mergeParts(clockParts), mat.frame);
  clockBody.castShadow = true;
  clock.add(clockBody);
  add(new THREE.CircleGeometry(0.132, 26), paleMat, 0, 0, 0.021, { parent: clock, cast: false });

  // A dartboard beside the television, two darts still in it.
  const darts = new THREE.Group();
  darts.position.set(2.6, 1.76, wallZ + 0.02);
  group.add(darts);
  add(new THREE.CylinderGeometry(0.24, 0.24, 0.045, 28), mat.frame, 0, 0, 0, { parent: darts }).rotation.x = Math.PI / 2;
  // The four rings differ only in colour, so they bake into one mesh with a
  // colour per vertex rather than four meshes and four materials.
  const RINGS = [[0.215, 0x1d1a16, 0.024], [0.15, 0xc9b68a, 0.0255], [0.09, 0x8c2f22, 0.027], [0.028, 0x1d1a16, 0.0285]];
  const face = new THREE.Mesh(
    mergeParts(
      RINGS.map(([r, col, z]) => ({
        geometry: new THREE.CircleGeometry(r, 28),
        matrix: at(0, 0, z),
        colour: new THREE.Color(col),
      })),
      { colours: true }
    ),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })
  );
  darts.add(face);
  for (const [dx, dy, col] of [[0.06, 0.09, 0xc8342a], [-0.11, -0.05, 0x3fc4ff]]) {
    const dart = new THREE.Group();
    dart.position.set(dx, dy, 0.03);
    dart.rotation.set(0.35, 0.2, 0);
    darts.add(dart);
    add(new THREE.CylinderGeometry(0.004, 0.004, 0.07, 8), mat.metal, 0, 0, 0.035, { parent: dart }).rotation.x =
      Math.PI / 2;
    add(B(0.026, 0.026, 0.002), new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 }), 0, 0, 0.073, {
      parent: dart,
    });
  }

  // A switch and a socket. Nobody looks at these; a wall without them is
  // nonetheless a wall in a rendering rather than a wall in a house.
  add(B(0.09, 0.13, 0.014), fittingMat, -1.06, 1.16, wallZ + 0.012, { cast: false });
  add(B(0.03, 0.05, 0.009), fittingMat, -1.06, 1.185, wallZ + 0.021, { cast: false });
  add(B(0.11, 0.08, 0.014), fittingMat, -0.62, 0.21, wallZ + 0.012, { cast: false });

  // The cable run from the television down to it, never quite tidy.
  for (const [cx, drop, tilt] of [[1.93, 0.52, 0.07], [2.0, 0.44, -0.05]]) {
    const cable = add(new THREE.CylinderGeometry(0.006, 0.006, drop, 6), mat.plastic, cx, drop / 2, wallZ + 0.06, {
      cast: false,
      receive: false,
    });
    cable.rotation.z = tilt;
  }

  // Last night, on the floor by the sofa.
  const pizza = add(
    B(0.42, 0.055, 0.42, 0.01),
    new THREE.MeshStandardMaterial({ color: 0xc8a978, roughness: 0.85, envMapIntensity: 0.5 }),
    1.6,
    0.028,
    -0.66,
    { receive: false }
  );
  pizza.rotation.y = -0.4;
  const lid = add(
    B(0.42, 0.045, 0.42, 0.01),
    new THREE.MeshStandardMaterial({ color: 0xbe9e6d, roughness: 0.85, envMapIntensity: 0.5 }),
    1.63,
    0.062,
    -0.63,
    { receive: false }
  );
  lid.rotation.set(0, -0.32, 0.05);
  for (const [cx, cz, col] of [[1.34, -0.44, 0x2f5f8c], [1.45, -0.78, 0x8c2f22]]) {
    add(
      new THREE.CylinderGeometry(0.033, 0.033, 0.12, 14),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.3, metalness: 0.6, envMapIntensity: 1.5 }),
      cx,
      0.06,
      cz,
      { receive: false }
    );
  }

  // A bin by the table, and two attempts that did not go in.
  add(
    new THREE.CylinderGeometry(0.11, 0.085, 0.26, 14, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x4a4640,
      roughness: 0.5,
      metalness: 0.5,
      side: THREE.DoubleSide,
      envMapIntensity: 1.2,
    }),
    -1.66,
    0.13,
    0.46
  );
  for (const [px, pz] of [[-1.46, 0.32], [-1.82, 0.6]]) {
    add(
      new THREE.DodecahedronGeometry(0.036, 0),
      new THREE.MeshStandardMaterial({ color: 0xded5bf, roughness: 0.95, envMapIntensity: 0.4 }),
      px,
      0.033,
      pz,
      { receive: false }
    );
  }


  /* ------------------------------------------------------------------ *
   *  Windows
   *
   *  Two of them, flanking everything else on the back wall — which is
   *  where they fit, the middle three metres being fully spoken for by
   *  the chimney breast and the posters. They swing in and out of frame
   *  as the idle camera sweeps; most of the time what you see of them is
   *  the cool light they throw, which is the half that matters. A warm
   *  interior against a cold exterior is the oldest trick for making a
   *  room read as a place rather than a lit box.
   *
   *  They are real openings, not paintings: the wall in scene.js is a
   *  shape with these two rectangles cut out of it, so there is a jamb
   *  with depth and it moves against the view the way a reveal should.
   *  Nothing here joins `furniture` — a natural 1 throws the bookcase
   *  across the room, not the window frames.
   * ------------------------------------------------------------------ */
  const arch = new THREE.Group();
  scene.add(arch);

  const paintMat = new THREE.MeshStandardMaterial({
    color: 0xe4ded0,
    roughness: 0.52,
    envMapIntensity: 1.0,
    // The jamb faces away from every lamp in the room, so without a little of
    // its own light it renders as a black slot and the window loses its depth.
    emissive: 0x2b3444,
    emissiveIntensity: 0.55,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xaecbe4,
    roughness: 0.06,
    metalness: 0,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
    envMapIntensity: 2.4,
  });
  const blindMat = new THREE.MeshStandardMaterial({ color: 0xcfc3aa, roughness: 0.9, side: THREE.DoubleSide });

  const REVEAL = 0.17; // how far the glass sits behind the face of the wall
  const sills = [];

  WINDOWS.forEach((wdw, i) => {
    const { x: WX, y: WY, w: WW, h: WH } = wdw;
    const half = { w: WW / 2, h: WH / 2 };

    // What is out there. Same generator for both, shifted: two windows seven
    // metres apart on one wall look onto the same street, not onto two.
    const view = new THREE.Mesh(
      new THREE.PlaneGeometry(WW + 1.4, WH + 1.4),
      new THREE.MeshBasicMaterial({ map: nightView({ seed: 24 + i * 11, shift: i * 47, moon: i === 1 }), toneMapped: false })
    );
    view.position.set(WX, WY, wallZ - REVEAL - 0.04);
    arch.add(view);

    // Jamb, architrave, glazing bars and sill, all one material and all rigidly
    // fixed to each other, so they bake into a single mesh.
    const T = 0.03; // architrave thickness off the wall
    const parts = [];
    // the four faces of the reveal
    parts.push({ geometry: B(WW + 0.02, 0.02, REVEAL), matrix: at(WX, WY + half.h, wallZ - REVEAL / 2) });
    parts.push({ geometry: B(WW + 0.02, 0.02, REVEAL), matrix: at(WX, WY - half.h, wallZ - REVEAL / 2) });
    for (const s of [-1, 1]) {
      parts.push({ geometry: B(0.02, WH, REVEAL), matrix: at(WX + s * half.w, WY, wallZ - REVEAL / 2) });
    }
    // the architrave standing proud of the wall
    parts.push({ geometry: B(WW + 0.1, 0.065, T), matrix: at(WX, WY + half.h + 0.032, wallZ + T / 2) });
    parts.push({ geometry: B(WW + 0.1, 0.05, T), matrix: at(WX, WY - half.h - 0.025, wallZ + T / 2) });
    for (const s of [-1, 1]) {
      parts.push({ geometry: B(0.05, WH + 0.1, T), matrix: at(WX + s * (half.w + 0.025), WY, wallZ + T / 2) });
    }
    // glazing bars: a two-over-two casement, which is the era of the room
    parts.push({ geometry: B(0.022, WH, 0.03), matrix: at(WX, WY, wallZ - 0.03) });
    parts.push({ geometry: B(WW, 0.022, 0.03), matrix: at(WX, WY + 0.02, wallZ - 0.03) });
    // the sill, jutting into the room
    parts.push({ geometry: B(WW + 0.16, 0.028, 0.17, 0.006), matrix: at(WX, WY - half.h - 0.05, wallZ + 0.05) });

    const casing = new THREE.Mesh(mergeParts(parts), paintMat);
    casing.castShadow = true;
    casing.receiveShadow = true;
    arch.add(casing);

    const glass = new THREE.Mesh(new THREE.PlaneGeometry(WW, WH), glassMat);
    glass.position.set(WX, WY, wallZ - 0.028);
    glass.renderOrder = 2;
    arch.add(glass);

    // A roller blind, pulled down a different amount on each — nobody has ever
    // levelled two blinds in one room.
    const drop = 0.15 + i * 0.09;
    const blind = new THREE.Mesh(new THREE.PlaneGeometry(WW - 0.03, drop), blindMat);
    blind.position.set(WX, WY + half.h - drop / 2, wallZ - 0.06);
    arch.add(blind);
    const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, WW - 0.02, 10), blindMat);
    roller.rotation.z = Math.PI / 2;
    roller.position.set(WX, WY + half.h - 0.025, wallZ - 0.06);
    arch.add(roller);

    // The spill. Cool, and weak — this is a sky an hour after sunset, not a
    // window at noon. It has to lose to the pendant over the table and to the
    // fire, or the room stops being about the table.
    const sky = new THREE.PointLight(0x8fb2e0, 1.35, 3.4, 2);
    sky.position.set(WX, WY - 0.1, wallZ + 0.42);
    scene.add(sky);

    sills.push({ x: WX, y: WY - half.h - 0.036, z: wallZ + 0.06 });
  });

  /* ------------------------------------------------------------------ *
   *  Plants
   *
   *  A lot of them, on the floor, on the mantel, on the bookcase, on the
   *  console and on both sills. Foliage is the cheapest way to make a
   *  room look inhabited: it is the only thing in here whose silhouette
   *  nobody drew, so it breaks up the straight lines everything else is
   *  made of.
   *
   *  Each one is a pot plus exactly one canopy mesh — see js/plants.js
   *  for why. The ones standing on the floor go into `group`, so a
   *  natural 1 throws them with everything else; the ones standing on
   *  furniture are children of that furniture and fly with it.
   * ------------------------------------------------------------------ */
  const swaying = [];
  const potted = (kind, x, y, z, opts = {}) => {
    const p = plant(kind, opts);
    p.position.set(x, y, z);
    p.rotation.y = opts.spin ?? 0;
    (opts.parent ?? group).add(p);
    if (opts.sway) swaying.push({ p, phase: swaying.length * 2.1, amp: opts.sway });
    return p;
  };

  // Floor plants. The monstera fills the stretch of wall between the chimney
  // breast and the posters, which was the one blank patch behind the party; the
  // palm stands between the hearth and the table, where it reads against the
  // fire and gives the left of frame something with height in it.
  potted("monstera", -0.92, 0, -1.72, { r: 0.155, h: 0.21, scale: 1.05, seed: 11, sway: 0.012 });
  potted("palm", -1.86, 0, -0.66, { r: 0.155, h: 0.22, pot: "slate", scale: 0.72, seed: 23, sway: 0.01 });
  potted("fern", 1.32, 0, -1.74, { r: 0.14, h: 0.17, scale: 0.92, seed: 37, sway: 0.014 });
  potted("fern", 0.18, 0, -1.75, { r: 0.16, h: 0.2, pot: "cream", scale: 1.0, seed: 53, sway: 0.012 });

  // On the hearth, where a plant has no business being and always ends up.
  potted("herb", -1.62, 0.062, -1.44, { r: 0.075, h: 0.095, pot: "brass", scale: 0.85, seed: 67 });

  // Trailing off the end of the mantel.
  potted("pothos", -2.88, 1.472, wallZ + 0.36, { r: 0.085, h: 0.1, pot: "cream", scale: 1.0, seed: 79, fall: -0.6, sway: 0.02 });

  // On top of the bookcase, one of them hanging down over the books.
  potted("pothos", -0.3, 1.18, 0.09, { r: 0.08, h: 0.095, pot: "terracotta", scale: 1.15, seed: 91, parent: bookcase, fall: 0, sway: 0.022 });
  potted("herb", 0.28, 1.18, 0.13, { r: 0.07, h: 0.085, pot: "slate", scale: 0.9, seed: 103, parent: bookcase });

  // On the television console, beside the case of discs.
  potted("succulent", 0.5, 0.7, 0.08, { r: 0.065, h: 0.07, pot: "cream", scale: 1.0, seed: 117, parent: tv });

  // Both windowsills. This is the one place in a room where everybody puts a
  // plant, so leaving them bare would be the thing that looked wrong.
  sills.forEach((s, i) => {
    potted("herb", s.x - 0.3, s.y, s.z + 0.02, { r: 0.065, h: 0.08, pot: "terracotta", scale: 0.85, seed: 131 + i * 7 });
    potted("succulent", s.x + 0.02, s.y, s.z + 0.02, { r: 0.055, h: 0.06, pot: "cream", scale: 0.85, seed: 149 + i * 7 });
    // Only the right window gets a trailing one. The left sill has the top of
    // the bookcase ten centimetres under it, so anything hanging off it hangs
    // through three shelves of books — measured, not guessed.
    if (i === 1) {
      potted("pothos", s.x + 0.33, s.y, s.z + 0.02, { r: 0.07, h: 0.085, pot: "slate", scale: 0.9, seed: 163, fall: 0, sway: 0.018 });
    } else {
      potted("succulent", s.x + 0.3, s.y, s.z + 0.02, { r: 0.06, h: 0.07, pot: "slate", scale: 0.95, seed: 163 });
    }
  });


  // Hung from the ceiling, which is above the top of frame — the cord runs up
  // out of shot. Three strings to a ring and then one cord up, which is how a
  // macramé hanger is actually made and the only version that reads at a
  // glance. These two matter more than their size: foliage in the top corners
  // is what stops the wide shot looking like a diorama with nothing above it.
  const cordMat = new THREE.MeshStandardMaterial({ color: 0x8a7a5e, roughness: 0.93, envMapIntensity: 0.4 });
  const hung = (kind, x, y, z, opts = {}) => {
    const p = potted(kind, x, y, z, opts);
    const rad = (opts.r ?? 0.08) * 1.07;
    const RING = 0.44;
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      const foot = new THREE.Vector3(Math.sin(a) * rad, (opts.h ?? 0.1) * 0.75, Math.cos(a) * rad);
      const d = new THREE.Vector3(0, RING, 0).sub(foot);
      const str = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, d.length(), 5), cordMat);
      str.position.copy(foot).addScaledVector(d, 0.5);
      str.quaternion.setFromUnitVectors(up, d.clone().normalize());
      p.add(str);
    }
    const rise = 2.9 - y - RING;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, rise, 6), cordMat);
    stalk.position.y = RING + rise / 2;
    p.add(stalk);
    return p;
  };

  hung("pothos", -1.42, 1.94, -1.05, { r: 0.085, h: 0.1, pot: "terracotta", scale: 1.15, seed: 181, sway: 0.026 });
  hung("pothos", 1.82, 2.0, -1.0, { r: 0.08, h: 0.095, pot: "cream", scale: 0.95, seed: 197, sway: 0.03 });

  // On top of the television, which is where one always ends up, and on its
  // lower shelf beside the discs.
  potted("herb", -0.18, 1.25, -0.02, { r: 0.075, h: 0.09, pot: "terracotta", scale: 0.95, seed: 211, parent: tv });
  potted("succulent", 0.42, 0.328, 0.05, { r: 0.05, h: 0.055, pot: "slate", scale: 0.8, seed: 223, parent: tv });

  // A second one on the mantel, standing between the candles.
  potted("succulent", -2.22, 1.472, wallZ + 0.2, { r: 0.06, h: 0.07, pot: "brass", scale: 0.9, seed: 229 });

  // A third on the bookcase top, in front of the sill rather than under it.
  potted("succulent", 0.02, 1.18, 0.06, { r: 0.06, h: 0.07, pot: "cream", scale: 0.95, seed: 233, parent: bookcase });

  // Standing in the corner under the right-hand window, past the floor lamp.
  potted("fern", 3.55, 0, -1.78, { r: 0.155, h: 0.19, scale: 1.0, seed: 239, sway: 0.013 });

  // Two more on the floor behind the party: the wall between the fireplace and
  // the television is the stretch the camera sweeps across most, and it was
  // still the emptiest thing in the frame.
  potted("herb", -0.42, 0, -1.94, { r: 0.115, h: 0.14, pot: "slate", scale: 1.3, seed: 251, sway: 0.016 });
  potted("fern", 0.78, 0, -1.85, { r: 0.1, h: 0.125, pot: "brass", scale: 0.62, seed: 263, sway: 0.015 });

  /* ------------------------------------------------------------------ *
   *  Animation
   * ------------------------------------------------------------------ */
  const update = (t) => {
    // Two sine waves at unrelated rates beat against each other, so the flicker
    // never settles into a visible loop.
    const beat = Math.sin(t * 9.1) * 0.5 + Math.sin(t * 5.3) * 0.32 + Math.sin(t * 17.7) * 0.18;
    for (const f of flames) {
      const w = Math.sin(t * 7.4 + f.phase) * 0.5 + Math.sin(t * 12.1 + f.phase * 2) * 0.3;
      // Height moves more than width, and the sprite grows upward from its base
      // rather than about its centre — a flame does not get shorter at the bottom.
      const hh = f.w * 1.63 * (0.82 + w * 0.34);
      f.s.scale.set(f.w * (0.92 + w * 0.14), hh, 1);
      f.s.position.y = f.y - f.w * 1.63 * 0.5 + hh * 0.5;
      f.s.material.opacity = 0.78 + w * 0.18;
    }
    // The canopies are single merged meshes, so no leaf can move on its own.
    // The whole plant leaning a fraction of a degree is enough — still air in a
    // lived-in room is what this is, not wind.
    for (const s of swaying) {
      s.p.rotation.z = Math.sin(t * 0.62 + s.phase) * s.amp;
      s.p.rotation.x = Math.sin(t * 0.47 + s.phase * 1.7) * s.amp * 0.7;
    }
    fireLight.intensity = 2.8 + beat * 0.6;
    tvGlow.intensity = 0.82 + Math.sin(t * 23.0) * 0.12 + Math.sin(t * 3.1) * 0.06;
  };

  const furniture = group.children.slice();

  /* ------------------------------------------------------------------ *
   *  Contact
   *  A soft dark quad under everything that stands on the floor. This is
   *  the oldest trick there is and it is here because the modern answer
   *  is not affordable: an ambient-occlusion pass costs ten times the
   *  frame at this mesh count (55 fps down to 5), all of it in the
   *  second pass it makes over the scene. See js/watercolour.js.
   *
   *  It earns its place. The pendant is a spot aimed at the table, so
   *  nothing on the floor casts a shadow at all, and furniture without a
   *  shadow does not sit on the floor — it hovers a little above it.
   * ------------------------------------------------------------------ */
  const blobTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, "rgba(0,0,0,0.62)");
    g.addColorStop(0.45, "rgba(0,0,0,0.42)");
    g.addColorStop(0.8, "rgba(0,0,0,0.1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();

  const contact = new THREE.Group();
  scene.add(contact);
  const bounds = new THREE.Box3();
  for (const item of furniture) {
    bounds.setFromObject(item);
    if (!isFinite(bounds.min.y) || bounds.min.y > 0.42) continue; // hangs on a wall
    const w = bounds.max.x - bounds.min.x;
    const d = bounds.max.z - bounds.min.z;
    if (w > 4 || d > 4 || w < 0.04) continue; // the rug is its own floor
    const blob = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 1.5, d * 1.5),
      new THREE.MeshBasicMaterial({
        map: blobTex,
        transparent: true,
        depthWrite: false,
        // Fainter the further the object's underside is off the floor, which
        // is what a real contact shadow does as the gap opens.
        opacity: 0.9 * Math.max(0.25, 1 - Math.max(0, bounds.min.y) * 3),
      })
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.set((bounds.min.x + bounds.max.x) / 2, 0.006, (bounds.min.z + bounds.max.z) / 2);
    blob.renderOrder = -1;
    contact.add(blob);
  }

  // Everything loose in the room, as its own rigid body. The lights are not in
  // here on purpose: a natural 1 throws the furniture about, and a fireplace
  // whose glow flew across the room with it would read as a bug. Nor are the
  // contact shadows — they are hidden while the furniture is in the air.
  return { update, fireLight, furniture, contact };
}
