// What happens on a natural 20 and a natural 1.
//
// Two effects, one module, because they share the only two things that are
// awkward here: a particle pool, and a light.
//
// The light matters. Adding or removing a PointLight changes the light count a
// material is compiled against, which makes three.js rebuild every shader in
// the scene — a visible stall at exactly the moment something is meant to feel
// sudden. So there is one flash light, created at start-up with zero intensity,
// and both effects borrow it and give it back.

import * as THREE from "three";

const G = 9.2;
const POOL = 1400;

// A natural 1 takes eight seconds end to end: five of wreckage, three to put
// the room back.
const BOOM = 5.0;
const RETURN = 3.0;

export function createEffects(scene, { centre = new THREE.Vector3(0, 0.9, 0), floorY = 0.08 } = {}) {
  /* ---------------- Sparks ---------------- */
  const pos = new Float32Array(POOL * 3);
  const col = new Float32Array(POOL * 3);
  const vel = new Float32Array(POOL * 3);
  const life = new Float32Array(POOL);
  const span = new Float32Array(POOL);
  const tint = new Float32Array(POOL * 3);
  for (let i = 0; i < POOL; i++) pos[i * 3 + 1] = -99;
  let cursor = 0;

  // A round spark. PointsMaterial draws a square by default, and at this size
  // a square reads as a speck of dirt rather than as a spark.
  const dot = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 48;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(24, 24, 0, 24, 24, 24);
    // Solid most of the way out, then a soft rim. A gentle radial falloff looks
    // nicer frozen and carries roughly a quarter of the light of the square it
    // replaced, which under an additive blend and a tone curve is the
    // difference between a firework and nothing at all.
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.55, "rgba(255,255,255,1)");
    g.addColorStop(0.78, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 48, 48);
    return new THREE.CanvasTexture(c);
  })();

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const sparks = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      // Big and bright. These are read through the watercolour pass, which tone
      // maps everything into display range — a spark at a sensible size and a
      // sensible brightness comes out of it as a grey speck.
      size: 0.075,
      map: dot,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
  );
  sparks.frustumCulled = false;
  sparks.renderOrder = 900;
  scene.add(sparks);

  const emit = (x, y, z, vx, vy, vz, r, g, b, secs) => {
    const i = cursor;
    cursor = (cursor + 1) % POOL;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
    tint[i * 3] = r; tint[i * 3 + 1] = g; tint[i * 3 + 2] = b;
    life[i] = span[i] = secs;
  };

  const flash = new THREE.PointLight(0xffd24a, 0, 6, 2);
  flash.position.copy(centre);
  scene.add(flash);
  let flashFor = 0;

  /* ---------------- Rockets ---------------- */
  const rockets = [];
  // Above 1 on purpose: the tone curve in the watercolour pass pulls everything
  // back into display range, and a spark that starts at 1 lands as grey.
  const HOT = 2.4;
  // Weighted warm: gold twice, then amber, then one white and one cold blue for
  // variety. An even draw across four came out white too often to read as gold.
  const SHELL = [
    [1.0, 0.84, 0.36], // gold
    [1.0, 0.84, 0.36], // gold again
    [1.0, 0.55, 0.22], // amber
    [1.0, 0.97, 0.88], // white
    [0.55, 0.82, 1.0], // cold blue
  ].map((c) => c.map((v) => v * HOT));

  /**
   * A natural 20. Three shells go up from the table over about half a second
   * and burst above it.
   */
  function fireworks(at) {
    for (let k = 0; k < 3; k++) {
      const c = SHELL[Math.floor(Math.random() * SHELL.length)];
      rockets.push({
        p: new THREE.Vector3(at.x + (Math.random() - 0.5) * 0.3, at.y + 0.05, at.z + (Math.random() - 0.5) * 0.3),
        // Tuned to burst somewhere between head height and the picture rail.
        // The first pass sent them up at 4.4 m/s on a half-second fuse, which
        // put the shells through the ceiling the room does not have.
        v: new THREE.Vector3((Math.random() - 0.5) * 0.6, 2.7 + Math.random() * 0.8, (Math.random() - 0.5) * 0.6),
        fuse: 0.28 + k * 0.16 + Math.random() * 0.1,
        c,
      });
    }
  }

  const burst = (p, c) => {
    for (let i = 0; i < 190; i++) {
      // Directions off a sphere, speeds off its square root: a uniform speed
      // gives a hollow shell, which is what a firework looks like from far away
      // and wrong from underneath.
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const sp = 0.45 + Math.sqrt(Math.random()) * 1.25;
      emit(
        p.x, p.y, p.z,
        Math.sin(ph) * Math.cos(th) * sp,
        Math.cos(ph) * sp,
        Math.sin(ph) * Math.sin(th) * sp,
        c[0], c[1], c[2],
        0.9 + Math.random() * 0.7
      );
    }
    flash.color.setRGB(c[0], c[1], c[2]);
    flash.position.copy(p);
    flash.intensity = 9;
    flashFor = 0.32;
  };

  /* ---------------- The room coming apart ---------------- */
  const debris = [];
  let boomT = -1;

  /**
   * A natural 1. Everything loose in the room is thrown away from the table,
   * bounces, and is then put back exactly where it was.
   */
  function blast(items) {
    if (boomT >= 0) return; // already in pieces
    debris.length = 0;
    for (const o of items) {
      const home = { p: o.position.clone(), q: o.quaternion.clone() };
      const away = o.position.clone().sub(centre);
      away.y = Math.max(away.y, 0.25);
      // Always forward into the room. Half of this furniture is on the back
      // wall, so blowing it straight away from the table sends it through the
      // wall and out of sight, which looks like things vanishing rather than
      // like things being blown off.
      away.z = Math.abs(away.z) * 0.5 + 0.4;
      const d = Math.max(0.6, away.length());
      away.normalize();
      debris.push({
        o,
        home,
        // Slow enough to watch. The first pass threw everything at six metres a
        // second, which cleared the frame before the first screenshot.
        v: away.multiplyScalar(0.8 + 1.1 / d).add(new THREE.Vector3(0, 2.6 + Math.random() * 1.8, 0)),
        w: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
          .normalize()
          .multiplyScalar(2.5 + Math.random() * 5),
        rest: Math.min(floorY, home.p.y),
      });
    }
    boomT = 0;

    for (let i = 0; i < 220; i++) {
      const th = Math.random() * Math.PI * 2;
      const sp = 0.9 + Math.random() * 2.0;
      emit(
        centre.x, centre.y - 0.1, centre.z,
        Math.cos(th) * sp, 0.6 + Math.random() * 2.4, Math.sin(th) * sp,
        HOT, HOT * 0.34, HOT * 0.1,
        0.7 + Math.random() * 0.7
      );
    }
    flash.color.setRGB(1, 0.35, 0.1);
    flash.position.copy(centre);
    flash.intensity = 26;
    flashFor = 0.5;
  }

  const spin = new THREE.Quaternion();
  const axis = new THREE.Vector3();

  /** How hard the camera should be shaking, 0 when it should not. */
  let shake = 0;

  function update(dt) {
    // rockets
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.v.y -= G * 0.45 * dt;
      r.p.addScaledVector(r.v, dt);
      r.fuse -= dt;
      // a short trail behind the shell on its way up
      emit(r.p.x, r.p.y, r.p.z, 0, -0.25, 0, r.c[0] * 0.55, r.c[1] * 0.4, r.c[2] * 0.25, 0.3);
      if (r.fuse <= 0) {
        burst(r.p, r.c);
        rockets.splice(i, 1);
      }
    }

    // sparks
    let live = false;
    for (let i = 0; i < POOL; i++) {
      if (life[i] <= 0) continue;
      live = true;
      life[i] -= dt;
      const k = Math.max(0, life[i] / span[i]);
      vel[i * 3 + 1] -= G * 0.42 * dt;
      const drag = 1 - 1.5 * dt;
      vel[i * 3] *= drag;
      vel[i * 3 + 2] *= drag;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      // Additive blending means fading to black is fading out, and it lets the
      // spark keep its hue all the way down instead of washing to white.
      const f = Math.pow(k, 1.3);
      col[i * 3] = tint[i * 3] * f;
      col[i * 3 + 1] = tint[i * 3 + 1] * f;
      col[i * 3 + 2] = tint[i * 3 + 2] * f;
      if (life[i] <= 0) {
        pos[i * 3 + 1] = -99;
        col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0;
      }
    }
    if (live) {
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    }

    if (flashFor > 0) {
      flashFor -= dt;
      flash.intensity *= Math.max(0, 1 - dt * 7);
      if (flashFor <= 0) flash.intensity = 0;
    }

    // the room
    if (boomT >= 0) {
      boomT += dt;
      shake = boomT < 1.1 ? (1 - boomT / 1.1) * 0.045 : 0;

      if (boomT < BOOM) {
        for (const d of debris) {
          // Lighter gravity than the sparks get: the arcs want to be readable,
          // not accurate.
          d.v.y -= 6.4 * dt;
          d.v.x *= 1 - 0.55 * dt;
          d.v.z *= 1 - 0.55 * dt;
          d.o.position.addScaledVector(d.v, dt);
          if (d.o.position.y < d.rest && d.v.y < 0) {
            d.o.position.y = d.rest;
            d.v.y *= -0.34;
            d.v.x *= 0.62;
            d.v.z *= 0.62;
            d.w.multiplyScalar(0.55);
          }
          axis.copy(d.w).normalize();
          spin.setFromAxisAngle(axis, d.w.length() * dt);
          d.o.quaternion.premultiply(spin);
        }
      } else if (boomT < BOOM + RETURN) {
        // Everything walks back to where it was, from wherever it came to rest.
        // That resting place has to be captured once, on the first frame of the
        // return — lerping towards home from the live position every frame is
        // an exponential ease that never quite arrives.
        if (!debris[0]?.from) for (const d of debris) d.from = { p: d.o.position.clone(), q: d.o.quaternion.clone() };
        const k = (boomT - BOOM) / RETURN;
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        for (const d of debris) {
          d.o.position.lerpVectors(d.from.p, d.home.p, e);
          d.o.quaternion.slerpQuaternions(d.from.q, d.home.q, e);
        }
      } else {
        for (const d of debris) {
          d.o.position.copy(d.home.p);
          d.o.quaternion.copy(d.home.q);
          d.from = null;
        }
        boomT = -1;
        shake = 0;
      }
    }
  }

  return {
    fireworks,
    blast,
    update,
    get shake() {
      return shake;
    },
  };
}
