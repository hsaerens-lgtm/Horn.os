// The things that make the office somebody's: a cat asleep in the sun on the
// window sill and the wall clock that tells the room what time it is. (The
// guitar has its own module, guitar.js.)

import * as THREE from "three";
import { roundedBox } from "../lib/shapes.js";

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
 *  Shared: a tube along a curve whose radius varies along its length
 * ------------------------------------------------------------------ */
const UP = new THREE.Vector3(0, 1, 0);

// Frames are built from the world up axis rather than Frenet frames, so a
// curve lying in the horizontal plane never twists. `flatten` squashes the
// section vertically (a sleeping cat is a loaf, not a pipe).
function taperedTube(curve, radius, { segments = 90, radial = 24, flatten = 1 } = {}) {
  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    const T = curve.getTangentAt(t);
    const B = new THREE.Vector3().crossVectors(T, UP).normalize();
    const N = new THREE.Vector3().crossVectors(B, T).normalize();
    const rad = radius(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const v = p.clone().addScaledVector(N, Math.cos(a) * rad * flatten).addScaledVector(B, Math.sin(a) * rad);
      pos.push(v.x, v.y, v.z);
      uv.push(t, j / radial);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/* ------------------------------------------------------------------ *
 *  The cat: a ginger tabby curled into a croissant, nose on its tail
 * ------------------------------------------------------------------ */
export function buildCat() {
  const g = new THREE.Group();
  g.userData.kind = "cat";

  // Fur along the body: tabby bands across the spine, a cream belly underneath
  // (v = 0.5 is the underside), and fine noise for the coat.
  const furTex = (bands, belly) =>
    canvasTexture(1024, 256, (c, w, h) => {
      c.fillStyle = "#d8894a";
      c.fillRect(0, 0, w, h);
      let s = 9;
      const r = () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
      for (let i = 0; i < bands; i++) {
        const x = (i + 0.5) * (w / bands) + (r() - 0.5) * 14;
        const wid = 10 + r() * 16;
        for (const [y0, y1] of [
          [0, h * 0.3],
          [h * 0.7, h],
        ]) {
          c.fillStyle = "rgba(140, 66, 26, 0.55)";
          c.beginPath();
          c.moveTo(x - wid / 2, y0);
          c.bezierCurveTo(x - wid, (y0 + y1) / 2, x + wid, (y0 + y1) / 2, x + wid / 2, y1);
          c.lineTo(x + wid, y0 === 0 ? y0 : y1);
          c.closePath();
          c.fill();
        }
      }
      // darker saddle along the spine (v = 0 and 1 are the top)
      const top = c.createLinearGradient(0, 0, 0, h);
      top.addColorStop(0, "rgba(120, 55, 20, 0.35)");
      top.addColorStop(0.2, "rgba(120, 55, 20, 0)");
      top.addColorStop(0.8, "rgba(120, 55, 20, 0)");
      top.addColorStop(1, "rgba(120, 55, 20, 0.35)");
      c.fillStyle = top;
      c.fillRect(0, 0, w, h);
      if (belly) {
        const b = c.createLinearGradient(0, h * 0.3, 0, h * 0.7);
        b.addColorStop(0, "rgba(250, 232, 208, 0)");
        b.addColorStop(0.35, "rgba(250, 232, 208, 0.95)");
        b.addColorStop(0.65, "rgba(250, 232, 208, 0.95)");
        b.addColorStop(1, "rgba(250, 232, 208, 0)");
        c.fillStyle = b;
        c.fillRect(0, 0, w, h);
      }
      for (let i = 0; i < 14000; i++) {
        c.fillStyle = r() < 0.5 ? "rgba(255, 220, 180, 0.12)" : "rgba(90, 40, 15, 0.12)";
        c.fillRect(r() * w, r() * h, 1, 2 + r() * 3);
      }
    });
  const coat = (map) => new THREE.MeshPhysicalMaterial({ map, roughness: 0.85, sheen: 1, sheenColor: new THREE.Color(0xffc48a), sheenRoughness: 0.6 });
  const bodyMat = coat(furTex(11, true));
  const tailMat = coat(furTex(9, false));
  const cream = new THREE.MeshPhysicalMaterial({ color: 0xf6e3c8, roughness: 0.9, sheen: 1, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.6 });
  const headMat = coat(furTex(6, false));
  const pink = new THREE.MeshStandardMaterial({ color: 0xd98a8a, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.5 });

  const cushion = shadowed(new THREE.Mesh(roundedBox(0.3, 0.05, 0.36, 0.024), new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.95 })));
  cushion.position.y = 0.025;
  g.add(cushion);

  const base = 0.05; // top of the cushion
  const R = 0.075; // radius of the curl
  const arc = (a0, a1, rad0, rad1, y) =>
    new THREE.CatmullRomCurve3(
      Array.from({ length: 16 }, (_, i) => {
        const k = i / 15;
        const a = a0 + (a1 - a0) * k;
        const rr = rad0 + (rad1 - rad0) * k;
        return new THREE.Vector3(Math.cos(a) * rr, y(k), Math.sin(a) * rr);
      }),
    );

  // body: from the neck, round the curl, to the haunches
  const bodyR = (t) => 0.042 + 0.034 * smooth(0, 0.25, t) - 0.012 * smooth(0.75, 1, t);
  const bodyCurve = arc(0.35 * Math.PI, 1.72 * Math.PI, R, R * 0.95, () => 0);
  const body = shadowed(new THREE.Mesh(taperedTube(bodyCurve, bodyR, { flatten: 0.82 }), bodyMat));
  body.position.y = base + 0.064 * 0.82;
  g.add(body);
  const haunch = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.066, 24, 16), bodyMat));
  const hp = bodyCurve.getPointAt(1);
  haunch.position.set(hp.x, base + 0.055, hp.z);
  haunch.scale.set(1, 0.82, 1);
  g.add(haunch);
  const chest = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 14), cream));
  const cp = bodyCurve.getPointAt(0);
  chest.position.set(cp.x, base + 0.04, cp.z);
  g.add(chest);

  // tail: out of the haunches and round the outside of the curl to the nose
  const tailCurve = arc(1.78 * Math.PI, 2.42 * Math.PI, R * 1.25, R * 1.75, (k) => 0.012 * (1 - k));
  const tailBase = tailCurve.getPointAt(0);
  const tail = new THREE.Group();
  tail.position.set(tailBase.x, base + 0.02, tailBase.z);
  const tailGeo = taperedTube(tailCurve, (t) => 0.021 - 0.009 * t, { segments: 60, radial: 14 });
  tailGeo.translate(-tailBase.x, 0, -tailBase.z);
  const tailMesh = shadowed(new THREE.Mesh(tailGeo, tailMat));
  tail.add(tailMesh);
  const tipP = tailCurve.getPointAt(1);
  const tip = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), tailMat));
  tip.position.set(tipP.x - tailBase.x, tipP.y, tipP.z - tailBase.z);
  tail.add(tip);
  g.add(tail);

  // head: resting on the tail by the neck, turned out and tipped on its side
  const ha = 0.28 * Math.PI;
  const head = new THREE.Group();
  const out = new THREE.Vector3(Math.cos(ha), 0, Math.sin(ha));
  head.position.set(out.x * R * 1.35, base + 0.062, out.z * R * 1.35);
  head.rotation.y = Math.atan2(out.x, out.z) - 0.5;
  head.rotation.x = 0.35;
  head.rotation.z = 0.35;
  g.add(head);
  const skull = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.05, 28, 20), headMat));
  skull.scale.set(1.05, 0.88, 0.95);
  head.add(skull);
  for (const s of [-1, 1]) {
    const cheek = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 12), headMat));
    cheek.position.set(s * 0.028, -0.018, 0.022);
    head.add(cheek);
  }
  const muzzle = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), cream));
  muzzle.scale.set(1.25, 0.8, 1);
  muzzle.position.set(0, -0.022, 0.04);
  head.add(muzzle);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 10, 8), pink);
  nose.scale.set(1.3, 0.8, 1);
  nose.position.set(0, -0.012, 0.059);
  head.add(nose);
  for (const s of [-1, 1]) {
    // closed eyes: a dark crescent each
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.009, 0.0016, 6, 12, Math.PI * 0.8), dark);
    eye.position.set(s * 0.02, 0.006, 0.046);
    eye.rotation.set(0.2, s * 0.35, Math.PI + Math.PI * 0.1);
    head.add(eye);
  }
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(s * 0.03, 0.036, -0.004);
    ear.rotation.set(-0.2, s * -0.25, s * -0.3);
    const outer = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.038, 4, 1), headMat));
    outer.rotation.y = Math.PI / 4;
    outer.scale.z = 0.5;
    ear.add(outer);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.028, 4, 1), pink);
    inner.rotation.y = Math.PI / 4;
    inner.scale.z = 0.3;
    inner.position.set(0, -0.003, 0.005);
    ear.add(inner);
    head.add(ear);
    ears.push(ear);
  }
  // front paws, tucked under the chin
  for (const s of [-1, 1]) {
    const paw = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.018, 14, 10), cream));
    paw.scale.set(1, 0.65, 1.6);
    const pa = ha + s * 0.2;
    paw.position.set(Math.cos(pa) * R * 1.55, base + 0.012, Math.sin(pa) * R * 1.55);
    paw.rotation.y = Math.atan2(Math.cos(pa), Math.sin(pa));
    g.add(paw);
  }

  let twitch = -1;
  return {
    group: g,
    poke(now) {
      twitch = now;
    },
    update(t, now) {
      // asleep: a slow breath rising through the body
      const breath = Math.sin(t * 1.6) * 0.5 + 0.5;
      body.scale.set(1 + breath * 0.02, 1 + breath * 0.05, 1 + breath * 0.02);
      haunch.scale.y = 0.82 * (1 + breath * 0.03);
      head.position.y = base + 0.062 + breath * 0.002;
      if (twitch >= 0) {
        const k = (now - twitch) / 1200;
        if (k > 1) {
          twitch = -1;
          ears[1].rotation.x = -0.2;
          tail.rotation.y = 0;
        } else {
          ears[1].rotation.x = -0.2 + Math.sin(k * Math.PI * 6) * 0.4 * (1 - k);
          tail.rotation.y = Math.sin(k * Math.PI * 2) * 0.25;
        }
      }
    },
  };
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
