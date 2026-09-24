// The board in the middle of the table.
//
// A printed map on its own is a picture; what makes it a board is that things
// stand on it. So this builds the tray, lays the map into it, and then reads
// MAP_PLAN — the same numbers the map was drawn from — to stand terrain on the
// features it drew: trees inside the forests, a tower on the keep, a bridge
// where the road crosses the river.
//
// Everything repeated is an InstancedMesh. Sixty trees as sixty meshes would be
// sixty draw calls for scenery nobody looks at closely; as two instanced meshes
// it is two.

import * as THREE from "three";
import { MAP_PLAN, fantasyMap } from "./textures.js";
import { roundedBox } from "./shapes.js";
import { mergeParts, at } from "./merge.js";

const N = (x, y = x) => new THREE.Vector2(x, y);

export function createBoard(scene, { cx = 0.1, cz = -0.05, w = 0.84, d = 0.6, y = 0.76 } = {}) {
  const group = new THREE.Group();
  scene.add(group);

  // Normalised map coordinates to world. Canvas v runs down the image, which is
  // the direction of increasing z once the map is laid flat, so no flip.
  const X = (u) => cx + (u - 0.5) * w;
  const Z = (v) => cz + (v - 0.5) * d;
  // A millimetre and a half above the tray's felt, which is itself below the
  // lip. Flat surfaces on this table are spaced deliberately, not stacked at
  // whatever height each one happened to be written at.
  const SURFACE = y + 0.005;

  const rand = (() => {
    let s = 20260918 >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
  })();

  // ---------- Tray ----------
  // A shallow wooden lip. It is what turns "a sheet of paper" into "a board":
  // the map now has an edge that belongs to it rather than to the table.
  const LIP = 0.018;
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3d26, roughness: 0.48, envMapIntensity: 0.9 });
  const felt = new THREE.MeshStandardMaterial({ color: 0x2c2118, roughness: 0.95, envMapIntensity: 0.2 });

  const rail = (rw, rd, rx, rz) => {
    const m = new THREE.Mesh(roundedBox(rw, 0.014, rd, 0.004), wood);
    m.position.set(rx, y + 0.007, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  };
  rail(w + LIP * 2, LIP, cx, cz - d / 2 - LIP / 2);
  rail(w + LIP * 2, LIP, cx, cz + d / 2 + LIP / 2);
  rail(LIP, d, cx - w / 2 - LIP / 2, cz);
  rail(LIP, d, cx + w / 2 + LIP / 2, cz);

  // Its top sits half a millimetre under the map. Centred on y + 0.003 with a
  // 6 mm box, as it was first written, the felt's top face lands above the map
  // and hides it completely.
  const base = new THREE.Mesh(roundedBox(w + LIP * 2, 0.005, d + LIP * 2, 0.002), felt);
  base.position.set(cx, y + 0.001, cz);
  base.receiveShadow = true;
  group.add(base);

  const mapMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ ...fantasyMap(), normalScale: N(0.3), envMapIntensity: 0.45 })
  );
  mapMesh.rotation.x = -Math.PI / 2;
  mapMesh.position.set(cx, SURFACE, cz);
  mapMesh.receiveShadow = true;
  group.add(mapMesh);

  // ---------- Instanced scenery ----------
  const place = (mesh, i, px, py, pz, s, rotY = 0, tilt = 0) => {
    const m = new THREE.Matrix4();
    m.compose(
      new THREE.Vector3(px, py, pz),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, rotY, tilt * 0.6)),
      new THREE.Vector3(s, s, s)
    );
    mesh.setMatrixAt(i, m);
  };

  // Where the trees go: sampled inside each forest disc, but pushed off the
  // roads, because a wood that grows across the road it is drawn beside is the
  // kind of detail that quietly ruins the illusion.
  const ROADS = MAP_PLAN.roads.flat().concat(MAP_PLAN.river);
  const clearOfPaths = (u, v) => ROADS.every(([ru, rv]) => Math.hypot(u - ru, v - rv) > 0.035);

  const spots = [];
  for (const f of MAP_PLAN.forests) {
    const n = Math.round(f.r * 115);
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const dd = Math.sqrt(rand()) * f.r * 0.92;
      const u = f.at[0] + Math.cos(a) * dd;
      const v = f.at[1] + Math.sin(a) * dd * 1.2;
      if (u < 0.02 || u > 0.98 || v < 0.02 || v > 0.98 || !clearOfPaths(u, v)) continue;
      spots.push([u, v, 0.8 + rand() * 0.55]);
    }
  }

  const barkMat = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.9, envMapIntensity: 0.3 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f5a35, roughness: 0.82, envMapIntensity: 0.35 });
  const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x4f6a3c, roughness: 0.82, envMapIntensity: 0.35 });

  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0022, 0.0032, 0.016, 5), barkMat, spots.length);
  const crownA = new THREE.InstancedMesh(new THREE.ConeGeometry(0.0125, 0.026, 7), leafMat, spots.length);
  const crownB = new THREE.InstancedMesh(new THREE.ConeGeometry(0.009, 0.02, 7), leafMat2, spots.length);
  for (const m of [trunks, crownA, crownB]) {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  spots.forEach(([u, v, s], i) => {
    const px = X(u);
    const pz = Z(v);
    const r = rand() * Math.PI;
    place(trunks, i, px, SURFACE + 0.008 * s, pz, s, r);
    place(crownA, i, px, SURFACE + 0.024 * s, pz, s, r);
    place(crownB, i, px, SURFACE + 0.04 * s, pz, s, r);
  });

  // Mountain crags along the drawn ridge, plus scree scattered below it.
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6d6459, roughness: 0.88, envMapIntensity: 0.4 });
  const crags = [];
  for (const [u, v] of MAP_PLAN.mountains) crags.push([u, v, 0.9 + rand() * 0.5]);
  for (const [u, v] of MAP_PLAN.hills) crags.push([u, v, 0.5 + rand() * 0.2]);
  for (let i = 0; i < 16; i++) {
    const [u, v] = MAP_PLAN.mountains[Math.floor(rand() * MAP_PLAN.mountains.length)];
    crags.push([u + (rand() - 0.5) * 0.09, v + (rand() - 0.5) * 0.07, 0.25 + rand() * 0.3]);
  }
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.022, 0), rockMat, crags.length);
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  group.add(rocks);
  crags.forEach(([u, v, s], i) =>
    place(rocks, i, X(u), SURFACE + 0.013 * s, Z(v), s, rand() * Math.PI, (rand() - 0.5) * 0.4)
  );

  // ---------- Single pieces ----------
  const solid = (geo, mat, px, py, pz, rotY = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz);
    m.rotation.y = rotY;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9a9184, roughness: 0.82, envMapIntensity: 0.45 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x7a3b2c, roughness: 0.7, envMapIntensity: 0.5 });
  const plankMat = new THREE.MeshStandardMaterial({ color: 0x6b4c30, roughness: 0.8, envMapIntensity: 0.4 });

  // Everything built on the map is static relative to the board, so it is baked
  // down to one mesh per material: stone, roof and plank. Ninety-odd little
  // meshes — battlements, wall segments, roofs, standing stones, ruin blocks —
  // become three.
  const stoneParts = [];
  const roofParts = [];
  const plankParts = [];

  // the keep at Highmark: a round tower with battlements and a spire
  const keep = MAP_PLAN.towns.find((t) => t.kind === "keep");
  const kx = X(keep.at[0]);
  const kz = Z(keep.at[1]);
  stoneParts.push(
    { geometry: new THREE.CylinderGeometry(0.019, 0.023, 0.062, 14), matrix: at(kx, SURFACE + 0.031, kz) },
    { geometry: new THREE.CylinderGeometry(0.024, 0.024, 0.008, 14), matrix: at(kx, SURFACE + 0.066, kz) }
  );
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    stoneParts.push({
      geometry: roundedBox(0.007, 0.009, 0.007, 0.0015, 2),
      matrix: at(kx + Math.cos(a) * 0.021, SURFACE + 0.0745, kz + Math.sin(a) * 0.021, [0, -a, 0]),
    });
  }
  roofParts.push({ geometry: new THREE.ConeGeometry(0.016, 0.03, 12), matrix: at(kx, SURFACE + 0.094, kz) });

  // the walled town at Ravensmoor: a ring of wall, a gate, roofs inside
  const town = MAP_PLAN.towns.find((t) => t.kind === "town");
  const tx = X(town.at[0]);
  const tz = Z(town.at[1]);
  for (let i = 0; i < 12; i++) {
    if (i === 3) continue; // the gate
    const a = (i / 12) * Math.PI * 2;
    stoneParts.push({
      geometry: roundedBox(0.014, 0.018, 0.006, 0.0015, 2),
      matrix: at(tx + Math.cos(a) * 0.028, SURFACE + 0.009, tz + Math.sin(a) * 0.028, [0, -a + Math.PI / 2, 0]),
    });
  }
  for (const [ox, oz, sc] of [[-0.008, -0.004, 1], [0.007, 0.006, 0.85], [0.002, -0.011, 0.75]]) {
    plankParts.push({ geometry: roundedBox(0.013 * sc, 0.011, 0.013 * sc, 0.0015, 2), matrix: at(tx + ox, SURFACE + 0.0055, tz + oz) });
    roofParts.push({ geometry: new THREE.ConeGeometry(0.011 * sc, 0.009, 4), matrix: at(tx + ox, SURFACE + 0.0155, tz + oz, [0, Math.PI / 4, 0]) });
  }

  // the village at Tallow: three roofs, no wall
  const vil = MAP_PLAN.towns.find((t) => t.kind === "village");
  for (let i = 0; i < 3; i++) {
    const vx = X(vil.at[0]) + (i - 1) * 0.014;
    const vz = Z(vil.at[1]) + (i % 2) * 0.011;
    plankParts.push({ geometry: roundedBox(0.012, 0.01, 0.012, 0.0015, 2), matrix: at(vx, SURFACE + 0.005, vz) });
    roofParts.push({ geometry: new THREE.ConeGeometry(0.0105, 0.008, 4), matrix: at(vx, SURFACE + 0.014, vz, [0, Math.PI / 4, 0]) });
  }

  // standing stones, and the ruin the party is presumably headed for
  const [su, sv] = MAP_PLAN.stones;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    stoneParts.push({
      geometry: roundedBox(0.005, 0.019, 0.004, 0.0015, 2),
      matrix: at(X(su) + Math.cos(a) * 0.017, SURFACE + 0.0095, Z(sv) + Math.sin(a) * 0.013, [0, -a, (rand() - 0.5) * 0.18]),
    });
  }
  const [ru, rv] = MAP_PLAN.ruin;
  for (let i = 0; i < 5; i++) {
    const h = 0.008 + rand() * 0.018;
    stoneParts.push({
      geometry: roundedBox(0.009, h, 0.007, 0.0015, 2),
      matrix: at(X(ru) + (i - 2) * 0.011, SURFACE + h / 2, Z(rv) + (rand() - 0.5) * 0.016, [0, rand() * 0.5, 0]),
    });
  }

  for (const [parts, material] of [[stoneParts, stoneMat], [roofParts, roofMat], [plankParts, plankMat]]) {
    const m = new THREE.Mesh(mergeParts(parts), material);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }

  // the bridge, standing over the river at the point the road crosses it
  const [bu, bv] = MAP_PLAN.bridge;
  const bx = X(bu);
  const bz = Z(bv);
  // Built in its own group so the railings and piers are placed in the bridge's
  // own axes; laying them out in world coordinates around a rotation is how you
  // end up with a handrail floating beside the deck.
  const bridge = new THREE.Group();
  bridge.position.set(bx, SURFACE, bz);
  bridge.rotation.y = -0.72; // along the road, across the river
  group.add(bridge);
  const part = (geo, mat, px, py, pz) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz);
    m.castShadow = true;
    m.receiveShadow = true;
    bridge.add(m);
    return m;
  };
  part(roundedBox(0.052, 0.004, 0.018, 0.0015, 2), plankMat, 0, 0.008, 0);
  for (const s of [-1, 1]) {
    part(roundedBox(0.05, 0.005, 0.002, 0.0015, 2), plankMat, 0, 0.0125, s * 0.008);
    part(roundedBox(0.009, 0.009, 0.022, 0.0015, 2), stoneMat, s * 0.026, 0.004, 0);
  }

  // ---------- Miniatures ----------
  // Painted metal on a round base: a slotted base, a cloak, a head, and a spear
  // or banner in the party's colour, so you can tell whose is whose at a glance.
  //
  // All seven are baked into one mesh. They differ only in colour, and a colour
  // per vertex carries that — fifty-six little meshes and fourteen materials
  // become one of each.
  const DARK = new THREE.Color(0x23201c);
  const miniParts = [];
  const mini = (colour, u, v, tall = 1, foe = false) => {
    const stand = new THREE.Matrix4().compose(
      new THREE.Vector3(X(u), SURFACE, Z(v)),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rand() * Math.PI * 2, 0)),
      new THREE.Vector3(1, 1, 1)
    );
    const cloak = colour.clone().multiplyScalar(0.62);
    const push = (geometry, colour2, x, y, z, rot = [0, 0, 0]) =>
      miniParts.push({ geometry, colour: colour2, matrix: stand.clone().multiply(at(x, y, z, rot)) });

    push(new THREE.CylinderGeometry(0.0105, 0.0115, 0.0035, 18), DARK, 0, 0.0018, 0);
    push(new THREE.CylinderGeometry(0.0088, 0.0098, 0.0012, 18), colour, 0, 0.0041, 0);
    push(new THREE.CapsuleGeometry(0.0052, 0.016 * tall, 4, 10), colour, 0, 0.0145 * tall, 0);
    // the cloak: a cone open at the bottom reads as cloth without a cloth sim
    push(new THREE.ConeGeometry(0.0082, 0.019 * tall, 10, 1, true), cloak, 0, 0.0135 * tall, -0.0022);
    push(new THREE.SphereGeometry(0.0046, 12, 10), DARK, 0, 0.0262 * tall, 0.0006);
    push(new THREE.CylinderGeometry(0.0009, 0.0009, 0.034 * tall, 6), DARK, 0.008, 0.019 * tall, 0.002, [0, 0, -0.12]);
    if (foe) push(new THREE.ConeGeometry(0.0026, 0.007, 6), DARK, 0.0095, 0.037 * tall, 0.002);
    else push(new THREE.PlaneGeometry(0.009, 0.007), colour, 0.0125, 0.033 * tall, 0.002);
  };

  return {
    mapMesh,
    /** Stand one miniature per party member, and what is waiting for them. */
    populate(party) {
      party.slice(0, 4).forEach((a, i) => {
        const [u, v] = MAP_PLAN.party[i];
        mini(new THREE.Color(a.colour), u, v, 1);
      });
      MAP_PLAN.foes.forEach(([u, v], i) => mini(new THREE.Color(0x8c2f22), u, v, i === 0 ? 1.35 : 1.05, true));

      const figures = new THREE.Mesh(
        mergeParts(miniParts, { colours: true }),
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.4,
          metalness: 0.2,
          envMapIntensity: 1.3,
          // the cloaks and the banners are open surfaces
          side: THREE.DoubleSide,
        })
      );
      figures.castShadow = true;
      group.add(figures);
    },
  };
}
