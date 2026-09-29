// Animated wallpapers for the Horn.os desktop: a canvas behind the bar, the
// windows and the dock, redrawn at 30 fps. Each wallpaper keeps its own state
// (drifting nodes, waves, stars) and is painted in the colours of the current
// theme, blended smoothly when the room turns from day to night. When the
// visitor asks for reduced motion, a wallpaper is drawn once and holds still.

const FPS = 30;
const REDUCED = "(prefers-reduced-motion: reduce)";

const rng = (seed) => {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
};

// Colours are written as hex pairs [day, night] and mixed by k (0 day → 1 night).
const parsed = new Map();
const rgb = (hex) => {
  let c = parsed.get(hex);
  if (!c) parsed.set(hex, (c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))));
  return c;
};
function mix([day, night], k, alpha = 1) {
  const a = rgb(day);
  const b = rgb(night);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * k));
  return alpha >= 1 ? `rgb(${c})` : `rgba(${c},${alpha})`;
}

// 3D value noise with a quintic fade, for the contour field.
function hash3(x, y, z) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
function noise3(x, y, z) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const u = fade(x - xi);
  const v = fade(y - yi);
  const w = fade(z - zi);
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}

const sky = (ctx, w, h, top, bottom, k) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, mix(top, k));
  g.addColorStop(1, mix(bottom, k));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

/* ------------------------------------------------------------------ *
 *  The wallpapers. create(w, h, u) gets the canvas size in pixels and
 *  u, the pixels per CSS pixel, and returns draw(ctx, t, k, dt).
 * ------------------------------------------------------------------ */

