// Procedural textures drawn on canvases — no image assets to license or download.
// Used for the battle map, the DM screen and the agent terminals; room surfaces use photo scans.
import * as THREE from "three";

// Small deterministic PRNG so the scene looks the same on every load.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvas(w, h = w) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d", { willReadFrequently: true })];
}

function toTexture(c, { repeat = [1, 1], srgb = false } = {}) {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Derived maps carry surface detail, not colour detail, so they are computed at a
// reduced size: a full Sobel pass over 1024 squared would stall the first frame.
const DERIVED = 512;

function downscale(src, size = DERIVED) {
  const [c, ctx] = canvas(size);
  ctx.drawImage(src, 0, 0, size, size);
  return [c, ctx];
}

/** Sobel the luminance of a canvas into a tangent-space normal map. */
function normalFrom(src, strength = 2.2) {
  const [small] = downscale(src);
  const size = small.width;
  const data = small.getContext("2d").getImageData(0, 0, size, size).data;
  const lum = new Float32Array(size * size);
  for (let i = 0, p = 0; i < lum.length; i++, p += 4) {
    lum[i] = (data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114) / 255;
  }
  const at = (x, y) => lum[((y + size) % size) * size + ((x + size) % size)];

  const [out, octx] = canvas(size);
  const img = octx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx =
        at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1) -
        (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1));
      const dy =
        at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1) -
        (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1));
      const nx = dx * strength;
      const ny = dy * strength;
      const len = Math.hypot(nx, ny, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len) * 127.5 + 127.5;
      img.data[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

/** Remap luminance into a roughness range: darker grain reads as rougher. */
function roughnessFrom(src, min = 0.35, max = 0.8) {
  const [small, sctx] = downscale(src);
  const size = small.width;
  const img = sctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let p = 0; p < d.length; p += 4) {
    const l = (d[p] * 0.299 + d[p + 1] * 0.587 + d[p + 2] * 0.114) / 255;
    const r = (max - (max - min) * l) * 255;
    d[p] = d[p + 1] = d[p + 2] = r;
  }
  sctx.putImageData(img, 0, 0);
  return small;
}

function speckle(ctx, size, count, rand, alphaMax, light) {
  for (let i = 0; i < count; i++) {
    const a = rand() * alphaMax;
    ctx.fillStyle = light ? "rgba(255,240,220," + a + ")" : "rgba(0,0,0," + a + ")";
    ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 2, 1 + rand() * 2);
  }
}

/** Fine grain for moulded plastic — the CRT shell and keyboard. */
export function plasticGrain({ size = 256, seed = 5, repeat = [3, 3] } = {}) {
  const rand = rng(seed);
  const [c, ctx] = canvas(size);
  ctx.fillStyle = "#9a9a9a";
  ctx.fillRect(0, 0, size, size);
  speckle(ctx, size, 9000, rand, 0.35, false);
  speckle(ctx, size, 9000, rand, 0.35, true);
  return {
    normalMap: toTexture(normalFrom(c, 0.9), { repeat }),
    roughnessMap: toTexture(roughnessFrom(c, 0.45, 0.72), { repeat }),
  };
}

/** Aged parchment, used for the DM screen panels. */
export function parchment({ size = 512, seed = 21 } = {}) {
  const rand = rng(seed);
  const [c, ctx] = canvas(size);
  ctx.fillStyle = "#d9c7a0";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 260; i++) {
    const x = rand() * size, y = rand() * size, r = 18 + rand() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rand() > 0.45 ? "rgba(120,86,40,0.05)" : "rgba(255,246,222,0.10)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  speckle(ctx, size, 4000, rand, 0.07, false);
  return {
    map: toTexture(c, { srgb: true }),
    normalMap: toTexture(normalFrom(c, 0.7)),
    roughnessMap: toTexture(roughnessFrom(c, 0.7, 0.95)),
  };
}

/* ------------------------------------------------------------------ *
 *  The board
 *
 *  One plan, two consumers. MAP_PLAN describes the region in normalised
 *  coordinates; the drawing below turns it into the printed map, and
 *  js/board.js stands the terrain pieces on the same coordinates. That
 *  is the whole trick: the trees are in the forest and the bridge is on
 *  the river because both read the same numbers, not because the two
 *  were nudged into agreement by hand.
 * ------------------------------------------------------------------ */

export const MAP_PLAN = {
  // The coastline runs from the top-left edge down to the bottom; the sea is
  // everything to the left of it.
  coast: [
    [-0.03, 0.16], [0.06, 0.28], [0.03, 0.4], [0.13, 0.5], [0.11, 0.62],
    [0.21, 0.72], [0.19, 0.84], [0.3, 0.93], [0.28, 1.03],
  ],
  mountains: [
    [0.6, 0.12], [0.68, 0.09], [0.75, 0.14], [0.82, 0.11], [0.88, 0.17], [0.94, 0.14],
    [0.71, 0.2], [0.79, 0.23], [0.87, 0.26],
  ],
  hills: [[0.5, 0.26], [0.57, 0.31], [0.44, 0.34], [0.9, 0.42], [0.84, 0.36]],
  forests: [
    { at: [0.3, 0.29], r: 0.115 },
    { at: [0.72, 0.71], r: 0.135 },
    { at: [0.52, 0.85], r: 0.085 },
  ],
  lake: { at: [0.54, 0.48], r: [0.072, 0.05] },
  river: [[0.74, 0.24], [0.63, 0.38], [0.54, 0.48], [0.455, 0.615], [0.34, 0.77], [0.24, 0.88]],
  roads: [
    [[0.26, 0.18], [0.3, 0.34], [0.33, 0.52], [0.38, 0.7]],
    [[0.38, 0.7], [0.455, 0.615], [0.56, 0.52], [0.645, 0.36]],
  ],
  bridge: [0.455, 0.615],
  towns: [
    { at: [0.385, 0.705], name: "Ravensmoor", kind: "town" },
    { at: [0.645, 0.35], name: "Highmark", kind: "keep" },
    { at: [0.26, 0.17], name: "Tallow", kind: "village" },
  ],
  ruin: [0.55, 0.19],
  stones: [0.85, 0.55],
  marsh: [0.82, 0.9],
  // where the party stands, and what is waiting for them
  party: [[0.345, 0.55], [0.315, 0.6], [0.365, 0.63], [0.3, 0.5]],
  foes: [[0.52, 0.23], [0.58, 0.26], [0.49, 0.28]],
};

const INK_MAP = "#4a3520";
const SEA = "#9fb3bd";

/** Jitter a polyline so nothing on the map looks ruled with a straight edge. */
function inkPath(ctx, pts, w, h, rand, amp = 3) {
  ctx.beginPath();
  pts.forEach(([u, v], i) => {
    const x = u * w + (rand() - 0.5) * amp;
    const y = v * h + (rand() - 0.5) * amp;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
}

/** One hand-drawn mountain: a chevron with hatching down its shaded side. */
function drawMountain(ctx, x, y, s) {
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = INK_MAP;
  ctx.beginPath();
  ctx.moveTo(x - s, y);
  ctx.lineTo(x - s * 0.25, y - s * 1.15);
  ctx.lineTo(x + s * 0.1, y - s * 0.7);
  ctx.lineTo(x + s * 0.45, y - s * 1.3);
  ctx.lineTo(x + s * 1.1, y);
  ctx.stroke();
  ctx.lineWidth = 1.1;
  for (let i = 1; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(x + s * (0.45 + i * 0.1), y - s * (1.3 - i * 0.2));
    ctx.lineTo(x + s * (0.55 + i * 0.12), y);
    ctx.stroke();
  }
}

function drawTreeGlyph(ctx, x, y, s) {
  ctx.strokeStyle = INK_MAP;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - s * 0.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - s * 0.5, y - s * 0.35);
  ctx.lineTo(x, y - s * 1.35);
  ctx.lineTo(x + s * 0.5, y - s * 0.35);
  ctx.closePath();
  ctx.stroke();
}

function drawCompass(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = INK_MAP;
  ctx.fillStyle = INK_MAP;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.76, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.1);
    ctx.lineTo(r * 0.17, 0);
    ctx.lineTo(0, r * 0.17);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.1);
    ctx.lineTo(-r * 0.17, 0);
    ctx.lineTo(0, r * 0.17);
    ctx.closePath();
    ctx.stroke();
  }
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.72);
    ctx.lineTo(r * 0.1, 0);
    ctx.lineTo(0, r * 0.1);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = INK_MAP;
  ctx.font = "bold 22px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText("N", x, y - r * 1.25);
}

/**
 * The printed map: a region drawn in ink on parchment, in the idiom of the
 * fold-out map at the front of a fantasy novel. Everything is placed from
 * MAP_PLAN, which the 3D terrain reads too.
 */
