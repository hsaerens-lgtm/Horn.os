import * as THREE from "three";
import { CSS3DRenderer, CSS3DObject } from "three/addons/renderers/CSS3DRenderer.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { plasticGrain, parchment, battleMap, agentScreen, agentFace } from "./textures.js";

// The sheet is 860x1180 CSS px, laid flat on the table at this physical width.
const SHEET_W = 0.34;
const SHEET_SCALE = SHEET_W / 860;
const SHEET_H = 1180 * SHEET_SCALE;

const TABLE_Y = 0.76;
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createScene({ container, sheetRoot, agents, onEnter, onExit }) {
  const width = () => container.clientWidth;
  const height = () => container.clientHeight;

  // ---------- Renderers (CSS3D below, WebGL on top with a transparent cut-out) ----------
  const cssRenderer = new CSS3DRenderer();
  cssRenderer.setSize(width(), height());
  cssRenderer.domElement.style.zIndex = "1";
  container.appendChild(cssRenderer.domElement);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width(), height());
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.style.zIndex = "2";
  renderer.domElement.style.pointerEvents = "none";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width() / height(), 0.05, 50);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.24;
  pmrem.dispose();

  // ---------- Materials ----------
  const texLoader = new THREE.TextureLoader();
  const loadPBR = (name, repeat) => {
    const load = (suffix, isColor) => {
      const t = texLoader.load(`assets/textures/${name}_${suffix}.jpg`);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat[0], repeat[1]);
      t.anisotropy = 8;
      if (isColor) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    return { map: load("diff", true), normalMap: load("nor_gl", false), roughnessMap: load("arm", false) };
  };

  const tex = {
    table: loadPBR("american_walnut_veneer", [1.4, 0.9]),
    tableEdge: loadPBR("american_walnut_veneer", [4, 0.4]),
    floor: loadPBR("herringbone_parquet", [2.2, 2.2]),
    wall: loadPBR("concrete_wall_008", [3, 1.4]),
    plastic: plasticGrain(),
    parchment: parchment(),
    map: battleMap(),
  };

  const N = (x, y = x) => new THREE.Vector2(x, y);
  const mat = {
    floor: new THREE.MeshStandardMaterial({ ...tex.floor, color: 0x8a7258, normalScale: N(0.35), roughness: 0.55, envMapIntensity: 0.7 }),
    wall: new THREE.MeshStandardMaterial({ ...tex.wall, color: 0x6a7186, normalScale: N(0.3), envMapIntensity: 0.5 }),
    wood: new THREE.MeshStandardMaterial({ ...tex.table, color: 0xb8855a, normalScale: N(0.5), envMapIntensity: 0.9 }),
    woodDark: new THREE.MeshStandardMaterial({ ...tex.tableEdge, color: 0x6b4a30, normalScale: N(0.4), envMapIntensity: 0.6 }),
    parchment: new THREE.MeshStandardMaterial({ ...tex.parchment, normalScale: N(0.4), envMapIntensity: 0.5, side: THREE.DoubleSide }),
    map: new THREE.MeshStandardMaterial({ ...tex.map, normalScale: N(0.25), envMapIntensity: 0.4 }),
    dice: new THREE.MeshStandardMaterial({ color: 0xc8342a, roughness: 0.22, metalness: 0.1, envMapIntensity: 1.5 }),
    dicePale: new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.3, envMapIntensity: 1.2 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x8a8f99, roughness: 0.3, metalness: 0.85, envMapIntensity: 1.6 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1c1f26, roughness: 0.45, envMapIntensity: 0.9 }),
    cutout: new THREE.MeshBasicMaterial({ color: 0x000000, blending: THREE.NoBlending, opacity: 0, transparent: true }),
  };

  const box = (w, h, d, m, x, y, z, { cast = true, receive = true } = {}) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    scene.add(mesh);
    return mesh;
  };

  // ---------- Room ----------
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), mat.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 5), mat.wall);
  wall.position.set(0, 2.5, -2.1);
  wall.receiveShadow = true;
  scene.add(wall);
  box(14, 0.1, 0.02, mat.woodDark, 0, 0.05, -2.09, { cast: false });

  // ---------- Table ----------
  const TABLE_W = 2.1;
  const TABLE_D = 1.35;
  box(TABLE_W, 0.05, TABLE_D, mat.wood, 0, TABLE_Y - 0.025, 0);
  box(TABLE_W + 0.04, 0.05, 0.04, mat.woodDark, 0, TABLE_Y - 0.06, TABLE_D / 2);
  box(TABLE_W + 0.04, 0.05, 0.04, mat.woodDark, 0, TABLE_Y - 0.06, -TABLE_D / 2);
  for (const [x, z] of [[-0.94, -0.56], [0.94, -0.56], [-0.94, 0.56], [0.94, 0.56]]) {
    box(0.08, TABLE_Y - 0.05, 0.08, mat.woodDark, x, (TABLE_Y - 0.05) / 2, z);
  }

  // ---------- Battle map ----------
  const mapMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.72), mat.map);
  mapMesh.rotation.x = -Math.PI / 2;
  mapMesh.position.set(0.12, TABLE_Y + 0.002, -0.08);
  mapMesh.receiveShadow = true;
  scene.add(mapMesh);

  // ---------- DM screen: three parchment panels, hinged, facing the players ----------
  const dmScreen = new THREE.Group();
  dmScreen.position.set(-0.66, TABLE_Y, -0.02);
  scene.add(dmScreen);
  const panel = (w, x, rotY) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, 0.235, 0.008), mat.parchment);
    p.position.set(x, 0.118, 0);
    p.rotation.y = rotY;
    p.castShadow = true;
    p.receiveShadow = true;
    dmScreen.add(p);
    return p;
  };
  panel(0.26, -0.24, 0.5);
  panel(0.3, 0, 0);
  panel(0.26, 0.24, -0.5);

  // ---------- Character sheet, lying flat in front of the DM ----------
  const SHEET_POS = new THREE.Vector3(-0.3, TABLE_Y + 0.004, 0.36);
  const sheetObject = new CSS3DObject(sheetRoot);
  sheetObject.scale.setScalar(SHEET_SCALE);
  sheetObject.rotation.x = -Math.PI / 2;
  sheetObject.position.copy(SHEET_POS);
  scene.add(sheetObject);

  const sheetMesh = new THREE.Mesh(new THREE.PlaneGeometry(SHEET_W, SHEET_H), mat.cutout);
  sheetMesh.rotation.x = -Math.PI / 2;
  sheetMesh.position.copy(SHEET_POS);
  scene.add(sheetMesh);

  // A paper edge under the sheet so it reads as a physical page on the table.
  const sheetBack = new THREE.Mesh(
    new THREE.PlaneGeometry(SHEET_W + 0.012, SHEET_H + 0.012),
    new THREE.MeshStandardMaterial({ color: 0xd9cdb2, roughness: 0.9, envMapIntensity: 0.4 })
  );
  sheetBack.rotation.x = -Math.PI / 2;
  sheetBack.position.set(SHEET_POS.x, TABLE_Y + 0.0015, SHEET_POS.z);
  sheetBack.receiveShadow = true;
  scene.add(sheetBack);

  // ---------- Dice ----------
  const diceSpecs = [
    [new THREE.IcosahedronGeometry(0.026), mat.dice, 0.06, 0.3],
    [new THREE.DodecahedronGeometry(0.022), mat.dicePale, 0.13, 0.42],
    [new THREE.OctahedronGeometry(0.02), mat.dice, -0.02, 0.46],
    [new THREE.TetrahedronGeometry(0.022), mat.dicePale, 0.1, 0.19],
    [new THREE.BoxGeometry(0.03, 0.03, 0.03), mat.dice, 0.19, 0.3],
    [new THREE.BoxGeometry(0.028, 0.028, 0.028), mat.dicePale, 0.24, 0.42],
  ];
  for (const [geo, m, x, z] of diceSpecs) {
    const d = new THREE.Mesh(geo, m);
    d.position.set(x, TABLE_Y + 0.019, z);
    d.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    d.castShadow = true;
    scene.add(d);
  }

  // ---------- Miniatures: one per agent on the map, plus what they are fighting ----------
  const mini = (colour, x, z, tall = 0.052) => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.021, 0.006, 20), mat.dark);
    base.castShadow = true;
    g.add(base);
    const bodyMat = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.35, metalness: 0.15, envMapIntensity: 1.3 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, tall * 0.55, 4, 12), bodyMat);
    body.position.y = 0.006 + tall * 0.5;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.0115, 14, 12), bodyMat);
    head.position.y = 0.006 + tall * 0.95;
    head.castShadow = true;
    g.add(head);
    g.position.set(x, TABLE_Y + 0.004, z);
    scene.add(g);
    return g;
  };

  const party = agents ?? [];
  const miniSpots = [[-0.12, -0.16], [-0.04, -0.05], [0.05, -0.18], [0.14, -0.06]];
  party.slice(0, 4).forEach((a, i) => mini(a.colour, miniSpots[i][0], miniSpots[i][1]));
  // the encounter on the far side of the map
  mini(0x8c2f22, 0.34, -0.3, 0.07);
  mini(0x8c2f22, 0.44, -0.2, 0.062);

  // ---------- The party ----------
  // Each agent is a suited figure with a television for a head, its mark on the
  // screen. Built from primitives so there is nothing to download or license.
  const suitMat = new THREE.MeshStandardMaterial({ color: 0x3b4252, roughness: 0.74, envMapIntensity: 0.7 });
  const suitDark = new THREE.MeshStandardMaterial({ color: 0x2a3040, roughness: 0.78, envMapIntensity: 0.55 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0xb9bfcc, roughness: 0.7, envMapIntensity: 0.45 });
  const caseMat = new THREE.MeshStandardMaterial({ color: 0x31353e, roughness: 0.6, ...tex.plastic, normalScale: N(0.25), envMapIntensity: 0.8 });
  const heads = [];

  const agentLights = [];

  const makeAgent = (a, x, z, rotY) => {
    const accent = new THREE.Color(a.colour);
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);

    // Seated torso: a capsule flattened front-to-back reads as a body in a jacket.
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.32, 4, 18), suitMat);
    torso.scale.set(1, 1, 0.66);
    torso.position.y = 1.0;
    torso.castShadow = true;
    g.add(torso);

    for (const s of [-1, 1]) {
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), suitMat);
      shoulder.position.set(s * 0.185, 1.15, 0);
      shoulder.scale.z = 0.8;
      shoulder.castShadow = true;
      g.add(shoulder);

      // Upper arm angles down and forward; the forearm rests on the table edge.
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.17, 4, 12), suitMat);
      upper.position.set(s * 0.2, 0.99, 0.05);
      upper.rotation.set(0.5, 0, s * 0.12);
      upper.castShadow = true;
      g.add(upper);

      const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.046, 0.2, 4, 12), suitMat);
      fore.position.set(s * 0.21, 0.86, 0.24);
      fore.rotation.set(1.28, 0, s * 0.06);
      fore.castShadow = true;
      g.add(fore);

      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.016, 14), shirtMat);
      cuff.position.set(s * 0.215, 0.815, 0.335);
      cuff.rotation.x = 1.28;
      g.add(cuff);

      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 12), new THREE.MeshStandardMaterial({ color: 0x5f6472, roughness: 0.68, envMapIntensity: 0.5 }));
      hand.position.set(s * 0.215, 0.795, 0.39);
      hand.scale.set(0.85, 0.6, 1.15);
      hand.castShadow = true;
      g.add(hand);

      // lapel
      const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.011), suitDark);
      lapel.position.set(s * 0.06, 1.095, 0.124);
      lapel.rotation.z = s * 0.2;
      g.add(lapel);
    }

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.086, 0.035, 16), shirtMat);
    collar.position.set(0, 1.165, 0.015);
    g.add(collar);

    const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.15, 0.01), shirtMat);
    shirt.position.set(0, 1.105, 0.12);
    g.add(shirt);

    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.17, 0.01), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.38, envMapIntensity: 1.3 }));
    tie.position.set(0, 1.07, 0.128);
    g.add(tie);

    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.016, 0.01), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5, envMapIntensity: 1.1 }));
    pocket.position.set(-0.115, 1.0, 0.126);
    g.add(pocket);

    // ----- television head -----
    const head = new THREE.Group();
    head.position.set(0, 1.30, 0.01);
    g.add(head);
    heads.push({ head, base: 0.01 });

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.055, 0.1, 14), suitDark);
    neck.position.y = -0.125;
    head.add(neck);

    const shell = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.23), caseMat);
    shell.castShadow = true;
    head.add(shell);

    const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.23, 0.02), caseMat);
    bezel.position.z = 0.117;
    head.add(bezel);

    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.235, 0.176),
      new THREE.MeshBasicMaterial({ map: agentFace(a, { seed: party.indexOf(a) + 2 }), toneMapped: false })
    );
    face.position.set(0, 0.008, 0.129);
    head.add(face);

    // side knobs, because every set had them
    for (let k = 0; k < 2; k++) {
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.012, 12), suitDark);
      knob.position.set(0.152, 0.05 - k * 0.055, 0.05);
      knob.rotation.z = Math.PI / 2;
      head.add(knob);
    }

    const faceGlow = new THREE.PointLight(accent, 0.55, 1.1, 2);
    faceGlow.position.set(0, 1.30, 0.22);
    g.add(faceGlow);
    agentLights.push(faceGlow);

    return g;
  };

  party.slice(0, 4).forEach((a, i) => {
    const x = -0.66 + i * 0.44;
    const z = -0.52;
    const g = new THREE.Group();
    g.position.set(x, TABLE_Y, z);
    g.rotation.y = 0.16 * (1.5 - i);
    scene.add(g);

    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.012, 20), mat.dark);
    stand.position.y = 0.006;
    stand.castShadow = true;
    g.add(stand);

    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.012), mat.metal);
    neck.position.y = 0.035;
    g.add(neck);

    const shell = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.014), mat.dark);
    shell.position.set(0, 0.125, 0);
    shell.rotation.x = -0.22;
    shell.castShadow = true;
    g.add(shell);

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.178, 0.118),
      new THREE.MeshBasicMaterial({ map: agentScreen(a.name, a.colour, { seed: i + 1 }), toneMapped: false })
    );
    screen.position.set(0, 0.125, 0.0085);
    screen.rotation.x = -0.22;
    screen.position.z += 0.0022;
    g.add(screen);

  });

  // The figures sit behind their laptops, on the far side of the table.
  party.slice(0, 4).forEach((a, i) => makeAgent(a, -0.66 + i * 0.44, -1.02, 0.2 * (1.5 - i)));

  // ---------- Furniture ----------
  const gltfLoader = new GLTFLoader();
  const addModel = (name, { position, rotationY = 0, scale = 1, tint = null }) =>
    gltfLoader
      .loadAsync(`assets/models/${name}/${name}.gltf`)
      .then(({ scene: obj }) => {
        obj.position.fromArray(position);
        obj.rotation.y = rotationY;
        obj.scale.setScalar(scale);
        obj.traverse((n) => {
          if (!n.isMesh) return;
          n.castShadow = true;
          n.receiveShadow = true;
          if (!n.material) return;
          n.material.envMapIntensity = 0.7;
          if (tint) n.material.color.multiplyScalar(tint);
        });
        scene.add(obj);
        return obj;
      })
      .catch((err) => console.warn(`model "${name}" not loaded:`, err));

  addModel("modern_arm_chair_01", { position: [-1.95, 0, -0.5], rotationY: 1.25, tint: 0.85 });
  addModel("potted_plant_04", { position: [-0.94, TABLE_Y, -0.5], rotationY: -0.6 });
  addModel("alarm_clock_01", { position: [0.72, TABLE_Y, 0.38], rotationY: -2.5 });

  // ---------- Lighting ----------
  // A pendant lamp over the table is the key light: it puts the map and the sheet
  // in a warm pool and lets the room fall away, the way a real table looks at night.
  const pendant = new THREE.Group();
  pendant.position.set(0, 1.78, -0.05);
  scene.add(pendant);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.9, 8), mat.dark);
  cord.position.y = 0.45;
  pendant.add(cord);
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.17, 28, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x24262c, roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide, envMapIntensity: 1.1 })
  );
  shade.castShadow = true;
  pendant.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.026, 14, 12), new THREE.MeshBasicMaterial({ color: 0xffdca8 }));
  bulb.position.y = -0.06;
  pendant.add(bulb);

  const keyLight = new THREE.PointLight(0xffc489, 8, 4.5, 2);
  keyLight.position.set(0, 1.71, -0.05);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.bias = -0.002;
  scene.add(keyLight);

  // Rim light from behind the party, so the figures read against the dark wall
  // instead of dissolving into it.
  const rim = new THREE.DirectionalLight(0x9fb4d8, 0.5);
  rim.position.set(-1.2, 2.4, -3.2);
  rim.target.position.set(0, 1.1, -0.6);
  scene.add(rim);
  scene.add(rim.target);

  scene.add(new THREE.HemisphereLight(0x3a3550, 0x0b0a09, 0.28));
  const fill = new THREE.DirectionalLight(0x8090c0, 0.12);
  fill.position.set(2, 3, 3);
  scene.add(fill);

  // ---------- Dust ----------
  const DUST = 170;
  const dustPos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 3.2;
    dustPos[i * 3 + 1] = 0.7 + Math.random() * 1.2;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 2.4;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({ color: 0xfff1d6, size: 0.007, transparent: true, opacity: 0.5, sizeAttenuation: true })
  );
  scene.add(dust);

  // ---------- Camera states ----------
  const UP_IDLE = new THREE.Vector3(0, 1, 0);
  // Looking straight down, the default up vector is parallel to the view direction,
  // which is degenerate. The sheet's local +Y maps to world -Z once it is laid flat,
  // so that is the direction that must read as "up" on screen when focused.
  const UP_FOCUS = new THREE.Vector3(0, 0, -1);
  const camUp = UP_IDLE.clone();

  const lookAt = new THREE.Vector3();
  const idleTarget = new THREE.Vector3(-0.05, TABLE_Y + 0.1, -0.05);
  const pointer = { x: 0, y: 0 };

  const idlePose = (t, out) => {
    const angle = Math.sin(t * 0.1) * 0.3 + pointer.x * 0.16;
    const radius = camera.aspect > 1.4 ? 2.35 : 2.35 * (1.4 / camera.aspect);
    out.pos.set(Math.sin(angle) * radius, 1.5 + pointer.y * 0.1, Math.cos(angle) * radius + 0.25);
    out.target.copy(idleTarget);
    return out;
  };

  const focusPose = (out) => {
    const fovRad = THREE.MathUtils.degToRad(camera.fov);
    const fill = 0.9;
    const dH = SHEET_H / 2 / Math.tan(fovRad / 2) / fill;
    const dW = SHEET_W / 2 / (Math.tan(fovRad / 2) * camera.aspect) / fill;
    const d = Math.max(dH, dW);
    out.pos.set(SHEET_POS.x, TABLE_Y + d, SHEET_POS.z);
    out.target.copy(SHEET_POS);
    return out;
  };

  const pose = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  const from = { pos: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3() };
  const to = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  let mode = "idle"; // idle | toFocus | focused | toIdle
  let tweenStart = 0;
  const TWEEN_MS = 1400;

  idlePose(0, pose);
  camera.position.copy(pose.pos);
  lookAt.copy(pose.target);
  camera.up.copy(camUp);
  camera.lookAt(pose.target);

  const setInteractive = (on) => {
    sheetRoot.style.pointerEvents = on ? "auto" : "none";
    container.style.cursor = on ? "default" : "grab";
  };
  setInteractive(false);

  function enter() {
    if (mode === "focused" || mode === "toFocus") return;
    from.pos.copy(camera.position);
    from.target.copy(lookAt);
    from.up.copy(camUp);
    mode = "toFocus";
    tweenStart = performance.now();
    onEnter?.();
  }

  function exit() {
    if (mode === "idle" || mode === "toIdle") return;
    from.pos.copy(camera.position);
    from.target.copy(lookAt);
    from.up.copy(camUp);
    mode = "toIdle";
    tweenStart = performance.now();
    setInteractive(false);
    onExit?.();
  }

  // ---------- Interaction ----------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hitSheet = (e) => {
    const r = container.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObject(sheetMesh, false).length > 0;
  };

  container.addEventListener("pointermove", (e) => {
    const r = container.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    if (mode === "idle") container.style.cursor = hitSheet(e) ? "pointer" : "grab";
  });
  container.addEventListener("pointerdown", (e) => {
    if (mode === "idle" && hitSheet(e)) enter();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") exit();
  });

  window.addEventListener("resize", () => {
    camera.aspect = width() / height();
    camera.updateProjectionMatrix();
    renderer.setSize(width(), height());
    cssRenderer.setSize(width(), height());
  });

  // ---------- Loop ----------
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const t = clock.getElapsedTime();

    const p = dust.geometry.attributes.position;
    for (let i = 0; i < DUST; i++) {
      let y = p.getY(i) + 0.0005 + Math.sin(t + i) * 0.0002;
      if (y > 1.9) y = 0.7;
      p.setY(i, y);
      p.setX(i, p.getX(i) + Math.sin(t * 0.3 + i * 1.7) * 0.00018);
    }
    p.needsUpdate = true;

    // the agent terminals breathe slightly, so the party looks awake
    agentLights.forEach((l, i) => (l.intensity = 0.45 + Math.sin(t * 1.6 + i * 1.9) * 0.1));

    if (mode === "idle") {
      idlePose(t, pose);
      camera.position.lerp(pose.pos, 0.04);
      lookAt.lerp(pose.target, 0.06);
      camUp.lerp(UP_IDLE, 0.08);
    } else if (mode === "focused") {
      focusPose(pose);
      camera.position.copy(pose.pos);
      lookAt.copy(pose.target);
      camUp.copy(UP_FOCUS);
    } else {
      const k = Math.min(1, (performance.now() - tweenStart) / TWEEN_MS);
      const e = easeInOutCubic(k);
      const targetUp = mode === "toFocus" ? UP_FOCUS : UP_IDLE;
      if (mode === "toFocus") focusPose(to);
      else idlePose(t, to);
      camera.position.lerpVectors(from.pos, to.pos, e);
      lookAt.lerpVectors(from.target, to.target, e);
      camUp.copy(from.up).lerp(targetUp, e).normalize();
      if (k >= 1) {
        if (mode === "toFocus") {
          mode = "focused";
          setInteractive(true);
        } else mode = "idle";
      }
    }
    camera.up.copy(camUp);
    camera.lookAt(lookAt);

    renderer.render(scene, camera);
    cssRenderer.render(scene, camera);
  });

  return { enter, exit, isFocused: () => mode === "focused" };
}
