// Nebula Run — a small 3D shooter that runs in a Horn.os window.
//
// The ship flies into the screen; asteroids and enemy drones come at it out
// of the dark. Shoot them, dodge them, pick up power-ups that change the gun,
// survive until the mothership arrives and bring it down. Three lives.
//
// Controls: arrows / WASD to move, Space to fire, P to pause, M for sound, Enter to start.
// With a mouse or a finger: hold and drag, the ship follows and fires.

import * as THREE from "three";
import { createSound } from "./sound.js";

const BOUNDS = { x: 8.5, y: 4.2 };
const SPAWN_Z = -150;
const LEVEL_TIME = 70; // seconds before the mothership
const WEAPON_TIME = 14; // seconds a power-up lasts

const WEAPONS = {
  single: { label: "Blaster", color: 0x7cf2ff, rate: 0.16 },
  double: { label: "Twin", color: 0x7dff9a, rate: 0.11 },
  spread: { label: "Spread", color: 0xffb04a, rate: 0.2 },
  laser: { label: "Laser", color: 0xff5ad8, rate: 0.07 },
};
const POWERUPS = ["double", "spread", "laser"];

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
}

function glowTexture(inner = "rgba(255,255,255,1)") {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.3, "rgba(255,255,255,0.6)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ------------------------------------------------------------------ *
 *  Models
 * ------------------------------------------------------------------ */
function buildShip() {
  const g = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: 0xe8ecef, roughness: 0.35, metalness: 0.5 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xd86a2c, roughness: 0.4, metalness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.5, metalness: 0.6 });
  // fuselage pointing -z
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.6, 8).rotateX(-Math.PI / 2), hull);
  body.scale.set(1, 0.55, 1);
  g.add(body);
  const back = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.7, 8).rotateX(Math.PI / 2), dark);
  back.scale.set(1, 0.55, 1);
  back.position.z = 1.6;
  g.add(back);
  // swept wings
  const wing = new THREE.Shape();
  wing.moveTo(0, -0.6);
  wing.lineTo(1.7, 0.7);
  wing.lineTo(1.7, 1.05);
  wing.lineTo(0, 0.9);
  const wingGeo = new THREE.ExtrudeGeometry(wing, { depth: 0.07, bevelEnabled: false }).rotateX(Math.PI / 2);
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(wingGeo, hull);
    w.scale.x = s;
    w.position.set(0, 0.03, 0.2);
    g.add(w);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.9), trim);
    tip.position.set(s * 1.72, 0.05, 1.1);
    g.add(tip);
  }
  // cockpit
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 10), new THREE.MeshPhysicalMaterial({ color: 0x1b3a4a, roughness: 0.05, metalness: 0.2, clearcoat: 1 }));
  glass.scale.set(0.8, 0.6, 1.6);
  glass.position.set(0, 0.2, -0.2);
  g.add(glass);
  // engine glow
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x6fd7ff, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.scale.set(1.3, 1.3, 1);
  flame.position.z = 2.05;
  g.add(flame);
  g.userData.flame = flame;
  return g;
}

function buildDrone() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), new THREE.MeshStandardMaterial({ color: 0x3a1f3f, roughness: 0.4, metalness: 0.7, flatShading: true }));
  core.scale.set(1.2, 0.7, 1.2);
  g.add(core);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.12, 8, 24), new THREE.MeshStandardMaterial({ color: 0x8b2c4a, roughness: 0.4, metalness: 0.6 }));
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff3355 }));
  eye.position.z = 0.7;
  g.add(eye);
  return g;
}

function asteroidGeometry(seed) {
  const r = seeded(seed);
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const bumps = Array.from({ length: 5 }, () => new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize());
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    let k = 0.82 + r() * 0.12;
    for (const b of bumps) k += 0.12 * Math.max(0, v.clone().normalize().dot(b));
    v.multiplyScalar(k);
    pos.setXYZ(i, v.x, v.y * 0.85, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildBoss() {
  const g = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: 0x2b2238, roughness: 0.45, metalness: 0.7, flatShading: true });
  const glow = new THREE.MeshBasicMaterial({ color: 0xff3355 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.6, 1.4, 10), hull);
  g.add(body);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x552244, roughness: 0.3, metalness: 0.6 }));
  dome.position.y = 0.6;
  g.add(dome);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), glow);
    light.position.set(Math.cos(a) * 4.2, -0.2, Math.sin(a) * 4.2);
    g.add(light);
  }
  for (const s of [-1, 1]) {
    const cannon = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 2.4), hull);
    cannon.position.set(s * 2.6, -0.6, 1.6);
    g.add(cannon);
  }
  g.rotation.x = 0.35;
  return g;
}