export function fantasyMap({ w = 1024, h = 731, seed = 33 } = {}) {
  const rand = rng(seed);
  const [c, ctx] = canvas(w, h);
  const X = (u) => u * w;
  const Y = (v) => v * h;

  // ---- parchment ground ----
  ctx.fillStyle = "#d9c69b";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 320; i++) {
    const x = rand() * w, y = rand() * h, r = 24 + rand() * 130;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rand() > 0.42 ? "rgba(120,84,36,0.055)" : "rgba(255,246,216,0.09)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // ---- sea ----
  ctx.save();
  ctx.beginPath();
  MAP_PLAN.coast.forEach(([u, v], i) => (i ? ctx.lineTo(X(u), Y(v)) : ctx.moveTo(X(u), Y(v))));
  ctx.lineTo(X(-0.05), Y(1.05));
  ctx.closePath();
  ctx.fillStyle = "rgba(120,150,165,0.28)";
  ctx.fill();
  ctx.clip();
  // the swell: long horizontal strokes, the way an engraver would fill water
  ctx.strokeStyle = "rgba(60,90,105,0.32)";
  ctx.lineWidth = 1.2;
  for (let y = 0; y < h; y += 13) {
    ctx.beginPath();
    for (let x = -10; x < w * 0.5; x += 8) {
      const yy = y + Math.sin(x * 0.05 + y * 0.1) * 2.2;
      x === -10 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.restore();

  // the coast itself, then three fading echoes of it out to sea
  for (let k = 0; k < 4; k++) {
    ctx.strokeStyle = k === 0 ? INK_MAP : `rgba(74,53,32,${0.3 - k * 0.07})`;
    ctx.lineWidth = k === 0 ? 3 : 1.3;
    inkPath(ctx, MAP_PLAN.coast.map(([u, v]) => [u - k * 0.016, v + k * 0.006]), w, h, rand, k ? 4 : 2.5);
    ctx.stroke();
  }

  // ---- a faint league grid, so it still reads as something you play on ----
  ctx.strokeStyle = "rgba(74,53,32,0.11)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 16; i++) {
    ctx.beginPath(); ctx.moveTo((i * w) / 16, 0); ctx.lineTo((i * w) / 16, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, (i * h) / 11); ctx.lineTo(w, (i * h) / 11); ctx.stroke();
  }

  // ---- lake and river ----
  const { lake } = MAP_PLAN;
  ctx.beginPath();
  ctx.ellipse(X(lake.at[0]), Y(lake.at[1]), X(lake.r[0]), Y(lake.r[1]), 0.3, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(120,150,165,0.32)";
  ctx.fill();
  ctx.strokeStyle = INK_MAP;
  ctx.lineWidth = 2.4;
  ctx.stroke();

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(80,110,125,0.85)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  MAP_PLAN.river.forEach(([u, v], i) => (i ? ctx.lineTo(X(u), Y(v)) : ctx.moveTo(X(u), Y(v))));
  ctx.stroke();
  ctx.strokeStyle = INK_MAP;
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // ---- mountains, tallest first so the near ones overlap the far ones ----
  for (const [u, v] of MAP_PLAN.mountains) drawMountain(ctx, X(u), Y(v), 26 + rand() * 12);
  for (const [u, v] of MAP_PLAN.hills) {
    ctx.strokeStyle = INK_MAP;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(X(u) - 20, Y(v));
    ctx.quadraticCurveTo(X(u), Y(v) - 22, X(u) + 20, Y(v));
    ctx.stroke();
  }

  // ---- forests ----
  for (const f of MAP_PLAN.forests) {
    const n = Math.round(f.r * 260);
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * f.r;
      drawTreeGlyph(ctx, X(f.at[0] + Math.cos(a) * d), Y(f.at[1] + Math.sin(a) * d * 1.25), 11 + rand() * 6);
    }
  }

  // ---- marsh ----
  for (let i = 0; i < 40; i++) {
    const x = X(MAP_PLAN.marsh[0]) + (rand() - 0.5) * 130;
    const y = Y(MAP_PLAN.marsh[1]) + (rand() - 0.5) * 80;
    ctx.strokeStyle = "rgba(74,53,32,0.5)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 12 + rand() * 10, y);
    ctx.stroke();
  }

  // ---- roads ----
  ctx.setLineDash([9, 7]);
  ctx.strokeStyle = "rgba(74,53,32,0.8)";
  ctx.lineWidth = 2.2;
  for (const road of MAP_PLAN.roads) {
    ctx.beginPath();
    road.forEach(([u, v], i) => (i ? ctx.lineTo(X(u), Y(v)) : ctx.moveTo(X(u), Y(v))));
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // ---- ruin and standing stones ----
  const [ru, rv] = MAP_PLAN.ruin;
  ctx.strokeStyle = INK_MAP;
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.strokeRect(X(ru) - 18 + i * 11, Y(rv) - 8 - (i % 2) * 7, 8, 14 + (i % 2) * 7);
  }
  const [su, sv] = MAP_PLAN.stones;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(X(su) + Math.cos(a) * 18, Y(sv) + Math.sin(a) * 14, 3.4, 0, Math.PI * 2);
    ctx.fillStyle = INK_MAP;
    ctx.fill();
  }

  // ---- settlements ----
  ctx.textAlign = "left";
  for (const t of MAP_PLAN.towns) {
    const x = X(t.at[0]);
    const y = Y(t.at[1]);
    ctx.strokeStyle = INK_MAP;
    ctx.fillStyle = INK_MAP;
    ctx.lineWidth = 2.2;
    if (t.kind === "town") {
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 13, y + Math.sin(a) * 13);
        ctx.lineTo(x + Math.cos(a) * 17, y + Math.sin(a) * 17);
        ctx.stroke();
      }
    } else if (t.kind === "keep") {
      ctx.strokeRect(x - 10, y - 12, 20, 22);
      ctx.fillRect(x - 12, y - 18, 5, 8);
      ctx.fillRect(x + 7, y - 18, 5, 8);
      ctx.fillRect(x - 3, y - 20, 6, 10);
    } else {
      for (let i = 0; i < 3; i++) ctx.strokeRect(x - 14 + i * 11, y - 6 + (i % 2) * 5, 8, 8);
    }
    ctx.font = "italic 21px Georgia, 'Times New Roman', serif";
    ctx.fillText(t.name, x + 22, y + 6);
  }

  // ---- sea dressing ----
  drawCompass(ctx, X(0.1), Y(0.82), 30);
  ctx.save();
  ctx.translate(X(0.07), Y(0.46));
  ctx.strokeStyle = "rgba(50,80,95,0.75)";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-34, 0);
  for (let i = 0; i <= 8; i++) ctx.lineTo(-34 + i * 9, Math.sin(i * 1.1) * 9);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-38, -3, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "rgba(50,80,95,0.8)";
  ctx.font = "italic 19px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText("Here be scope creep", X(0.11), Y(0.63));

  // ---- cartouche ----
  ctx.save();
  ctx.translate(X(0.82), Y(0.06));
  ctx.rotate(-0.02);
  ctx.fillStyle = "rgba(255,248,226,0.4)";
  ctx.fillRect(-140, -26, 280, 54);
  ctx.strokeStyle = INK_MAP;
  ctx.lineWidth = 2.4;
  ctx.strokeRect(-140, -26, 280, 54);
  ctx.lineWidth = 1;
  ctx.strokeRect(-134, -20, 268, 42);
  ctx.fillStyle = INK_MAP;
  ctx.textAlign = "center";
  ctx.font = "bold 24px Georgia, serif";
  ctx.fillText("THE BACKLOG MARCHES", 0, 2);
  ctx.font = "italic 16px Georgia, serif";
  ctx.fillText("surveyed in the fourth year", 0, 20);
  ctx.restore();

  // ---- age: fold creases, then stains, then a scorched border ----
  ctx.strokeStyle = "rgba(90,66,34,0.16)";
  ctx.lineWidth = 2;
  for (const fx of [0.34, 0.67]) {
    ctx.beginPath();
    ctx.moveTo(X(fx), 0);
    ctx.lineTo(X(fx), h);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, Y(0.5));
  ctx.lineTo(w, Y(0.5));
  ctx.stroke();

  for (let i = 0; i < 26; i++) {
    const x = rand() * w, y = rand() * h, r = 14 + rand() * 46;
    const g = ctx.createRadialGradient(x, y, r * 0.4, x, y, r);
    g.addColorStop(0, "rgba(120,80,30,0.05)");
    g.addColorStop(1, "rgba(120,80,30,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  const edge = ctx.createLinearGradient(0, 0, 0, h);
  edge.addColorStop(0, "rgba(86,54,18,0.35)");
  edge.addColorStop(0.12, "rgba(86,54,18,0)");
  edge.addColorStop(0.88, "rgba(86,54,18,0)");
  edge.addColorStop(1, "rgba(86,54,18,0.35)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, w, h);
  const edge2 = ctx.createLinearGradient(0, 0, w, 0);
  edge2.addColorStop(0, "rgba(86,54,18,0.35)");
  edge2.addColorStop(0.1, "rgba(86,54,18,0)");
  edge2.addColorStop(0.9, "rgba(86,54,18,0)");
  edge2.addColorStop(1, "rgba(86,54,18,0.35)");
  ctx.fillStyle = edge2;
  ctx.fillRect(0, 0, w, h);

  speckle(ctx, Math.max(w, h), 5000, rand, 0.06, false);

  return {
    map: toTexture(c, { srgb: true }),
    normalMap: toTexture(normalFrom(c, 0.4)),
    roughnessMap: toTexture(roughnessFrom(c, 0.66, 0.94)),
  };
}

/** A small terminal screen for one AI player: name, prompt and log lines. */
export function agentScreen(name, colour, { w = 512, h = 340, seed = 1 } = {}) {
  const rand = rng(seed * 977 + name.length);
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = "#0b0f14";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = colour;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, w - 6, h - 6);
  ctx.globalAlpha = 1;

  ctx.fillStyle = colour;
  ctx.font = "bold 46px 'Courier New', monospace";
  ctx.fillText(name, 26, 64);

  ctx.font = "20px 'Courier New', monospace";
  ctx.fillStyle = "rgba(200,230,255,0.42)";
  ctx.fillText("● connected", 26, 100);

  const lines = ["> awaiting turn", "> tools: 6 ready", "> ctx  ████████░░", "> roll: d20 + 3", "> status: ok"];
  ctx.font = "22px 'Courier New', monospace";
  lines.forEach((l, i) => {
    ctx.fillStyle = i === 0 ? colour : "rgba(180,215,240," + (0.55 - i * 0.07) + ")";
    ctx.fillText(l, 26, 146 + i * 34);
  });

  // scanlines
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 2);
  speckle(ctx, Math.max(w, h), 500, rand, 0.05, true);

  return toTexture(c, { srgb: true });
}

