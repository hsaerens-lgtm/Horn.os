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
import { poster, brick, weave, tvScreen, flame } from "./textures.js";
import { roundedBox } from "./shapes.js";

const N = (x, y = x) => new THREE.Vector2(x, y);

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
  const POSTERS = [
    { kind: "code", x: -1.72, y: 1.94, tilt: 0.015, framed: true },
    { kind: "y2k", x: -0.86, y: 1.99, tilt: -0.03, framed: false },
    { kind: "arcade", x: 0.02, y: 1.92, tilt: 0.022, framed: false },
    { kind: "lan", x: 0.88, y: 1.99, tilt: -0.014, framed: true },
    { kind: "skate", x: 1.76, y: 1.93, tilt: 0.034, framed: false },
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
    fireLight.intensity = 2.8 + beat * 0.6;
    tvGlow.intensity = 0.82 + Math.sin(t * 23.0) * 0.12 + Math.sin(t * 3.1) * 0.06;
  };

  return { update, fireLight };
}
