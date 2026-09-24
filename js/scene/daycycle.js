// Day → sunset → night. Each phase is a set of light values and a painted sky;
// a transition interpolates every value from one phase to the next, so the sun
// is seen going down rather than the room cutting to a new state.

import * as THREE from "three";

export const PHASES = ["day", "sunset", "night"];

// Local time → phase. The same hours Horn.os uses for its dark theme.
export function phaseFor(date) {
  const h = date.getHours();
  if (h >= 7 && h < 18) return "day";
  if (h >= 18 && h < 21) return "sunset";
  return "night";
}

const C = (hex) => new THREE.Color(hex);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Light values per phase. `sun` doubles as the moon at night: cool, faint,
// still shadowed, so the window frame still lands on the floor.
export const PRESETS = {
  day: {
    sunColor: C(0xfff0d8), sunI: 4.2, sunPos: V(-7.8, 4.6, 1.4),
    hemiSky: C(0xdfe9f5), hemiGround: C(0xb89c7c), hemiI: 0.5,
    env: 0.32, skyLightColor: C(0xe4eefc), skyLightI: 3.2,
    lampI: 0, glowI: 0.35, fillI: 0, dust: 0.55, exposure: 1.0,
    bulb: 0,
  },
  sunset: {
    sunColor: C(0xff8a4c), sunI: 3.6, sunPos: V(-8.0, 1.5, 3.0),
    hemiSky: C(0xf2b894), hemiGround: C(0x6a4a3a), hemiI: 0.32,
    env: 0.18, skyLightColor: C(0xffb07e), skyLightI: 1.8,
    lampI: 1.1, glowI: 0.7, fillI: 0.25, dust: 0.7, exposure: 1.0,
    bulb: 1,
  },
  night: {
    sunColor: C(0x8fa6e8), sunI: 0.45, sunPos: V(-7.0, 5.5, -1.5),
    hemiSky: C(0x2a3550), hemiGround: C(0x16110d), hemiI: 0.12,
    env: 0.05, skyLightColor: C(0x5b6fa8), skyLightI: 0.35,
    lampI: 1.8, glowI: 0.6, fillI: 0.8, dust: 0, exposure: 1.15,
    bulb: 1,
  },
};

