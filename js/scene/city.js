// The view from the window: the office is on the eighth floor of a building
// on a tree-lined street, with the city beyond.
//
// Everything out here is real geometry, so the camera's drift gives true
// parallax: the street trees slide past the far towers. The facades draw
// their windows in a shader, and at night each window switches on and off on
// its own clock; cars run both ways with their lights on, street lamps glow,
// and the tallest towers blink red.

import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

const GROUND_Y = -24; // the office is on the eighth floor
const STREET_X = -13; // centre line of the street, parallel to the facade
const PARK = { x0: -19, x1: -62 }; // a park across the street, then the city

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
}

/* ------------------------------------------------------------------ *
 *  Sky dome: gradient, sun, stars
 * ------------------------------------------------------------------ */
function buildSky() {
  const uniforms = {
    uTop: { value: new THREE.Color(0x5d97d6) },
    uHorizon: { value: new THREE.Color(0xdfe9f0) },
    uSunDir: { value: new THREE.Vector3(-0.8, 0.45, 0.15).normalize() },
    uSunColor: { value: new THREE.Color(0xfff2d8) },
    uSunSize: { value: 1 },
    uStars: { value: 0 },
    uTime: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uHorizon, uSunDir, uSunColor;
      uniform float uSunSize, uStars, uTime;
      varying vec3 vDir;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHorizon, uTop, smoothstep(-0.02, 0.55, h));
        float s = max(dot(d, normalize(uSunDir)), 0.0);
        col += uSunColor * (pow(s, 1400.0 / uSunSize) * 6.0 + pow(s, 12.0) * 0.35 + pow(s, 3.0) * 0.12);
        // stars: a sparse hash grid, twinkling, fading out near the horizon
        vec3 cell = floor(d * 380.0);
        float st = step(0.9975, hash(cell));
        float tw = 0.6 + 0.4 * sin(uTime * 2.0 + hash(cell + 1.0) * 40.0);
        col += vec3(st * tw * uStars * smoothstep(0.04, 0.3, h));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), material);
  mesh.renderOrder = -100;
  return { mesh, uniforms };
}

/* ------------------------------------------------------------------ *
 *  Clouds: soft planes far out, drifting
 * ------------------------------------------------------------------ */
function cloudTexture(seed) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d");
  const r = seeded(seed);
  for (let i = 0; i < 38; i++) {
    const x = 90 + r() * 330;
    const y = 120 + (r() - 0.5) * 60;
    const rad = 30 + r() * 60;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, "rgba(255,255,255,0.55)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 512, 256);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildClouds() {
  const group = new THREE.Group();
  const r = seeded(31);
  const mats = [];
  for (let i = 0; i < 9; i++) {
    const mat = new THREE.MeshBasicMaterial({ map: cloudTexture(100 + i), transparent: true, depthWrite: false, fog: false, color: 0xffffff, opacity: 0.9 });
    mats.push(mat);
    const w = 70 + r() * 90;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.4), mat);
    m.position.set(-260 - r() * 60, 45 + r() * 70, -220 + r() * 440);
    m.rotation.y = Math.PI / 2;
    m.userData.speed = 0.6 + r() * 0.8;
    group.add(m);
  }
  return { group, mats };
}

/* ------------------------------------------------------------------ *
 *  Buildings: instanced boxes, windows drawn in the shader
 * ------------------------------------------------------------------ */