/** Each agent's mark, drawn as vector paths so there is nothing to license. */
function drawLogo(ctx, id, cx, cy, r, colour) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = Math.max(3, r * 0.14);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (id === "book") {
    // an open book: two pages curving away from a spine, a line of text on each
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.55);
    ctx.lineTo(0, r * 0.75);
    ctx.stroke();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.55);
      ctx.quadraticCurveTo(s * r * 0.55, -r * 0.95, s * r * 0.98, -r * 0.6);
      ctx.lineTo(s * r * 0.98, r * 0.55);
      ctx.quadraticCurveTo(s * r * 0.55, r * 0.35, 0, r * 0.75);
      ctx.stroke();
      ctx.lineWidth = Math.max(2, r * 0.07);
      for (let i = 0; i < 3; i++) {
        const y = -r * 0.28 + i * r * 0.26;
        ctx.beginPath();
        ctx.moveTo(s * r * 0.22, y - r * 0.02);
        ctx.lineTo(s * r * 0.8, y - r * 0.13);
        ctx.stroke();
      }
      ctx.lineWidth = Math.max(3, r * 0.14);
    }
  } else if (id === "twins") {
    // two four-pointed stars, one a little higher than the other
    const star = (x, y, R) => {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 === 0 ? R : R * 0.36;
        const px = x + Math.cos(a) * rr;
        const py = y + Math.sin(a) * rr;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    };
    star(-r * 0.42, -r * 0.2, r * 0.62);
    star(r * 0.48, r * 0.3, r * 0.48);
  } else if (id === "home") {
    // a house, with a small lit core inside: it runs at home
    ctx.beginPath();
    ctx.moveTo(-r * 0.85, -r * 0.05);
    ctx.lineTo(0, -r * 0.9);
    ctx.lineTo(r * 0.85, -r * 0.05);
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(-r * 0.62, -r * 0.1, r * 1.24, r * 1.0);
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(-r * 0.2, r * 0.2, r * 0.4, r * 0.4);
    ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.07);
    for (const [x, y] of [[-r * 0.2, r * 0.4], [r * 0.2, r * 0.4], [0, r * 0.2], [0, r * 0.6]]) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (x === 0 ? 0 : Math.sign(x) * r * 0.18), y + (x === 0 ? Math.sign(y - r * 0.4) * r * 0.18 : 0));
      ctx.stroke();
    }
  } else if (id === "shield") {
    // a mirrored shield
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.8, -r * 0.55);
    ctx.lineTo(r * 0.8, r * 0.25);
    ctx.quadraticCurveTo(r * 0.8, r * 0.9, 0, r);
    ctx.quadraticCurveTo(-r * 0.8, r * 0.9, -r * 0.8, r * 0.25);
    ctx.lineTo(-r * 0.8, -r * 0.55);
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 0.28;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(-r * 0.36, -r * 0.1);
    ctx.lineTo(0, r * 0.38);
    ctx.lineTo(r * 0.36, -r * 0.1);
    ctx.stroke();
  } else if (id === "staff") {
    // a winged staff
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.9);
    ctx.lineTo(0, r * 0.95);
    ctx.stroke();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.45);
      ctx.quadraticCurveTo(s * r * 0.95, -r * 0.8, s * r * 0.85, -r * 0.05);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.12);
      ctx.quadraticCurveTo(s * r * 0.7, -r * 0.4, s * r * 0.62, r * 0.25);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, -r * 0.92, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === "wheel") {
    // a ship's wheel
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.stroke();
    }
  } else {
    // braces around a stack of lines
    ctx.beginPath();
    ctx.moveTo(-r * 0.42, -r * 0.95);
    ctx.quadraticCurveTo(-r * 0.92, -r * 0.95, -r * 0.92, 0);
    ctx.quadraticCurveTo(-r * 0.92, r * 0.95, -r * 0.42, r * 0.95);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 0.42, -r * 0.95);
    ctx.quadraticCurveTo(r * 0.92, -r * 0.95, r * 0.92, 0);
    ctx.quadraticCurveTo(r * 0.92, r * 0.95, r * 0.42, r * 0.95);
    ctx.stroke();
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.32, i * r * 0.42);
      ctx.lineTo(r * 0.32 - Math.abs(i) * r * 0.18, i * r * 0.42);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** The face shown on an agent's television head: its mark over a live-looking screen. */
export function agentFace(agent, { w = 512, h = 384, seed = 4 } = {}) {
  const rand = rng(seed * 613 + agent.name.length);
  const [c, ctx] = canvas(w, h);

  ctx.fillStyle = "#07090d";
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w / 2, h * 0.44, 10, w / 2, h * 0.44, w * 0.62);
  g.addColorStop(0, agent.colour + "3a");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // The emblem is chosen by `mark` in content.js — book, twins, home, braces,
  // and the older shield, staff and wheel — never by the agent's name.
  drawLogo(ctx, agent.mark ?? "braces", w / 2, h * 0.41, h * 0.23, agent.colour);

  ctx.textAlign = "center";
  ctx.fillStyle = agent.colour;
  ctx.font = "bold 44px 'Courier New', monospace";
  ctx.fillText(agent.name, w / 2, h * 0.79);

  ctx.font = "20px 'Courier New', monospace";
  ctx.fillStyle = "rgba(210,235,255,0.45)";
  ctx.fillText(agent.role.toUpperCase(), w / 2, h * 0.88);

  // curved-tube vignette, then scanlines
  const v = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.62);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.65)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 2);
  speckle(ctx, Math.max(w, h), 420, rand, 0.04, true);

  return toTexture(c, { srgb: true });
}

/**
 * Woven suit cloth: a diagonal twill with slub noise, optionally pinstriped.
 * Drawn mid-grey so the material's own colour does the tinting.
 */
export function suitFabric({ size = 256, seed = 41, pinstripe = false, repeat = [3, 3] } = {}) {
  const rand = rng(seed + (pinstripe ? 7 : 0));
  const [c, ctx] = canvas(size);
  ctx.fillStyle = "#9a9a9a";
  ctx.fillRect(0, 0, size, size);

  // twill runs at 45 degrees; two tones one pixel apart give the weave its ridge
  ctx.lineWidth = 1;
  for (let i = -size; i < size * 2; i += 4) {
    ctx.strokeStyle = "rgba(255,255,255,0.13)";
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.16)";
    ctx.beginPath();
    ctx.moveTo(i + 1.6, 0);
    ctx.lineTo(i + 1.6 + size, size);
    ctx.stroke();
  }

  // cross-weave, much fainter, so the cloth is not a single directional streak
  for (let i = -size; i < size * 2; i += 6) {
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.beginPath();
    ctx.moveTo(i, size);
    ctx.lineTo(i + size, 0);
    ctx.stroke();
  }

  if (pinstripe) {
    for (let x = 0; x < size; x += 26) {
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
  }

  speckle(ctx, size, 5200, rand, 0.1, false);
  speckle(ctx, size, 3200, rand, 0.07, true);

  return {
    map: toTexture(c, { repeat, srgb: true }),
    normalMap: toTexture(normalFrom(c, 0.75), { repeat }),
    roughnessMap: toTexture(roughnessFrom(c, 0.66, 0.9), { repeat }),
  };
}

/** Fine poplin for the shirt and cuffs. */
export function shirtFabric({ size = 128, seed = 53, repeat = [4, 4] } = {}) {
  const rand = rng(seed);
  const [c, ctx] = canvas(size);
  ctx.fillStyle = "#b4b4b4";
  ctx.fillRect(0, 0, size, size);
  ctx.lineWidth = 1;
  for (let i = 0; i < size; i += 3) {
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.09)";
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }
  speckle(ctx, size, 1800, rand, 0.06, false);
  return {
    map: toTexture(c, { repeat, srgb: true }),
    normalMap: toTexture(normalFrom(c, 0.5), { repeat }),
    roughnessMap: toTexture(roughnessFrom(c, 0.62, 0.86), { repeat }),
  };
}

/**
 * The number that floats up after a die lands. `kind` is "crit" on a natural 20,
 * "fumble" on a natural 1, and "normal" otherwise — the colour carries the result
 * before the reader has parsed the digits.
 */
