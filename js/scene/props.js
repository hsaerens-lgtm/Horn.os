// The things that make the office somebody's: a cat asleep in the sun on the
// window sill, a guitar on its stand, and the wall clock that tells the room
// what time it is.

import * as THREE from "three";
import { roundedBox, between } from "../lib/shapes.js";
import { mergeParts, at } from "../lib/merge.js";

function canvasTexture(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const shadowed = (m) => {
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

/* ------------------------------------------------------------------ *
 *  The cat
 * ------------------------------------------------------------------ */
export function buildCat() {
  const g = new THREE.Group();
  g.userData.kind = "cat";

  // Ginger tabby: bands across the sphere's U, which wraps round the body.
  const fur = canvasTexture(512, 256, (c, w, h) => {
    c.fillStyle = "#d58b4c";
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) {
      const x = (i / 14) * w + Math.sin(i * 2.3) * 8;
      c.fillStyle = "rgba(150, 78, 34, 0.55)";
      c.beginPath();
      c.ellipse(x, h / 2, 9 + (i % 3) * 3, h * 0.42, 0, 0, Math.PI * 2);
      c.fill();
    }
    const grd = c.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, "rgba(255,255,255,0)");
    grd.addColorStop(0.85, "rgba(255,238,215,0)");
    grd.addColorStop(1, "rgba(255,238,215,0.9)");
    c.fillStyle = grd;
    c.fillRect(0, 0, w, h);
  });
  const coat = new THREE.MeshStandardMaterial({ map: fur, roughness: 0.95 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xd98b8b, roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: 0.6 });

  const cushion = shadowed(new THREE.Mesh(roundedBox(0.28, 0.05, 0.36, 0.022), new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.95 })));
  cushion.position.y = 0.025;
  g.add(cushion);

  const body = new THREE.Group();
  body.position.y = 0.05;
  g.add(body);

  const torso = shadowed(new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), coat));
  torso.scale.set(0.11, 0.075, 0.15);
  torso.position.y = 0.068;
  body.add(torso);

  const hips = shadowed(new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), coat));
  hips.scale.set(0.1, 0.07, 0.09);
  hips.position.set(0.02, 0.06, -0.08);
  body.add(hips);

  // Head tucked down on the front paws, turned a little towards the room.
  const head = new THREE.Group();
  head.position.set(0.055, 0.075, 0.12);
  head.rotation.y = 0.5;
  body.add(head);
  const skull = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.055, 24, 16), coat));
  skull.scale.set(1, 0.88, 0.95);
  head.add(skull);
  const muzzle = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf1ddc4, roughness: 0.95 })));
  muzzle.position.set(0, -0.016, 0.042);
  head.add(muzzle);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.007, 10, 8), pink);
  nose.position.set(0, -0.006, 0.066);
  head.add(nose);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.0025, 0.003), dark);
    eye.position.set(s * 0.022, 0.008, 0.05);
    eye.rotation.z = s * -0.25;
    head.add(eye);
  }
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.042, 4), coat));
    ear.position.set(s * 0.032, 0.05, -0.005);
    ear.rotation.set(-0.15, 0, s * -0.35);
    head.add(ear);
    ears.push(ear);
  }

  // Front paws, peeking out under the chin.
  for (const s of [-1, 1]) {
    const paw = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), new THREE.MeshStandardMaterial({ color: 0xf1ddc4, roughness: 0.95 })));
    paw.scale.set(1, 0.6, 1.5);
    paw.position.set(s * 0.03 + 0.02, 0.015, 0.15);
    body.add(paw);
  }

  // The tail, curled round the front.
  const tail = new THREE.Group();
  tail.position.set(0, 0.03, -0.02);
  body.add(tail);
  const tailMesh = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 10, 28, Math.PI * 1.05), coat));
  tailMesh.rotation.x = Math.PI / 2;
  tailMesh.rotation.z = -0.3;
  tail.add(tailMesh);

  let twitch = -1;
  return {
    group: g,
    poke(now) {
      twitch = now;
    },
    update(t, now) {
      // Asleep: a slow breath, the whole body rising a little.
      const breath = Math.sin(t * 1.7) * 0.5 + 0.5;
      torso.scale.y = 0.075 * (1 + breath * 0.045);
      torso.scale.x = 0.11 * (1 + breath * 0.025);
      head.position.y = 0.075 + breath * 0.002;
      if (twitch >= 0) {
        const k = (now - twitch) / 1200;
        if (k > 1) {
          twitch = -1;
          ears[1].rotation.x = -0.15;
          tail.rotation.y = 0;
        } else {
          ears[1].rotation.x = -0.15 + Math.sin(k * Math.PI * 6) * 0.35 * (1 - k);
          tail.rotation.y = Math.sin(k * Math.PI * 2) * 0.35;
        }
      }
    },
  };
}

