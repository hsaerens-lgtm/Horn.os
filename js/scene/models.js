// Real models from Poly Haven (CC0), loaded once and placed as needed.
//
// Several Poly Haven plant files hold four to six variants side by side
// (`…_a`, `…_b`, …). `variant` keeps only the meshes of one of them and
// re-centres it, so it stands on the origin like a single asset.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const loader = new GLTFLoader();
const cache = new Map();

function load(id) {
  if (!cache.has(id)) cache.set(id, loader.loadAsync(`assets/models/${id}/${id}.gltf`));
  return cache.get(id);
}

/**
 * A ready-to-place copy of a model: shadows on, standing on y = 0 and centred
 * on x/z. `height` scales it to that height in metres; `scale` multiplies.
 */
export async function model(id, { variant = null, height = null, scale = 1 } = {}) {
  const gltf = await load(id);
  const src = gltf.scene.clone(true);
  if (variant) {
    const keep = (o) => new RegExp(`_${variant}$`).test(o.name);
    for (const child of [...src.children]) if (!keep(child)) src.remove(child);
  }
  src.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.material) o.material.envMapIntensity = 0.8;
    }
  });
  const box = new THREE.Box3().setFromObject(src);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  src.position.set(-centre.x, -box.min.y, -centre.z);
  const wrap = new THREE.Group();
  wrap.add(src);
  const k = (height ? height / size.y : 1) * scale;
  wrap.scale.setScalar(k);
  wrap.userData.size = size.multiplyScalar(k);
  return wrap;
}

/* ------------------------------------------------------------------ *
 *  Planters for the models that come without a pot
 * ------------------------------------------------------------------ */
function speckle(base, dots, seed) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  let s = seed >>> 0;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = dots[Math.floor(r() * dots.length)];
    g.globalAlpha = 0.15 + r() * 0.35;
    const d = 0.6 + r() * 1.8;
    g.fillRect(r() * 512, r() * 512, d, d);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  return t;
}

const GLAZES = {
  white: () => new THREE.MeshStandardMaterial({ map: speckle("#ece8df", ["#8a857a", "#b8b2a6", "#5c574f"], 3), roughness: 0.55 }),
  terracotta: () => new THREE.MeshStandardMaterial({ map: speckle("#b8663f", ["#7a3a1f", "#d88a5f", "#5a2a14"], 5), roughness: 0.9 }),
  sage: () => new THREE.MeshStandardMaterial({ map: speckle("#8fa38c", ["#5d6f5a", "#b9c7b5", "#3f4d3d"], 7), roughness: 0.6 }),
  charcoal: () => new THREE.MeshStandardMaterial({ map: speckle("#3a3b3d", ["#1c1d1e", "#5d5f62", "#2a2b2d"], 9), roughness: 0.7 }),
};
const soilMat = new THREE.MeshStandardMaterial({ map: speckle("#3b2a1e", ["#1e140d", "#5a4230", "#2b1d13"], 11), roughness: 1 });

/**
 * A turned planter: a lathe profile with a rolled rim, glazed, with soil.
 * Returns { group, top } where `top` is the soil height to stand a plant on.
 */
export function planter(r, h, glaze = "white") {
  const pts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(r * 0.7, 0),
    new THREE.Vector2(r * 0.76, h * 0.03),
    new THREE.Vector2(r * 0.92, h * 0.45),
    new THREE.Vector2(r, h * 0.92),
    new THREE.Vector2(r * 1.04, h * 0.97),
    new THREE.Vector2(r * 1.02, h),
    new THREE.Vector2(r * 0.93, h),
    new THREE.Vector2(r * 0.9, h * 0.9),
  ];
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), GLAZES[glaze]());
  pot.castShadow = pot.receiveShadow = true;
  g.add(pot);
  const soil = new THREE.Mesh(new THREE.CircleGeometry(r * 0.9, 40), soilMat);
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = h * 0.88;
  soil.receiveShadow = true;
  g.add(soil);
  return { group: g, top: h * 0.88 };
}
