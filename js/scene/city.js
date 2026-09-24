// The view from the window: the office is on the eighth floor of a building
// on a tree-lined street, with a park across it and the city beyond.
//
// Everything out here is real geometry, so the camera's drift gives true
// parallax. Facades draw their windows in a shader, in four styles — brick,
// glass curtain wall, concrete ribbon windows, rendered plaster — with frames,
// blinds, sky reflections and shopfronts; at night each window keeps its own
// clock. Trees are trunks, branches and cards of painted leaves; cars run both
// ways with their lights on, lamps glow, towers blink, clouds drift and birds
// cross the sky by day.

import * as THREE from "three";

const GROUND_Y = -24; // the office is on the eighth floor
const STREET_X = -13; // centre line of the street, parallel to the facade
const PARK = { x0: -19, x1: -62 }; // a park across the street, then the city

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
}

function canvasTexture(w, h, draw, { repeat = null, srgb = true } = {}) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  t.anisotropy = 8;
  return t;
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
 *  Clouds: cumulus with flat, shaded bases, and high cirrus streaks
 * ------------------------------------------------------------------ */
function cumulusTexture(seed) {
  return canvasTexture(512, 256, (g, w, h) => {
    const r = seeded(seed);
    const base = h * 0.72;
    for (let i = 0; i < 60; i++) {
      const x = 70 + r() * 370;
      const spread = 1 - Math.abs(x - 256) / 200;
      const y = base - r() * 90 * Math.max(0.2, spread);
      const rad = 18 + r() * 42 * Math.max(0.3, spread);
      const grd = g.createRadialGradient(x, y - rad * 0.3, 0, x, y, rad);
      grd.addColorStop(0, "rgba(255,255,255,0.9)");
      grd.addColorStop(0.6, "rgba(245,247,250,0.6)");
      grd.addColorStop(1, "rgba(235,240,246,0)");
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, rad, 0, Math.PI * 2);
      g.fill();
    }
    // shade the underside and cut it flat
    g.globalCompositeOperation = "source-atop";
    const sh = g.createLinearGradient(0, base - 70, 0, base + 10);
    sh.addColorStop(0, "rgba(160,172,190,0)");
    sh.addColorStop(1, "rgba(150,162,182,0.75)");
    g.fillStyle = sh;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "destination-out";
    const cut = g.createLinearGradient(0, base, 0, base + 18);
    cut.addColorStop(0, "rgba(0,0,0,0)");
    cut.addColorStop(1, "rgba(0,0,0,1)");
    g.fillStyle = cut;
    g.fillRect(0, base, w, h - base);
  });
}

function cirrusTexture(seed) {
  return canvasTexture(512, 128, (g, w, h) => {
    const r = seeded(seed);
    for (let i = 0; i < 90; i++) {
      const x = r() * w;
      const y = h / 2 + (r() - 0.5) * 50;
      g.strokeStyle = `rgba(255,255,255,${0.05 + r() * 0.1})`;
      g.lineWidth = 2 + r() * 6;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 60, y - 8 + r() * 16, x + 120 + r() * 80, y + (r() - 0.5) * 20);
      g.stroke();
    }
  });
}

function buildClouds() {
  const group = new THREE.Group();
  const r = seeded(31);
  const mats = [];
  const add = (tex, w, h, x, y, z, speed, opacity) => {
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity });
    mat.userData.base = opacity;
    mats.push(mat);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    m.rotation.y = Math.PI / 2;
    m.userData.speed = speed;
    group.add(m);
  };
  for (let i = 0; i < 16; i++) {
    const w = 60 + r() * 110;
    add(cumulusTexture(100 + i), w, w * 0.5, -170 - r() * 200, 45 + r() * 70, -260 + r() * 520, 0.6 + r() * 1.2, 0.95);
  }
  for (let i = 0; i < 5; i++) add(cirrusTexture(200 + i), 260, 60, -360, 150 + r() * 40, -240 + r() * 480, 0.3, 0.8);
  return { group, mats };
}

/* ------------------------------------------------------------------ *
 *  Buildings: instanced boxes, facades drawn in the shader
 * ------------------------------------------------------------------ */
