// What each player has brought to the table.
//
// A table with nothing personal on it reads as a showroom. One small object in
// front of each player does more for "a session is happening here" than another
// pass on the figures would: a mug half drunk, a dice cup, a rolled map, a
// notepad with a pencil across it.
//
// Each prop is matched to its agent rather than dealt out at random — the
// platform that runs overnight gets the coffee, the navigator gets the map —
// and each carries that agent's colour somewhere, so the object and the player
// behind it belong to each other.

import * as THREE from "three";
import { roundedBox } from "./shapes.js";

export function createProps(scene, { tableY = 0.76 } = {}) {
  const group = new THREE.Group();
  scene.add(group);

  const mat = {
    ceramic: new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.35, envMapIntensity: 1.3 }),
    coffee: new THREE.MeshStandardMaterial({ color: 0x2a1408, roughness: 0.18, envMapIntensity: 1.6 }),
    leather: new THREE.MeshStandardMaterial({ color: 0x5c3a24, roughness: 0.72, envMapIntensity: 0.6 }),
    paper: new THREE.MeshStandardMaterial({ color: 0xdfd6c0, roughness: 0.92, envMapIntensity: 0.4 }),
    card: new THREE.MeshStandardMaterial({ color: 0xc8bda2, roughness: 0.9, envMapIntensity: 0.35 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x8a6134, roughness: 0.6, envMapIntensity: 0.7 }),
    graphite: new THREE.MeshStandardMaterial({ color: 0x2a2c31, roughness: 0.5, envMapIntensity: 0.9 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xb08a2a, roughness: 0.3, metalness: 0.8, envMapIntensity: 1.6 }),
    string: new THREE.MeshStandardMaterial({ color: 0x8a7a5c, roughness: 0.9 }),
  };

  const add = (g, geo, m, x, y, z, rot = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.rotation.set(...rot);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };

  /** A mug, drunk about half way down. */
  const mug = (g, accent) => {
    const body = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.3, envMapIntensity: 1.4 });
    add(g, new THREE.CylinderGeometry(0.032, 0.028, 0.082, 20, 1, true), body, 0, 0.041, 0);
    add(g, new THREE.CylinderGeometry(0.028, 0.028, 0.004, 20), mat.ceramic, 0, 0.002, 0);
    // the coffee sits below the rim, which is the whole point of drawing it
    add(g, new THREE.CircleGeometry(0.03, 20), mat.coffee, 0, 0.056, 0, [-Math.PI / 2, 0, 0]);
    const handle = add(g, new THREE.TorusGeometry(0.021, 0.0065, 8, 16, Math.PI * 1.1), body, 0.033, 0.046, 0, [0, Math.PI / 2, -0.4]);
    handle.castShadow = true;
  };

  /** A dice cup, and the two dice already tipped out of it. */
  const diceCup = (g, accent) => {
    const felt = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.75, envMapIntensity: 0.5, side: THREE.DoubleSide });
    add(g, new THREE.CylinderGeometry(0.036, 0.029, 0.088, 20, 1, true), mat.leather, 0, 0.044, 0);
    add(g, new THREE.CircleGeometry(0.034, 20), felt, 0, 0.087, 0, [-Math.PI / 2, 0, 0]);
    add(g, new THREE.CylinderGeometry(0.029, 0.029, 0.005, 20), mat.leather, 0, 0.0025, 0);
    add(g, new THREE.TorusGeometry(0.0355, 0.004, 6, 20), mat.leather, 0, 0.082, 0, [Math.PI / 2, 0, 0]);
    add(g, roundedBox(0.018, 0.018, 0.018, 0.004, 3), mat.ceramic, 0.055, 0.009, 0.02, [0.3, 0.7, 0.2]);
    add(g, new THREE.OctahedronGeometry(0.013), felt, 0.048, 0.01, -0.028, [0.4, 0.2, 0.9]);
  };

  /** A map rolled up and tied, with a compass sitting on it. */
  const scroll = (g, accent) => {
    const ribbon = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.6, envMapIntensity: 0.9 });
    add(g, new THREE.CylinderGeometry(0.017, 0.017, 0.155, 16), mat.paper, 0, 0.018, 0, [0, 0, Math.PI / 2]);
    for (const s of [-1, 1]) {
      add(g, new THREE.CylinderGeometry(0.0185, 0.0185, 0.012, 16), ribbon, s * 0.045, 0.018, 0, [0, 0, Math.PI / 2]);
    }
    // one dowel through the roll, its ends poking out of both sides
    add(g, new THREE.CylinderGeometry(0.005, 0.005, 0.185, 10), mat.wood, 0, 0.018, 0, [0, 0, Math.PI / 2]);
    add(g, new THREE.CylinderGeometry(0.019, 0.019, 0.008, 18), mat.brass, 0.04, 0.041, 0.025, [0.1, 0, 0.06]);
    add(g, new THREE.CircleGeometry(0.015, 18), mat.ceramic, 0.04, 0.0452, 0.025, [-Math.PI / 2 + 0.1, 0, 0]);
    add(g, roundedBox(0.019, 0.0018, 0.003, 0.0006, 2), mat.graphite, 0.04, 0.0462, 0.025, [0.1, 0.9, 0]);
  };

  /** A notepad with a pencil across it, and two cards pulled off the top. */
  const notepad = (g, accent) => {
    const cover = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.55, envMapIntensity: 0.9 });
    add(g, roundedBox(0.105, 0.012, 0.14, 0.004, 3), cover, 0, 0.006, 0, [0, 0.12, 0]);
    add(g, roundedBox(0.098, 0.006, 0.132, 0.003, 3), mat.paper, 0, 0.015, 0, [0, 0.12, 0]);
    for (let i = 0; i < 5; i++) {
      add(g, new THREE.CylinderGeometry(0.0022, 0.0022, 0.016, 8), mat.brass, -0.046, 0.018, -0.05 + i * 0.025, [0, 0, Math.PI / 2]);
    }
    const pencil = add(g, new THREE.CylinderGeometry(0.0038, 0.0038, 0.115, 6), mat.wood, 0.012, 0.021, 0.01, [0, 0, Math.PI / 2]);
    pencil.rotation.y = 0.5;
    add(g, new THREE.ConeGeometry(0.0038, 0.014, 6), mat.graphite, 0.062, 0.021, -0.017, [0, 0.5, -Math.PI / 2]);
    add(g, roundedBox(0.07, 0.0025, 0.048, 0.002, 2), mat.card, -0.075, 0.0015, 0.055, [0, -0.5, 0]);
    add(g, roundedBox(0.07, 0.0025, 0.048, 0.002, 2), mat.card, -0.082, 0.004, 0.049, [0, -0.35, 0]);
  };

  const BUILDERS = { perseus: mug, hermes: diceCup, odysseus: scroll, codex: notepad };

  /**
   * Stands one prop on the table in front of a seat. `at` is in table
   * coordinates and `facing` turns the object to sit square with its owner.
   */
  return {
    place(agent, at, facing) {
      const build = BUILDERS[agent.id] ?? mug;
      const g = new THREE.Group();
      g.position.set(at[0], tableY, at[1]);
      g.rotation.y = facing + Math.PI; // props face their owner, not the board
      group.add(g);
      build(g, new THREE.Color(agent.colour));
      return g;
    },
  };
}