export function scoreLabel(value, sides, kind = "normal") {
  const [c, ctx] = canvas(256, 168);
  const col = kind === "crit" ? "#ffd24a" : kind === "fumble" ? "#e8503f" : "#f2e8d2";

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // a soft disc behind the digits so they stay readable over the battle map
  const g = ctx.createRadialGradient(128, 78, 6, 128, 78, 118);
  g.addColorStop(0, kind === "normal" ? "rgba(10,8,6,0.72)" : col + "55");
  g.addColorStop(1, "rgba(10,8,6,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 168);

  ctx.font = "bold 104px Georgia, 'Times New Roman', serif";
  ctx.shadowColor = col;
  ctx.shadowBlur = kind === "normal" ? 14 : 34;
  ctx.fillStyle = col;
  ctx.fillText(String(value), 128, 108);
  ctx.shadowBlur = 0;

  ctx.font = "600 20px Georgia, serif";
  ctx.fillStyle = "rgba(240,232,210,0.62)";
  ctx.fillText(kind === "crit" ? "CRITICAL" : kind === "fumble" ? "FUMBLE" : "d" + sides, 128, 140);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Cold-press paper: a tileable sheet of tooth and fibre. Used by the watercolour
 * pass both as the grain laid over the image and as the low-frequency noise that
 * wobbles the sampling, which is what keeps painted edges from looking machined.
 */
export function paperGrain({ size = 512, seed = 71 } = {}) {
  const rand = rng(seed);
  const [c, ctx] = canvas(size);
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, size, size);

  // broad cloudy blotches: the low-frequency channel
  for (let i = 0; i < 170; i++) {
    const x = rand() * size, y = rand() * size, r = 40 + rand() * 150;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const light = rand() > 0.5;
    g.addColorStop(0, light ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // the tooth of the paper: short fibres in both directions
  ctx.lineWidth = 1;
  for (let i = 0; i < 2600; i++) {
    const x = rand() * size, y = rand() * size;
    const len = 4 + rand() * 16;
    const horiz = rand() > 0.5;
    ctx.strokeStyle = rand() > 0.5 ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.09)";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(horiz ? x + len : x + rand() * 2, horiz ? y + rand() * 2 : y + len);
    ctx.stroke();
  }

  speckle(ctx, size, 6000, rand, 0.07, false);
  speckle(ctx, size, 6000, rand, 0.07, true);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/* ------------------------------------------------------------------ *
 *  Room dressing
 *  Everything below is drawn rather than downloaded. The posters are
 *  original artwork in the visual language of the early 2000s — code
 *  rain, Y2K chrome, pixel arcade, LAN flyer, skate print — not
 *  reproductions of real ones, which would be someone else's copyright.
 * ------------------------------------------------------------------ */

/** Offset dot screen, the printing artefact that dates an image to a cheap poster press. */
function halftone(ctx, w, h, colour, step, radius, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = colour;
  for (let y = 0, row = 0; y < h + step; y += step, row++) {
    for (let x = (row % 2) * (step / 2); x < w + step; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Aerosol overspray: a cloud of soft dots around a point. */
function spray(ctx, cx, cy, r, colour, count, rand) {
  ctx.fillStyle = colour;
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const d = Math.pow(rand(), 0.6) * r;
    ctx.globalAlpha = 0.03 + rand() * 0.07;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0.5 + rand() * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Text with a hard offset shadow — the cheap way every 2000s flyer got depth. */
function shadowText(ctx, text, x, y, font, fill, shadow, dx = 4, dy = 4) {
  ctx.font = font;
  ctx.fillStyle = shadow;
  ctx.fillText(text, x + dx, y + dy);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

const PIXEL_HERO = [
  "....GGGG....",
  "...GGGGGG...",
  "..GGWWGGWW..",
  "..GGWWGGWW..",
  "..GGGGGGGG..",
  "...GGRRGG...",
  "..CCGGGGCC..",
  ".CCCGGGGCCC.",
  "CC.CGGGGC.CC",
  "....GGGG....",
  "...CC..CC...",
  "..CCC..CCC..",
];

/**
 * One wall poster. `kind` selects the design; each is a self-contained little
 * piece of art rather than a variation on a template, because a wall of five
 * variations on one layout reads as wallpaper, not as a room someone lives in.
 */
export function poster(kind, { w = 512, h = 724, seed = 9 } = {}) {
  const rand = rng(seed * 131 + kind.length);
  // Drawn at twice the size it is laid out at. The designs below are written
  // in 512 x 724 units and at that resolution a 66 cm poster carries 7.7
  // pixels to the centimetre, which is soft in any shot closer than the wide
  // one — the type lost its corners. The layout stays in its own units; only
  // the backing canvas is bigger.
  const SS = 2;
  const [c, ctx] = canvas(w * SS, h * SS);
  ctx.scale(SS, SS);
  ctx.textAlign = "center";

  if (kind === "code") {
    ctx.fillStyle = "#020604";
    ctx.fillRect(0, 0, w, h);
    const glyphs = "0123456789<>[]{}/\\|=+*#$%&@?!~^";
    ctx.textAlign = "left";
    ctx.font = "22px 'Courier New', monospace";
    for (let x = 6; x < w; x += 21) {
      const head = rand() * h * 1.4 - h * 0.2;
      const len = 12 + Math.floor(rand() * 26);
      for (let i = 0; i < len; i++) {
        const y = head - i * 24;
        if (y < -20 || y > h + 20) continue;
        const fade = 1 - i / len;
        ctx.fillStyle = i === 0 ? "rgba(215,255,225,0.95)" : `rgba(50,${Math.round(180 + fade * 60)},95,${0.1 + fade * 0.7})`;
        ctx.fillText(glyphs[Math.floor(rand() * glyphs.length)], x, y);
      }
    }
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(0, h * 0.63, w, h * 0.2);
    shadowText(ctx, "THE SOURCE", w / 2, h * 0.735, "bold 78px 'Arial Black', Impact, sans-serif", "#d9ffe6", "#0a5f32", 3, 3);
    ctx.font = "19px 'Courier New', monospace";
    ctx.fillStyle = "rgba(120,240,170,0.75)";
    ctx.fillText("THERE IS NO PROMPT", w / 2, h * 0.79);
    ctx.fillStyle = "rgba(120,240,170,0.4)";
    ctx.font = "15px 'Courier New', monospace";
    ctx.fillText("REALITY  —  DIRECTOR'S CUT", w / 2, h * 0.94);
  } else if (kind === "y2k") {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#0b2c5e");
    g.addColorStop(0.45, "#2f8fd8");
    g.addColorStop(0.72, "#bfe4ff");
    g.addColorStop(1, "#134a86");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // starburst behind the title
    ctx.save();
    ctx.translate(w / 2, h * 0.38);
    for (let i = 0; i < 28; i++) {
      ctx.rotate((Math.PI * 2) / 28);
      ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.03)";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w * 0.9, -26);
      ctx.lineTo(w * 0.9, 26);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // chrome bubble type: dark base, gradient core, white rim light
    ctx.font = "bold 168px 'Arial Black', Impact, sans-serif";
    ctx.fillStyle = "#06213f";
    ctx.fillText("Y2K", w / 2 + 6, h * 0.44 + 7);
    const chrome = ctx.createLinearGradient(0, h * 0.28, 0, h * 0.47);
    chrome.addColorStop(0, "#ffffff");
    chrome.addColorStop(0.44, "#8fc7f2");
    chrome.addColorStop(0.5, "#0f3f73");
    chrome.addColorStop(0.58, "#eaf6ff");
    chrome.addColorStop(1, "#5d9ccd");
    ctx.fillStyle = chrome;
    ctx.fillText("Y2K", w / 2, h * 0.44);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.strokeText("Y2K", w / 2, h * 0.44);

    ctx.font = "bold 34px 'Trebuchet MS', sans-serif";
    ctx.fillStyle = "#04203d";
    ctx.fillText("THE FUTURE IS NOW", w / 2 + 2, h * 0.55 + 2);
    ctx.fillStyle = "#f2fbff";
    ctx.fillText("THE FUTURE IS NOW", w / 2, h * 0.55);

    // the obligatory glossy capsule
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.68, w * 0.32, h * 0.055, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = "bold 26px 'Trebuchet MS', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("READY OR NOT", w / 2, h * 0.695);
    halftone(ctx, w, h, "#ffffff", 7, 1.1, 0.05);
  } else if (kind === "arcade") {
    ctx.fillStyle = "#170a2b";
    ctx.fillRect(0, 0, w, h);
    // perspective floor grid
    ctx.strokeStyle = "rgba(255,52,160,0.5)";
    ctx.lineWidth = 2;
    for (let i = -10; i <= 10; i++) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + i * 18, h * 0.62);
      ctx.lineTo(w / 2 + i * 190, h);
      ctx.stroke();
    }
    for (let i = 0, y = h * 0.62; y < h; i++) {
      y += 6 + i * i * 1.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    // sun
    const sg = ctx.createLinearGradient(0, h * 0.2, 0, h * 0.62);
    sg.addColorStop(0, "#ffe46b");
    sg.addColorStop(1, "#ff2f7a");
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.44, w * 0.27, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#170a2b";
    for (let y = h * 0.46; y < h * 0.62; y += 13) ctx.fillRect(0, y, w, 5);

    // the hero, drawn a pixel at a time
    const px = 15;
    const ox = w / 2 - (PIXEL_HERO[0].length * px) / 2;
    const oy = h * 0.3;
    const pal = { G: "#2fe08a", W: "#ffffff", R: "#ff3b3b", C: "#3fc4ff" };
    PIXEL_HERO.forEach((row, ry) =>
      [...row].forEach((ch, rx) => {
        if (!pal[ch]) return;
        ctx.fillStyle = pal[ch];
        ctx.fillRect(ox + rx * px, oy + ry * px, px, px);
      })
    );

    shadowText(ctx, "PRESS START", w / 2, h * 0.79, "bold 62px 'Courier New', monospace", "#ffe46b", "#ff2f7a", 5, 5);
    ctx.font = "22px 'Courier New', monospace";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText("INSERT COIN  ·  1 CREDIT  ·  2P", w / 2, h * 0.85);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    for (let y = 0; y < h; y += 5) ctx.fillRect(0, y, w, 2);
  } else if (kind === "lan") {
    ctx.fillStyle = "#05070c";
    ctx.fillRect(0, 0, w, h);
    // a network someone actually cabled, drawn as a node graph
    const nodes = [];
    for (let i = 0; i < 16; i++) nodes.push([40 + rand() * (w - 80), h * 0.2 + rand() * h * 0.42]);
    ctx.strokeStyle = "rgba(60,220,190,0.35)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (Math.hypot(nodes[i][0] - nodes[j][0], nodes[i][1] - nodes[j][1]) > 150) continue;
        ctx.beginPath();
        ctx.moveTo(nodes[i][0], nodes[i][1]);
        ctx.lineTo(nodes[j][0], nodes[j][1]);
        ctx.stroke();
      }
    }
    for (const [x, y] of nodes) {
      ctx.fillStyle = "#3ff0c8";
      ctx.shadowColor = "#3ff0c8";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(5,7,12,0.82)";
    ctx.fillRect(0, h * 0.62, w, h * 0.3);
    shadowText(ctx, "LAN PARTY", w / 2, h * 0.72, "bold 74px 'Arial Black', Impact, sans-serif", "#3ff0c8", "#0d5a4c", 4, 4);
    ctx.font = "bold 30px 'Courier New', monospace";
    ctx.fillStyle = "#ff8a3d";
    ctx.fillText("BYOC  ·  48 HOURS", w / 2, h * 0.775);
    ctx.font = "19px 'Courier New', monospace";
    ctx.fillStyle = "rgba(200,240,255,0.55)";
    ctx.fillText("bring your own chair, cable and rig", w / 2, h * 0.815);
    ctx.fillText("pizza at 02:00  ·  no respawn camping", w / 2, h * 0.845);
    ctx.strokeStyle = "rgba(63,240,200,0.5)";
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, w - 24, h - 24);
  } else {
    // skate print: one loud word, badly registered, sprayed over
    ctx.fillStyle = "#e9e2d2";
    ctx.fillRect(0, 0, w, h);
    halftone(ctx, w, h, "#1a1714", 6, 1.4, 0.12);
    ctx.save();
    ctx.translate(w / 2, h * 0.42);
    ctx.rotate(-0.09);
    ctx.fillStyle = "#e4531f";
    ctx.fillRect(-w * 0.44, -h * 0.13, w * 0.88, h * 0.26);
    ctx.font = "bold 112px 'Arial Black', Impact, sans-serif";
    ctx.fillStyle = "rgba(20,18,16,0.25)";
    ctx.fillText("NO RULES", 7, 40);
    ctx.fillStyle = "#faf6ea";
    ctx.fillText("NO RULES", 0, 36);
    ctx.restore();

    // a deck, seen from below
    ctx.save();
    ctx.translate(w / 2, h * 0.68);
    ctx.rotate(0.22);
    ctx.fillStyle = "#1a1714";
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.06, h * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e4531f";
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.042, h * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    spray(ctx, w * 0.24, h * 0.2, 130, "#1a1714", 1400, rand);
    spray(ctx, w * 0.78, h * 0.85, 150, "#e4531f", 1400, rand);
    ctx.textAlign = "center";
    ctx.font = "bold 27px 'Trebuchet MS', sans-serif";
    ctx.fillStyle = "#1a1714";
    ctx.fillText("SKATE OR DON'T  ·  EST. 2001", w / 2, h * 0.94);
    speckle(ctx, Math.max(w, h), 3000, rand, 0.09, false);
  }

  // every poster on a wall has been up a while
  const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.95);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.3)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  speckle(ctx, Math.max(w, h), 900, rand, 0.05, false);

  return toTexture(c, { srgb: true });
}

/** Painted brick for the fireplace surround. */
export function brick({ size = 512, seed = 63, repeat = [2, 1] } = {}) {
  const rand = rng(seed);
  const [c, ctx] = canvas(size);
  ctx.fillStyle = "#4a3f3a";
  ctx.fillRect(0, 0, size, size);
  const rows = 12;
  const rh = size / rows;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (size / 8);
    for (let b = -1; b < 8; b++) {
      const x = offset + b * (size / 4) + 3;
      const y = r * rh + 3;
      const shade = 0.78 + rand() * 0.3;
      ctx.fillStyle = `rgb(${Math.round(150 * shade)},${Math.round(112 * shade)},${Math.round(96 * shade)})`;
      ctx.fillRect(x, y, size / 4 - 6, rh - 6);
      // each brick is a little mottled, or the wall reads as tiling
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = rand() > 0.5 ? "rgba(255,240,225,0.08)" : "rgba(0,0,0,0.1)";
        ctx.fillRect(x + rand() * (size / 4 - 6), y + rand() * (rh - 6), 3 + rand() * 9, 2 + rand() * 5);
      }
    }
  }
  speckle(ctx, size, 5000, rand, 0.09, false);
  return {
    map: toTexture(c, { repeat, srgb: true }),
    normalMap: toTexture(normalFrom(c, 1.5), { repeat }),
    roughnessMap: toTexture(roughnessFrom(c, 0.72, 0.96), { repeat }),
  };
}

/** Flat-weave upholstery for the sofa. */
export function weave({ size = 256, seed = 67, repeat = [3, 2] } = {}) {
  const rand = rng(seed);
  const [c, ctx] = canvas(size);
  ctx.fillStyle = "#9e9e9e";
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 6) {
    for (let x = 0; x < size; x += 6) {
      const alt = ((x / 6 + y / 6) | 0) % 2;
      ctx.fillStyle = alt ? "rgba(255,255,255,0.11)" : "rgba(0,0,0,0.11)";
      ctx.fillRect(x, y, alt ? 6 : 3, alt ? 3 : 6);
    }
  }
  speckle(ctx, size, 6000, rand, 0.12, false);
  speckle(ctx, size, 4000, rand, 0.09, true);
  return {
    map: toTexture(c, { repeat, srgb: true }),
    normalMap: toTexture(normalFrom(c, 1.1), { repeat }),
    roughnessMap: toTexture(roughnessFrom(c, 0.74, 0.96), { repeat }),
  };
}