const STYLE = { brick: 0, glass: 1, concrete: 2, plaster: 3 };
const TONES = {
  [STYLE.brick]: [0x9a5a44, 0x8a4e3a, 0xa8664c, 0x7e4a3a, 0xc9a36a, 0x94604a],
  [STYLE.glass]: [0x3a4550, 0x2e3a44, 0x55606a, 0x44505a],
  [STYLE.concrete]: [0xb8b4ac, 0xa9a59e, 0xc6c1b8, 0x9d9a94],
  [STYLE.plaster]: [0xe8e0d0, 0xf0ead8, 0xd9cdb5, 0xe6d6c0, 0xd8dcd6],
};

function buildBuildings() {
  const r = seeded(7);
  const boxes = [];
  const pickStyle = (h) => {
    const k = r();
    if (h > 55) return k < 0.7 ? STYLE.glass : STYLE.concrete;
    if (k < 0.35) return STYLE.brick;
    if (k < 0.6) return STYLE.concrete;
    if (k < 0.85) return STYLE.plaster;
    return STYLE.glass;
  };
  const add = (x, z, w, d, h) => boxes.push({ x, z, w, d, h, style: pickStyle(h), tone: r() });

  for (let z = -160; z < 160; ) {
    const w = 12 + r() * 16;
    const d = 14 + r() * 8;
    add(PARK.x1 - d / 2 - r() * 3, z + w / 2, d, w - 0.8, 10 + r() * 13);
    z += w;
  }
  for (let gx = 0; gx < 13; gx++) {
    for (let gz = 0; gz < 20; gz++) {
      if (r() < 0.2) continue;
      const x = PARK.x1 - 50 - gx * 28 - r() * 10;
      const z = -280 + gz * 28 + r() * 10;
      const far = Math.min(1, gx / 5);
      const tower = r() < 0.1 + far * 0.12;
      const h = tower ? 60 + r() * 110 : 12 + r() * 34 * (0.5 + far);
      add(x, z, 14 + r() * 12, 14 + r() * 12, h);
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
    uSkyTop: { value: new THREE.Color(0x4f8fd6) },
    uFogColor: { value: new THREE.Color(0xdfe9f0) },
    uFogNear: { value: 60 },
    uFogFar: { value: 420 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    defines: { GROUND_Y: GROUND_Y.toFixed(1) },
    vertexShader: /* glsl */ `
      attribute vec3 aTone;
      attribute float aStyle;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec3 vTone;
      varying float vId;
      varying float vHeight;
      varying float vStyle;
      void main() {
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vTone = aTone;
        vStyle = aStyle;
        vId = float(gl_InstanceID);
        vHeight = instanceMatrix[1][1];
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir, uSunColor, uAmbient, uSky, uSkyTop, uFogColor;
      uniform float uNight, uTime, uFogNear, uFogFar;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec3 vTone;
      varying float vId;
      varying float vHeight;
      varying float vStyle;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float box(vec2 f, vec4 r) { return step(r.x, f.x) * step(f.x, r.y) * step(r.z, f.y) * step(f.y, r.w); }
      void main() {
        vec3 n = normalize(vNormal);
        vec3 V = normalize(vWorld - cameraPosition);
        float dist = length(vWorld - cameraPosition);
        float diff = max(dot(n, normalize(uSunDir)), 0.0);
        vec3 light = uAmbient + uSunColor * diff;
        float st = floor(vStyle + 0.5);
        bool isBrick = st < 0.5;
        bool isGlass = abs(st - 1.0) < 0.5;
        bool isConcrete = abs(st - 2.0) < 0.5;
        vec3 col;
        if (abs(n.y) > 0.5) {
          col = vTone * 0.5 * light; // roofs: membrane and gravel
        } else {
          float u = abs(n.x) > 0.5 ? vWorld.z : vWorld.x;
          float y = vWorld.y - GROUND_Y;
          float face = abs(n.x) > 0.5 ? sign(n.x) : 2.0 + sign(n.z);
          vec2 cs = isGlass ? vec2(1.6, 3.6) : isConcrete ? vec2(4.2, 3.4) : vec2(3.0, 3.4);
          float gy = y - 4.6; // the ground floor is taller
          vec2 cell = floor(vec2(u, gy) / cs);
          vec2 f = fract(vec2(u, gy) / cs);
          vec3 seed = vec3(cell, vId * 7.0 + face);
          vec4 win = isGlass ? vec4(0.03, 0.97, 0.1, 0.98) : isConcrete ? vec4(0.0, 1.0, 0.36, 0.86) : vec4(0.25, 0.75, 0.3, 0.82);
          float upper = step(0.0, gy) * step(y, vHeight - 1.2);
          float inWin = box(f, win) * upper;
          float inFrame = box(f, win + vec4(-0.035, 0.035, -0.03, 0.02)) * (1.0 - box(f, win)) * upper * (isGlass ? 0.0 : 1.0);
          float sill = box(f, vec4(win.x - 0.05, win.y + 0.05, win.z - 0.06, win.z - 0.03)) * upper * (isGlass || isConcrete ? 0.0 : 1.0);

          vec3 wall = vTone;
          if (isBrick) {
            float row = floor(y / 0.075);
            vec2 b = vec2(u / 0.25 + mod(row, 2.0) * 0.5, y / 0.075);
            float fade = 1.0 - smoothstep(18.0, 70.0, dist);
            float mortar = max(step(0.88, fract(b.x)), step(0.8, fract(b.y)));
            wall *= (1.0 - mortar * 0.22 * fade) * (0.9 + 0.2 * hash(vec3(floor(b), vId)) * fade);
          } else if (isConcrete) {
            wall *= 0.93 + 0.07 * step(0.5, fract(gy / cs.y + 0.25));
          } else {
            wall *= 0.97 + 0.03 * hash(vec3(floor(vec2(u, y) * 0.5), vId));
          }
          vec3 lit = wall * light;

          // glass: interior, blinds, and a Fresnel reflection of the sky
          vec3 R = reflect(V, n);
          vec3 skyRefl = mix(uSky, uSkyTop, smoothstep(0.0, 0.5, R.y));
          skyRefl += uSunColor * pow(max(dot(R, normalize(uSunDir)), 0.0), 250.0) * 1.5;
          float fres = 0.3 + 0.7 * pow(1.0 - max(dot(-V, n), 0.0), 3.0);
          vec3 interior = vec3(0.05, 0.055, 0.065) * (0.6 + 0.8 * hash(seed + 5.0));
          float wy = (f.y - win.z) / (win.w - win.z);
          float blind = step(0.55, hash(seed + 13.0)) * step(1.0 - hash(seed + 21.0) * 0.7, wy);
          interior = mix(interior, vec3(0.78, 0.74, 0.66) * (uAmbient * 0.7), blind);
          vec3 glassDay = mix(interior, skyRefl * (isGlass ? 0.8 : 0.55), fres);
          float period = 6.0 + hash(seed) * 30.0;
          float epoch = floor((uTime + hash(seed + 3.0) * period) / period);
          float floorLit = isGlass ? step(0.4, hash(vec3(cell.y, vId, floor((uTime + vId) / 40.0)))) : 1.0;
          float on = step(0.55 - 0.25 * uNight, hash(seed + epoch)) * floorLit;
          vec3 warm = mix(vec3(1.0, 0.72, 0.4), vec3(0.8, 0.88, 1.0), step(0.75, hash(seed + 9.0)));
          vec3 glassNight = mix(skyRefl * 0.2 + 0.01, warm * (0.7 + 0.6 * hash(seed + 11.0)) * mix(1.0, 0.5, blind), on);
          vec3 glass = mix(glassDay, glassNight, uNight);

          vec3 frame = (abs(st - 3.0) < 0.5 ? vec3(0.92) : vec3(0.16, 0.16, 0.17)) * light;
          col = lit;
          col = mix(col, wall * 1.15 * light, sill);
          col = mix(col, frame, inFrame);
          col = mix(col, glass, inWin);

          // shopfronts along the street, lit warm at night
          float bay = fract(u / 6.0);
          float shop = step(0.6, y) * step(y, 3.9) * step(0.08, bay) * step(bay, 0.92);
          vec3 shopDay = mix(vec3(0.07), skyRefl * 0.5, fres);
          vec3 shopNight = vec3(1.0, 0.8, 0.55) * (0.7 + 0.5 * hash(vec3(floor(u / 6.0), vId, 2.0)));
          col = mix(col, mix(shopDay, shopNight, uNight), shop);
          col *= mix(1.0, 0.8, step(y, 0.4)); // plinth
        }
        col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, dist));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });

  const mesh = new THREE.InstancedMesh(geo, material, boxes.length);
  const tones = new Float32Array(boxes.length * 3);
  const styles = new Float32Array(boxes.length);
  const m4 = new THREE.Matrix4();
  const tmp = new THREE.Color();
  boxes.forEach((b, i) => {
    m4.compose(new THREE.Vector3(b.x, GROUND_Y, b.z), new THREE.Quaternion(), new THREE.Vector3(b.w, b.h, b.d));
    mesh.setMatrixAt(i, m4);
    const list = TONES[b.style];
    tmp.set(list[Math.floor(b.tone * list.length)]);
    tones.set([tmp.r, tmp.g, tmp.b], i * 3);
    styles[i] = b.style;
  });
  geo.setAttribute("aTone", new THREE.InstancedBufferAttribute(tones, 3));
  geo.setAttribute("aStyle", new THREE.InstancedBufferAttribute(styles, 1));
  mesh.frustumCulled = false;

  // Rooftop plant: air-handling units and water tanks on the lower roofs.
  const unitGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const tankGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 12).translate(0, 0.5, 0);
  const units = [];
  const tanks = [];
  for (const b of boxes) {
    if (b.style === STYLE.glass || r() < 0.3) continue;
    const n = 1 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const x = b.x + (r() - 0.5) * b.w * 0.6;
      const z = b.z + (r() - 0.5) * b.d * 0.6;
      const y = GROUND_Y + b.h;
      if (r() < 0.25) tanks.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(2.4, 3, 2.4)));
      else units.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(2 + r() * 3, 1.2 + r(), 1.5 + r() * 2)));
    }
  }
  const plantMat = new THREE.MeshStandardMaterial({ color: 0x9a9da0, roughness: 0.7, metalness: 0.3 });
  const unitMesh = new THREE.InstancedMesh(unitGeo, plantMat, units.length);
  units.forEach((m, i) => unitMesh.setMatrixAt(i, m));
  const tankMesh = new THREE.InstancedMesh(tankGeo, new THREE.MeshStandardMaterial({ color: 0x6d5a48, roughness: 0.9 }), tanks.length);
  tanks.forEach((m, i) => tankMesh.setMatrixAt(i, m));
  unitMesh.frustumCulled = tankMesh.frustumCulled = false;

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
  const group = new THREE.Group();
  group.add(mesh, unitMesh, tankMesh, beacons);
  return { group, uniforms, beaconUniforms };
}

/* ------------------------------------------------------------------ *
 *  Ground textures, painted
 * ------------------------------------------------------------------ */
function grassTexture() {
  return canvasTexture(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = "#6a8a4a";
      g.fillRect(0, 0, w, h);
      const r = seeded(3);
      for (let i = 0; i < 60; i++) {
        const grd = g.createRadialGradient(r() * w, r() * h, 0, r() * w, r() * h, 40 + r() * 90);
        grd.addColorStop(0, `rgba(${r() < 0.5 ? "90,120,60" : "120,140,70"},0.35)`);
        grd.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = grd;
        g.fillRect(0, 0, w, h);
      }
      for (let i = 0; i < 26000; i++) {
        const v = r();
        g.fillStyle = v < 0.33 ? "rgba(60,90,40,0.5)" : v < 0.66 ? "rgba(140,165,85,0.45)" : "rgba(100,130,60,0.5)";
        g.fillRect(r() * w, r() * h, 1, 2 + r() * 3);
      }
    },
    { repeat: [120, 120] },
  );
}

function paverTexture() {
  return canvasTexture(
    256,
    256,
    (g, w, h) => {
      g.fillStyle = "#8f8a82";
      g.fillRect(0, 0, w, h);
      const r = seeded(8);
      const pw = 64;
      const ph = 32;
      for (let y = 0; y < h; y += ph) {
        const off = (y / ph) % 2 ? pw / 2 : 0;
        for (let x = -pw; x < w + pw; x += pw) {
          const v = 170 + r() * 30;
          g.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
          g.fillRect(x + off + 2, y + 2, pw - 4, ph - 4);
        }
      }
      for (let i = 0; i < 3000; i++) {
        g.fillStyle = `rgba(0,0,0,${r() * 0.08})`;
        g.fillRect(r() * w, r() * h, 2, 2);
      }
    },
    { repeat: [8, 600] },
  );
}

function asphaltTexture() {
  return canvasTexture(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = "#3a3c3f";
      g.fillRect(0, 0, w, h);
      const r = seeded(12);
      for (let i = 0; i < 30000; i++) {
        const v = 40 + r() * 50;
        g.fillStyle = `rgba(${v},${v},${v + 3},0.5)`;
        g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
      }
      for (let i = 0; i < 12; i++) {
        g.fillStyle = `rgba(20,20,22,${0.15 + r() * 0.2})`;
        g.fillRect(r() * w, r() * h, 30 + r() * 120, 20 + r() * 60);
      }
    },
    { repeat: [2, 90] },
  );
}

function gravelTexture() {
  return canvasTexture(
    256,
    256,
    (g, w, h) => {
      g.fillStyle = "#c2b59c";
      g.fillRect(0, 0, w, h);
      const r = seeded(15);
      for (let i = 0; i < 9000; i++) {
        const v = 150 + r() * 70;
        g.fillStyle = `rgba(${v},${v - 10},${v - 30},0.6)`;
        g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
      }
    },
    { repeat: [2, 160] },
  );
}

/* ------------------------------------------------------------------ *
 *  Trees: trunk, branches, and cards of painted leaves
 * ------------------------------------------------------------------ */
function foliageTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    const r = seeded(21);
    const cx = w / 2;
    const cy = h / 2;
    for (let i = 0; i < 4200; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * (w * 0.44);
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d * 0.9;
      const shade = 0.55 + 0.45 * (1 - (y / h)) * (0.7 + 0.3 * r()); // lighter on top
      const base = [
        [78, 112, 52],
        [96, 132, 60],
        [62, 96, 44],
        [110, 142, 70],
      ][Math.floor(r() * 4)];
      g.fillStyle = `rgb(${Math.round(base[0] * shade)},${Math.round(base[1] * shade)},${Math.round(base[2] * shade)})`;
      g.save();
      g.translate(x, y);
      g.rotate(r() * Math.PI);
      g.beginPath();
      g.ellipse(0, 0, 7 + r() * 7, 3.5 + r() * 3.5, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  });
}

function buildTrees(r) {
  const spots = [];
  for (const side of [-1, 1]) for (let z = -130; z < 130; z += 8 + r() * 3) spots.push([STREET_X + side * 6.8 + (r() - 0.5) * 0.6, z, 0.9 + r() * 0.35]);
  for (let i = 0; i < 150; i++) spots.push([PARK.x0 - 3 - r() * (PARK.x0 - PARK.x1 - 6), -150 + r() * 300, 0.8 + r() * 0.6]);

  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.24, 5, 8).translate(0, 2.5, 0);
  const branchGeo = new THREE.CylinderGeometry(0.03, 0.09, 2.6, 6).translate(0, 1.3, 0);
  const cardGeo = new THREE.PlaneGeometry(1, 1);
  const trunks = [];
  const branches = [];
  const cards = [];
  const cardTint = [];
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (const [x, z, s] of spots) {
    trunks.push(new THREE.Matrix4().compose(new THREE.Vector3(x, GROUND_Y, z), q.identity(), new THREE.Vector3(s, s, s)));
    const crown = new THREE.Vector3(x, GROUND_Y + 6.6 * s, z);
    for (let k = 0; k < 4; k++) {
      e.set(0.55 + r() * 0.35, r() * Math.PI * 2, 0, "YXZ");
      branches.push(new THREE.Matrix4().compose(new THREE.Vector3(x, GROUND_Y + (3.4 + r() * 1.2) * s, z), new THREE.Quaternion().setFromEuler(e), new THREE.Vector3(s, s, s)));
    }
    const n = 30;
    for (let k = 0; k < n; k++) {
      // points in a squashed ellipsoid, denser towards the outside
      const a = r() * Math.PI * 2;
      const up = r() * 2 - 1;
      const rad = 0.55 + 0.45 * Math.sqrt(r());
      const dir = new THREE.Vector3(Math.cos(a) * Math.sqrt(1 - up * up), up, Math.sin(a) * Math.sqrt(1 - up * up));
      const p = crown.clone().add(new THREE.Vector3(dir.x * 2.4 * s * rad, dir.y * 1.8 * s * rad, dir.z * 2.4 * s * rad));
      e.set((r() - 0.5) * 1.2, r() * Math.PI * 2, (r() - 0.5) * 0.6, "YXZ");
      const size = (1.7 + r() * 1.1) * s;
      cards.push(new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(e), new THREE.Vector3(size, size, size)));
      // darker inside and underneath: a cheap ambient occlusion
      const k2 = 0.62 + 0.38 * (0.5 + 0.5 * dir.y) * (0.7 + 0.3 * rad) + (r() - 0.5) * 0.1;
      cardTint.push(k2);
    }
  }
  const bark = new THREE.MeshStandardMaterial({ color: 0x5a4a3c, roughness: 1 });
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, bark, trunks.length);
  trunks.forEach((m, i) => trunkMesh.setMatrixAt(i, m));
  const branchMesh = new THREE.InstancedMesh(branchGeo, bark, branches.length);
  branches.forEach((m, i) => branchMesh.setMatrixAt(i, m));
  const leafMat = new THREE.MeshStandardMaterial({ map: foliageTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 });
  const cardMesh = new THREE.InstancedMesh(cardGeo, leafMat, cards.length);
  const c = new THREE.Color();
  cards.forEach((m, i) => {
    cardMesh.setMatrixAt(i, m);
    cardMesh.setColorAt(i, c.setRGB(cardTint[i], cardTint[i] * (0.98 + r() * 0.06), cardTint[i] * 0.95));
  });
  for (const im of [trunkMesh, branchMesh, cardMesh]) im.frustumCulled = false;
  return [trunkMesh, branchMesh, cardMesh];
}

/* ------------------------------------------------------------------ *
 *  The street: road, pavements, park, trees, lamps, traffic
 * ------------------------------------------------------------------ */
function buildStreet() {
  const group = new THREE.Group();
  const r = seeded(19);
  const flat = (w, d, mat, x, y, z, rotZ = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = rotZ;
    m.position.set(x, y, z);
    group.add(m);
    return m;
  };

  flat(900, 900, new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 }), -200, GROUND_Y - 0.02, 0);
  flat(9, 400, new THREE.MeshStandardMaterial({ map: asphaltTexture(), roughness: 0.92 }), STREET_X, GROUND_Y, 0);
  const pavers = new THREE.MeshStandardMaterial({ map: paverTexture(), roughness: 0.95 });
  for (const side of [-1, 1]) flat(4, 400, pavers, STREET_X + side * 6.5, GROUND_Y + 0.12, 0);
  // kerbs
  const kerbMat = new THREE.MeshStandardMaterial({ color: 0xb8b3aa, roughness: 0.9 });
  for (const side of [-1, 1]) {
    const k = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 400), kerbMat);
    k.position.set(STREET_X + side * 4.6, GROUND_Y + 0.05, 0);
    group.add(k);
  }
  // the park: a gravel path, low hedges along its edge
  flat(3, 400, new THREE.MeshStandardMaterial({ map: gravelTexture(), roughness: 1 }), (PARK.x0 + PARK.x1) / 2, GROUND_Y + 0.01, 0, 0.12);
  const hedge = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 400), new THREE.MeshStandardMaterial({ color: 0x3f5f32, roughness: 1 }));
  hedge.position.set(PARK.x0 - 3.2, GROUND_Y + 0.5, 0);
  group.add(hedge);
  // lane markings
  const dash = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.15, 2.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xdedbd2 }), 80);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 80; i++) dash.setMatrixAt(i, m4.makeTranslation(STREET_X, GROUND_Y + 0.02, -200 + i * 5));
  group.add(dash);

  group.add(...buildTrees(r));

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
  group.add(
    new THREE.Points(
      glowGeo,
      new THREE.ShaderMaterial({
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
      }),
    ),
  );

  // Traffic: cars both ways, with headlights and tail lights.
  const N = 26;
  const cars = [];
  for (let i = 0; i < N; i++) {
    const dir = i % 2 ? 1 : -1;
    cars.push({ dir, lane: STREET_X + dir * -1.9, z: -180 + r() * 360, speed: 7 + r() * 6, colour: [0x2c3e50, 0xc0392b, 0xecf0f1, 0x7f8c8d, 0x1e1e1e, 0x2e86c1, 0xd4ac0d][Math.floor(r() * 7)] });
  }
  const body = new THREE.InstancedMesh(new THREE.BoxGeometry(1.8, 1.1, 4.2).translate(0, 0.75, 0), new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.5 }), N);
  const cabin = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.6, 2.2).translate(0, 1.55, -0.2), new THREE.MeshStandardMaterial({ color: 0x1c2228, roughness: 0.2, metalness: 0.6 }), N);
  cars.forEach((c, i) => body.setColorAt(i, new THREE.Color(c.colour)));
  const lightUniforms = [];
  const lightMat = (hex) => {
    const uniforms = { uNight: { value: 0 }, uColor: { value: new THREE.Color(hex) } };
    lightUniforms.push(uniforms);
    return new THREE.ShaderMaterial({
      uniforms,
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
  };
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
  for (const im of [body, cabin, heads, tails, dash, pole]) im.frustumCulled = false;

  return {
    group,
    glowUniforms,
    lightUniforms,
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
 *  Birds: two small flocks crossing the sky by day
 * ------------------------------------------------------------------ */
function buildBirds() {
  const group = new THREE.Group();
  const r = seeded(51);
  const mat = new THREE.MeshBasicMaterial({ color: 0x2a2c30, side: THREE.DoubleSide, fog: true });
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0.9, 0.05, -0.15, 0.15, 0, 0.35], 3));
  const flocks = [];
  for (let f = 0; f < 2; f++) {
    const flock = { birds: [], x: -60 - r() * 60, y: GROUND_Y + 40 + r() * 25, z: -150 + r() * 100, speed: 7 + r() * 3 };
    for (let i = 0; i < 7; i++) {
      const b = new THREE.Group();
      const left = new THREE.Mesh(wingGeo, mat);
      const right = new THREE.Mesh(wingGeo, mat);
      right.scale.x = -1;
      b.add(left, right);
      b.scale.setScalar(0.9);
      b.userData = { left, right, off: new THREE.Vector3((r() - 0.5) * 4, (r() - 0.5) * 2, -Math.abs(i - 3) * 2.2), phase: r() * 6 };
      group.add(b);
      flock.birds.push(b);
    }
    flocks.push(flock);
  }
  return {
    group,
    update(t, dt) {
      for (const fl of flocks) {
        fl.z += fl.speed * dt;
        if (fl.z > 220) fl.z = -220;
        for (const b of fl.birds) {
          const u = b.userData;
          b.position.set(fl.x + u.off.x, fl.y + u.off.y + Math.sin(t * 0.6 + u.phase) * 0.8, fl.z + u.off.z);
          const flap = Math.sin(t * 9 + u.phase) * 0.6;
          u.left.rotation.z = flap;
          u.right.rotation.z = -flap;
        }
      }
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
  const birds = buildBirds();
  const root = new THREE.Group();
  root.add(sky.mesh, clouds.group, buildings.group, street.group, birds.group);
  root.traverse((o) => {
    o.castShadow = false;
    o.receiveShadow = false;
  });
  scene.add(root);
  scene.fog = new THREE.Fog(0xdfe9f0, 60, 420);

  return {
    /** `p` is the current mix of the day-cycle presets. */
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
      bu.uSkyTop.value.copy(p.skyTop);
      bu.uFogColor.value.copy(p.skyHorizon);
      scene.fog.color.copy(p.skyHorizon);
      buildings.beaconUniforms.uNight.value = p.night;
      street.glowUniforms.uOn.value = Math.max(0, p.night * 1.1 - 0.1);
      for (const u of street.lightUniforms) u.uNight.value = p.night;
      for (const m of clouds.mats) {
        m.color.copy(p.cloudColor);
        m.opacity = p.cloudOpacity * m.userData.base;
      }
      birds.group.visible = p.night < 0.6;
    },
    update(t, dt) {
      sky.uniforms.uTime.value = t;
      buildings.uniforms.uTime.value = t;
      buildings.beaconUniforms.uTime.value = t;
      street.update(dt);
      birds.update(t, dt);
      for (const c of clouds.group.children) {
        c.position.z += c.userData.speed * dt;
        if (c.position.z > 280) c.position.z = -280;
      }
    },
  };
}