/* ------------------------------------------------------------------ *
 *  The guitar
 * ------------------------------------------------------------------ */
export function buildGuitar() {
  const g = new THREE.Group();

  // Body outline: the union of a lower and an upper bout, pinched at the waist.
  const L = 0.5;
  const hw = (y) => {
    const a = (y - 0.17) / 0.19;
    const b = (y - 0.38) / 0.135;
    const lower = Math.abs(a) <= 1 ? 0.19 * Math.sqrt(1 - a * a) : 0;
    const upper = Math.abs(b) <= 1 ? 0.145 * Math.sqrt(1 - b * b) : 0;
    return Math.max(lower, upper, y > 0.12 && y < 0.44 ? 0.118 : 0);
  };
  const steps = 60;
  const shape = new THREE.Shape();
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const y = -0.02 + (i / steps) * (L + 0.035);
    pts.push(new THREE.Vector2(hw(y), y));
  }
  shape.moveTo(0, -0.02);
  for (const p of pts) shape.lineTo(p.x, p.y);
  for (let i = pts.length - 1; i >= 0; i--) shape.lineTo(-pts[i].x, pts[i].y);
  const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.085, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 3, curveSegments: 4 });
  const spruce = new THREE.MeshStandardMaterial({ color: 0xe6c48c, roughness: 0.35 });
  const mahogany = new THREE.MeshStandardMaterial({ color: 0x6e3520, roughness: 0.35 });
  const rosewood = new THREE.MeshStandardMaterial({ color: 0x2b1810, roughness: 0.5 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.25, metalness: 0.9 });
  const body = shadowed(new THREE.Mesh(bodyGeo, [spruce, mahogany]));
  body.position.z = -0.0425;
  g.add(body);

  const front = 0.0425 + 0.0065;
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.043, 32), new THREE.MeshBasicMaterial({ color: 0x120a06 }));
  hole.position.set(0, 0.32, front);
  g.add(hole);
  const rosette = new THREE.Mesh(new THREE.RingGeometry(0.047, 0.056, 40), rosewood);
  rosette.position.set(0, 0.32, front + 0.0005);
  g.add(rosette);
  const bridge = shadowed(new THREE.Mesh(roundedBox(0.1, 0.022, 0.008, 0.003), rosewood));
  bridge.position.set(0, 0.11, front + 0.004);
  g.add(bridge);

  // Neck, fretboard, headstock.
  const neck = shadowed(new THREE.Mesh(roundedBox(0.048, 0.44, 0.024, 0.008), mahogany));
  neck.position.set(0, L + 0.2, 0.012);
  g.add(neck);
  const board = shadowed(new THREE.Mesh(roundedBox(0.046, 0.46, 0.006, 0.002), rosewood));
  board.position.set(0, L + 0.19, 0.027);
  g.add(board);
  const frets = [];
  for (let i = 0; i < 16; i++) {
    const y = L + 0.41 - Math.pow(0.944, i) * 0.4 + 0.0;
    frets.push({ geometry: new THREE.BoxGeometry(0.046, 0.0015, 0.002), matrix: at(0, y - 0.02, 0.031) });
  }
  g.add(new THREE.Mesh(mergeParts(frets), metal));
  const head = shadowed(new THREE.Mesh(roundedBox(0.075, 0.16, 0.018, 0.008), mahogany));
  head.position.set(0, L + 0.5, 0.004);
  head.rotation.x = -0.18;
  g.add(head);
  const pegs = [];
  for (let i = 0; i < 3; i++) {
    for (const s of [-1, 1]) pegs.push({ geometry: new THREE.CylinderGeometry(0.006, 0.006, 0.03, 8), matrix: at(s * 0.052, L + 0.46 + i * 0.04, 0.0, [0, 0, Math.PI / 2]) });
  }
  g.add(new THREE.Mesh(mergeParts(pegs), metal));
  const strings = [];
  for (let i = 0; i < 6; i++) {
    const x = (i - 2.5) * 0.0068;
    strings.push(between(new THREE.Vector3(x, 0.11, front + 0.009), new THREE.Vector3(x * 1.2, L + 0.43, 0.032), 0.0006, 0.0006, 4));
  }
  g.add(new THREE.Mesh(mergeParts(strings), metal));

  // Stand: a steel A-frame with a cradle under the body and a yoke at the neck.
  const stand = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x1d1f21, roughness: 0.45, metalness: 0.6 });
  const legs = [];
  const top = new THREE.Vector3(0, 0.78, -0.16);
  for (const s of [-1, 1]) legs.push(between(new THREE.Vector3(s * 0.16, 0.0, 0.12), new THREE.Vector3(s * 0.05, 0.12, 0.02), 0.008, 0.008, 8));
  legs.push(between(new THREE.Vector3(0, 0.0, -0.3), top, 0.008, 0.008, 8));
  legs.push(between(new THREE.Vector3(-0.12, 0.12, 0.03), new THREE.Vector3(0.12, 0.12, 0.03), 0.009, 0.009, 8));
  legs.push(between(new THREE.Vector3(0, 0.12, 0.03), new THREE.Vector3(0, 0.34, -0.06), 0.008, 0.008, 8));
  stand.add(shadowed(new THREE.Mesh(mergeParts(legs), steel)));
  g.add(stand);

  // Lean the guitar back into the stand.
  const lean = new THREE.Group();
  lean.add(...g.children.filter((c) => c !== stand));
  lean.position.set(0, 0.13, 0.03);
  lean.rotation.x = -0.24;
  g.add(lean);
  return g;
}

