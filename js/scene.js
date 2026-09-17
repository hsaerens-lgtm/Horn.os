import * as THREE from "three";
import { CSS3DRenderer, CSS3DObject } from "three/addons/renderers/CSS3DRenderer.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { plasticGrain, poster } from "./textures.js";

// Screen: 1024x768 CSS px mapped onto a 0.48 m x 0.36 m opening in the CRT bezel.
const SCREEN_W = 0.48;
const SCREEN_H = 0.36;
const SCREEN_SCALE = SCREEN_W / 1024;

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createScene({ container, osRoot, onEnter, onExit }) {
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

  // Image-based lighting: without it, plastic and metal read as flat shaded blocks.
  // RoomEnvironment is generated in-engine, so this costs no download. Kept dim so
  // the scene still reads as a room lit by one lamp at night.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.5).texture;
  scene.environmentIntensity = 0.22;
  pmrem.dispose();

  // ---------- Materials ----------
  // Photo-based PBR sets from Poly Haven (CC0). Each set is three 512px JPGs:
  // diffuse, OpenGL normal, and an ARM map whose green channel is roughness —
  // which is exactly the channel MeshStandardMaterial reads for roughnessMap.
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
    desk: loadPBR("american_walnut_veneer", [1.6, 0.8]),
    deskEdge: loadPBR("american_walnut_veneer", [4, 0.4]),
    floor: loadPBR("dark_wooden_planks", [3, 3]),
    wall: loadPBR("grey_plaster_02", [4, 1.8]),
    plastic: plasticGrain(),
    poster: poster(),
  };
  const N = (x, y = x) => new THREE.Vector2(x, y);
  const mat = {
    floor: new THREE.MeshStandardMaterial({ ...tex.floor, color: 0x6a6a72, normalScale: N(0.8), envMapIntensity: 0.5 }),
    // The plaster scan is a light grey; tinted down so the room still reads as night.
    wall: new THREE.MeshStandardMaterial({ ...tex.wall, color: 0x4a4a5c, normalScale: N(0.5), envMapIntensity: 0.4 }),
    wood: new THREE.MeshStandardMaterial({ ...tex.desk, color: 0xc08a5a, normalScale: N(0.5), envMapIntensity: 0.9 }),
    woodDark: new THREE.MeshStandardMaterial({ ...tex.deskEdge, color: 0x6b4a30, normalScale: N(0.4), envMapIntensity: 0.6 }),
    beige: new THREE.MeshStandardMaterial({ color: 0xcfc3a9, ...tex.plastic, normalScale: N(0.22), envMapIntensity: 1.0 }),
    beigeDark: new THREE.MeshStandardMaterial({ color: 0xb3a88f, ...tex.plastic, normalScale: N(0.22), envMapIntensity: 0.8 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x24242a, roughness: 0.5, envMapIntensity: 0.8 }),
    keys: new THREE.MeshStandardMaterial({ color: 0xd8d0bc, ...tex.plastic, normalScale: N(0.15), envMapIntensity: 0.9 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x8a8f99, roughness: 0.3, metalness: 0.85, envMapIntensity: 1.6 }),
    lampShade: new THREE.MeshStandardMaterial({ color: 0x2f5d50, roughness: 0.45, metalness: 0.3, side: THREE.DoubleSide, envMapIntensity: 1.2 }),
    paper: new THREE.MeshStandardMaterial({ color: 0xf1ede2, roughness: 0.9, envMapIntensity: 0.6 }),
    mug: new THREE.MeshStandardMaterial({ color: 0xb8433a, roughness: 0.25, envMapIntensity: 1.4 }),
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
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), mat.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const wall = new THREE.Mesh(new THREE.PlaneGeometry(12, 5), mat.wall);
  wall.position.set(0, 2.5, -1.3);
  wall.receiveShadow = true;
  scene.add(wall);

  // Skirting board and a framed print so the back wall isn't a flat void.
  box(12, 0.1, 0.02, mat.woodDark, 0, 0.05, -1.29, { cast: false });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.66, 0.03), mat.woodDark);
  frame.position.set(0.95, 1.75, -1.28);
  frame.castShadow = true;
  scene.add(frame);
  const print = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.58), new THREE.MeshStandardMaterial({ map: tex.poster, roughness: 0.9 }));
  print.position.set(0.95, 1.75, -1.26);
  scene.add(print);

  // ---------- Desk ----------
  const DESK_Y = 0.75;
  box(2.2, 0.05, 0.9, mat.wood, 0, DESK_Y - 0.025, 0);
  box(2.2, 0.08, 0.04, mat.woodDark, 0, DESK_Y - 0.09, 0.43);
  for (const [x, z] of [[-1.02, -0.38], [1.02, -0.38], [-1.02, 0.38], [1.02, 0.38]]) {
    box(0.06, DESK_Y - 0.05, 0.06, mat.woodDark, x, (DESK_Y - 0.05) / 2, z);
  }

  // ---------- Monitor (CRT) ----------
  const monitor = new THREE.Group();
  monitor.position.set(0, DESK_Y, -0.12);
  monitor.rotation.y = -0.03;
  scene.add(monitor);

  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.04, 32), mat.beigeDark);
  stand.position.y = 0.02;
  stand.castShadow = true;
  monitor.add(stand);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.04, 24), mat.beigeDark);
  neck.position.y = 0.06;
  monitor.add(neck);

  const BODY_H = 0.47;
  const BODY_Y = 0.08 + BODY_H / 2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, BODY_H, 0.4), mat.beige);
  body.position.set(0, BODY_Y, -0.06);
  body.castShadow = true;
  monitor.add(body);

  const back = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.36, 0.14), mat.beigeDark);
  back.position.set(0, BODY_Y, -0.32);
  back.castShadow = true;
  monitor.add(back);

  // Bezel: a frame with a rectangular hole, extruded towards the viewer.
  const FRONT_Z = -0.06 + 0.2;
  const bezelShape = new THREE.Shape();
  bezelShape.moveTo(-0.3, -BODY_H / 2);
  bezelShape.lineTo(0.3, -BODY_H / 2);
  bezelShape.lineTo(0.3, BODY_H / 2);
  bezelShape.lineTo(-0.3, BODY_H / 2);
  bezelShape.closePath();
  const hole = new THREE.Path();
  const HOLE_Y = 0.03; // screen sits slightly above the body centre, leaving room for the badge/buttons below
  // The extrude bevel rounds the opening inwards, so widen the hole by exactly the
  // bevel size — otherwise the frame clips the OS taskbar along the bottom edge.
  const BEVEL = 0.008;
  const hw = SCREEN_W / 2 + BEVEL;
  const hh = SCREEN_H / 2 + BEVEL;
  hole.moveTo(-hw, HOLE_Y - hh);
  hole.lineTo(hw, HOLE_Y - hh);
  hole.lineTo(hw, HOLE_Y + hh);
  hole.lineTo(-hw, HOLE_Y + hh);
  hole.closePath();
  bezelShape.holes.push(hole);
  const bezel = new THREE.Mesh(new THREE.ExtrudeGeometry(bezelShape, { depth: 0.035, bevelEnabled: true, bevelSize: BEVEL, bevelThickness: BEVEL, bevelSegments: 2 }), mat.beige);
  bezel.position.set(0, BODY_Y, FRONT_Z);
  bezel.castShadow = true;
  monitor.add(bezel);

  // Power LED + buttons under the screen
  const led = new THREE.Mesh(new THREE.CircleGeometry(0.006, 12), new THREE.MeshBasicMaterial({ color: 0x40ff70 }));
  led.position.set(0.22, BODY_Y + HOLE_Y - SCREEN_H / 2 - 0.035, FRONT_Z + 0.036);
  monitor.add(led);
  for (let i = 0; i < 3; i++) {
    const btn = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.008, 0.01), mat.beigeDark);
    btn.position.set(-0.2 + i * 0.03, BODY_Y + HOLE_Y - SCREEN_H / 2 - 0.035, FRONT_Z + 0.038);
    monitor.add(btn);
  }

  // Screen: CSS3D element + WebGL cut-out (also the raycast target)
  // Recessed only a few millimetres: deeper and the bezel walls would occlude the screen edges when zoomed in.
  const SCREEN_Z = FRONT_Z + 0.035 - 0.004;
  const screenObject = new CSS3DObject(osRoot);
  screenObject.scale.setScalar(SCREEN_SCALE);
  screenObject.position.set(0, BODY_Y + HOLE_Y, SCREEN_Z);
  monitor.add(screenObject);

  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H), mat.cutout);
  screenMesh.position.copy(screenObject.position);
  monitor.add(screenMesh);

  // Teal spill from the desktop once the OS is on; off while the CRT is dark.
  const screenGlow = new THREE.PointLight(0x5fb0b0, 0, 1.2, 2);
  let screenOn = false;
  screenGlow.position.set(0, BODY_Y + HOLE_Y, SCREEN_Z + 0.25);
  monitor.add(screenGlow);

  // ---------- Keyboard, mouse, props ----------
  const kb = box(0.46, 0.025, 0.16, mat.dark, 0.02, DESK_Y + 0.0125, 0.26);
  kb.rotation.y = 0.02;
  const keyGeo = new THREE.BoxGeometry(0.024, 0.008, 0.024);
  const keyCount = 14 * 5;
  const keys = new THREE.InstancedMesh(keyGeo, mat.keys, keyCount);
  const tmp = new THREE.Object3D();
  let k = 0;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 14; c++) {
      tmp.position.set(-0.19 + c * 0.029 + (r % 2) * 0.006, 0.0165, -0.055 + r * 0.028);
      tmp.updateMatrix();
      keys.setMatrixAt(k++, tmp.matrix);
    }
  }
  keys.castShadow = true;
  kb.add(keys);

  const mouse = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.05, 6, 12), mat.beige);
  mouse.rotation.x = Math.PI / 2;
  mouse.scale.set(1, 1, 0.55);
  mouse.position.set(0.42, DESK_Y + 0.016, 0.26);
  mouse.castShadow = true;
  scene.add(mouse);

  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.1, 24), mat.mug);
  mug.position.set(0.62, DESK_Y + 0.05, 0.05);
  mug.castShadow = true;
  scene.add(mug);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 8, 16, Math.PI), mat.mug);
  handle.position.set(0.66, DESK_Y + 0.05, 0.05);
  handle.rotation.z = -Math.PI / 2;
  scene.add(handle);

  for (let i = 0; i < 3; i++) {
    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.002, 0.297), mat.paper);
    paper.position.set(-0.62 + i * 0.02, DESK_Y + 0.002 + i * 0.002, 0.2 - i * 0.03);
    paper.rotation.y = -0.25 + i * 0.12;
    paper.receiveShadow = true;
    scene.add(paper);
  }

  // ---------- Lamp ----------
  const lamp = new THREE.Group();
  lamp.position.set(-0.8, DESK_Y, -0.22);
  scene.add(lamp);
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.02, 32), mat.metal);
  lampBase.position.y = 0.01;
  lamp.add(lampBase);
  const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.42, 12), mat.metal);
  arm1.position.set(0.06, 0.22, 0);
  arm1.rotation.z = -0.3;
  lamp.add(arm1);
  const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.38, 12), mat.metal);
  arm2.position.set(0.28, 0.5, 0.02);
  arm2.rotation.z = -1.25;
  lamp.add(arm2);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.16, 32, 1, true), mat.lampShade);
  shade.position.set(0.44, 0.52, 0.04);
  shade.rotation.set(0.35, 0, 0.55);
  shade.castShadow = true;
  lamp.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
  bulb.position.set(0.44, 0.49, 0.06);
  lamp.add(bulb);
  const lampLight = new THREE.PointLight(0xffb372, 2.6, 4.5, 2);
  lampLight.position.set(0.46, 0.46, 0.08);
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(1024, 1024);
  lampLight.shadow.bias = -0.002;
  lamp.add(lampLight);

  // Stand-in for light bouncing off the desk onto the monitor's face, which the
  // lamp itself never reaches — without it the hero object sits in shadow.
  const bounce = new THREE.PointLight(0xffc38f, 0.85, 2.2, 2);
  bounce.position.set(-0.18, DESK_Y + 0.14, 0.5);
  scene.add(bounce);

  scene.add(new THREE.HemisphereLight(0x3a3550, 0x08070a, 0.32));
  const fill = new THREE.DirectionalLight(0x8090c0, 0.12);
  fill.position.set(2, 3, 3);
  scene.add(fill);

  // ---------- Dust ----------
  const DUST = 180;
  const dustPos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 3;
    dustPos[i * 3 + 1] = 0.6 + Math.random() * 1.6;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 2.4 - 0.2;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xfff1d6, size: 0.008, transparent: true, opacity: 0.55, sizeAttenuation: true }));
  scene.add(dust);

  // ---------- Camera states ----------
  const lookAt = new THREE.Vector3();
  const idleTarget = new THREE.Vector3(0, DESK_Y + 0.44, -0.12);
  const pointer = { x: 0, y: 0 };
  const idlePose = (t, out) => {
    const angle = Math.sin(t * 0.12) * 0.32 + pointer.x * 0.18;
    // Wider viewports can sit closer; portrait-ish ones need distance so the monitor stays in frame.
    const radius = camera.aspect > 1.4 ? 2.45 : 2.45 * (1.4 / camera.aspect);
    out.pos.set(Math.sin(angle) * radius, 1.30 + pointer.y * 0.1, Math.cos(angle) * radius - 0.12);
    out.target.copy(idleTarget);
    return out;
  };

  const screenCenter = new THREE.Vector3();
  const screenNormal = new THREE.Vector3();
  const focusPose = (out) => {
    screenMesh.getWorldPosition(screenCenter);
    screenNormal.set(0, 0, 1).applyQuaternion(monitor.getWorldQuaternion(new THREE.Quaternion()));
    const fovRad = THREE.MathUtils.degToRad(camera.fov);
    const fill = 0.86;
    const dH = (SCREEN_H / 2) / Math.tan(fovRad / 2) / fill;
    const dW = (SCREEN_W / 2) / (Math.tan(fovRad / 2) * camera.aspect) / fill;
    const d = Math.max(dH, dW);
    out.pos.copy(screenCenter).addScaledVector(screenNormal, d);
    out.target.copy(screenCenter);
    return out;
  };

  const pose = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  const from = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  const to = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  let mode = "idle"; // idle | toFocus | focused | toIdle
  let tweenStart = 0;
  const TWEEN_MS = 1300;

  idlePose(0, pose);
  camera.position.copy(pose.pos);
  // Seed the look-at vector too: it is lerped every frame, so leaving it at the
  // origin makes the camera start aimed at the floor and swing up over the first
  // second — very visible when the first frames are throttled.
  lookAt.copy(pose.target);
  camera.lookAt(pose.target);

  const setInteractive = (on) => {
    osRoot.style.pointerEvents = on ? "auto" : "none";
    container.style.cursor = on ? "default" : "grab";
  };
  setInteractive(false);

  function enter() {
    if (mode === "focused" || mode === "toFocus") return;
    from.pos.copy(camera.position);
    from.target.copy(lookAt);
    mode = "toFocus";
    tweenStart = performance.now();
    screenOn = true;
    onEnter?.();
  }

  function exit() {
    if (mode === "idle" || mode === "toIdle") return;
    from.pos.copy(camera.position);
    from.target.copy(lookAt);
    mode = "toIdle";
    tweenStart = performance.now();
    setInteractive(false);
    onExit?.();
  }

  // ---------- Interaction ----------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hitScreen = (e) => {
    const r = container.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObject(screenMesh, false).length > 0;
  };

  container.addEventListener("pointermove", (e) => {
    const r = container.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    if (mode === "idle") container.style.cursor = hitScreen(e) ? "pointer" : "grab";
  });
  container.addEventListener("pointerdown", (e) => {
    if (mode === "idle" && hitScreen(e)) enter();
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

    // dust drift
    const p = dust.geometry.attributes.position;
    for (let i = 0; i < DUST; i++) {
      let y = p.getY(i) + 0.0006 + Math.sin(t + i) * 0.00025;
      if (y > 2.3) y = 0.6;
      p.setY(i, y);
      p.setX(i, p.getX(i) + Math.sin(t * 0.3 + i * 1.7) * 0.0002);
    }
    p.needsUpdate = true;
    screenGlow.intensity = screenOn ? 0.09 + Math.sin(t * 9) * 0.01 : 0;

    if (mode === "idle") {
      idlePose(t, pose);
      camera.position.lerp(pose.pos, 0.04);
      lookAt.lerp(pose.target, 0.06);
    } else if (mode === "focused") {
      focusPose(pose);
      camera.position.copy(pose.pos);
      lookAt.copy(pose.target);
    } else {
      const k = Math.min(1, (performance.now() - tweenStart) / TWEEN_MS);
      const e = easeInOutCubic(k);
      if (mode === "toFocus") focusPose(to);
      else idlePose(t, to);
      camera.position.lerpVectors(from.pos, to.pos, e);
      lookAt.lerpVectors(from.target, to.target, e);
      if (k >= 1) {
        if (mode === "toFocus") {
          mode = "focused";
          setInteractive(true);
        } else mode = "idle";
      }
    }
    camera.lookAt(lookAt);

    renderer.render(scene, camera);
    cssRenderer.render(scene, camera);
  });

  return { enter, exit, isFocused: () => mode === "focused" };
}