// Aurora: soft colour fields drifting on slow Lissajous paths. Drawn on a
// canvas a quarter of the size and stretched, which blurs it for free.
const aurora = {
  id: "aurora",
  name: "Aurora",
  scale: 1 / 4,
  create(w, h) {
    const BASE = ["#eee7d8", "#0e1416"];
    const BLOBS = [
      ["#a6cdb6", "#1f6a55"],
      ["#f2bd95", "#3c2c63"],
      ["#c0e1cc", "#16775a"],
      ["#b6d0e6", "#1b3d66"],
      ["#efd996", "#5b2a4d"],
    ];
    const r = rng(3);
    const paths = BLOBS.map(() => ({ sx: 0.04 + r() * 0.07, sy: 0.03 + r() * 0.06, px: r() * 6.3, py: r() * 6.3, size: 0.5 + r() * 0.3 }));
    return (ctx, t, k) => {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = mix(BASE, k);
      ctx.fillRect(0, 0, w, h);
      paths.forEach((p, i) => {
        const x = w * (0.5 + 0.42 * Math.sin(t * p.sx + p.px));
        const y = h * (0.5 + 0.4 * Math.sin(t * p.sy + p.py));
        const rad = Math.max(w, h) * p.size * (0.9 + 0.1 * Math.sin(t * 0.13 + i));
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, mix(BLOBS[i], k, 0.9));
        g.addColorStop(1, mix(BLOBS[i], k, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      });
    };
  },
};

// Tides: layered hills of water rolling at different speeds under a sun that
// becomes the moon at night.
const tides = {
  id: "tides",
  name: "Tides",
  scale: 1 / 2,
  create(w, h, u) {
    const LAYERS = [
      ["#cfdfd4", "#1a2a36"],
      ["#b1cbbb", "#173640"],
      ["#8fb3a1", "#154449"],
      ["#6a9786", "#115250"],
      ["#487a69", "#0c6152"],
    ];
    const r = rng(11);
    const waves = LAYERS.map((_, i) => ({
      base: 0.5 + i * 0.1,
      a1: (10 + i * 5) * u,
      f1: (0.0035 + r() * 0.002) / u,
      s1: 0.12 + i * 0.07,
      a2: (4 + i * 2) * u,
      f2: (0.009 + r() * 0.004) / u,
      s2: 0.2 + i * 0.1,
      p: r() * 6.3,
    }));
    const stars = Array.from({ length: 70 }, () => ({ x: r() * w, y: r() * h * 0.5, s: (0.4 + r()) * u, p: r() * 6.3 }));
    return (ctx, t, k) => {
      sky(ctx, w, h, ["#f5eee0", "#0b111c"], ["#e9e1d3", "#1c2636"], k);
      for (const s of stars) {
        ctx.fillStyle = `rgba(235, 240, 255, ${k * (0.45 + 0.35 * Math.sin(t * 1.3 + s.p))})`;
        ctx.fillRect(s.x, s.y, s.s, s.s);
      }
      const cx = w * 0.72;
      const cy = h * 0.3;
      const R = Math.min(w, h) * 0.07;
      const glow = ctx.createRadialGradient(cx, cy, R * 0.8, cx, cy, R * 4.5);
      glow.addColorStop(0, mix(["#f8c98e", "#dfe4ea"], k, 0.45 - 0.2 * k));
      glow.addColorStop(1, mix(["#f8c98e", "#dfe4ea"], k, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = mix(["#f6b979", "#eeeadf"], k);
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      const step = 6 * u;
      waves.forEach((wv, i) => {
        ctx.fillStyle = mix(LAYERS[i], k);
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w + step; x += step) {
          const y = h * wv.base + wv.a1 * Math.sin(x * wv.f1 + t * wv.s1 + wv.p) + wv.a2 * Math.sin(x * wv.f2 - t * wv.s2 + wv.p * 2);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
      });
    };
  },
};

// Contours: a topographic map of a slowly shifting landscape, traced with
// marching squares; every fifth line is an index line, drawn heavier.
const contours = {
  id: "contours",
  name: "Contours",
  scale: 1,
  create(w, h, u) {
    const cell = 12 * u;
    const cols = Math.ceil(w / cell) + 1;
    const rows = Math.ceil(h / cell) + 1;
    const f = new Float32Array(cols * rows);
    const LEVELS = 15;
    const zoom = 1 / (260 * u);
    return (ctx, t, k) => {
      const bg = ctx.createRadialGradient(w * 0.3, h * 0.2, 0, w * 0.3, h * 0.2, Math.max(w, h));
      bg.addColorStop(0, mix(["#f4f0e7", "#161c1e"], k));
      bg.addColorStop(1, mix(["#e4e7de", "#0f1315"], k));
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      const z = t * 0.035;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const x = i * cell * zoom;
          const y = j * cell * zoom;
          f[j * cols + i] = noise3(x, y, z) * 0.65 + noise3(x * 2.1 + 5, y * 2.1 + 3, z * 1.6) * 0.35;
        }
      }
      const thin = new Path2D();
      const bold = new Path2D();
      for (let l = 1; l < LEVELS; l++) {
        const L = 0.18 + (l / LEVELS) * 0.64;
        const p = l % 5 === 0 ? bold : thin;
        for (let j = 0; j < rows - 1; j++) {
          for (let i = 0; i < cols - 1; i++) {
            const a = f[j * cols + i];
            const b = f[j * cols + i + 1];
            const c = f[(j + 1) * cols + i + 1];
            const d = f[(j + 1) * cols + i];
            const code = (a > L) | ((b > L) << 1) | ((c > L) << 2) | ((d > L) << 3);
            if (code === 0 || code === 15) continue;
            const x0 = i * cell;
            const y0 = j * cell;
            const e = [
              [x0 + ((L - a) / (b - a)) * cell, y0],
              [x0 + cell, y0 + ((L - b) / (c - b)) * cell],
              [x0 + ((L - d) / (c - d)) * cell, y0 + cell],
              [x0, y0 + ((L - a) / (d - a)) * cell],
            ];
            const seg = (m, n) => {
              p.moveTo(e[m][0], e[m][1]);
              p.lineTo(e[n][0], e[n][1]);
            };
            switch (code) {
              case 1: case 14: seg(3, 0); break;
              case 2: case 13: seg(0, 1); break;
              case 3: case 12: seg(3, 1); break;
              case 4: case 11: seg(1, 2); break;
              case 6: case 9: seg(0, 2); break;
              case 7: case 8: seg(3, 2); break;
              case 5: seg(3, 0); seg(1, 2); break;
              case 10: seg(0, 1); seg(2, 3); break;
            }
          }
        }
      }
      ctx.lineCap = "round";
      ctx.strokeStyle = mix(["#2f6f5e", "#7cc3aa"], k, 0.28);
      ctx.lineWidth = 1 * u;
      ctx.stroke(thin);
      ctx.strokeStyle = mix(["#2f6f5e", "#7cc3aa"], k, 0.5);
      ctx.lineWidth = 1.8 * u;
      ctx.stroke(bold);
    };
  },
};

// Constellation: drifting nodes linked to their neighbours, with signals
// running along the links, like agents passing messages.
const constellation = {
  id: "constellation",
  name: "Constellation",
  scale: 1,
  create(w, h, u) {
    const r = rng(7);
    const n = Math.round(Math.min(90, Math.max(16, (w * h) / (u * u) / 15000)));
    const D = 150 * u;
    const nodes = Array.from({ length: n }, () => {
      const a = r() * Math.PI * 2;
      const v = (5 + r() * 9) * u;
      return { x: r() * w, y: r() * h, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: (1.4 + r() * 1.8) * u };
    });
    const pulses = [];
    let nextPulse = 0;
    const edges = [];
    return (ctx, t, k, dt) => {
      const bg = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, Math.max(w, h) * 0.75);
      bg.addColorStop(0, mix(["#f3f4ee", "#141a1d"], k));
      bg.addColorStop(1, mix(["#e0e8e1", "#0c1012"], k));
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      for (const p of nodes) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < -20 * u) p.x += w + 40 * u;
        if (p.x > w + 20 * u) p.x -= w + 40 * u;
        if (p.y < -20 * u) p.y += h + 40 * u;
        if (p.y > h + 20 * u) p.y -= h + 40 * u;
      }
      edges.length = 0;
      ctx.lineWidth = 1 * u;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const d = Math.hypot(dx, dy);
          if (d > D) continue;
          edges.push(i, j);
          ctx.strokeStyle = mix(["#2f6f5e", "#7cc3aa"], k, (1 - d / D) * 0.38);
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
      ctx.fillStyle = mix(["#2f6f5e", "#9ad6c0"], k, 0.8);
      for (const p of nodes) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
        ctx.fill();
      }
      if (dt > 0 && t > nextPulse && edges.length) {
        const e = Math.floor(r() * (edges.length / 2)) * 2;
        pulses.push(r() < 0.5 ? { a: edges[e], b: edges[e + 1], p: 0 } : { a: edges[e + 1], b: edges[e], p: 0 });
        nextPulse = t + 0.25 + r() * 0.5;
      }
      for (let i = pulses.length - 1; i >= 0; i--) {
        const q = pulses[i];
        q.p += dt / 1.3;
        if (q.p >= 1) {
          pulses.splice(i, 1);
          continue;
        }
        const A = nodes[q.a];
        const B = nodes[q.b];
        const x = A.x + (B.x - A.x) * q.p;
        const y = A.y + (B.y - A.y) * q.p;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 9 * u);
        g.addColorStop(0, mix(["#e0873a", "#ffd08a"], k, 0.9));
        g.addColorStop(1, mix(["#e0873a", "#ffd08a"], k, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x - 9 * u, y - 9 * u, 18 * u, 18 * u);
      }
    };
  },
};