export function mixPreset(a, b, w) {
  const out = {};
  for (const k of Object.keys(a)) {
    const va = a[k];
    const vb = b[k];
    if (va instanceof THREE.Color) out[k] = va.clone().lerp(vb, w);
    else if (va instanceof THREE.Vector3) out[k] = va.clone().lerp(vb, w);
    else out[k] = va + (vb - va) * w;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 *  Painted skies
 * ------------------------------------------------------------------ */
function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
}

function paint(draw) {
  const c = document.createElement("canvas");
  c.width = 2048;
  c.height = 1024;
  draw(c.getContext("2d"), c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The same skyline in every phase (same seed), lit differently.
function landscape(g, w, h, { bld, bldLit = 0, trees, ground, haze }) {
  const r = seeded(4);
  for (let i = 0; i < 26; i++) {
    const bw = 50 + r() * 120;
    const bh = 60 + r() * 200;
    const x = r() * w;
    const y = h * 0.72 - bh;
    g.fillStyle = bld(r());
    g.fillRect(x, y, bw, bh);
    if (bldLit) {
      for (let wy = y + 10; wy < h * 0.72 - 8; wy += 14) {
        for (let wx = x + 6; wx < x + bw - 6; wx += 11) {
          if (r() < bldLit) {
            g.fillStyle = `rgba(255, ${200 + r() * 40}, ${120 + r() * 60}, ${0.6 + r() * 0.4})`;
            g.fillRect(wx, wy, 5, 7);
          }
        }
      }
    }
  }
  for (let i = 0; i < 1400; i++) {
    const x = r() * w;
    const y = h * (0.7 + r() * 0.1);
    const s = 10 + r() * 26;
    g.fillStyle = trees(r());
    g.beginPath();
    g.arc(x, y, s, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = ground;
  g.fillRect(0, h * 0.78, w, h * 0.22);
  if (haze) {
    const hz = g.createLinearGradient(0, h * 0.5, 0, h * 0.8);
    hz.addColorStop(0, "rgba(0,0,0,0)");
    hz.addColorStop(1, haze);
    g.fillStyle = hz;
    g.fillRect(0, h * 0.5, w, h * 0.3);
  }
}

function clouds(g, w, h, colour, seed = 5) {
  const r = seeded(seed);
  for (let c = 0; c < 9; c++) {
    const cx = r() * w;
    const cy = h * (0.08 + r() * 0.3);
    for (let i = 0; i < 14; i++) {
      g.fillStyle = colour(r());
      g.beginPath();
      g.ellipse(cx + (r() - 0.5) * 260, cy + (r() - 0.5) * 40, 60 + r() * 90, 18 + r() * 26, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
}

const GREENS = [
  [96, 138, 84],
  [78, 120, 70],
  [118, 156, 96],
  [66, 104, 64],
];

export function skyTextures() {
  const day = paint((g, w, h) => {
    const s = g.createLinearGradient(0, 0, 0, h * 0.72);
    s.addColorStop(0, "#6fa6dc");
    s.addColorStop(0.55, "#a9cbe8");
    s.addColorStop(1, "#e8eef0");
    g.fillStyle = s;
    g.fillRect(0, 0, w, h);
    clouds(g, w, h, (v) => `rgba(255,255,255,${0.1 + v * 0.12})`);
    landscape(g, w, h, {
      bld: (v) => `rgba(${176 + v * 20},${188 + v * 16},${200 + v * 12},0.9)`,
      trees: (v) => {
        const c = GREENS[Math.floor(v * 4)];
        return `rgb(${c[0]},${c[1]},${c[2]})`;
      },
      ground: "#5c8452",
    });
  });
  const sunset = paint((g, w, h) => {
    const s = g.createLinearGradient(0, 0, 0, h * 0.74);
    s.addColorStop(0, "#35427a");
    s.addColorStop(0.35, "#b0628a");
    s.addColorStop(0.7, "#f39a5e");
    s.addColorStop(1, "#ffd08a");
    g.fillStyle = s;
    g.fillRect(0, 0, w, h);
    // the sun itself, low on the horizon
    const sun = g.createRadialGradient(w * 0.62, h * 0.66, 0, w * 0.62, h * 0.66, 260);
    sun.addColorStop(0, "rgba(255,240,200,1)");
    sun.addColorStop(0.12, "rgba(255,210,140,0.9)");
    sun.addColorStop(1, "rgba(255,150,80,0)");
    g.fillStyle = sun;
    g.fillRect(0, 0, w, h);
    clouds(g, w, h, (v) => `rgba(255,${150 + v * 50},${130 + v * 40},${0.12 + v * 0.14})`);
    landscape(g, w, h, {
      bld: (v) => `rgba(${120 + v * 20},${80 + v * 16},${100 + v * 12},0.95)`,
      bldLit: 0.12,
      trees: (v) => `rgb(${50 + v * 20},${48 + v * 16},${52 + v * 14})`,
      ground: "#2f2a2e",
    });
  });
  const night = paint((g, w, h) => {
    const s = g.createLinearGradient(0, 0, 0, h * 0.74);
    s.addColorStop(0, "#070b1c");
    s.addColorStop(0.7, "#17234a");
    s.addColorStop(1, "#2c3a66");
    g.fillStyle = s;
    g.fillRect(0, 0, w, h);
    const r = seeded(17);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`;
      const sz = r() < 0.05 ? 2.5 : 1.3;
      g.fillRect(r() * w, r() * h * 0.6, sz, sz);
    }
    const moon = g.createRadialGradient(w * 0.3, h * 0.2, 0, w * 0.3, h * 0.2, 120);
    moon.addColorStop(0, "rgba(245,245,255,1)");
    moon.addColorStop(0.3, "rgba(230,235,255,0.95)");
    moon.addColorStop(0.34, "rgba(200,210,255,0.25)");
    moon.addColorStop(1, "rgba(200,210,255,0)");
    g.fillStyle = moon;
    g.fillRect(0, 0, w, h);
    landscape(g, w, h, {
      bld: (v) => `rgba(${22 + v * 10},${26 + v * 10},${44 + v * 12},1)`,
      bldLit: 0.28,
      trees: (v) => `rgb(${10 + v * 8},${16 + v * 8},${20 + v * 8})`,
      ground: "#0b0f14",
    });
  });
  return { day, sunset, night };
}