/* ------------------------------------------------------------------ *
 *  The wall clock — shows the visitor's real time; clicking it moves the
 *  room on to the next part of the day.
 * ------------------------------------------------------------------ */
export function buildClock() {
  const g = new THREE.Group();
  g.userData.kind = "clock";
  const face = canvasTexture(512, 512, (c, w) => {
    c.fillStyle = "#f7f3ea";
    c.beginPath();
    c.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#1d1f21";
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const long = i % 5 === 0;
      c.lineWidth = long ? 10 : 3;
      const r0 = w / 2 - (long ? 64 : 44);
      const r1 = w / 2 - 28;
      c.beginPath();
      c.moveTo(w / 2 + Math.sin(a) * r0, w / 2 - Math.cos(a) * r0);
      c.lineTo(w / 2 + Math.sin(a) * r1, w / 2 - Math.cos(a) * r1);
      c.stroke();
    }
  });
  const R = 0.15;
  const dial = new THREE.Mesh(new THREE.CircleGeometry(R, 48), new THREE.MeshStandardMaterial({ map: face, roughness: 0.6 }));
  dial.position.z = 0.012;
  dial.receiveShadow = true;
  g.add(dial);
  const rim = shadowed(new THREE.Mesh(new THREE.TorusGeometry(R, 0.012, 10, 48), new THREE.MeshStandardMaterial({ color: 0x1d1f21, roughness: 0.4, metalness: 0.5 })));
  rim.position.z = 0.012;
  g.add(rim);
  const back = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.02, 48), new THREE.MeshStandardMaterial({ color: 0x1d1f21, roughness: 0.5 })));
  back.rotation.x = Math.PI / 2;
  g.add(back);

  const handMat = new THREE.MeshStandardMaterial({ color: 0x1d1f21, roughness: 0.4 });
  const hand = (len, wid, z) => {
    const pivot = new THREE.Group();
    const m = shadowed(new THREE.Mesh(new THREE.BoxGeometry(wid, len, 0.003), handMat));
    m.position.y = len / 2 - 0.012;
    pivot.add(m);
    pivot.position.z = z;
    g.add(pivot);
    return pivot;
  };
  const hourHand = hand(0.075, 0.009, 0.016);
  const minuteHand = hand(0.115, 0.006, 0.019);
  const secondHand = hand(0.12, 0.002, 0.022);
  secondHand.children[0].material = new THREE.MeshStandardMaterial({ color: 0xc0462f, roughness: 0.4 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.006, 16), handMat);
  cap.rotation.x = Math.PI / 2;
  cap.position.z = 0.024;
  g.add(cap);

  return {
    group: g,
    update(date) {
      const s = date.getSeconds() + date.getMilliseconds() / 1000;
      const m = date.getMinutes() + s / 60;
      const h = (date.getHours() % 12) + m / 60;
      secondHand.rotation.z = -(s / 60) * Math.PI * 2;
      minuteHand.rotation.z = -(m / 60) * Math.PI * 2;
      hourHand.rotation.z = -(h / 12) * Math.PI * 2;
    },
  };
}
