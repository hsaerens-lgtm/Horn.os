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

const N = (x, y = x) => new THREE.Vector2(x, y);

export function createBoard(scene, { cx = 0.1, cz = -0.05, w = 0.84, d = 0.6, y = 0.76 } = {}) {
  const group = new THREE.Group();
  scene.add(group);

  // Normalised map coordinates to world. Canvas v runs down the image, which is
  // the direction of increasing z once the map is laid flat, so no flip.
  const X = (u) => cx + (u - 0.5) * w;
  const Z = (v) => cz + (v - 0.5) * d;
  const SURFACE = y + 0.004;

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
    const m = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.014, rd), wood);
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
  const base = new THREE.Mesh(new THREE.BoxGeometry(w + LIP * 2, 0.005, d + LIP * 2), felt);
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
    const n = Math.round(f.r * 135);
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

  // the keep at Highmark: a round tower with battlements and a spire
  const keep = MAP_PLAN.towns.find((t) => t.kind === "keep");
  const kx = X(keep.at[0]);
  const kz = Z(keep.at[1]);
  solid(new THREE.CylinderGeometry(0.019, 0.023, 0.062, 14), stoneMat, kx, SURFACE + 0.031, kz);
  solid(new THREE.CylinderGeometry(0.024, 0.024, 0.008, 14), stoneMat, kx, SURFACE + 0.066, kz);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    solid(
      new THREE.BoxGeometry(0.007, 0.009, 0.007),
      stoneMat,
      kx + Math.cos(a) * 0.021,
      SURFACE + 0.0745,
      kz + Math.sin(a) * 0.021,
      -a
    );
  }
  solid(new THREE.ConeGeometry(0.016, 0.03, 12), roofMat, kx, SURFACE + 0.094, kz);

  // the walled town at Ravensmoor: a ring of wall, a gate, roofs inside
  const town = MAP_PLAN.towns.find((t) => t.kind === "town");
  const tx = X(town.at[0]);
  const tz = Z(town.at[1]);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    if (i === 3) continue; // the gate
    solid(
      new THREE.BoxGeometry(0.014, 0.018, 0.006),
      stoneMat,
      tx + Math.cos(a) * 0.028,
      SURFACE + 0.009,
      tz + Math.sin(a) * 0.028,
      -a + Math.PI / 2
    );
  }
  for (const [ox, oz, s] of [[-0.008, -0.004, 1], [0.007, 0.006, 0.85], [0.002, -0.011, 0.75]]) {
    solid(new THREE.BoxGeometry(0.013 * s, 0.011, 0.013 * s), plankMat, tx + ox, SURFACE + 0.0055, tz + oz);
    solid(new THREE.ConeGeometry(0.011 * s, 0.009, 4), roofMat, tx + ox, SURFACE + 0.0155, tz + oz, Math.PI / 4);
  }

  // the village at Tallow: three roofs, no wall
  const vil = MAP_PLAN.towns.find((t) => t.kind === "village");
  for (let i = 0; i < 3; i++) {
    const vx = X(vil.at[0]) + (i - 1) * 0.014;
    const vz = Z(vil.at[1]) + (i % 2) * 0.011;
    solid(new THREE.BoxGeometry(0.012, 0.01, 0.012), plankMat, vx, SURFACE + 0.005, vz);
    solid(new THREE.ConeGeometry(0.0105, 0.008, 4), roofMat, vx, SURFACE + 0.014, vz, Math.PI / 4);
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
  part(new THREE.BoxGeometry(0.052, 0.004, 0.018), plankMat, 0, 0.008, 0);
  for (const s of [-1, 1]) {
    part(new THREE.BoxGeometry(0.05, 0.005, 0.002), plankMat, 0, 0.0125, s * 0.008);
    part(new THREE.BoxGeometry(0.009, 0.009, 0.022), stoneMat, s * 0.026, 0.004, 0);
  }

  // standing stones, and the ruin the party is presumably headed for
  const [su, sv] = MAP_PLAN.stones;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    solid(
      new THREE.BoxGeometry(0.005, 0.019, 0.004),
      stoneMat,
      X(su) + Math.cos(a) * 0.017,
      SURFACE + 0.0095,
      Z(sv) + Math.sin(a) * 0.013,
      -a
    ).rotation.z = (rand() - 0.5) * 0.18;
  }
  const [ru, rv] = MAP_PLAN.ruin;
  for (let i = 0; i < 5; i++) {
    const h = 0.008 + rand() * 0.018;
    solid(
      new THREE.BoxGeometry(0.009, h, 0.007),
      stoneMat,
      X(ru) + (i - 2) * 0.011,
      SURFACE + h / 2,
      Z(rv) + (rand() - 0.5) * 0.016,
      rand() * 0.5
    );
  }

  // ---------- Miniatures ----------
  // Painted metal on a round base: a slotted base, a cloak, a head, and a spear
  // or banner in the party's colour, so you can tell whose is whose at a glance.
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x23201c, roughness: 0.55, metalness: 0.2, envMapIntensity: 0.9 });
  const mini = (colour, u, v, tall = 1, foe = false) => {
    const g = new THREE.Group();
    g.position.set(X(u), SURFACE, Z(v));
    g.rotation.y = rand() * Math.PI * 2;
    group.add(g);

    const body = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.34, metalness: 0.25, envMapIntensity: 1.5 });
    const add = (geo, mat, px, py, pz) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(px, py, pz);
      m.castShadow = true;
      g.add(m);
      return m;
    };
    add(new THREE.CylinderGeometry(0.0105, 0.0115, 0.0035, 18), baseMat, 0, 0.0018, 0);
    add(new THREE.CylinderGeometry(0.0088, 0.0098, 0.0012, 18), body, 0, 0.0041, 0);
    add(new THREE.CapsuleGeometry(0.0052, 0.016 * tall, 4, 10), body, 0, 0.0145 * tall, 0);
    // the cloak: a cone open at the bottom reads as cloth without a cloth sim
    const cloakMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colour).multiplyScalar(0.62),
      roughness: 0.62,
      side: THREE.DoubleSide,
      envMapIntensity: 0.9,
    });
    add(new THREE.ConeGeometry(0.0082, 0.019 * tall, 10, 1, true), cloakMat, 0, 0.0135 * tall, -0.0022);
    add(new THREE.SphereGeometry(0.0046, 12, 10), baseMat, 0, 0.0262 * tall, 0.0006);
    const pole = add(new THREE.CylinderGeometry(0.0009, 0.0009, 0.034 * tall, 6), baseMat, 0.008, 0.019 * tall, 0.002);
    pole.rotation.z = -0.12;
    if (foe) {
      add(new THREE.ConeGeometry(0.0026, 0.007, 6), baseMat, 0.0095, 0.037 * tall, 0.002);
    } else {
      const flag = add(new THREE.PlaneGeometry(0.009, 0.007), body, 0.0125, 0.033 * tall, 0.002);
      flag.material = new THREE.MeshStandardMaterial({ color: colour, side: THREE.DoubleSide, roughness: 0.6 });
    }
    return g;
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
    },
  };
}