/** The living-room television, left on with nobody watching. */
export function tvScreen({ w = 512, h = 384, seed = 12 } = {}) {
  const rand = rng(seed);
  const [c, ctx] = canvas(w, h);
  // colour bars: what a CRT shows once the night is over
  const bars = ["#c0c0c0", "#c0c000", "#00c0c0", "#00c000", "#c000c0", "#c00000", "#0000c0"];
  bars.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.fillRect((i * w) / bars.length, 0, w / bars.length + 1, h * 0.7);
  });
  ctx.fillStyle = "#101018";
  ctx.fillRect(0, h * 0.7, w, h * 0.3);
  ctx.textAlign = "center";
  ctx.font = "bold 40px 'Courier New', monospace";
  ctx.fillStyle = "#e8e8f0";
  ctx.fillText("NO SIGNAL", w / 2, h * 0.86);
  ctx.font = "18px 'Courier New', monospace";
  ctx.fillStyle = "rgba(200,210,230,0.5)";
  ctx.fillText("CH 03   ·   AV1", w / 2, h * 0.94);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 2);
  speckle(ctx, Math.max(w, h), 2200, rand, 0.14, true);
  const v = ctx.createRadialGradient(w / 2, h / 2, w * 0.28, w / 2, h / 2, w * 0.66);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  return toTexture(c, { srgb: true });
}

/**
 * One tongue of flame, drawn once and stacked with additive blending.
 *
 * A radial blob was the first attempt and it read as a glow, not as fire: what
 * makes a flame legible is the silhouette — wide and hot at the base, pinched
 * to a tip. So this is an actual shape, filled with a vertical heat gradient
 * and softened by drawing it three times at falling alpha.
 */
export function flame({ w = 128, h = 208 } = {}) {
  const [c, ctx] = canvas(w, h);

  const heat = ctx.createLinearGradient(0, h, 0, 0);
  heat.addColorStop(0, "rgba(198, 74, 18, 0.55)");
  heat.addColorStop(0.16, "rgba(255, 150, 44, 0.95)");
  heat.addColorStop(0.42, "rgba(255, 206, 110, 0.95)");
  heat.addColorStop(0.74, "rgba(255, 150, 50, 0.55)");
  heat.addColorStop(1, "rgba(150, 40, 0, 0)");

  const tongue = (spread, alpha) => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = heat;
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.02);
    ctx.bezierCurveTo(w / 2 + spread * 0.5, h * 0.3, w / 2 + spread, h * 0.6, w / 2 + spread * 0.75, h * 0.92);
    ctx.quadraticCurveTo(w / 2, h * 1.02, w / 2 - spread * 0.75, h * 0.92);
    ctx.bezierCurveTo(w / 2 - spread, h * 0.6, w / 2 - spread * 0.5, h * 0.3, w / 2, h * 0.02);
    ctx.closePath();
    ctx.fill();
  };

  tongue(w * 0.46, 0.45);
  tongue(w * 0.34, 0.6);
  tongue(w * 0.2, 0.85);

  // the white heart at the base, where the gas is actually burning
  ctx.globalAlpha = 1;
  const core = ctx.createRadialGradient(w / 2, h * 0.84, 1, w / 2, h * 0.84, w * 0.3);
  core.addColorStop(0, "rgba(255,248,224,0.95)");
  core.addColorStop(1, "rgba(255,180,80,0)");
  ctx.fillStyle = core;
  ctx.fillRect(0, h * 0.5, w, h * 0.5);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ *
 *  The DM screen
 *  Three panels, printed on both sides: the players get the artwork,
 *  the DM gets the tables they actually need mid-session. The camera
 *  sits behind the DM, so the tables are the side it reads.
 * ------------------------------------------------------------------ */

/** Parchment ground shared by both faces of the screen. */
function screenStock(ctx, w, h, rand) {
  ctx.fillStyle = "#e3d4ae";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 150; i++) {
    const x = rand() * w, y = rand() * h, r = 20 + rand() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rand() > 0.5 ? "rgba(122,88,44,0.06)" : "rgba(255,248,226,0.12)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  speckle(ctx, Math.max(w, h), 2600, rand, 0.06, false);
}