function buildBuildings() {
  const r = seeded(7);
  const boxes = [];
  const add = (x, z, w, d, h, tone) => boxes.push({ x, z, w, d, h, tone });

  // Beyond the park: a continuous row of mid-rise facades facing the office.
  for (let z = -160; z < 160; ) {
    const w = 12 + r() * 16;
    const d = 14 + r() * 8;
    add(PARK.x1 - d / 2 - r() * 3, z + w / 2, d, w - 0.8, 10 + r() * 13, r());
    z += w;
  }
  // The city beyond: blocks on a loose grid, taller in the middle distance.
  for (let gx = 0; gx < 13; gx++) {
    for (let gz = 0; gz < 20; gz++) {
      if (r() < 0.2) continue;
      const x = PARK.x1 - 50 - gx * 28 - r() * 10;
      const z = -280 + gz * 28 + r() * 10;
      const far = Math.min(1, gx / 5);
      const tower = r() < 0.1 + far * 0.12;
      const h = tower ? 60 + r() * 110 : 12 + r() * 34 * (0.5 + far);
      add(x, z, 14 + r() * 12, 14 + r() * 12, h, r());
    }
  }

  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const uniforms = {
    uSunDir: { value: new THREE.Vector3(-0.8, 0.45, 0.15).normalize() },
    uSunColor: { value: new THREE.Color(0xfff0d8) },
    uAmbient: { value: new THREE.Color(0x8a9bb0) },
    uNight: { value: 0 },
    uTime: { value: 0 },
    uSky: { value: new THREE.Color(0xa9cbe8) },
    uFogColor: { value: new THREE.Color(0xdfe9f0) },
    uFogNear: { value: 60 },
    uFogFar: { value: 420 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      attribute vec3 aTone;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec3 vTone;
      varying float vId;
      varying float vHeight;
      void main() {
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vTone = aTone;
        vId = float(gl_InstanceID);
        vHeight = instanceMatrix[1][1];
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    defines: { GROUND_Y: GROUND_Y.toFixed(1) },
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir, uSunColor, uAmbient, uSky, uFogColor;
      uniform float uNight, uTime, uFogNear, uFogFar;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec3 vTone;
      varying float vId;
      varying float vHeight;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        vec3 n = normalize(vNormal);
        vec3 wall = vTone;
        float diff = max(dot(n, normalize(uSunDir)), 0.0);
        vec3 lit = wall * (uAmbient + uSunColor * diff);
        vec3 col = lit;
        if (abs(n.y) < 0.5) {
          // which way this face runs, and where we are on its grid of windows
          float u = abs(n.x) > 0.5 ? vWorld.z : vWorld.x;
          float y = vWorld.y - GROUND_Y;
          vec2 cellSize = vec2(3.0, 3.4);
          vec2 cell = floor(vec2(u, y) / cellSize);
          vec2 f = fract(vec2(u, y) / cellSize);
          float face = abs(n.x) > 0.5 ? sign(n.x) : 2.0 + sign(n.z);
          float inWin = step(0.24, f.x) * step(f.x, 0.76) * step(0.3, f.y) * step(f.y, 0.82);
          inWin *= step(3.3, y) * step(y, vHeight - 1.5); // no windows at street level or in the parapet
          vec3 seed = vec3(cell, vId * 7.0 + face);
          // each window keeps its state for a while, then maybe flips
          float period = 6.0 + hash(seed) * 30.0;
          float epoch = floor((uTime + hash(seed + 3.0) * period) / period);
          float on = step(0.55 - 0.25 * uNight, hash(seed + epoch));
          vec3 warm = mix(vec3(1.0, 0.72, 0.38), vec3(0.75, 0.85, 1.0), step(0.8, hash(seed + 9.0)));
          vec3 glassDay = mix(uSky * 0.55, vec3(0.12, 0.15, 0.2), 0.45 + 0.3 * hash(seed + 5.0));
          vec3 glassNight = mix(vec3(0.02, 0.025, 0.04), warm * (0.8 + 0.6 * hash(seed + 11.0)), on);
          vec3 glass = mix(glassDay, glassNight, uNight);
          col = mix(lit, glass, inWin);
        } else {
          col = wall * 0.8 * (uAmbient + uSunColor * diff);
        }
        float dist = length(vWorld - cameraPosition);
        col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, dist));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });

  const mesh = new THREE.InstancedMesh(geo, material, boxes.length);
  const tones = new Float32Array(boxes.length * 3);
  const palette = [0xd8d0c4, 0xc9bfb2, 0xb8b2aa, 0xe2dbd0, 0xa89c8e, 0x9aa3ab, 0xc7c0b8, 0x8f8a84];
  const m4 = new THREE.Matrix4();
  const tmp = new THREE.Color();
  boxes.forEach((b, i) => {
    m4.compose(new THREE.Vector3(b.x, GROUND_Y, b.z), new THREE.Quaternion(), new THREE.Vector3(b.w, b.h, b.d));
    mesh.setMatrixAt(i, m4);
    tmp.set(palette[Math.floor(b.tone * palette.length)]);
    tones.set([tmp.r, tmp.g, tmp.b], i * 3);
  });
  geo.setAttribute("aTone", new THREE.InstancedBufferAttribute(tones, 3));
  mesh.frustumCulled = false;

  // Aircraft warning lights on the towers.
  const tops = boxes.filter((b) => b.h > 55);
  const pos = new Float32Array(tops.length * 3);
  const phase = new Float32Array(tops.length);
  tops.forEach((b, i) => {
    pos.set([b.x, GROUND_Y + b.h + 1, b.z], i * 3);
    phase[i] = r() * 6.28;
  });
  const beaconGeo = new THREE.BufferGeometry();
  beaconGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  beaconGeo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
  const beaconUniforms = { uTime: { value: 0 }, uNight: { value: 0 } };
  const beacons = new THREE.Points(
    beaconGeo,
    new THREE.ShaderMaterial({
      uniforms: beaconUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aPhase;
        varying float vA;
        uniform float uTime, uNight;
        void main() {
          vA = step(0.55, fract(uTime * 0.5 + aPhase)) * (0.25 + 0.75 * uNight);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = 900.0 / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          gl_FragColor = vec4(1.0, 0.15, 0.1, vA * smoothstep(0.5, 0.0, d));
        }`,
    }),
  );
  return { mesh, uniforms, beacons, beaconUniforms };
}

/* ------------------------------------------------------------------ *
 *  The street: road, pavements, trees, lamps, traffic
 * ------------------------------------------------------------------ */
function buildStreet() {
  const group = new THREE.Group();
  const r = seeded(19);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ color: 0x7a8a6c, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(-200, GROUND_Y - 0.02, 0);
  group.add(ground);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(9, 400), new THREE.MeshStandardMaterial({ color: 0x3b3d40, roughness: 0.9 }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(STREET_X, GROUND_Y, 0);
  group.add(road);
  const walk = new THREE.MeshStandardMaterial({ color: 0xb9b3a8, roughness: 0.95 });
  for (const side of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(4, 400), walk);
    p.rotation.x = -Math.PI / 2;
    p.position.set(STREET_X + side * 6.5, GROUND_Y + 0.01, 0);
    group.add(p);
  }
  // a gravel path winding through the park
  const path = new THREE.Mesh(new THREE.PlaneGeometry(3, 400), new THREE.MeshStandardMaterial({ color: 0xc8bba2, roughness: 1 }));
  path.rotation.x = -Math.PI / 2;
  path.rotation.z = 0.12;
  path.position.set((PARK.x0 + PARK.x1) / 2, GROUND_Y + 0.01, 0);
  group.add(path);
  // lane markings
  const dash = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.15, 2.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xdedbd2 }), 80);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 80; i++) dash.setMatrixAt(i, m4.makeTranslation(STREET_X, GROUND_Y + 0.02, -200 + i * 5));
  group.add(dash);

  // Trees on both pavements: a trunk and a lumpy canopy each.
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 4.5, 7).translate(0, 2.25, 0);
  let crownGeo = mergeVertices(new THREE.IcosahedronGeometry(1.7, 3));
  // Nudge the blob's vertices so no two crowns are perfect spheres.
  {
    const pos = crownGeo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const k = 1 + 0.12 * Math.sin(v.x * 3.1) * Math.cos(v.z * 2.7) + 0.08 * Math.sin(v.y * 4.3);
      pos.setXYZ(i, v.x * k, v.y * k * 0.85, v.z * k);
    }
    crownGeo.computeVertexNormals();
  }
  const trunks = [];
  const crowns = [];
  const tree = (x, z, s) => {
    trunks.push(new THREE.Matrix4().compose(new THREE.Vector3(x, GROUND_Y, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)));
    // a crown is four overlapping blobs
    for (let k = 0; k < 4; k++) {
      const a = r() * 6.28;
      const off = k === 0 ? 0 : 1.1 * s;
      crowns.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x + Math.cos(a) * off, GROUND_Y + (5.2 + (k === 0 ? 1.2 : r() * 0.8)) * s, z + Math.sin(a) * off),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(r(), r() * 6, r())),
          new THREE.Vector3(s * (0.9 + r() * 0.35), s * (0.85 + r() * 0.3), s * (0.9 + r() * 0.35)),
        ),
      );
    }
  };
  for (const side of [-1, 1]) for (let z = -130; z < 130; z += 8 + r() * 3) tree(STREET_X + side * 6.8 + (r() - 0.5) * 0.6, z, 0.9 + r() * 0.4);
  for (let i = 0; i < 140; i++) tree(PARK.x0 - 3 - r() * (PARK.x0 - PARK.x1 - 6), -150 + r() * 300, 0.8 + r() * 0.7);
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x5b4636, roughness: 1 }), trunks.length);
  trunks.forEach((m, i) => trunkMesh.setMatrixAt(i, m));
  const crownMesh = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), crowns.length);
  const greens = [0x587d45, 0x4c7040, 0x6a8f50, 0x5f8448, 0x4a6b3a, 0x789a58];
  crowns.forEach((m, i) => {
    crownMesh.setMatrixAt(i, m);
    crownMesh.setColorAt(i, new THREE.Color(greens[Math.floor(r() * greens.length)]));
  });
  group.add(trunkMesh, crownMesh);

  // Street lamps on the near pavement, with glows that come on in the evening.
  const lampPos = [];
  for (let z = -100; z < 100; z += 18) lampPos.push(new THREE.Vector3(STREET_X + 5, GROUND_Y, z + 4));
  const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.1, 5.5, 6).translate(0, 2.75, 0), new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.6 }), lampPos.length);
  lampPos.forEach((p, i) => pole.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)));
  group.add(pole);
  const glowPos = new Float32Array(lampPos.length * 3);
  lampPos.forEach((p, i) => glowPos.set([p.x - 0.4, p.y + 5.5, p.z], i * 3));
  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute("position", new THREE.BufferAttribute(glowPos, 3));
  const glowUniforms = { uOn: { value: 0 }, uColor: { value: new THREE.Color(0xffc47a) }, uSize: { value: 1400 } };
  const glowMat = new THREE.ShaderMaterial({
    uniforms: glowUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uSize;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOn;
      uniform vec3 uColor;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(uColor, uOn * a * a);
      }`,
  });
  group.add(new THREE.Points(glowGeo, glowMat));

  // Traffic: cars both ways, with headlights and tail lights.
  const N = 26;
  const cars = [];
  for (let i = 0; i < N; i++) {
    const dir = i % 2 ? 1 : -1;
    cars.push({ dir, lane: STREET_X + dir * -1.9, z: -180 + r() * 360, speed: 7 + r() * 6, colour: [0x2c3e50, 0xc0392b, 0xecf0f1, 0x7f8c8d, 0x1e1e1e, 0x2e86c1, 0xd4ac0d][Math.floor(r() * 7)] });
  }
  const body = new THREE.InstancedMesh(new THREE.BoxGeometry(1.8, 1.1, 4.2).translate(0, 0.75, 0), new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.4 }), N);
  const cabin = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.6, 2.2).translate(0, 1.55, -0.2), new THREE.MeshStandardMaterial({ color: 0x1c2228, roughness: 0.2, metalness: 0.6 }), N);
  cars.forEach((c, i) => body.setColorAt(i, new THREE.Color(c.colour)));
  const lightUniforms = { uNight: { value: 0 } };
  const lightMat = (hex) =>
    new THREE.ShaderMaterial({
      uniforms: { ...lightUniforms, uColor: { value: new THREE.Color(hex) } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        void main() { gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uNight;
        void main() { gl_FragColor = vec4(uColor * (0.4 + 2.2 * uNight), 1.0); }`,
    });
  const heads = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.5, 0.22).translate(0, 0.8, 2.12), lightMat(0xfff4dc), N);
  const tails = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.5, 0.18).rotateY(Math.PI).translate(0, 0.85, -2.12), lightMat(0xff2a1a), N);
  group.add(body, cabin, heads, tails);
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const place = () => {
    cars.forEach((c, i) => {
      q.setFromAxisAngle(up, c.dir > 0 ? 0 : Math.PI);
      m4.compose(new THREE.Vector3(c.lane, GROUND_Y, c.z), q, new THREE.Vector3(1, 1, 1));
      body.setMatrixAt(i, m4);
      cabin.setMatrixAt(i, m4);
      heads.setMatrixAt(i, m4);
      tails.setMatrixAt(i, m4);
    });
    for (const im of [body, cabin, heads, tails]) im.instanceMatrix.needsUpdate = true;
  };
  place();
  for (const im of [body, cabin, heads, tails, trunkMesh, crownMesh, dash, pole]) im.frustumCulled = false;

  return {
    group,
    glowUniforms,
    lightUniforms: [heads.material.uniforms, tails.material.uniforms],
    update(dt) {
      for (const c of cars) {
        c.z += c.dir * c.speed * dt;
        if (c.z > 190) c.z = -190;
        if (c.z < -190) c.z = 190;
      }
      place();
    },
  };
}

/* ------------------------------------------------------------------ *
 *  The whole view
 * ------------------------------------------------------------------ */
export function buildCity(scene) {
  const sky = buildSky();
  const clouds = buildClouds();
  const buildings = buildBuildings();
  const street = buildStreet();
  const root = new THREE.Group();
  root.add(sky.mesh, clouds.group, buildings.mesh, buildings.beacons, street.group);
  root.traverse((o) => {
    o.castShadow = false;
    o.receiveShadow = false;
  });
  scene.add(root);
  scene.fog = new THREE.Fog(0xdfe9f0, 60, 420);

  return {
    /**
     * `p` is the current mix of the day-cycle presets; `t` elapsed seconds.
     */
    apply(p) {
      sky.uniforms.uTop.value.copy(p.skyTop);
      sky.uniforms.uHorizon.value.copy(p.skyHorizon);
      sky.uniforms.uSunDir.value.copy(p.sunPos).normalize();
      sky.uniforms.uSunColor.value.copy(p.sunDisc);
      sky.uniforms.uSunSize.value = p.sunSize;
      sky.uniforms.uStars.value = p.stars;
      const bu = buildings.uniforms;
      bu.uSunDir.value.copy(p.sunPos).normalize();
      bu.uSunColor.value.copy(p.sunColor).multiplyScalar(p.sunI * 0.22);
      bu.uAmbient.value.copy(p.cityAmbient);
      bu.uNight.value = p.night;
      bu.uSky.value.copy(p.skyHorizon);
      bu.uFogColor.value.copy(p.skyHorizon);
      scene.fog.color.copy(p.skyHorizon);
      buildings.beaconUniforms.uNight.value = p.night;
      street.glowUniforms.uOn.value = Math.max(0, p.night * 1.1 - 0.1);
      for (const u of street.lightUniforms) u.uNight.value = p.night;
      for (const m of clouds.mats) {
        m.color.copy(p.cloudColor);
        m.opacity = p.cloudOpacity;
      }
    },
    update(t, dt) {
      sky.uniforms.uTime.value = t;
      buildings.uniforms.uTime.value = t;
      buildings.beaconUniforms.uTime.value = t;
      street.update(dt);
      for (const c of clouds.group.children) {
        c.position.z += c.userData.speed * dt;
        if (c.position.z > 240) c.position.z = -240;
      }
    },
  };
}