// Nebula: deep space with drifting coloured clouds, three layers of stars
// and now and then a shooting star. Space stays dark by day as well.
const nebula = {
  id: "nebula",
  name: "Nebula",
  scale: 1 / 2,
  create(w, h, u) {
    const r = rng(19);
    const S = Math.ceil(Math.hypot(w, h) * 1.1);
    const clouds = document.createElement("canvas");
    clouds.width = clouds.height = S;
    const c = clouds.getContext("2d");
    c.globalCompositeOperation = "lighter";
    const COLS = ["107, 63, 160", "47, 127, 143", "176, 69, 122", "58, 79, 176", "122, 47, 111"];
    for (let i = 0; i < 18; i++) {
      const x = S * (0.2 + r() * 0.6);
      const y = S * (0.2 + r() * 0.6);
      const rad = S * (0.12 + r() * 0.22);
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      const col = COLS[Math.floor(r() * COLS.length)];
      g.addColorStop(0, `rgba(${col}, ${0.22 + r() * 0.25})`);
      g.addColorStop(1, `rgba(${col}, 0)`);
      c.fillStyle = g;
      c.fillRect(0, 0, S, S);
    }
    const layers = [
      { n: 140, s: 0.7, v: 2 },
      { n: 60, s: 1.1, v: 5 },
      { n: 22, s: 1.7, v: 10 },
    ].map((L) => ({ ...L, stars: Array.from({ length: L.n }, () => ({ x: r() * w, y: r() * h, p: r() * 6.3, f: 0.6 + r() * 1.8 })) }));
    let shoot = null;
    let nextShoot = 3;
    return (ctx, t, k, dt) => {
      ctx.fillStyle = "#05060d";
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.globalAlpha = 0.95 + 0.05 * (1 - k);
      ctx.translate(w / 2 + Math.sin(t * 0.02) * 20 * u, h / 2 + Math.cos(t * 0.017) * 14 * u);
      ctx.rotate(t * 0.006);
      ctx.drawImage(clouds, -S / 2, -S / 2);
      ctx.restore();
      for (const L of layers) {
        const size = L.s * u;
        for (const s of L.stars) {
          s.x -= L.v * u * dt;
          if (s.x < 0) s.x += w;
          ctx.fillStyle = `rgba(230, 236, 255, ${0.5 + 0.45 * Math.sin(t * s.f + s.p)})`;
          ctx.fillRect(s.x, s.y, size, size);
        }
      }
      if (dt > 0 && !shoot && t > nextShoot) shoot = { x: r() * w * 0.8 + w * 0.2, y: r() * h * 0.4, p: 0 };
      if (shoot) {
        shoot.p += dt / 0.9;
        const len = 120 * u;
        const x = shoot.x - shoot.p * 260 * u;
        const y = shoot.y + shoot.p * 130 * u;
        const g = ctx.createLinearGradient(x, y, x + len, y - len / 2);
        g.addColorStop(0, `rgba(255, 255, 255, ${0.9 * (1 - shoot.p)})`);
        g.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.4 * u;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + len, y - len / 2);
        ctx.stroke();
        if (shoot.p >= 1) {
          shoot = null;
          nextShoot = t + 6 + r() * 6;
        }
      }
    };
  },
};