const INK = "#3a2a18";
const RED = "#8c2f22";

/** A boxed table with a heading and rows, the unit every DM screen is built from. */
function refTable(ctx, x, y, w, rows, title, rand) {
  const rowH = 30;
  const h = 40 + rows.length * rowH;
  ctx.fillStyle = "rgba(255,250,236,0.5)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = RED;
  ctx.fillRect(x, y, w, 34);
  ctx.fillStyle = "#f4ead2";
  ctx.font = "bold 21px Georgia, serif";
  ctx.textAlign = "left";
  ctx.fillText(title, x + 12, y + 24);

  ctx.font = "20px Georgia, serif";
  rows.forEach(([left, right], i) => {
    const ry = y + 40 + i * rowH;
    if (i % 2) {
      ctx.fillStyle = "rgba(122,88,44,0.09)";
      ctx.fillRect(x + 2, ry - 4, w - 4, rowH);
    }
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.fillText(left, x + 12, ry + 17);
    ctx.textAlign = "right";
    ctx.fillStyle = RED;
    ctx.font = "bold 20px Georgia, serif";
    ctx.fillText(right, x + w - 12, ry + 17);
    ctx.font = "20px Georgia, serif";
  });
  return y + h;
}

/**
 * The DM's side of one panel. `index` picks which tables it carries, so the
 * three panels together read as one reference spread rather than three copies.
 */
export function dmScreenTables(index, { w = 512, h = 430, seed = 81, names = ["Fable", "Codex", "Gemini", "Qwen"] } = {}) {
  const rand = rng(seed + index * 17);
  const [c, ctx] = canvas(w, h);
  screenStock(ctx, w, h, rand);

  const M = 22;
  const iw = w - M * 2;

  if (index === 0) {
    let y = refTable(ctx, M, 20, iw, [
      ["Trivial", "DC 5"],
      ["Easy", "DC 10"],
      ["Medium", "DC 15"],
      ["Hard", "DC 20"],
      ["Nearly impossible", "DC 30"],
    ], "DIFFICULTY CLASS", rand);
    refTable(ctx, M, y + 18, iw, [
      ["Advantage", "roll 2, keep high"],
      ["Disadvantage", "roll 2, keep low"],
      ["Inspiration", "once per session"],
    ], "THE DICE", rand);
  } else if (index === 1) {
    let y = refTable(ctx, M, 20, iw, [
      ["Scope agreed", "+2"],
      ["Data is clean", "+2"],
      ["No owner named", "-4"],
      ["Demo on Friday", "-2"],
      ["Nobody asked for it", "auto-fail"],
    ], "DELIVERY CHECKS", rand);
    y = refTable(ctx, M, y + 16, iw, [
      ["Blinded", "hallucinating"],
      ["Charmed", "demo-driven"],
      ["Exhausted", "context full"],
    ], "CONDITIONS", rand);
    ctx.fillStyle = INK;
    ctx.font = "italic 19px Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText("the rules are a starting point", w / 2, y + 42);
  } else {
    // the initiative order, pencilled in and scratched out as a session does
    // the party's names come from content.js, so a renamed player is renamed here too
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    let y = refTable(ctx, M, 20, iw, [
      ...names.slice(0, 4).map((n, i) => [cap(n), String([18, 15, 12, 9][i])]),
      ["The backlog", "4"],
    ], "INITIATIVE", rand);

    ctx.strokeStyle = "rgba(60,44,26,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(M + 14, y - 22);
    ctx.lineTo(M + iw - 60, y - 26);
    ctx.stroke();

    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.font = "bold 19px Georgia, serif";
    ctx.fillText("NOTES", M, y + 42);
    ctx.font = "19px Georgia, serif";
    ["ask what it is for, first", "ship it, then make it pretty", "the humans sign off"].forEach((t, i) => {
      ctx.fillText("— " + t, M, y + 72 + i * 28);
    });

    // the ring every DM screen ends up with
    ctx.strokeStyle = "rgba(122,78,32,0.3)";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(w - 92, h - 76, 46, 0, Math.PI * 2);
    ctx.stroke();
  }

  speckle(ctx, Math.max(w, h), 1400, rand, 0.05, false);
  return c;
}

/**
 * The players' side: one long illustration split across the three panels, so
 * they line up into a single creature rather than three unrelated pictures.
 * A dragon made of circuitry — the thing this party is actually fighting.
 */
export function dmScreenArt(index, { w = 512, h = 430, seed = 91 } = {}) {
  const rand = rng(seed + index * 23);
  const [c, ctx] = canvas(w, h);
  screenStock(ctx, w, h, rand);

  // ink wash, darker towards the bottom, as if brushed
  const wash = ctx.createLinearGradient(0, 0, 0, h);
  wash.addColorStop(0, "rgba(40,52,64,0.05)");
  wash.addColorStop(1, "rgba(28,36,48,0.34)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = INK;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (index === 0) {
    // head and jaw
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(w * 0.12, h * 0.6);
    ctx.bezierCurveTo(w * 0.2, h * 0.3, w * 0.55, h * 0.22, w * 0.9, h * 0.34);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.14, h * 0.62);
    ctx.bezierCurveTo(w * 0.3, h * 0.72, w * 0.6, h * 0.66, w * 0.92, h * 0.56);
    ctx.stroke();
    // horns
    for (let i = 0; i < 3; i++) {
      ctx.lineWidth = 5 - i;
      ctx.beginPath();
      ctx.moveTo(w * (0.34 + i * 0.16), h * 0.27);
      ctx.quadraticCurveTo(w * (0.4 + i * 0.16), h * 0.06, w * (0.54 + i * 0.16), h * 0.04);
      ctx.stroke();
    }
    // the eye, the one warm thing on the whole panel
    ctx.fillStyle = RED;
    ctx.beginPath();
    ctx.ellipse(w * 0.33, h * 0.45, 20, 11, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(w * 0.33, h * 0.45, 5, 10, -0.2, 0, Math.PI * 2);
    ctx.fill();
    // teeth
    ctx.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      const x = w * (0.22 + i * 0.1);
      ctx.beginPath();
      ctx.moveTo(x, h * 0.63);
      ctx.lineTo(x + 9, h * 0.73);
      ctx.lineTo(x + 18, h * 0.63);
      ctx.stroke();
    }
  } else if (index === 1) {
    // body, with a wing sweeping over it
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.42);
    ctx.bezierCurveTo(w * 0.35, h * 0.34, w * 0.7, h * 0.46, w, h * 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, h * 0.62);
    ctx.bezierCurveTo(w * 0.3, h * 0.82, w * 0.72, h * 0.74, w, h * 0.66);
    ctx.stroke();
    ctx.lineWidth = 4;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(w * (0.1 + i * 0.2), h * 0.38);
      ctx.quadraticCurveTo(w * (0.16 + i * 0.2), h * 0.1, w * (0.3 + i * 0.2), h * 0.06);
      ctx.stroke();
    }
    // scales as circuit pads
    ctx.lineWidth = 2;
    for (let i = 0; i < 46; i++) {
      const x = rand() * w, y = h * 0.44 + rand() * h * 0.22;
      ctx.beginPath();
      ctx.arc(x, y, 4 + rand() * 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    // tail, trailing off the last panel
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.44);
    ctx.bezierCurveTo(w * 0.4, h * 0.4, w * 0.6, h * 0.74, w * 0.95, h * 0.88);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.66);
    ctx.bezierCurveTo(w * 0.35, h * 0.62, w * 0.55, h * 0.84, w * 0.8, h * 0.95);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(w * (0.08 + i * 0.13), h * (0.42 + i * 0.07));
      ctx.lineTo(w * (0.12 + i * 0.13), h * (0.3 + i * 0.07));
      ctx.stroke();
    }
  }

  // circuit traces running under the ink on every panel
  ctx.strokeStyle = "rgba(60,90,110,0.34)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    let x = rand() * w, y = rand() * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      if (rand() > 0.5) x += (rand() - 0.5) * 90;
      else y += (rand() - 0.5) * 90;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // a title, once, on the middle panel
  if (index === 1) {
    ctx.textAlign = "center";
    ctx.font = "bold 30px Georgia, serif";
    ctx.fillStyle = RED;
    ctx.fillText("HERE BE LEGACY SYSTEMS", w / 2, h * 0.95);
  }

  speckle(ctx, Math.max(w, h), 1600, rand, 0.05, false);
  return c;
}

/** Wraps a DM-screen canvas into the material set the panel mesh needs. */
export function screenFace(c) {
  return {
    map: toTexture(c, { srgb: true }),
    normalMap: toTexture(normalFrom(c, 0.6)),
    roughnessMap: toTexture(roughnessFrom(c, 0.72, 0.95)),
  };
}

/**
 * Wallpaper.
 *
 * Two earlier attempts read as dirty, and for the same reason both times: the
 * things that make a surface look *used* — blotches, scuffs, heavy speckle, a
 * normal map derived from that speckle — are exactly the things that make it
 * look unwashed when it covers fourteen metres of wall behind a dim room. So
 * there is almost nothing here: fine stripes, a low-contrast motif on a lattice,
 * and just enough grain to stop the flat areas banding. Clean is a choice you
 * make by leaving things out.
 */