/* ------------------------------------------------------------------ *
 *  The game
 * ------------------------------------------------------------------ */
export function createSpaceGame(container) {
  const sound = createSound();
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.append(renderer.domElement);
  renderer.domElement.className = "game-canvas";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060d);
  scene.fog = new THREE.Fog(0x05060d, 90, 170);
  const camera = new THREE.PerspectiveCamera(60, 16 / 10, 0.1, 400);
  const CAM = new THREE.Vector3(0, 5.2, 10.5); // behind and above, so the wings read
  camera.position.copy(CAM);
  camera.lookAt(0, -1.5, -30);

  scene.add(new THREE.AmbientLight(0x6070a0, 0.8));
  const sun = new THREE.DirectionalLight(0xffe6c8, 2.4);
  sun.position.set(-6, 8, 6);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x7ab8ff, 1.2);
  rim.position.set(6, -2, -8);
  scene.add(rim);

  // Far away: a ringed planet, two nebulae, and a starfield that streams past.
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(22, 48, 32),
    new THREE.MeshStandardMaterial({
      map: (() => {
        const c = document.createElement("canvas");
        c.width = 512;
        c.height = 256;
        const g = c.getContext("2d");
        const r = seeded(8);
        for (let y = 0; y < 256; y++) {
          const t = y / 256;
          const v = 110 + 60 * Math.sin(t * 20 + Math.sin(t * 7) * 2) + r() * 10;
          g.fillStyle = `rgb(${v * 0.9},${v * 0.62},${v * 0.5})`;
          g.fillRect(0, y, 512, 1);
        }
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
      })(),
      roughness: 1,
      fog: false,
    }),
  );
  planet.position.set(95, 55, -300);
  scene.add(planet);
  const ringMesh = new THREE.Mesh(new THREE.RingGeometry(29, 42, 64), new THREE.MeshBasicMaterial({ color: 0xc9a27a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, fog: false }));
  ringMesh.position.copy(planet.position);
  ringMesh.rotation.set(1.2, 0.3, 0.2);
  scene.add(ringMesh);
  const nebulaTex = glowTexture();
  for (const [x, y, z, s, col] of [
    [-90, 30, -300, 260, 0x3a1f6a],
    [60, -40, -320, 300, 0x0f4a66],
    [-20, 60, -340, 220, 0x5a1f3f],
  ]) {
    const neb = new THREE.Sprite(new THREE.SpriteMaterial({ map: nebulaTex, color: col, transparent: true, opacity: 0.55, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    neb.position.set(x, y, z);
    neb.scale.set(s, s, 1);
    scene.add(neb);
  }
  const STARS = 1400;
  const starPos = new Float32Array(STARS * 3);
  const rs = seeded(3);
  for (let i = 0; i < STARS; i++) starPos.set([(rs() - 0.5) * 180, (rs() - 0.5) * 110, -rs() * 200], i * 3);
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ map: glowTexture(), color: 0xffffff, size: 0.45, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false, fog: false });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);
  // the jump to warp: every star drawn as a streak that stretches with speed
  const streakPos = new Float32Array(STARS * 6);
  const streakGeo = new THREE.BufferGeometry();
  streakGeo.setAttribute("position", new THREE.BufferAttribute(streakPos, 3));
  const streakMat = new THREE.LineBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0, fog: false, blending: THREE.AdditiveBlending, depthWrite: false });
  const streaks = new THREE.LineSegments(streakGeo, streakMat);
  scene.add(streaks);

  // the player
  const ship = buildShip();
  scene.add(ship);
  const shipLight = new THREE.PointLight(0x6fd7ff, 6, 8, 2);
  scene.add(shipLight);

  // shared geometry and materials for everything that comes and goes
  const astGeos = [1, 2, 3, 4, 5].map(asteroidGeometry);
  const astMat = new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 0.95, flatShading: true });
  const boltGeo = new THREE.CapsuleGeometry(0.08, 0.9, 4, 8).rotateX(Math.PI / 2);
  const laserGeo = new THREE.CapsuleGeometry(0.06, 2.4, 4, 8).rotateX(Math.PI / 2);
  const enemyBoltGeo = new THREE.SphereGeometry(0.22, 10, 8);
  const boltMats = Object.fromEntries(Object.entries(WEAPONS).map(([k, w]) => [k, new THREE.MeshBasicMaterial({ color: w.color })]));
  const enemyBoltMat = new THREE.MeshBasicMaterial({ color: 0xff3355 });
  const puGeo = new THREE.OctahedronGeometry(0.55, 0);
  const sparkTex = glowTexture();

  // --- HUD ---------------------------------------------------------------
  const hud = document.createElement("div");
  hud.className = "game-hud";
  hud.innerHTML = `
    <div class="game-top">
      <div class="game-score">0</div>
      <div class="game-progress"><div class="game-progress-bar"></div></div>
      <div class="game-lives"></div>
      <button type="button" class="game-mute" data-act="mute" aria-label="Sound on or off (M)"></button>
    </div>
    <div class="game-weapon"></div>
    <div class="game-boss hidden"><span>MOTHERSHIP</span><div class="game-boss-bar"><div></div></div></div>
    <div class="game-overlay"></div>`;
  container.append(hud);
  const $ = (sel) => hud.querySelector(sel);
  const speakerOn = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  const speakerOff = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  const paintMute = () => {
    const b = $(".game-mute");
    b.innerHTML = sound.muted ? speakerOff : speakerOn;
    b.classList.toggle("off", sound.muted);
  };
  const heart = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.5 1.2 4.3 2.4.8-1.2 2.2-2.4 4.3-2.4 3.7 0 5.8 3.8 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>`;

  // --- state ---------------------------------------------------------------
  let state = "title";
  let lives = 3;
  let score = 0;
  let best = 0;
  try {
    best = Number(localStorage.getItem("nebula-run-best")) || 0;
  } catch {
    /* storage may be unavailable */
  }
  let weapon = "single";
  let weaponLeft = 0;
  let levelT = 0;
  let fireCool = 0;
  let invuln = 0;
  let spawnAst = 0;
  let spawnEnemy = 4;
  let spawnPower = 10;
  let boss = null;
  let endT = 0;
  let shake = 0;
  let timeScale = 1;
  let speed = 38;
  const keys = new Set();
  const pointer = { active: false, x: 0, y: 0 };
  const shipPos = new THREE.Vector2(0, -1.5);
  const shipVel = new THREE.Vector2();
  const asteroids = [];
  const enemies = [];
  const bullets = [];
  const bolts = [];
  const powerups = [];
  const particles = [];

  const clearAll = () => {
    for (const list of [asteroids, enemies, bullets, bolts, powerups]) {
      for (const o of list) scene.remove(o.mesh);
      list.length = 0;
    }
    for (const p of particles) scene.remove(p.points);
    particles.length = 0;
    if (boss) scene.remove(boss.mesh);
    boss = null;
  };

  function overlay(html) {
    const el = $(".game-overlay");
    el.innerHTML = html;
    el.classList.toggle("show", !!html);
  }
  function titleScreen() {
    overlay(`
      <div class="game-card">
        <div class="game-kicker">Horn.os Arcade</div>
        <h2>NEBULA RUN</h2>
        <p>Dodge the asteroids, shoot the drones, grab power-ups and bring down the mothership.</p>
        <div class="game-keys"><span><kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd> move</span><span><kbd>Space</kbd> fire</span><span><kbd>P</kbd> pause</span><span><kbd>M</kbd> sound</span></div>
        <div class="game-pus"><span class="pu double">Twin</span><span class="pu spread">Spread</span><span class="pu laser">Laser</span></div>
        <button type="button" class="game-btn" data-act="start">Start · <kbd>Enter</kbd></button>
        ${best ? `<div class="game-best">Best: ${best}</div>` : ""}
      </div>`);
  }
  hud.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    sound.unlock();
    if (act === "start" || act === "retry") start();
    if (act === "mute") {
      sound.toggleMute();
      paintMute();
    }
  });

  function updateHud() {
    $(".game-score").textContent = score.toLocaleString("en");
    $(".game-lives").innerHTML = Array.from({ length: 3 }, (_, i) => `<span class="${i < lives ? "on" : ""}">${heart}</span>`).join("");
    $(".game-progress-bar").style.width = `${Math.min(100, (levelT / LEVEL_TIME) * 100)}%`;
    const w = WEAPONS[weapon];
    $(".game-weapon").innerHTML =
      weapon === "single" ? `<span class="pu single">${w.label}</span>` : `<span class="pu ${weapon}">${w.label}</span><i style="width:${(weaponLeft / WEAPON_TIME) * 100}%"></i>`;
    $(".game-boss").classList.toggle("hidden", !boss);
    if (boss) $(".game-boss-bar div").style.width = `${(boss.hp / boss.max) * 100}%`;
  }

  function start() {
    clearAll();
    lives = 3;
    score = 0;
    weapon = "single";
    weaponLeft = 0;
    levelT = 0;
    invuln = 1.5;
    spawnAst = 0.5;
    spawnEnemy = 5;
    spawnPower = 9;
    speed = 38;
    timeScale = 1;
    endT = 0;
    shipPos.set(0, -1.5);
    shipVel.set(0, 0);
    ship.visible = true;
    ship.rotation.set(0, 0, 0);
    camera.fov = 60;
    camera.updateProjectionMatrix();
    state = "playing";
    overlay("");
    updateHud();
    sound.unlock();
    sound.music.stop();
    sound.music.intense(false);
    sound.music.start();
  }

  // --- spawning ----------------------------------------------------------
  const rnd = Math.random;
  function spawnAsteroid(size = 1 + rnd() * 1.8, at = null) {
    const mesh = new THREE.Mesh(astGeos[Math.floor(rnd() * astGeos.length)], astMat);
    mesh.scale.setScalar(size);
    if (at) mesh.position.copy(at);
    else mesh.position.set((rnd() * 2 - 1) * BOUNDS.x * 1.2, (rnd() * 2 - 1) * BOUNDS.y * 1.2, SPAWN_Z);
    scene.add(mesh);
    asteroids.push({ mesh, size, hp: Math.ceil(size * 1.6), spin: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(2), vel: new THREE.Vector3((rnd() - 0.5) * 2, (rnd() - 0.5) * 1.5, speed * (0.7 + rnd() * 0.5)) });
  }
  function spawnDrone() {
    const mesh = buildDrone();
    const baseX = (rnd() * 2 - 1) * BOUNDS.x * 0.8;
    mesh.position.set(baseX, (rnd() * 2 - 1) * BOUNDS.y * 0.8, SPAWN_Z);
    scene.add(mesh);
    enemies.push({ mesh, hp: 3, baseX, phase: rnd() * 6, fire: 1.5 + rnd() * 1.5, stop: -40 - rnd() * 30 });
  }
  function spawnPowerup(kind = POWERUPS[Math.floor(rnd() * POWERUPS.length)], at = null) {
    const mesh = new THREE.Mesh(puGeo, new THREE.MeshStandardMaterial({ color: WEAPONS[kind].color, emissive: WEAPONS[kind].color, emissiveIntensity: 0.8, roughness: 0.3, metalness: 0.3 }));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, color: WEAPONS[kind].color, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.set(2.6, 2.6, 1);
    mesh.add(halo);
    if (at) mesh.position.copy(at);
    else mesh.position.set((rnd() * 2 - 1) * BOUNDS.x * 0.8, (rnd() * 2 - 1) * BOUNDS.y * 0.8, SPAWN_Z);
    scene.add(mesh);
    powerups.push({ mesh, kind });
  }
  function spawnBoss() {
    const mesh = buildBoss();
    mesh.position.set(0, 3.5, -120);
    scene.add(mesh);
    boss = { mesh, hp: 90, max: 90, fire: 2, t: 0 };
    sound.bossWarn();
    sound.music.intense(true);
  }

  // --- effects -----------------------------------------------------------
  function explode(pos, color = 0xffa040, n = 40, power = 10, size = 0.5) {
    const count = Math.round(n);
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    const v = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p.set([pos.x, pos.y, pos.z], i * 3);
      const d = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(power * (0.3 + rnd()));
      v.set([d.x, d.y, d.z], i * 3);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(p, 3));
    const mat = new THREE.PointsMaterial({ map: sparkTex, color, size, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    particles.push({ points, v, life: 1, fade: 1.2 + rnd() * 0.5 });
  }

  // --- firing ------------------------------------------------------------
  function fire() {
    const w = WEAPONS[weapon];
    fireCool = w.rate;
    sound.shoot(weapon);
    const origin = new THREE.Vector3(shipPos.x, shipPos.y, -1.2);
    const shots = [];
    if (weapon === "single") shots.push([0, 0]);
    if (weapon === "double") shots.push([-0.6, 0], [0.6, 0]);
    if (weapon === "spread") shots.push([0, 0], [-0.25, 0], [0.25, 0], [-0.5, 0], [0.5, 0]);
    if (weapon === "laser") shots.push([0, 0]);
    for (const [a] of shots) {
      const mesh = new THREE.Mesh(weapon === "laser" ? laserGeo : boltGeo, boltMats[weapon]);
      mesh.position.copy(origin);
      if (weapon === "double") mesh.position.x += a;
      const dir = new THREE.Vector3(weapon === "spread" ? Math.sin(a) : 0, 0, -1).normalize();
      mesh.rotation.set(0, weapon === "spread" ? -a : 0, 0); // the bolt geometry already lies along z
      scene.add(mesh);
      bullets.push({ mesh, vel: dir.multiplyScalar(weapon === "laser" ? 140 : 95), dmg: weapon === "laser" ? 1 : weapon === "spread" ? 1 : 1.5, pierce: weapon === "laser", hit: new Set() });
    }
  }

  function hurt() {
    if (invuln > 0 || state !== "playing") return;
    lives -= 1;
    shake = 0.6;
    sound.hurt();
    explode(new THREE.Vector3(shipPos.x, shipPos.y, 0), 0x7cf2ff, 50, 8, 0.4);
    weapon = "single";
    weaponLeft = 0;
    if (lives <= 0) lose();
    else invuln = 2;
    updateHud();
  }

  function lose() {
    state = "lost";
    endT = 0;
    ship.visible = false;
    shake = 1.2;
    const p = new THREE.Vector3(shipPos.x, shipPos.y, 0);
    explode(p, 0xffa040, 140, 14, 0.7);
    explode(p, 0xff3355, 90, 9, 0.9);
    explode(p, 0xffffff, 60, 20, 0.35);
    timeScale = 0.35;
    saveBest();
    sound.music.stop();
    sound.bigExplosion();
    sound.lose();
  }

  function win() {
    state = "won";
    endT = 0;
    saveBest();
    sound.music.stop();
  }

  function saveBest() {
    if (score > best) {
      best = score;
      try {
        localStorage.setItem("nebula-run-best", String(best));
      } catch {
        /* ignore */
      }
    }
  }

  // --- input -------------------------------------------------------------
  const KEYMAP = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", a: "left", d: "right", w: "up", s: "down", q: "left", z: "up", " ": "fire" };
  function onKey(e, down) {
    if (down) sound.unlock();
    if (down && (e.key === "m" || e.key === "M")) {
      sound.toggleMute();
      paintMute();
      return true;
    }
    const k = KEYMAP[e.key] ?? KEYMAP[e.key?.toLowerCase?.()];
    if (down && e.key === "Enter" && state !== "playing" && state !== "paused") {
      start();
      return true;
    }
    if (down && (e.key === "p" || e.key === "P") && (state === "playing" || state === "paused")) {
      state = state === "playing" ? "paused" : "playing";
      if (state === "paused") sound.music.stop();
      else sound.music.start();
      overlay(state === "paused" ? `<div class="game-card small"><h2>PAUSED</h2><p>Press <kbd>P</kbd> to resume</p></div>` : "");
      return true;
    }
    if (!k) return false;
    if (down) keys.add(k);
    else keys.delete(k);
    return true;
  }
  const canvas = renderer.domElement;
  const toPlay = (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
  };
  canvas.addEventListener("pointerdown", (e) => {
    if (state !== "playing") return;
    pointer.active = true;
    toPlay(e);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => pointer.active && toPlay(e));
  const release = () => (pointer.active = false);
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  // --- loop --------------------------------------------------------------
  const clock = new THREE.Clock();
  let running = true;
  let t = 0;
  const hitR = (a, b, r) => a.distanceToSquared(b) < r * r;

  function step(dt) {
    t += dt;
    const playing = state === "playing";
    const flying = playing || state === "won" || state === "title";

    // stars stream past; faster in the warp at the end
    const warp = state === "won" && endT > 1.5 ? Math.min(1, (endT - 1.5) / 1.2) : 0;
    const starSpeed = (state === "paused" ? 0 : 60) + warp * 400;
    const sp = starGeo.attributes.position;
    for (let i = 0; i < STARS; i++) {
      let z = sp.getZ(i) + starSpeed * dt;
      if (z > 12) z -= 212;
      sp.setZ(i, z);
    }
    sp.needsUpdate = true;
    starMat.opacity = 0.9 * (1 - warp);
    streakMat.opacity = warp;
    if (warp > 0) {
      const len = 2 + warp * 40;
      for (let i = 0; i < STARS; i++) {
        const x = sp.getX(i);
        const y = sp.getY(i);
        const z = sp.getZ(i);
        streakPos.set([x, y, z, x, y, z - len], i * 6);
      }
      streakGeo.attributes.position.needsUpdate = true;
    }
    planet.rotation.y += dt * 0.02;

    if (state === "paused") return;

    // ship
    if (playing) {
      const ax = (keys.has("right") ? 1 : 0) - (keys.has("left") ? 1 : 0);
      const ay = (keys.has("up") ? 1 : 0) - (keys.has("down") ? 1 : 0);
      if (pointer.active) {
        const tx = pointer.x * BOUNDS.x;
        const ty = pointer.y * BOUNDS.y;
        shipVel.set((tx - shipPos.x) * 8, (ty - shipPos.y) * 8);
      } else {
        shipVel.x += (ax * 22 - shipVel.x) * Math.min(1, dt * 10);
        shipVel.y += (ay * 16 - shipVel.y) * Math.min(1, dt * 10);
      }
      shipPos.addScaledVector(shipVel, dt);
      shipPos.x = THREE.MathUtils.clamp(shipPos.x, -BOUNDS.x, BOUNDS.x);
      shipPos.y = THREE.MathUtils.clamp(shipPos.y, -BOUNDS.y, BOUNDS.y);
      fireCool -= dt;
      if ((keys.has("fire") || pointer.active) && fireCool <= 0) fire();
      invuln = Math.max(0, invuln - dt);
      ship.visible = invuln <= 0 || Math.floor(t * 12) % 2 === 0;
      if (weaponLeft > 0) {
        weaponLeft -= dt;
        if (weaponLeft <= 0) weapon = "single";
      }
      levelT += dt;
      speed = 38 + levelT * 0.35;

      // spawns
      if (!boss) {
        spawnAst -= dt;
        if (spawnAst <= 0) {
          spawnAsteroid();
          spawnAst = Math.max(0.35, 1.2 - levelT * 0.012) * (0.6 + rnd() * 0.8);
        }
        spawnEnemy -= dt;
        if (spawnEnemy <= 0) {
          const n = 1 + Math.floor(levelT / 25);
          for (let i = 0; i < n; i++) spawnDrone();
          spawnEnemy = 5 + rnd() * 3;
        }
        spawnPower -= dt;
        if (spawnPower <= 0) {
          spawnPowerup();
          spawnPower = 11 + rnd() * 6;
        }
        if (levelT >= LEVEL_TIME) spawnBoss();
      }
    }
    ship.position.set(shipPos.x, shipPos.y, 0);
    ship.rotation.z = THREE.MathUtils.lerp(ship.rotation.z, -shipVel.x * 0.045, Math.min(1, dt * 8));
    ship.rotation.x = THREE.MathUtils.lerp(ship.rotation.x, shipVel.y * 0.03, Math.min(1, dt * 8));
    ship.userData.flame.scale.setScalar(1.1 + Math.sin(t * 40) * 0.15 + warp * 2);
    shipLight.position.set(shipPos.x, shipPos.y + 0.5, 1.5);

    // bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.mesh.position.addScaledVector(b.vel, dt);
      if (b.mesh.position.z < SPAWN_Z - 10) {
        scene.remove(b.mesh);
        bullets.splice(i, 1);
      }
    }
    // asteroids
    for (let i = asteroids.length - 1; i >= 0; i--) {
      const a = asteroids[i];
      if (flying) a.mesh.position.addScaledVector(a.vel, dt);
      a.mesh.rotation.x += a.spin.x * dt;
      a.mesh.rotation.y += a.spin.y * dt;
      let dead = false;
      for (let j = bullets.length - 1; j >= 0 && !dead; j--) {
        const b = bullets[j];
        if (b.hit.has(a) || !hitR(b.mesh.position, a.mesh.position, a.size + 0.3)) continue;
        a.hp -= b.dmg;
        explode(b.mesh.position, 0xffd08a, 8, 5, 0.3);
        sound.hit();
        if (b.pierce) b.hit.add(a);
        else {
          scene.remove(b.mesh);
          bullets.splice(j, 1);
        }
        if (a.hp <= 0) dead = true;
      }
      if (dead) {
        explode(a.mesh.position, 0xc9a27a, 30 + a.size * 10, 7, 0.45);
        sound.explode(a.size * 0.7);
        score += Math.round(50 * a.size);
        if (a.size > 1.6) for (let k = 0; k < 2; k++) spawnAsteroid(a.size * 0.5, a.mesh.position.clone().add(new THREE.Vector3((rnd() - 0.5) * 2, (rnd() - 0.5) * 2, 0)));
        scene.remove(a.mesh);
        asteroids.splice(i, 1);
        continue;
      }
      if (playing && Math.abs(a.mesh.position.z) < a.size + 1 && hitR(a.mesh.position, ship.position, a.size * 0.85 + 0.7)) {
        hurt();
        explode(a.mesh.position, 0xc9a27a, 30, 7, 0.45);
        scene.remove(a.mesh);
        asteroids.splice(i, 1);
        continue;
      }
      if (a.mesh.position.z > 14) {
        scene.remove(a.mesh);
        asteroids.splice(i, 1);
      }
    }
    // drones
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      const m = e.mesh;
      if (m.position.z < e.stop) m.position.z += speed * 0.9 * dt;
      else m.position.z += 3 * dt;
      m.position.x = e.baseX + Math.sin(t * 1.3 + e.phase) * 3;
      m.rotation.y += dt * 2;
      if (playing && m.position.z > -90) {
        e.fire -= dt;
        if (e.fire <= 0) {
          e.fire = 1.6 + rnd() * 1.6;
          const bolt = new THREE.Mesh(enemyBoltGeo, enemyBoltMat);
          bolt.position.copy(m.position);
          const dir = new THREE.Vector3(shipPos.x, shipPos.y, 0).sub(m.position).normalize();
          scene.add(bolt);
          bolts.push({ mesh: bolt, vel: dir.multiplyScalar(26) });
          sound.enemyShot();
        }
      }
      let dead = false;
      for (let j = bullets.length - 1; j >= 0 && !dead; j--) {
        const b = bullets[j];
        if (b.hit.has(e) || !hitR(b.mesh.position, m.position, 1.3)) continue;
        e.hp -= b.dmg;
        explode(b.mesh.position, 0xff6688, 8, 5, 0.3);
        sound.hit();
        if (b.pierce) b.hit.add(e);
        else {
          scene.remove(b.mesh);
          bullets.splice(j, 1);
        }
        if (e.hp <= 0) dead = true;
      }
      if (dead) {
        explode(m.position, 0xff3355, 60, 10, 0.5);
        explode(m.position, 0xffc070, 30, 6, 0.4);
        sound.explode(1.3);
        score += 250;
        if (rnd() < 0.3) spawnPowerup(undefined, m.position.clone());
        scene.remove(m);
        enemies.splice(i, 1);
        continue;
      }
      if (playing && hitR(m.position, ship.position, 1.5)) {
        hurt();
        explode(m.position, 0xff3355, 60, 10, 0.5);
        scene.remove(m);
        enemies.splice(i, 1);
        continue;
      }
      if (m.position.z > 14) {
        scene.remove(m);
        enemies.splice(i, 1);
      }
    }
    // enemy bolts
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.mesh.position.addScaledVector(b.vel, dt);
      if (playing && hitR(b.mesh.position, ship.position, 0.8)) {
        hurt();
        scene.remove(b.mesh);
        bolts.splice(i, 1);
        continue;
      }
      if (b.mesh.position.z > 14 || Math.abs(b.mesh.position.x) > 30) {
        scene.remove(b.mesh);
        bolts.splice(i, 1);
      }
    }
    // power-ups
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      if (flying) p.mesh.position.z += speed * 0.6 * dt;
      p.mesh.rotation.y += dt * 3;
      p.mesh.rotation.x += dt * 1.5;
      if (playing && hitR(p.mesh.position, ship.position, 1.6)) {
        weapon = p.kind;
        weaponLeft = WEAPON_TIME;
        sound.pickup();
        explode(p.mesh.position, WEAPONS[p.kind].color, 40, 6, 0.4);
        score += 100;
        scene.remove(p.mesh);
        powerups.splice(i, 1);
        continue;
      }
      if (p.mesh.position.z > 14) {
        scene.remove(p.mesh);
        powerups.splice(i, 1);
      }
    }
    // the mothership
    if (boss) {
      const m = boss.mesh;
      boss.t += dt;
      if (m.position.z < -55) m.position.z += 14 * dt;
      m.position.x = Math.sin(boss.t * 0.6) * 6;
      m.rotation.y += dt * 0.6;
      if (playing) {
        boss.fire -= dt;
        if (boss.fire <= 0) {
          boss.fire = boss.hp < boss.max / 2 ? 1.1 : 1.7;
          for (let k = -3; k <= 3; k++) {
            const bolt = new THREE.Mesh(enemyBoltGeo, enemyBoltMat);
            bolt.position.copy(m.position).add(new THREE.Vector3(0, -1, 3));
            const dir = new THREE.Vector3(shipPos.x + k * 2.2, shipPos.y, 0).sub(bolt.position).normalize();
            scene.add(bolt);
            bolts.push({ mesh: bolt, vel: dir.multiplyScalar(24) });
          }
          sound.enemyShot();
        }
        for (let j = bullets.length - 1; j >= 0; j--) {
          const b = bullets[j];
          if (b.hit.has(boss) || !hitR(b.mesh.position, m.position, 4.6)) continue;
          boss.hp -= b.dmg;
          explode(b.mesh.position, 0xff6688, 10, 6, 0.35);
          sound.hit();
          if (b.pierce) b.hit.add(boss);
          else {
            scene.remove(b.mesh);
            bullets.splice(j, 1);
          }
        }
        if (boss.hp <= 0) {
          score += 5000;
          win();
        }
      }
    }

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt / p.fade;
      const pos = p.points.geometry.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        pos.setXYZ(k, pos.getX(k) + p.v[k * 3] * dt, pos.getY(k) + p.v[k * 3 + 1] * dt, pos.getZ(k) + p.v[k * 3 + 2] * dt);
        p.v[k * 3] *= 0.97;
        p.v[k * 3 + 1] *= 0.97;
        p.v[k * 3 + 2] *= 0.97;
      }
      pos.needsUpdate = true;
      p.points.material.opacity = Math.max(0, p.life);
      if (p.life <= 0) {
        scene.remove(p.points);
        p.points.geometry.dispose();
        p.points.material.dispose();
        particles.splice(i, 1);
      }
    }

    // endings
    if (state === "won") {
      endT += dt;
      if (boss && endT < 2) {
        // the mothership goes up in a chain of blasts
        if (Math.floor(endT * 8) !== Math.floor((endT - dt) * 8)) {
          explode(boss.mesh.position.clone().add(new THREE.Vector3((rnd() - 0.5) * 8, (rnd() - 0.5) * 3, (rnd() - 0.5) * 6)), [0xffa040, 0xff3355, 0xffffff][Math.floor(rnd() * 3)], 70, 12, 0.8);
          shake = 0.5;
          sound.explode(1.8);
        }
      } else if (boss) {
        explode(boss.mesh.position, 0xffffff, 200, 25, 1);
        explode(boss.mesh.position, 0xffa040, 160, 16, 1.2);
        scene.remove(boss.mesh);
        boss = null;
        shake = 1;
        sound.bigExplosion();
        sound.win();
      }
      // a victory roll, then the jump to warp
      if (endT > 1.2 && endT < 2.4) ship.rotation.z = -((endT - 1.2) / 1.2) * Math.PI * 2;
      if (endT > 2.4) {
        shipPos.y += (0 - shipPos.y) * dt * 2;
        shipPos.x += (0 - shipPos.x) * dt * 2;
        camera.fov = 60 + warp * 25;
        camera.updateProjectionMatrix();
      }
      if (endT > 3.6 && !$(".game-overlay").classList.contains("show")) {
        overlay(`
          <div class="game-card victory">
            <div class="game-kicker">Mission complete</div>
            <h2>VICTORY</h2>
            <p>The mothership is down and the lane is clear.</p>
            <div class="game-final">${score.toLocaleString("en")}<small>points${score > 0 && score >= best ? " · new best" : ""}</small></div>
            <button type="button" class="game-btn" data-act="retry">Play again · <kbd>Enter</kbd></button>
          </div>`);
        for (let k = 0; k < 6; k++) setTimeout(() => running && explode(new THREE.Vector3((rnd() - 0.5) * 16, 2 + rnd() * 5, -20 - rnd() * 20), [0x7cf2ff, 0xffb04a, 0xff5ad8, 0x7dff9a][k % 4], 90, 12, 0.6), k * 280);
      }
    }
    if (state === "lost") {
      endT += dt;
      timeScale = Math.min(1, 0.35 + endT * 0.4);
      if (endT > 1.6 && !$(".game-overlay").classList.contains("show")) {
        overlay(`
          <div class="game-card lose">
            <div class="game-kicker">Ship lost</div>
            <h2>GAME OVER</h2>
            <p>The asteroid field won this time.</p>
            <div class="game-final">${score.toLocaleString("en")}<small>points · best ${best.toLocaleString("en")}</small></div>
            <button type="button" class="game-btn" data-act="retry">Try again · <kbd>Enter</kbd></button>
          </div>`);
      }
    }

    // camera: follow the ship a little, shake on hits
    shake = Math.max(0, shake - dt * 1.5);
    camera.position.set(CAM.x + shipPos.x * 0.25 + (rnd() - 0.5) * shake, CAM.y + shipPos.y * 0.2 + (rnd() - 0.5) * shake, CAM.z);
    camera.lookAt(shipPos.x * 0.3, shipPos.y * 0.2 - 1.5, -30);
    if (playing || state === "won" || state === "lost") updateHud();
  }

  function frame() {
    if (!running) return;
    const raw = Math.min(0.05, clock.getDelta());
    step(raw * timeScale);
    renderer.render(scene, camera);
  }

  function resize() {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();
  titleScreen();
  updateHud();
  paintMute();
  renderer.setAnimationLoop(frame);

  return {
    onKey,
    pause() {
      if (state === "playing") {
        state = "paused";
        overlay(`<div class="game-card small"><h2>PAUSED</h2><p>Press <kbd>P</kbd> to resume</p></div>`);
      }
      running = false;
      renderer.setAnimationLoop(null);
      sound.suspend();
    },
    resume() {
      sound.resume();
      running = true;
      clock.getDelta();
      renderer.setAnimationLoop(frame);
    },
    dispose() {
      sound.dispose();
      running = false;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      renderer.dispose();
      renderer.forceContextLoss?.();
    },
    debug: { sound, start, spawnBoss, win, lose, state: () => state, setWeapon: (w) => ((weapon = w), (weaponLeft = WEAPON_TIME)) },
  };
}
