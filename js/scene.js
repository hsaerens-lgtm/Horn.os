import * as THREE from "three";
import { CSS3DRenderer, CSS3DObject } from "three/addons/renderers/CSS3DRenderer.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import {
  plasticGrain,
  parchment,
  agentScreen,
  agentFace,
  suitFabric,
  shirtFabric,
  scoreLabel,
  wallpaper,
  dmScreenTables,
  dmScreenArt,
  screenFace,
} from "./textures.js";
import { createWatercolour } from "./watercolour.js";
import { createRoom } from "./room.js";
import { createBoard } from "./board.js";
import { createProps } from "./props.js";
import { createChatter } from "./chatter.js";
import { roundedBox } from "./shapes.js";

// The sheet is 860x1180 CSS px, laid flat on the table at this physical width.
const SHEET_W = 0.34;
const SHEET_SCALE = SHEET_W / 860;
const SHEET_H = 1180 * SHEET_SCALE;

const TABLE_Y = 0.76;
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createScene({ container, sheetRoot, agentRoots, agents, players = "robot", onEnter, onExit, onAgent, onBoard }) {
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
  // Tone mapping happens inside the watercolour pass, not here: the pass needs the
  // raw HDR values to sample, and applying the curve twice would flatten the scene.
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.domElement.style.zIndex = "2";
  renderer.domElement.style.pointerEvents = "none";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width() / height(), 0.05, 50);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.26;
  pmrem.dispose();

  // ---------- Materials ----------
  const texLoader = new THREE.TextureLoader();
  // Declared up here, not beside the furniture that used to be its only client:
  // the players may need it too, and they are built earlier in the file.
  const gltfLoader = new GLTFLoader();
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
    wall: wallpaper(),
    plastic: plasticGrain(),
    parchment: parchment(),
  };

  const N = (x, y = x) => new THREE.Vector2(x, y);
  const mat = {
    floor: new THREE.MeshStandardMaterial({ ...tex.floor, color: 0x8a7258, normalScale: N(0.35), roughness: 0.55, envMapIntensity: 0.7 }),
    // A warm grey rather than the blue-grey it was: the blue was what made the
    // room read as a basement even before the lighting got involved.
    wall: new THREE.MeshStandardMaterial({ ...tex.wall, color: 0xcdc6b8, normalScale: N(0.18), envMapIntensity: 0.95 }),
    wood: new THREE.MeshStandardMaterial({ ...tex.table, color: 0xb8855a, normalScale: N(0.5), envMapIntensity: 0.9 }),
    woodDark: new THREE.MeshStandardMaterial({ ...tex.tableEdge, color: 0x6b4a30, normalScale: N(0.4), envMapIntensity: 0.6 }),
    parchment: new THREE.MeshStandardMaterial({ ...tex.parchment, normalScale: N(0.4), envMapIntensity: 0.5, side: THREE.DoubleSide }),
    dice: new THREE.MeshStandardMaterial({ color: 0xc8342a, roughness: 0.22, metalness: 0.1, envMapIntensity: 1.5 }),
    dicePale: new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.3, envMapIntensity: 1.2 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x8a8f99, roughness: 0.3, metalness: 0.85, envMapIntensity: 1.6 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1c1f26, roughness: 0.45, envMapIntensity: 0.9 }),
    cutout: new THREE.MeshBasicMaterial({ color: 0x000000, blending: THREE.NoBlending, opacity: 0, transparent: true }),
  };

  const box = (w, h, d, m, x, y, z, { cast = true, receive = true, r = 0.01 } = {}) => {
    const mesh = new THREE.Mesh(roundedBox(w, h, d, r), m);
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

  const WALL_Z = -2.1;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 5), mat.wall);
  wall.position.set(0, 2.5, WALL_Z);
  wall.receiveShadow = true;
  scene.add(wall);
  box(14, 0.1, 0.02, mat.woodDark, 0, 0.05, WALL_Z + 0.01, { cast: false });
  // A picture rail at the top of the poster band gives the wall a horizon; a
  // blank five-metre plane behind the party is what read as institutional.
  box(14, 0.03, 0.05, mat.woodDark, 0, 2.38, WALL_Z + 0.02, { cast: false });

  // Side walls. Looking straight at the table you never see them, but the shot
  // that frames a player at the end of the table looks along the room's axis,
  // and without these it looks into an unlit void.
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 5), mat.wall);
    side.position.set(s * 4.6, 2.5, WALL_Z + 4.7);
    side.rotation.y = -s * (Math.PI / 2);
    side.receiveShadow = true;
    scene.add(side);
    box(0.02, 0.1, 9.5, mat.woodDark, s * 4.59, 0.05, WALL_Z + 4.7, { cast: false });
  }

  // ---------- Everything that makes it a room and not a set ----------
  const room = createRoom(scene, { wallZ: WALL_Z });

  // ---------- Table ----------
  const TABLE_W = 2.1;
  const TABLE_D = 1.35;
  box(TABLE_W, 0.05, TABLE_D, mat.wood, 0, TABLE_Y - 0.025, 0, { r: 0.016 });
  box(TABLE_W + 0.04, 0.05, 0.04, mat.woodDark, 0, TABLE_Y - 0.06, TABLE_D / 2);
  box(TABLE_W + 0.04, 0.05, 0.04, mat.woodDark, 0, TABLE_Y - 0.06, -TABLE_D / 2);
  for (const [x, z] of [[-0.94, -0.56], [0.94, -0.56], [-0.94, 0.56], [0.94, 0.56]]) {
    box(0.08, TABLE_Y - 0.05, 0.08, mat.woodDark, x, (TABLE_Y - 0.05) / 2, z);
  }

  // ---------- The board ----------
  // A printed region map in a shallow wooden tray, with terrain standing on it.
  //
  // Everything that lies flat on this table has to own its own patch of it. Two
  // flat things at the same height in the same place do not layer, they fight —
  // the depth buffer picks a winner per pixel per frame and the result flickers.
  // The board was overlapping the DM's sheet by 21 x 14 cm and one player's by
  // 19 x 5 cm, which is exactly what that looked like. It is smaller now, and
  // the sheets have moved, so no two footprints touch.
  const board = createBoard(scene, { cx: 0.1, cz: -0.1, w: 0.7, d: 0.5, y: TABLE_Y });

  // ---------- DM screen: three panels, hinged, printed on both sides ----------
  // A real screen carries artwork on the players' face and the tables the DM
  // needs on their own. BoxGeometry takes one material per face in the order
  // +X -X +Y -Y +Z -Z, so each panel gets six: plain stock on the edges, the
  // dragon on +Z and the reference tables on -Z.
  const PANEL_H = 0.3;
  const dmScreen = new THREE.Group();
  dmScreen.position.set(-0.72, TABLE_Y, 0.46);
  dmScreen.rotation.y = Math.PI;
  scene.add(dmScreen);

  const printMat = (canvasEl) =>
    new THREE.MeshStandardMaterial({ ...screenFace(canvasEl), normalScale: N(0.35), envMapIntensity: 0.45 });

  const panel = (w, x, z, rotY, index) => {
    // Height in pixels is derived from the panel's own aspect, so none of the
    // three prints is stretched to fit a shape it was not drawn for.
    const px = 512;
    const py = Math.round((px * PANEL_H) / w);
    const faces = [mat.parchment, mat.parchment, mat.parchment, mat.parchment];
    faces.push(printMat(dmScreenArt(index, { w: px, h: py })));
    faces.push(printMat(dmScreenTables(index, { w: px, h: py })));
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, PANEL_H, 0.009), faces);
    p.position.set(x, PANEL_H / 2, z);
    p.rotation.y = rotY;
    p.castShadow = true;
    p.receiveShadow = true;
    dmScreen.add(p);
    return p;
  };
  // The wings hinge back around the DM, so their inner edges meet the centre
  // panel's corners exactly instead of intersecting it.
  // Narrower than it was: folded out at the old width the wings reached 11 cm
  // past the end of the table.
  const HINGE = 0.5;
  const wingX = 0.13 + (0.22 / 2) * Math.cos(HINGE);
  const wingZ = -(0.22 / 2) * Math.sin(HINGE);
  panel(0.22, -wingX, wingZ, -HINGE, 0);
  panel(0.26, 0, 0, 0, 1);
  panel(0.22, wingX, wingZ, HINGE, 2);

  // ---------- Character sheet, lying flat in front of the DM ----------
  const SHEET_POS = new THREE.Vector3(-0.22, TABLE_Y + 0.004, 0.44);
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
    [new THREE.IcosahedronGeometry(0.026), mat.dice, 0.06, 0.3, 20],
    [new THREE.DodecahedronGeometry(0.022), mat.dicePale, 0.13, 0.42, 12],
    [new THREE.OctahedronGeometry(0.02), mat.dice, -0.02, 0.46, 8],
    [new THREE.TetrahedronGeometry(0.022), mat.dicePale, 0.1, 0.19, 4],
    [roundedBox(0.03, 0.03, 0.03, 0.006, 4), mat.dice, 0.19, 0.3, 6],
    [roundedBox(0.028, 0.028, 0.028, 0.0055, 4), mat.dicePale, 0.24, 0.42, 6],
  ];
  const dice = [];
  for (const [geo, m, x, z, sides] of diceSpecs) {
    const d = new THREE.Mesh(geo, m);
    d.position.set(x, TABLE_Y + 0.019, z);
    d.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    d.castShadow = true;
    d.userData.sides = sides;
    scene.add(d);
    dice.push(d);
  }

  // ---------- Rolling ----------
  // No physics engine: a die hops along an arc while it tumbles, then settles and
  // pushes a floating number. The result is drawn up front, so the animation is
  // presentation rather than simulation — which is also why it cannot land wrong.
  const rolls = [];
  const labels = [];

  const spawnLabel = (die, value, sides) => {
    const kind = sides === 20 && value === 20 ? "crit" : sides === 20 && value === 1 ? "fumble" : "normal";
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: scoreLabel(value, sides, kind), transparent: true, depthTest: false, depthWrite: false })
    );
    sprite.position.copy(die.position).add(new THREE.Vector3(0, 0.085, 0));
    sprite.renderOrder = 999;
    scene.add(sprite);
    labels.push({ sprite, t0: performance.now(), dur: kind === "normal" ? 1900 : 2600, y0: sprite.position.y, kind });
  };

  const rollDie = (die) => {
    if (die.userData.rolling) return;
    die.userData.rolling = true;
    const result = 1 + Math.floor(Math.random() * die.userData.sides);
    const from = die.position.clone();
    const to = from.clone();
    to.x += (Math.random() - 0.5) * 0.13;
    to.z += (Math.random() - 0.5) * 0.11;
    rolls.push({
      die,
      result,
      from,
      to,
      axis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
      spin: 16 + Math.random() * 9,
      t0: performance.now(),
      dur: 1150,
    });
  };

  const updateDice = () => {
    const now = performance.now();

    for (let i = rolls.length - 1; i >= 0; i--) {
      const r = rolls[i];
      const k = Math.min(1, (now - r.t0) / r.dur);
      const travel = 1 - Math.pow(1 - k, 3);
      r.die.position.lerpVectors(r.from, r.to, travel);
      r.die.position.y = r.from.y + Math.sin(Math.PI * Math.min(1, k * 1.08)) * 0.2;
      r.die.rotateOnAxis(r.axis, r.spin * (1 - k) * 0.017);
      if (k >= 1) {
        r.die.position.copy(r.to);
        r.die.userData.rolling = false;
        spawnLabel(r.die, r.result, r.die.userData.sides);
        rolls.splice(i, 1);
      }
    }

    for (let i = labels.length - 1; i >= 0; i--) {
      const l = labels[i];
      const k = Math.min(1, (now - l.t0) / l.dur);
      l.sprite.position.y = l.y0 + k * 0.24;
      const pop = k < 0.14 ? k / 0.14 : 1;
      const base = l.kind === "normal" ? 0.26 : 0.36;
      l.sprite.scale.set(base * (0.75 + pop * 0.25), base * 0.66 * (0.75 + pop * 0.25), 1);
      l.sprite.material.opacity = k > 0.62 ? 1 - (k - 0.62) / 0.38 : 1;
      if (k >= 1) {
        scene.remove(l.sprite);
        l.sprite.material.map.dispose();
        l.sprite.material.dispose();
        labels.splice(i, 1);
      }
    }
  };

  // The miniatures stand on the board, placed from the same map plan.
  const party = agents ?? [];
  board.populate(party);

  // ---------- The party ----------
  // Each agent is a suited figure with a television for a head, its mark on the
  // screen. Built from primitives so there is nothing to download or license.
  // Two cloths so the party reads as individuals rather than four copies: plain
  // twill and a pinstripe. Both are drawn mid-grey, so the material colour tints them.
  const twill = suitFabric({ repeat: [2.6, 2.6] });
  const pin = suitFabric({ pinstripe: true, seed: 47, repeat: [2.6, 2.6] });
  const poplin = shirtFabric();
  const suitOf = (striped, colour) =>
    new THREE.MeshStandardMaterial({ ...(striped ? pin : twill), color: colour, normalScale: N(0.55), envMapIntensity: 0.34 });
  const suitDarkOf = (striped, colour) =>
    new THREE.MeshStandardMaterial({
      ...(striped ? pin : twill),
      color: new THREE.Color(colour).multiplyScalar(0.7),
      normalScale: N(0.45),
      envMapIntensity: 0.28,
    });
  const shirtMat = new THREE.MeshStandardMaterial({ ...poplin, color: 0x8f96a6, normalScale: N(0.35), envMapIntensity: 0.3 });
  const cuffMat = new THREE.MeshStandardMaterial({ color: 0x6e7484, roughness: 0.78, envMapIntensity: 0.25 });
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x2f2a26, roughness: 0.72, envMapIntensity: 0.4 });
  const chairLegMat = new THREE.MeshStandardMaterial({ color: 0x6d7280, roughness: 0.35, metalness: 0.75, envMapIntensity: 1.0 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x14161d, roughness: 0.34, envMapIntensity: 0.9 });
  const handMat = new THREE.MeshStandardMaterial({ color: 0x474d5c, roughness: 0.72, envMapIntensity: 0.3 });
  const caseMat = new THREE.MeshStandardMaterial({ color: 0x31353e, roughness: 0.6, ...tex.plastic, normalScale: N(0.25), envMapIntensity: 0.8 });
  const heads = [];

  const agentLights = [];
  const agentHits = [];
  // Anything that should rise and fall as if something inside it were running.
  // Four figures holding perfectly still is the difference between a party and
  // a shop window, and it costs one sine wave each.
  const breathers = [];
  // An empty object over each player's head: where its speech bubble hangs.
  const speakers = [];
  const breathe = (i, ...objects) =>
    breathers.push({
      objects,
      baseY: objects.map((o) => o.position.y),
      baseX: objects.map((o) => o.rotation.x),
      phase: i * 1.7,
      rate: 1.05 + i * 0.09, // no two of them on the same rhythm
    });

  // A jacket silhouette: square across the shoulders, tapering to the waist. Extruding
  // a profile with a bevel gives soft edges without the balloon look of stacked spheres.
  const jacketShape = (() => {
    const s = new THREE.Shape();
    const SH = 0.184; // half-width at the shoulder
    const WA = 0.126; // half-width at the waist
    s.moveTo(-SH, 0.2);
    s.lineTo(SH, 0.2); // straight shoulder line
    s.bezierCurveTo(SH + 0.008, 0.06, WA + 0.03, -0.1, WA, -0.26);
    s.lineTo(-WA, -0.26);
    s.bezierCurveTo(-WA - 0.03, -0.1, -SH - 0.008, 0.06, -SH, 0.2);
    return s;
  })();

  const lapelShape = (() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.2);
    s.lineTo(0.085, 0.2);
    s.lineTo(0.05, 0.03);
    s.lineTo(0.012, -0.12);
    s.lineTo(0, -0.05);
    return s;
  })();

  // Seated proportions, measured off a real chair rather than guessed: the seat is
  // 45 cm, the hip sits just above it, thighs run forward to the knee and the shins
  // drop to the floor. Everything above the hip is placed relative to SEAT_Y so the
  // whole figure moves together if the chair height ever changes.
  const SEAT_Y = 0.45;
  const HIP_Y = SEAT_Y + 0.05;

  // RobotExpressive arrives at its own scale and in its own pose, so these are
  // measured in the browser and written down rather than guessed: how tall the
  // seated robot should end up, how far back on the seat it sits, and how far
  // the television rides above where its own head was.
  const ROBOT_Z = 0.02;
  const ROBOT_HEAD_LIFT = 0.02;
  // The robot was drawn around a head half the size of its body. Swapping that
  // head for a television leaves the body looking oversized, so the body comes
  // down and the set goes up until the two read as one creature.
  const ROBOT_BODY = 0.9;
  const ROBOT_HEAD = 1.15;
  const DEBUG_ROBOT = new URLSearchParams(location.search).has("debug");
  const robotTrim = new THREE.MeshStandardMaterial({ color: 0x1b1f27, roughness: 0.55, envMapIntensity: 0.5 });

  const makeChair = (g) => {
    const seat = new THREE.Mesh(roundedBox(0.44, 0.045, 0.42, 0.014), chairMat);
    seat.position.set(0, SEAT_Y, 0.06);
    seat.castShadow = true;
    seat.receiveShadow = true;
    g.add(seat);

    const back = new THREE.Mesh(roundedBox(0.42, 0.44, 0.04, 0.013), chairMat);
    back.position.set(0, SEAT_Y + 0.24, -0.13);
    back.rotation.x = -0.12;
    back.castShadow = true;
    g.add(back);

    for (const [lx, lz] of [[-0.18, -0.11], [0.18, -0.11], [-0.18, 0.23], [0.18, 0.23]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.015, SEAT_Y, 10), chairLegMat);
      leg.position.set(lx, SEAT_Y / 2, lz);
      leg.castShadow = true;
      g.add(leg);
    }
  };

  // Everything above the hip lives in its own group, so a single rotation leans
  // the whole upper body forward without having to re-place twenty parts. That
  // lean, a turn of the head and how far each one reaches across the table are
  // the three numbers that stop four identical figures reading as four copies
  // of one figure — far more than any amount of extra geometry would.
  const makeAgent = (a, seat) => {
    const { rot: rotY, striped = false, suit, lean = 0, turn = 0, tilt = 0, reach = 0 } = seat;
    const [x, z] = seat.fig;
    const accent = new THREE.Color(a.colour);
    const suitMat = suitOf(striped, suit);
    const suitDark = suitDarkOf(striped, suit);
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);

    makeChair(g);

    // ----- legs -----
    for (const s of [-1, 1]) {
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.26, 4, 14), suitMat);
      thigh.position.set(s * 0.105, HIP_Y - 0.01, 0.17);
      thigh.rotation.x = Math.PI / 2;
      thigh.castShadow = true;
      g.add(thigh);

      const knee = new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 12), suitMat);
      knee.position.set(s * 0.105, HIP_Y - 0.015, 0.315);
      g.add(knee);

      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.26, 4, 14), suitMat);
      shin.position.set(s * 0.105, HIP_Y - 0.17, 0.335);
      shin.rotation.x = 0.1;
      shin.castShadow = true;
      g.add(shin);

      const shoe = new THREE.Mesh(roundedBox(0.09, 0.05, 0.19, 0.016), shoeMat);
      shoe.position.set(s * 0.105, 0.028, 0.385);
      shoe.castShadow = true;
      g.add(shoe);
    }

    const upper = new THREE.Group();
    upper.position.set(0, HIP_Y, 0);
    upper.rotation.x = lean;
    g.add(upper);
    const put = (mesh, px, py, pz) => {
      mesh.position.set(px, py, pz);
      upper.add(mesh);
      return mesh;
    };

    // ----- jacket -----
    const torso = new THREE.Mesh(
      new THREE.ExtrudeGeometry(jacketShape, {
        depth: 0.19,
        bevelEnabled: true,
        bevelSize: 0.024,
        bevelThickness: 0.022,
        bevelSegments: 5,
        curveSegments: 18,
      }),
      suitMat
    );
    torso.castShadow = true;
    torso.receiveShadow = true;
    put(torso, 0, 0.34, -0.095);

    put(new THREE.Mesh(roundedBox(0.13, 0.26, 0.02, 0.006), suitDark), 0, 0.43, 0.117);

    for (const s of [-1, 1]) {
      const lapel = new THREE.Mesh(
        new THREE.ExtrudeGeometry(lapelShape, { depth: 0.02, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2 }),
        suitDark
      );
      lapel.scale.x = s;
      put(lapel, 0, 0.34, 0.112);

      // ----- arm: shoulder, upper arm down, forearm forward onto the table -----
      // Sunk into the jacket rather than perched on it: a sphere sitting proud
      // of the shoulder line reads as a ball joint, which is the single detail
      // that made these look like mannequins.
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.053, 16, 12), suitMat);
      cap.scale.set(1, 0.8, 0.95);
      cap.castShadow = true;
      put(cap, s * 0.166, 0.508, -0.005);

      const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.16, 4, 14), suitMat);
      upperArm.rotation.set(0.42, 0, s * 0.14);
      upperArm.castShadow = true;
      put(upperArm, s * 0.188, 0.408, 0.035);

      put(new THREE.Mesh(new THREE.SphereGeometry(0.048, 14, 12), suitMat), s * 0.216, 0.305, 0.115);

      const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.21, 4, 14), suitMat);
      fore.rotation.set(1.31, 0, s * 0.05);
      fore.castShadow = true;
      put(fore, s * 0.214, 0.215, 0.255 + reach * 0.5);

      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.014, 16), cuffMat);
      cuff.rotation.x = 1.31;
      put(cuff, s * 0.212, 0.185, 0.365 + reach * 0.8);

      const hand = new THREE.Mesh(roundedBox(0.075, 0.03, 0.13, 0.01), handMat);
      hand.rotation.set(0.05, s * -0.12, 0);
      hand.castShadow = true;
      put(hand, s * 0.212, TABLE_Y + 0.022 - HIP_Y, 0.43 + reach);
    }

    // ----- shirt, collar, tie -----
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.078, 0.04, 18), shirtMat), 0, 0.535, 0.012);
    put(new THREE.Mesh(roundedBox(0.085, 0.13, 0.014, 0.005), shirtMat), 0, 0.475, 0.124);

    const accentMat = (rough) => new THREE.MeshStandardMaterial({ color: accent, roughness: rough, envMapIntensity: 1.4 });
    put(new THREE.Mesh(roundedBox(0.036, 0.034, 0.018, 0.006), accentMat(0.36)), 0, 0.518, 0.132);
    put(new THREE.Mesh(roundedBox(0.03, 0.165, 0.014, 0.004), accentMat(0.38)), 0, 0.418, 0.132);
    put(new THREE.Mesh(roundedBox(0.042, 0.014, 0.012, 0.004), accentMat(0.5)), -0.104, 0.44, 0.118);

    // ----- television head -----
    const head = buildTvHead(a, suitDark, { neck: true });
    head.position.set(0, 0.69, 0.012);
    head.rotation.set(tilt, turn, 0);
    upper.add(head);

    breathe(party.indexOf(a), upper);
    mountSpeaker(g, a, head.position.y + HIP_Y);
    finishAgent(g, a, seat);
    return g;
  };

  /**
   * The television that stands in for a face, built on its own so both kinds of
   * player can wear one: it is the thing that says which agent this is.
   */
  function buildTvHead(a, trim, { neck = true } = {}) {
    const accent = new THREE.Color(a.colour);
    const head = new THREE.Group();

    if (neck) {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.056, 0.1, 16), trim);
      stalk.position.y = -0.125;
      head.add(stalk);
    }

    // The shell is an extruded rounded rectangle rather than a box: the soft
    // corner is most of what separates a television set from a crate.
    const shellShape = (() => {
      const s = new THREE.Shape();
      const w = 0.122, h = 0.104, r = 0.02;
      s.moveTo(-w + r, -h);
      s.lineTo(w - r, -h);
      s.quadraticCurveTo(w, -h, w, -h + r);
      s.lineTo(w, h - r);
      s.quadraticCurveTo(w, h, w - r, h);
      s.lineTo(-w + r, h);
      s.quadraticCurveTo(-w, h, -w, h - r);
      s.lineTo(-w, -h + r);
      s.quadraticCurveTo(-w, -h, -w + r, -h);
      return s;
    })();
    const shell = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shellShape, {
        depth: 0.172,
        bevelEnabled: true,
        bevelSize: 0.008,
        bevelThickness: 0.008,
        bevelSegments: 3,
        curveSegments: 10,
      }),
      caseMat
    );
    // Front of the glass ends up at -0.086 + 0.172 + 0.008 = 0.094; everything
    // below is placed just proud of that.
    shell.position.z = -0.086;
    shell.castShadow = true;
    head.add(shell);

    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.194, 0.146),
      new THREE.MeshBasicMaterial({ map: agentFace(a, { seed: party.indexOf(a) + 2 }), toneMapped: false })
    );
    face.position.set(0, 0.008, 0.0975);
    head.add(face);

    // a brand strip under the screen, and the vents every set of this era had
    const strip = new THREE.Mesh(roundedBox(0.086, 0.011, 0.006, 0.002), trim);
    strip.position.set(-0.042, -0.086, 0.0955);
    head.add(strip);
    for (let i = 0; i < 5; i++) {
      const vent = new THREE.Mesh(roundedBox(0.1, 0.004, 0.006, 0.0015), trim);
      vent.position.set(0, 0.114, -0.014 - i * 0.015);
      head.add(vent);
    }
    for (const s of [-1, 1]) {
      const foot = new THREE.Mesh(roundedBox(0.026, 0.013, 0.045, 0.004), trim);
      foot.position.set(s * 0.078, -0.118, -0.016);
      head.add(foot);
    }
    for (let k = 0; k < 2; k++) {
      const knob = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 0.012, 12),
        new THREE.MeshStandardMaterial({ color: accent, roughness: 0.4, envMapIntensity: 1.4 })
      );
      knob.position.set(0.094 - k * 0.03, -0.085, 0.0955);
      knob.rotation.x = Math.PI / 2;
      head.add(knob);
    }
    return head;
  }

  /** Hangs a bubble mount over one player, at the height of its screen. */
  function mountSpeaker(g, a, headY) {
    const mount = new THREE.Object3D();
    mount.position.set(0, headY + 0.13, 0.05);
    g.add(mount);
    speakers.push({ agent: a, mount });
  }

  /**
   * The parts every player needs whatever it is made of: the glow its screen
   * throws forward, and the box you click to open its sheet.
   */
  function finishAgent(g, a, seat) {
    const [x, z] = seat.fig;
    const accent = new THREE.Color(a.colour);

    const faceGlow = new THREE.PointLight(accent, 0.55, 1.1, 2);
    faceGlow.position.set(0, HIP_Y + 0.69, 0.22);
    g.add(faceGlow);
    agentLights.push(faceGlow);

    // One invisible box per agent is a far cheaper and steadier click target than
    // raycasting the two dozen meshes each figure is made of. It stops at table
    // height on purpose: a raycast ignores occlusion, so a box that reached down
    // to the seat would sit invisibly behind the tabletop and swallow every click
    // meant for the dice or the map in front of that player.
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.82, 0.62), hitMat);
    hit.position.set(0, HIP_Y + 0.71, 0.04);
    hit.visible = false;
    hit.userData.agent = a;
    hit.userData.index = party.indexOf(a);
    hit.userData.seat = { x, z, rotY: seat.rot };
    g.add(hit);
    agentHits.push(hit);
  }

  /* ------------------------------------------------------------------ *
   *  The other kind of player: RobotExpressive, seated.
   *
   *  Tomás Laulhé's robot is the one rigged character three.js ships that
   *  is actually CC0, and it carries a "Sitting" clip, which is the whole
   *  reason to reach for it — a real articulated sitting pose is the thing
   *  primitives cannot fake. It keeps the television head, because that is
   *  what tells you which agent you are looking at.
   *
   *  Loading is async and everything else is not, so the seat, the chair,
   *  the light and the click box are built immediately and only the body
   *  arrives late. Clicking a player before it lands still works.
   * ------------------------------------------------------------------ */
  // Every player that is still on its way. The caller holds the loader until
  // they have all arrived, rather than revealing a table of empty chairs that
  // fill in a second later.
  const pending = [];
  let robotAsset = null;
  const loadRobot = () => (robotAsset ??= gltfLoader.loadAsync("assets/models/RobotExpressive/RobotExpressive.glb"));

  // How the robot is folded into a chair. The rig makes this necessary rather
  // than optional, and the numbers are in one place so they can be tuned.
  const ROBOT_POSE = {
    upperLeg: -1.42, // hip: swing the thigh from hanging down to horizontal
    lowerLeg: 1.28, //  knee: drop the shin back to vertical
    abdomen: 0.1, //    a slight lean towards the table
    upperArm: 1.3, //   bring the arms down along the body
    lowerArm: 0.65, //  and the forearms down, hands tucked in at the table edge
    footZ: 0.28, //     the feet are not attached to the legs; they are placed
    footY: 0.02, //     under the knees by hand
  };

  const makeRobotAgent = (a, seat) => {
    const [x, z] = seat.fig;
    const accent = new THREE.Color(a.colour);
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = seat.rot;
    scene.add(g);

    makeChair(g);
    finishAgent(g, a, seat);

    const arriving = loadRobot()
      .then((gltf) => {
        // SkeletonUtils.clone, not Object3D.clone: the hands are skinned, and a
        // plain clone would leave all four robots sharing one skeleton.
        const root = cloneSkeleton(gltf.scene);

        root.traverse((n) => {
          if (!n.isMesh) return;
          n.castShadow = true;
          n.receiveShadow = true;
          // Materials survive the clone by reference, so tinting one robot
          // would tint all four.
          n.material = n.material.clone();
          n.material.envMapIntensity = 0.55;
          if (n.material.name === "Main") n.material.color.copy(accent).multiplyScalar(0.6);
          else if (n.material.name === "Grey") n.material.color.setHex(0x8b929f);
        });

        const bone = (n) => root.getObjectByName(n);

        // The rig ships no seated pose. Its "Sitting" clip is a 0.42 s crouch —
        // the hips drop a sixth of the body height and the feet do not move at
        // all — so the chair pose is built here, bone by bone. Local X is the
        // bend axis for both the hip and the knee, which the rest rotations
        // give away: the knee sits at a plain 0.72 about X and nothing else.
        for (const side of ["L", "R"]) {
          bone(`UpperLeg${side}`).rotation.x += ROBOT_POSE.upperLeg;
          bone(`LowerLeg${side}`).rotation.x += ROBOT_POSE.lowerLeg;
          bone(`UpperArm${side}`).rotation.x += ROBOT_POSE.upperArm;
          bone(`LowerArm${side}`).rotation.x += ROBOT_POSE.lowerArm;
        }
        bone("Abdomen").rotation.x += ROBOT_POSE.abdomen;

        // The feet hang off the root bone rather than off the legs, so bending
        // the knees leaves them standing where they were. They get moved.
        for (const side of ["L", "R"]) {
          const foot = bone(`Foot${side}`);
          foot.position.z += ROBOT_POSE.footZ;
          foot.position.y += ROBOT_POSE.footY;
        }

        // Its own head comes off; the television goes where it was.
        const headBone = bone("Head");
        const headArt = bone("Head_1");
        if (headArt) headArt.visible = false;

        const holder = new THREE.Group();
        holder.add(root);
        g.add(holder); // the model already faces +Z, which is where the table is
        root.updateMatrixWorld(true);

        // Scale off two landmarks rather than off a bounding box: two of the
        // meshes are skinned, and Box3.setFromObject measures those in their
        // bind pose, which reports this robot as 4.8 units tall when its head
        // is at 3.0.
        const hips = bone("Hips").getWorldPosition(new THREE.Vector3());
        const headAt = headBone.getWorldPosition(new THREE.Vector3());
        const scale = (ROBOT_BODY * (HIP_Y + 0.69 - SEAT_Y - 0.05)) / Math.max(0.001, headAt.y - hips.y);
        holder.scale.setScalar(scale);
        holder.position.set(0, SEAT_Y + 0.05 - hips.y * scale, ROBOT_Z);
        holder.updateMatrixWorld(true);

        // Rebind the skinned meshes now that the body sits where it will stay.
        // A SkinnedMesh keeps the world matrix it was bound with; reparenting
        // and scaling it leaves that matrix stale, so the holder's transform is
        // applied twice — once through the bones and once through the model
        // matrix. The two hands are the only skinned parts here, and untreated
        // they render as slabs the size of the torso.
        root.traverse((n) => {
          if (n.isSkinnedMesh) n.bind(n.skeleton, n.matrixWorld);
        });

        const tv = buildTvHead(a, robotTrim, { neck: false });
        tv.scale.setScalar(ROBOT_HEAD);
        const p = headBone.getWorldPosition(new THREE.Vector3());
        g.worldToLocal(p);
        tv.position.copy(p).add(new THREE.Vector3(0, ROBOT_HEAD_LIFT, 0));
        tv.rotation.set(seat.tilt ?? 0, seat.turn ?? 0, 0);
        g.add(tv);

        breathe(party.indexOf(a), holder, tv);
        mountSpeaker(g, a, tv.position.y);

        if (DEBUG_ROBOT) {
          (window.__robots ??= []).push({ name: a.name, root, holder, tv, bone });
          const foot = bone("FootL").getWorldPosition(new THREE.Vector3());
          console.debug("PROBE robot", a.name, {
            scale: +scale.toFixed(4),
            hipsWorldY: +(SEAT_Y + 0.05).toFixed(3),
            headLocal: [+tv.position.x.toFixed(3), +tv.position.y.toFixed(3), +tv.position.z.toFixed(3)],
            footWorld: [+foot.x.toFixed(3), +foot.y.toFixed(3), +foot.z.toFixed(3)],
          });
        }
      })
      .catch((err) => console.warn("robot player not loaded:", err));
    pending.push(arriving);

    return g;
  };

  // Seats around the table, the way a real session sits: the DM is where the camera
  // is, two players opposite, one at each end. In front of each seat lies that
  // player's character sheet, with their laptop pushed off to one side.
  const SEATS = [
    // suit / lean / turn / tilt / reach: the posture of one player at the table.
    // The one leaning furthest in is looking at the board; the one sitting back
    // with their head turned is looking at whoever is talking.
    { fig: [-0.46, -1.08], rot: 0.1, sheet: [-0.46, -0.52], lap: [-0.78, -0.5], prop: [-0.2, -0.58],
      striped: false, suit: 0x232a3a, lean: 0.1, turn: -0.22, tilt: 0.06, reach: 0.03 },
    { fig: [0.46, -1.08], rot: -0.1, sheet: [0.46, -0.52], lap: [0.78, -0.5], prop: [0.22, -0.58],
      striped: true, suit: 0x33302c, lean: 0.02, turn: 0.3, tilt: -0.04, reach: -0.03 },
    { fig: [-1.42, 0.0], rot: Math.PI / 2, sheet: [-0.8, 0.0], lap: [-0.8, -0.32], prop: [-0.84, 0.24],
      striped: true, suit: 0x2b3330, lean: 0.16, turn: 0.12, tilt: 0.1, reach: 0.06 },
    { fig: [1.42, 0.0], rot: -Math.PI / 2, sheet: [0.8, 0.0], lap: [0.8, -0.32], prop: [0.84, 0.24],
      striped: false, suit: 0x2f2833, lean: -0.04, turn: -0.34, tilt: -0.02, reach: -0.05 },
  ];

  party.slice(0, 4).forEach((a, i) => {
    const seat = SEATS[i];
    const g = new THREE.Group();
    g.position.set(seat.lap[0], TABLE_Y, seat.lap[1]);
    g.rotation.y = seat.rot;
    scene.add(g);

    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.012, 20), mat.dark);
    stand.position.y = 0.006;
    stand.castShadow = true;
    g.add(stand);

    const neck = new THREE.Mesh(roundedBox(0.012, 0.05, 0.012, 0.003), mat.metal);
    neck.position.y = 0.035;
    g.add(neck);

    const shell = new THREE.Mesh(roundedBox(0.2, 0.14, 0.014, 0.006), mat.dark);
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
  const buildPlayer = players === "robot" ? makeRobotAgent : makeAgent;
  party.slice(0, 4).forEach((a, i) => buildPlayer(a, SEATS[i]));

  // ---------- What each player brought with them ----------
  const props = createProps(scene, { tableY: TABLE_Y });
  party.slice(0, 4).forEach((a, i) => props.place(a, SEATS[i].prop, SEATS[i].rot));

  // ---------- And what they say ----------
  const chatter = createChatter(scene, speakers);

  // ---------- Each player's character sheet ----------
  // The sheet lies face-up on the table in front of its player, the way a sheet
  // does at a real table. Clicking that player lifts it: it rises off the table,
  // turns to face you and grows, because 22 cm of paper seen at an angle is a
  // prop, and the whole point is that you can read what the agent actually is.
  const AS_W = 480; // the sheet's own CSS pixel size
  const AS_H = 740;
  const AS_FLAT = 0.19 / AS_W; // lying on the table, about the size of a sheet of A4
  const AS_RAISED = 0.42 / AS_W; // held up in front of you

  const agentSheets = [];
  const agentSheetHits = [];

  party.slice(0, 4).forEach((a, i) => {
    const root = agentRoots?.[i];
    if (!root) return;
    const seat = SEATS[i];
    const [fx, fz] = seat.fig;
    const rot = seat.rot;
    // The direction the player faces, and their right hand side. Every pose
    // below is written in those two vectors, so the same code works for a
    // player sitting across the table and one sitting at the end of it.
    const fwd = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot));
    const right = new THREE.Vector3(Math.cos(rot), 0, -Math.sin(rot));

    const flatPos = new THREE.Vector3(seat.sheet[0], TABLE_Y + 0.004, seat.sheet[1]);
    // Euler order YXZ means the yaw is applied first and the lay-flat tilt second,
    // which is what keeps the text the right way up for a reader on the table side
    // whichever way round the chair is.
    const flatQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, rot, 0, "YXZ"));

    const raisedPos = new THREE.Vector3(fx, 1.14, fz).addScaledVector(fwd, 0.72).addScaledVector(right, 0.4);
    const raisedQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.14, rot, 0, "YXZ"));

    const obj = new CSS3DObject(root);
    obj.position.copy(flatPos);
    obj.quaternion.copy(flatQuat);
    obj.scale.setScalar(AS_FLAT);
    scene.add(obj);

    const cut = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat.cutout);
    cut.userData.agent = a;
    cut.userData.index = i;
    scene.add(cut);

    // the paper's own edge, so it is a physical page and not a floating rectangle
    const backing = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshStandardMaterial({ color: 0xd9cdb2, roughness: 0.9, envMapIntensity: 0.4, side: THREE.DoubleSide })
    );
    backing.receiveShadow = true;
    scene.add(backing);

    agentSheets.push({ index: i, obj, cut, backing, flatPos, flatQuat, raisedPos, raisedQuat, k: 0, target: 0 });
    agentSheetHits.push(cut);
  });

  const SHEET_NORMAL = new THREE.Vector3();
  const updateAgentSheets = (dt) => {
    for (const s of agentSheets) {
      s.k = THREE.MathUtils.damp(s.k, s.target, 6.5, dt);
      s.obj.position.lerpVectors(s.flatPos, s.raisedPos, s.k);
      s.obj.quaternion.slerpQuaternions(s.flatQuat, s.raisedQuat, s.k);
      const sc = THREE.MathUtils.lerp(AS_FLAT, AS_RAISED, s.k);
      s.obj.scale.setScalar(sc);

      s.cut.position.copy(s.obj.position);
      s.cut.quaternion.copy(s.obj.quaternion);
      s.cut.scale.set(AS_W * sc, AS_H * sc, 1);

      // Sit the backing a fraction behind the page along its own normal, derived
      // from the quaternion rather than the matrix — the matrix has not been
      // recomputed yet at this point in the frame.
      SHEET_NORMAL.set(0, 0, 1).applyQuaternion(s.obj.quaternion);
      s.backing.position.copy(s.obj.position).addScaledVector(SHEET_NORMAL, -0.0015);
      s.backing.quaternion.copy(s.obj.quaternion);
      s.backing.scale.set(AS_W * sc + 0.012, AS_H * sc + 0.012, 1);
    }
  };

  // ---------- Furniture ----------
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

  addModel("modern_arm_chair_01", { position: [-2.62, 0, -0.52], rotationY: 2.5, tint: 0.85 });
  addModel("potted_plant_04", { position: [0.9, TABLE_Y, 0.46], rotationY: -0.6 });
  addModel("alarm_clock_01", { position: [0.34, TABLE_Y, 0.54], rotationY: -2.5 });

  // ---------- Lighting ----------
  // A pendant lamp over the table is the key light: it puts the map and the sheet
  // in a warm pool and lets the room fall away, the way a real table looks at night.
  const pendant = new THREE.Group();
  pendant.position.set(0, 1.95, -0.05);
  scene.add(pendant);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.7, 8), mat.dark);
  cord.position.y = 0.35;
  pendant.add(cord);
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.19, 0.15, 28, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x24262c, roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide, envMapIntensity: 1.1 })
  );
  shade.castShadow = true;
  pendant.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.026, 14, 12), new THREE.MeshBasicMaterial({ color: 0xffdca8 }));
  bulb.position.y = -0.06;
  pendant.add(bulb);

  const keyLight = new THREE.PointLight(0xffc489, 6.2, 4.2, 2);
  keyLight.position.set(0, 1.88, -0.05);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.bias = -0.002;
  scene.add(keyLight);

  // Rim light from behind the party, so the figures read against the dark wall
  // instead of dissolving into it.
  const rim = new THREE.DirectionalLight(0x9fb4d8, 0.12);
  rim.position.set(-1.2, 2.4, -3.2);
  rim.target.position.set(0, 1.1, -0.6);
  scene.add(rim);
  scene.add(rim.target);

  // The ambient pair is warm now rather than blue. The room stays dark — the
  // pendant is still far and away the brightest thing — but dark and warm reads
  // as a evening at home, where dark and blue read as a basement.
  scene.add(new THREE.HemisphereLight(0x53453c, 0x14100c, 0.32));
  const fill = new THREE.DirectionalLight(0xb09878, 0.16);
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

  // ---------- Watercolour pass ----------
  const painter = createWatercolour(renderer, scene, camera);

  // ---------- Camera states ----------
  const UP_IDLE = new THREE.Vector3(0, 1, 0);
  // Looking straight down, the default up vector is parallel to the view direction,
  // which is degenerate. The sheet's local +Y maps to world -Z once it is laid flat,
  // so that is the direction that must read as "up" on screen when focused.
  const UP_FOCUS = new THREE.Vector3(0, 0, -1);
  const camUp = UP_IDLE.clone();

  const lookAt = new THREE.Vector3();
  // Sat a little higher and further back than before, so the fire, the sofa and
  // the wall all fall inside the frame. The table is still the subject; the room
  // is what tells you the table is somewhere.
  const idleTarget = new THREE.Vector3(-0.05, TABLE_Y + 0.2, -0.05);
  const pointer = { x: 0, y: 0 };

  // How far in the wheel has pulled the idle camera. 1 is the wide shot.
  let idleZoom = 1;

  const idlePose = (t, out) => {
    const angle = Math.sin(t * 0.1) * 0.3 + pointer.x * 0.16;
    const wide = camera.aspect > 1.4 ? 2.5 : 2.5 * (1.4 / camera.aspect);
    const radius = wide * idleZoom;
    // Coming in also means coming down: holding the height while closing the
    // distance would tip the view into a plan of the table.
    const height = 0.94 + 0.68 * idleZoom + pointer.y * 0.1;
    out.pos.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius + 0.25 * idleZoom);
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

  // Framing the board: low and close, tilted just enough that the terrain stands
  // up off the map instead of being read from directly above like a plan.
  const BOARD_AT = new THREE.Vector3(0.1, TABLE_Y, -0.1);
  const boardPose = (out) => {
    const d = camera.aspect > 1.4 ? 0.95 : 0.95 * (1.4 / camera.aspect);
    out.pos.set(BOARD_AT.x, TABLE_Y + 0.69, BOARD_AT.z + d);
    out.target.set(BOARD_AT.x, TABLE_Y + 0.02, BOARD_AT.z);
    return out;
  };

  // Framing one agent: stand off along the direction they face, high enough to
  // take in both the player and the sheet they have just raised. The aim point
  // sits between the two and slightly to their right, which pushes the player
  // into the left of frame and leaves the right for the sheet.
  let focusedAgent = null;
  const AGENT_F = new THREE.Vector3();
  const AGENT_R = new THREE.Vector3();
  const agentPose = (out) => {
    const { x, z, rotY } = focusedAgent.userData.seat;
    AGENT_F.set(Math.sin(rotY), 0, Math.cos(rotY));
    AGENT_R.set(Math.cos(rotY), 0, -Math.sin(rotY));
    const d = camera.aspect > 1.4 ? 1.75 : 1.75 * (1.4 / camera.aspect);
    out.pos.set(x, 1.4, z).addScaledVector(AGENT_F, d).addScaledVector(AGENT_R, 0.1);
    out.target.set(x, 1.12, z).addScaledVector(AGENT_F, 0.6).addScaledVector(AGENT_R, 0.24);
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

  function enterAgent(hit) {
    if (mode !== "idle") return;
    focusedAgent = hit;
    for (const s of agentSheets) s.target = s.index === hit.userData.index ? 1 : 0;
    from.pos.copy(camera.position);
    from.target.copy(lookAt);
    from.up.copy(camUp);
    mode = "toAgent";
    tweenStart = performance.now();
    onAgent?.(hit.userData.agent);
  }

  function enterBoard() {
    if (mode !== "idle") return;
    from.pos.copy(camera.position);
    from.target.copy(lookAt);
    from.up.copy(camUp);
    mode = "toBoard";
    tweenStart = performance.now();
    onBoard?.();
  }

  function exit() {
    if (mode === "idle" || mode === "toIdle") return;
    for (const s of agentSheets) s.target = 0;
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
  const aim = (e) => {
    const r = container.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
  };
  const hitSheet = (e) => {
    aim(e);
    return raycaster.intersectObject(sheetMesh, false).length > 0;
  };
  // A player's own sheet opens that player, so the paper in front of them is a
  // target too, not just the figure behind it.
  const hitAgent = (e) => {
    aim(e);
    const onSheet = raycaster.intersectObjects(agentSheetHits, false);
    if (onSheet.length) {
      const i = onSheet[0].object.userData.index;
      return agentHits.find((h) => h.userData.index === i) ?? null;
    }
    const hits = raycaster.intersectObjects(agentHits, false);
    return hits.length ? hits[0].object : null;
  };
  const hitDie = (e) => {
    aim(e);
    const hits = raycaster.intersectObjects(dice, false);
    return hits.length ? hits[0].object : null;
  };
  const hitBoard = (e) => {
    aim(e);
    return raycaster.intersectObject(board.mapMesh, false).length > 0;
  };

  container.addEventListener("pointermove", (e) => {
    const r = container.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    if (mode === "idle") {
      container.style.cursor = hitDie(e) || hitSheet(e) || hitAgent(e) || hitBoard(e) ? "pointer" : "grab";
    }
  });
  container.addEventListener("pointerdown", (e) => {
    if (mode !== "idle") return;
    // Dice are tested first: they sit on the table and are small enough that the
    // sheet behind them would otherwise swallow the click.
    const d = hitDie(e);
    if (d) return rollDie(d);
    if (hitSheet(e)) return enter();
    const a = hitAgent(e);
    if (a) return enterAgent(a);
    // Last, because it is the biggest target on the table by a long way and
    // would otherwise swallow everything standing on it.
    if (hitBoard(e)) enterBoard();
  });
  // ---------- Reading the sheet ----------
  // The sheet is a real scrollable element, but a browser will not route wheel
  // scrolling into a node that sits under a 3D transform: the click hit-test
  // finds it, the scroll hit-test does not. So the scrolling is driven here
  // instead, from the container, which sees the event whatever it landed on.
  const SHEET_LINE = 90;
  const scrollSheet = (dy) => {
    sheetRoot.scrollTop = Math.max(0, Math.min(sheetRoot.scrollHeight - sheetRoot.clientHeight, sheetRoot.scrollTop + dy));
  };

  container.addEventListener(
    "wheel",
    (e) => {
      if (mode === "focused") {
        e.preventDefault();
        scrollSheet(e.deltaMode === 1 ? e.deltaY * SHEET_LINE : e.deltaY);
      } else if (mode === "idle") {
        // The same gesture does the obvious thing in both places: moves you
        // through what you are looking at.
        e.preventDefault();
        idleZoom = THREE.MathUtils.clamp(idleZoom + e.deltaY * 0.0013, 0.42, 1.3);
      }
    },
    { passive: false }
  );

  // Dragging the page is the other half of it: on a trackpad or a touchscreen
  // that is what people reach for before they look for a scrollbar.
  let drag = null;
  container.addEventListener("pointerdown", (e) => {
    if (mode !== "focused") return;
    drag = { y: e.clientY, top: sheetRoot.scrollTop, moved: false };
    container.setPointerCapture?.(e.pointerId);
  });
  container.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const d = e.clientY - drag.y;
    if (Math.abs(d) > 3) drag.moved = true;
    sheetRoot.scrollTop = Math.max(0, Math.min(sheetRoot.scrollHeight - sheetRoot.clientHeight, drag.top - d * 1.6));
  });
  const endDrag = () => (drag = null);
  container.addEventListener("pointerup", endDrag);
  container.addEventListener("pointercancel", endDrag);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") return exit();
    if (mode !== "focused") return;
    const step = { ArrowDown: SHEET_LINE, ArrowUp: -SHEET_LINE, PageDown: 900, PageUp: -900, " ": 900 }[e.key];
    if (step !== undefined) {
      e.preventDefault();
      scrollSheet(step);
    } else if (e.key === "Home") sheetRoot.scrollTop = 0;
    else if (e.key === "End") sheetRoot.scrollTop = sheetRoot.scrollHeight;
  });

  window.addEventListener("resize", () => {
    camera.aspect = width() / height();
    camera.updateProjectionMatrix();
    renderer.setSize(width(), height());
    cssRenderer.setSize(width(), height());
    painter.setSize(width(), height());
  });

  // ---------- Loop ----------
  const clock = new THREE.Clock();
  let prevT = 0;
  renderer.setAnimationLoop(() => {
    const t = clock.getElapsedTime();
    // Clamped, because a backgrounded tab returns with a delta of several
    // seconds and every damped value would snap.
    const dt = Math.min(0.05, t - prevT);
    prevT = t;
    room.update(t);
    updateAgentSheets(dt);

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

    // They only talk in the wide shot: every closer view has its own thing to read.
    chatter.update(performance.now(), mode !== "idle");

    for (const b of breathers) {
      const k = Math.sin(t * b.rate + b.phase);
      b.objects.forEach((o, i) => {
        o.position.y = b.baseY[i] + k * 0.0075;
        o.rotation.x = b.baseX[i] + k * 0.013;
      });
    }
    updateDice();

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
    } else if (mode === "agent") {
      agentPose(pose);
      camera.position.copy(pose.pos);
      lookAt.copy(pose.target);
      camUp.copy(UP_IDLE);
    } else if (mode === "board") {
      boardPose(pose);
      camera.position.copy(pose.pos);
      lookAt.copy(pose.target);
      camUp.copy(UP_IDLE);
    } else {
      const k = Math.min(1, (performance.now() - tweenStart) / TWEEN_MS);
      const e = easeInOutCubic(k);
      const targetUp = mode === "toFocus" ? UP_FOCUS : UP_IDLE;
      if (mode === "toFocus") focusPose(to);
      else if (mode === "toAgent") agentPose(to);
      else if (mode === "toBoard") boardPose(to);
      else idlePose(t, to);
      camera.position.lerpVectors(from.pos, to.pos, e);
      lookAt.lerpVectors(from.target, to.target, e);
      camUp.copy(from.up).lerp(targetUp, e).normalize();
      if (k >= 1) {
        if (mode === "toFocus") {
          mode = "focused";
          setInteractive(true);
        } else if (mode === "toAgent") mode = "agent";
        else if (mode === "toBoard") mode = "board";
        else {
          mode = "idle";
          focusedAgent = null;
        }
      }
    }
    camera.up.copy(camUp);
    camera.lookAt(lookAt);

    painter.render();
    cssRenderer.render(scene, camera);
  });

  return { enter, exit, enterBoard, isFocused: () => mode === "focused", ready: Promise.all(pending) };
}