// Bokeh: out-of-focus lights rising slowly, like a city seen through a lens.
const bokeh = {
  id: "bokeh",
  name: "Bokeh",
  scale: 1 / 2,
  create(w, h, u) {
    const COLS = [
      ["#f2b98f", "#f0b24a"],
      ["#a9cdb9", "#e8903a"],
      ["#f3dc9b", "#7cc3aa"],
      ["#bcd3e3", "#f6d58a"],
      ["#e9b8b8", "#d86a4a"],
    ];
    const r = rng(29);
    // as many lights as fit the area, so a thumbnail is not a white-out
    const n = Math.round(Math.min(34, Math.max(7, (w * h) / (u * u) / 30000)));
    const fit = Math.min(1, (w / u / 1280) * 1.6); // smaller discs on a thumbnail
    const lights = Array.from({ length: n }, () => ({
      x: r() * w,
      y: r() * h,
      rad: (18 + r() * 70) * u * fit,
      vy: (4 + r() * 9) * u * fit,
      sway: (6 + r() * 16) * u * fit,
      p: r() * 6.3,
      c: Math.floor(r() * COLS.length),
      a: 0.22 + r() * 0.25,
    }));
    return (ctx, t, k, dt) => {
      ctx.globalCompositeOperation = "source-over";
      sky(ctx, w, h, ["#f4ede2", "#0f1422"], ["#e5dccf", "#1d1a2b"], k);
      ctx.globalCompositeOperation = k > 0.5 ? "lighter" : "source-over";
      for (const b of lights) {
        b.y -= b.vy * dt;
        if (b.y < -b.rad) {
          b.y = h + b.rad;
          b.x = r() * w;
        }
        const x = b.x + Math.sin(t * 0.3 + b.p) * b.sway;
        const g = ctx.createRadialGradient(x, b.y, 0, x, b.y, b.rad);
        const a = b.a * (0.8 + 0.2 * Math.sin(t * 0.7 + b.p));
        g.addColorStop(0, mix(COLS[b.c], k, a * 0.75));
        g.addColorStop(0.82, mix(COLS[b.c], k, a));
        g.addColorStop(0.94, mix(COLS[b.c], k, a * 0.55));
        g.addColorStop(1, mix(COLS[b.c], k, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, b.y, b.rad, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    };
  },
};

// Still: the original calm gradient, for visitors who prefer no motion.
const still = {
  id: "still",
  name: "Still",
  scale: 1 / 2,
  still: true,
  create(w, h) {
    return (ctx, t, k) => {
      const g = ctx.createRadialGradient(w * 0.2, h * 0.1, 0, w * 0.2, h * 0.1, Math.max(w, h) * 1.1);
      g.addColorStop(0, mix(["#f4efe4", "#23302b"], k));
      g.addColorStop(0.55, mix(["#e3eadf", "#181c1e"], k));
      g.addColorStop(1, mix(["#cfdcd2", "#111315"], k));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    };
  },
};

export const WALLPAPERS = [aurora, tides, contours, constellation, nebula, bokeh, still];
export const DEFAULT_WALLPAPER = "aurora";
const byId = (id) => WALLPAPERS.find((wp) => wp.id === id) ?? WALLPAPERS[0];

/**
 * Runs a wallpaper on a canvas, sized to the canvas's CSS box. Returns
 * { id, set(id), setTheme(theme), pause(), resume(), dispose() }.
 */
export function createWallpaper(canvas, { id = DEFAULT_WALLPAPER, theme = "light", thumb = false } = {}) {
  const ctx = canvas.getContext("2d");
  const reduced = matchMedia(REDUCED).matches;
  let wp = byId(id);
  let draw = null;
  let target = theme === "dark" ? 1 : 0;
  let k = target;
  let dirty = true;
  let last = 0;
  let raf = 0;
  const t0 = performance.now();

  function fit() {
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (!cw || !ch) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, thumb ? 2 : 1.5);
    const u = wp.scale === 1 ? dpr : wp.scale * (thumb ? dpr : 1);
    const w = Math.max(1, Math.round(cw * u));
    const h = Math.max(1, Math.round(ch * u));
    if (!draw || w !== canvas.width || h !== canvas.height) {
      canvas.width = w;
      canvas.height = h;
      draw = wp.create(w, h, u);
      dirty = true;
    }
    return true;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (now - last < 1000 / FPS - 2) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    const before = k;
    k += (target - k) * Math.min(1, dt * 2.5);
    if (Math.abs(target - k) < 0.003) k = target;
    if (!fit()) return;
    const hold = reduced || wp.still;
    if (hold && !dirty && k === before) return;
    draw(ctx, hold ? 12 : (now - t0) / 1000, k, hold ? 0 : dt);
    dirty = false;
  }
  raf = requestAnimationFrame(frame);

  return {
    get id() {
      return wp.id;
    },
    set(next) {
      if (next === wp.id) return;
      // fade the old picture out over the new one
      if (!thumb && canvas.width > 1 && canvas.isConnected) {
        const ghost = document.createElement("canvas");
        ghost.className = `${canvas.className} is-ghost`;
        ghost.setAttribute("aria-hidden", "true");
        ghost.width = canvas.width;
        ghost.height = canvas.height;
        ghost.getContext("2d").drawImage(canvas, 0, 0);
        canvas.after(ghost);
        ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduced ? 1 : 700, easing: "ease-out" }).onfinish = () => ghost.remove();
      }
      wp = byId(next);
      draw = null;
      dirty = true;
      last = 0;
    },
    setTheme(t) {
      target = t === "dark" ? 1 : 0;
    },
    pause() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
    resume() {
      if (raf) return;
      last = 0;
      dirty = true;
      raf = requestAnimationFrame(frame);
    },
    dispose() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