export function wallpaper({ size = 512, seed = 88, repeat = [12, 4.5] } = {}) {
  const rand = rng(seed);
  const [c, ctx] = canvas(size);
  ctx.fillStyle = "#bdbdbd";
  ctx.fillRect(0, 0, size, size);

  // fine vertical stripes, about 7 cm apart at the scale this is applied
  const STRIPE = 32;
  for (let x = 0; x < size; x += STRIPE * 2) {
    ctx.fillStyle = "rgba(255,255,255,0.035)";
    ctx.fillRect(x, 0, STRIPE, size);
  }
  for (let x = 0; x < size; x += STRIPE) {
    ctx.fillStyle = "rgba(0,0,0,0.02)";
    ctx.fillRect(x, 0, 1, size);
  }

  // a small four-petal motif on a staggered lattice — the quietest pattern that
  // still says "this wall was papered" rather than "this wall is a flat fill"
  const CELL = 128;
  const petal = (cx, cy, r) => {
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(px + Math.cos(a + 1.2) * r * 0.7, py + Math.sin(a + 1.2) * r * 0.7, px, py);
      ctx.quadraticCurveTo(px + Math.cos(a - 1.2) * r * 0.7, py + Math.sin(a - 1.2) * r * 0.7, cx, cy);
    }
    ctx.closePath();
  };
  for (let row = 0; row * CELL < size + CELL; row++) {
    for (let col = -1; col * CELL < size + CELL; col++) {
      const cx = col * CELL + (row % 2) * (CELL / 2);
      const cy = row * CELL;
      ctx.fillStyle = "rgba(255,255,255,0.055)";
      petal(cx, cy, 20);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.025)";
      ctx.lineWidth = 1;
      petal(cx, cy, 20);
      ctx.stroke();
      ctx.fillStyle = "rgba(0,0,0,0.02)";
      ctx.beginPath();
      ctx.arc(cx, cy, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // barely any grain: enough to break up flat gradients, not enough to be dirt
  speckle(ctx, size, 2600, rand, 0.018, false);
  speckle(ctx, size, 2600, rand, 0.018, true);

  return {
    map: toTexture(c, { repeat, srgb: true }),
    // Weak, and derived from the pattern rather than from noise: a normal map
    // built off speckle is what made the last two walls look like old plaster.
    normalMap: toTexture(normalFrom(c, 0.22), { repeat }),
    roughnessMap: toTexture(roughnessFrom(c, 0.86, 0.94), { repeat }),
  };
}

/**
 * A speech bubble, drawn for one line.
 *
 * Sized for legibility from the wide shot rather than for elegance up close:
 * at two and a half metres a bubble that looks correctly proportioned beside
 * the figure is about six pixels of text on screen. It is a cartoon table, and
 * a cartoon lets you draw the bubble too big.
 */
/**
 * The proportions of a bubble, so the sprite that carries it is not stretched.
 * Exported rather than repeated: chatter.js needs the same number.
 */
export const BUBBLE = { w: 680, h: 320 };

/**
 * One speech bubble.
 *
 * The text is wrapped to the bubble, at the largest size that fits. The first
 * version of this trusted the line breaks written into content.js and drew each
 * row centred without ever measuring it — seventeen of the forty lines ran past
 * the outline, the worst of them by two hundred pixels, which is what made them
 * unreadable. Nothing is drawn now that has not been measured first.
 *
 * Authored breaks are kept as hard breaks: they are the comic timing, the pause
 * between the setup and the punchline. Wrapping happens inside them.
 */
export function speechBubble(text, name, colour, { w = BUBBLE.w, h = BUBBLE.h } = {}) {
  const rand = rng(text.length * 31 + name.length);
  const [c, ctx] = canvas(w, h);
  const PAD = 32;
  const TAIL = 34;
  const bodyH = h - TAIL;
  const maxW = w - PAD * 2;
  const TOP = 84;               // under the name
  const room = bodyH - 26 - TOP; // vertical space the text has

  const round = (x, y, bw, bh, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + bw - r, y);
    ctx.quadraticCurveTo(x + bw, y, x + bw, y + r);
    ctx.lineTo(x + bw, y + bh - r);
    ctx.quadraticCurveTo(x + bw, y + bh, x + bw - r, y + bh);
    ctx.lineTo(x + r, y + bh);
    ctx.quadraticCurveTo(x, y + bh, x, y + bh - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  // A card, not a cartoon balloon. The first bubble had a seven-pixel outline
  // in the speaker's colour, which was the one comic-book thing left on a
  // table that had gone to parchment everywhere else. This is the hint card's
  // language: parchment with a faint wash, a hairline of ink, a second hairline
  // inside it in the speaker's colour, the name in small capitals over a rule.
  const INK = "#2b1d12";
  const wash = ctx.createLinearGradient(0, 0, 0, bodyH);
  wash.addColorStop(0, "#f4ecd9");
  wash.addColorStop(1, "#e6d7b8");

  // the body, then the tail, drawn as one silhouette so the outline is continuous
  ctx.fillStyle = wash;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  round(6, 6, w - 12, bodyH - 6, 10);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(w * 0.24, bodyH - 8);
  ctx.lineTo(w * 0.19, h - 6);
  ctx.lineTo(w * 0.36, bodyH - 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // paint over the seam the tail leaves in the body outline
  ctx.fillStyle = "#e6d7b8";
  ctx.beginPath();
  ctx.rect(w * 0.245, bodyH - 12, w * 0.11, 9);
  ctx.fill();

  // the inner hairline, in the speaker's colour, and a rule under the name
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2;
  round(16, 16, w - 32, bodyH - 26, 6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.3, 66);
  ctx.lineTo(w * 0.7, 66);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = colour;
  ctx.font = "bold 26px Georgia, 'Times New Roman', serif";
  // tracked capitals by hand: canvas has no letter-spacing, so each glyph is
  // placed from a running measure
  {
    const caps = String(name).toUpperCase();
    const TRACK = 5;
    const widths = [...caps].map((ch) => ctx.measureText(ch).width);
    let x = w / 2 - (widths.reduce((a, b) => a + b, 0) + TRACK * (caps.length - 1)) / 2;
    ctx.textAlign = "left";
    [...caps].forEach((ch, i) => {
      ctx.fillText(ch, x, 50);
      x += widths[i] + TRACK;
    });
    ctx.textAlign = "center";
  }

  const wrap = (size) => {
    ctx.font = `italic ${size}px Georgia, 'Times New Roman', serif`;
    const out = [];
    for (const hard of String(text).split("\n")) {
      let line = "";
      for (const word of hard.split(/\s+/)) {
        const test = line ? line + " " + word : word;
        if (line && ctx.measureText(test).width > maxW) {
          out.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) out.push(line);
    }
    return out;
  };

  // The largest size that fits both ways. It stops at 26 rather than shrinking
  // for ever: a line that still does not fit at 26 is too long to be a joke,
  // and the right fix for that one is to write it shorter.
  let rows = [];
  let lh = 0;
  for (const size of [42, 38, 34, 30, 26]) {
    rows = wrap(size);
    lh = Math.round(size * 1.22);
    if (rows.length * lh <= room && rows.every((r) => ctx.measureText(r).width <= maxW)) break;
  }

  ctx.fillStyle = "#33240f";
  const first = TOP + (room - rows.length * lh) / 2 + lh * 0.76;
  rows.forEach((row, i) => ctx.fillText(row, w / 2, first + i * lh));

  speckle(ctx, Math.max(w, h), 900, rand, 0.035, false);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ *
 *  What is on the other side of the glass
 *
 *  The clock on the chimney breast reads twenty past eleven and the fire
 *  is lit, so this cannot be daylight. It is the blue hour instead: the
 *  sky still holds light at the horizon while the street below has gone
 *  to silhouette. That is the useful version anyway — a cool window
 *  against a warm hearth is the contrast that makes an interior read as
 *  a real place rather than a lit box, and daylight would just wash the
 *  fire out.
 *
 *  `shift` slides the skyline sideways. Two windows seven metres apart
 *  on the same wall look onto the same street from different points, so
 *  they get the same generator and different offsets rather than two
 *  unrelated views.
 * ------------------------------------------------------------------ */
export function nightView({ w = 512, h = 560, seed = 24, shift = 0, moon = false } = {}) {
  const [c, ctx] = canvas(w, h);
  const rand = rng(seed);
  const HORIZON = h * 0.66;

  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, "#111c33");
  sky.addColorStop(0.42, "#22375c");
  sky.addColorStop(0.74, "#3c5c80");
  sky.addColorStop(0.93, "#7d8aa0");
  sky.addColorStop(1, "#b09a86"); // the last of the sun, just above the roofline
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, HORIZON + 2);

  // Stars only in the top third: any lower and they sit in sky that is still
  // bright enough to drown them, which reads as dirt on the glass.
  for (let i = 0; i < 90; i++) {
    const y = rand() * HORIZON * 0.55;
    const a = (1 - y / (HORIZON * 0.55)) * (0.25 + rand() * 0.6);
    ctx.fillStyle = `rgba(226,236,255,${a.toFixed(3)})`;
    const r = rand() < 0.12 ? 1.5 : 0.9;
    ctx.beginPath();
    ctx.arc(rand() * w, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (moon) {
    const mx = w * 0.72;
    const my = h * 0.16;
    const halo = ctx.createRadialGradient(mx, my, 4, mx, my, 74);
    halo.addColorStop(0, "rgba(233,240,255,0.55)");
    halo.addColorStop(1, "rgba(233,240,255,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(mx, my, 74, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#eef3ff";
    ctx.beginPath();
    ctx.arc(mx, my, 15, 0, Math.PI * 2);
    ctx.fill();
  }

  // A few streaks of cloud, lit from underneath by the city.
  for (let i = 0; i < 7; i++) {
    const y = HORIZON * (0.18 + rand() * 0.66);
    const cw = w * (0.3 + rand() * 0.6);
    const cx = rand() * w;
    const g = ctx.createLinearGradient(cx - cw / 2, 0, cx + cw / 2, 0);
    g.addColorStop(0, "rgba(150,168,196,0)");
    g.addColorStop(0.5, `rgba(150,168,196,${(0.06 + rand() * 0.12).toFixed(3)})`);
    g.addColorStop(1, "rgba(150,168,196,0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - cw / 2, y, cw, 6 + rand() * 14);
  }

  /* The roofline. Amsterdam, because that is where the desk this was built
     at is: stepped and bell gables rather than flat parapets. */
  const ROOF = "#0b1019";
  const gable = (x, bw, top) => {
    ctx.fillStyle = ROOF;
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(x, top + 30);
    const style = rand();
    if (style < 0.42) {
      // stepped
      const steps = 3 + Math.floor(rand() * 2);
      for (let s = 0; s < steps; s++) {
        const sx = x + (bw / 2) * ((s + 1) / steps) * 0.82;
        const sy = top + 30 - ((top + 30 - top) * 0 + 30 * (s + 1)) / steps;
        ctx.lineTo(sx - bw * 0.06, sy);
        ctx.lineTo(sx, sy);
      }
      ctx.lineTo(x + bw / 2, top);
      ctx.lineTo(x + bw / 2, top);
      for (let s = steps - 1; s >= 0; s--) {
        const sx = x + bw - (bw / 2) * ((s + 1) / steps) * 0.82;
        const sy = top + 30 - (30 * (s + 1)) / steps;
        ctx.lineTo(sx, sy);
        ctx.lineTo(sx + bw * 0.06, sy);
      }
    } else if (style < 0.75) {
      // bell
      ctx.bezierCurveTo(x, top + 4, x + bw * 0.34, top, x + bw / 2, top);
      ctx.bezierCurveTo(x + bw * 0.66, top, x + bw, top + 4, x + bw, top + 30);
    } else {
      // plain pitched
      ctx.lineTo(x + bw / 2, top);
      ctx.lineTo(x + bw, top + 30);
    }
    ctx.lineTo(x + bw, h);
    ctx.closePath();
    ctx.fill();

    // Lit windows across the street. Warm, and only a few: a facade where
    // every window is on reads as an office block.
    const cols = Math.max(2, Math.round(bw / 34));
    for (let r = 0; r < 4; r++) {
      for (let k = 0; k < cols; k++) {
        if (rand() > 0.3) continue;
        const wx = x + bw * ((k + 0.5) / cols) - 6;
        const wy = top + 56 + r * 40;
        if (wy > h - 16) continue;
        ctx.fillStyle = rand() < 0.22 ? "rgba(150,196,236,0.72)" : "rgba(255,196,110,0.82)";
        ctx.fillRect(wx, wy, 12, 20);
      }
    }
  };

  let x = -60 + ((shift % 90) + 90) % 90;
  while (x < w + 40) {
    const bw = 44 + rand() * 62;
    gable(x, bw, HORIZON - 34 - rand() * 78);
    x += bw + 2 + rand() * 5;
  }

  // Sodium haze rising off the street, which is what actually sells a city
  // at night — the silhouette alone reads as a cut-out.
  const haze = ctx.createLinearGradient(0, h, 0, h * 0.72);
  haze.addColorStop(0, "rgba(255,168,92,0.26)");
  haze.addColorStop(1, "rgba(255,168,92,0)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, h * 0.72, w, h * 0.28);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ *
 *  Rain
 *
 *  Two things make rain read, and they are not the same thing. The
 *  falling streaks give it movement; the water sitting on the glass
 *  gives it the cosiness, because that is the part that says you are on
 *  the dry side of the window. The streaks are a scrolling sheet, the
 *  water is a normal map on the pane.
 * ------------------------------------------------------------------ */

/**
 * A tileable sheet of falling rain, white on transparent.
 *
 * The slant is baked in rather than applied by scrolling the texture
 * diagonally: scrolling diagonally moves the whole sheet sideways as well as
 * down, and after a few seconds the seam between tiles walks into view.
 */
export function rainSheet({ w = 256, h = 512, seed = 305, drops = 150, slant = 0.14, len = 0.11 } = {}) {
  const [c, ctx] = canvas(w, h);
  const rand = rng(seed);
  ctx.lineCap = "round";
  for (let i = 0; i < drops; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const L = h * len * (0.5 + rand());
    const a = 0.18 + rand() * 0.5;
    ctx.strokeStyle = `rgba(214,230,255,${a.toFixed(3)})`;
    ctx.lineWidth = 0.7 + rand() * 1.1;
    // Drawn three times, offset by exactly one tile height each way, so a
    // streak crossing the seam is continuous when the sheet wraps.
    for (const dy of [-h, 0, h]) {
      ctx.beginPath();
      ctx.moveTo(x, y + dy);
      ctx.lineTo(x + L * slant, y + dy + L);
      ctx.stroke();
    }
  }
  return toTexture(c);
}

/**
 * Water on the glass, as a normal map: scattered beads, and a few runnels
 * where enough of them have joined up to run.
 */
export function wetGlass({ size = 512, seed = 311 } = {}) {
  const [c, ctx] = canvas(size);
  const rand = rng(seed);
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, size, size);

  const bead = (x, y, r) => {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.55, "rgba(180,180,180,0.5)");
    g.addColorStop(1, "rgba(30,30,30,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  for (let i = 0; i < 520; i++) bead(rand() * size, rand() * size, 1.5 + rand() * 5);

  // Runnels. A bead only starts running once it is heavy enough, so these are
  // few and they wander — a straight vertical line reads as a scratch.
  for (let i = 0; i < 9; i++) {
    let x = rand() * size;
    let y = rand() * size * 0.5;
    const r = 2.2 + rand() * 2.4;
    const fall = size * (0.3 + rand() * 0.6);
    for (let s = 0; s < fall; s += r * 0.75) {
      x += (rand() - 0.5) * 1.6;
      bead(x, y + s, r * (0.75 + rand() * 0.5));
    }
    // the fat drop at the bottom of the run
    bead(x, y + fall, r * 1.9);
  }

  // normalFrom hands back a canvas, not a texture.
  return toTexture(normalFrom(c, 1.6), { repeat: [1, 1] });
}

/* ------------------------------------------------------------------ *
 *  Painted shell
 *
 *  For the players. RobotExpressive ships with no maps at all and no UVs
 *  to put any on — four flat colours at roughness 0.9, which is a matte
 *  chalk that takes light the same way from every direction. In a room
 *  where the table, the floor and the wall all carry 2K scans, they were
 *  the only things in frame with no surface on them, and it showed.
 *
 *  Kept near-white: this multiplies into each player's own colour, so
 *  one texture serves all four and the accent still comes from the
 *  material. What it adds is the orange peel of sprayed paint, the
 *  brushed pass under it, and the specks and scuffs that stop a
 *  highlight being a clean oval.
 * ------------------------------------------------------------------ */
export function paintedShell({ size = 512, seed = 401, repeat = [4, 4] } = {}) {
  const [c, ctx] = canvas(size);
  const rand = rng(seed);

  ctx.fillStyle = "#ececec";
  ctx.fillRect(0, 0, size, size);

  // Large-scale patina first. The first version of this had only fine grain,
  // which at the distance the players are actually seen from averaged out to a
  // flat field — the texture was there and invisible, which is the worst of
  // both. Big soft variation is what reads at arm's length.
  for (let i = 0; i < 26; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = size * (0.12 + rand() * 0.22);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const up = rand() < 0.45;
    g.addColorStop(0, `rgba(${up ? 255 : 74},${up ? 255 : 74},${up ? 250 : 78},0.1)`);
    g.addColorStop(1, "rgba(128,128,128,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Orange peel: overlapping soft blobs at two scales. Sprayed paint is not
  // smooth, and the unevenness is what breaks a specular into something that
  // looks like a surface rather than a lens flare.
  for (const [count, r, a] of [[900, 11, 0.05], [2600, 4.5, 0.045]]) {
    for (let i = 0; i < count; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const up = rand() < 0.5;
      g.addColorStop(0, `rgba(${up ? 255 : 90},${up ? 255 : 90},${up ? 255 : 90},${a})`);
      g.addColorStop(1, "rgba(128,128,128,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  // A brushed pass, faint and horizontal. Wraps, so it tiles.
  for (let i = 0; i < 420; i++) {
    const y = rand() * size;
    ctx.strokeStyle = `rgba(${rand() < 0.5 ? 255 : 96},${rand() < 0.5 ? 255 : 96},200,${(0.02 + rand() * 0.04).toFixed(3)})`;
    ctx.lineWidth = 0.6 + rand() * 1.4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.33, y + (rand() - 0.5) * 3, size * 0.66, y + (rand() - 0.5) * 3, size, y);
    ctx.stroke();
  }

  // Scuffs, on the scale of a thing that has been carried about.
  for (let i = 0; i < 60; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 4 + rand() * 26;
    const a = rand() * Math.PI * 2;
    ctx.strokeStyle = `rgba(255,255,255,${(0.05 + rand() * 0.16).toFixed(3)})`;
    ctx.lineWidth = 0.7 + rand();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }

  speckle(ctx, size, 2200, rand, 0.05, false);

  return {
    map: toTexture(c, { repeat, srgb: true }),
    normalMap: toTexture(normalFrom(c, 1.15), { repeat }),
    // A narrow band: this is one finish, not two materials. Wide roughness
    // variation on a single painted shell reads as dirt, not as paint.
    roughnessMap: toTexture(roughnessFrom(c, 0.3, 0.52), { repeat }),
  };
}
