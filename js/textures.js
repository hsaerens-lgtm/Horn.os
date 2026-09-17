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
    g.addColorStop(0, rand() > 0.45 ? "rgba(120,86,40,0.10)" : "rgba(255,246,222,0.14)");
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

/** A square-grid battle map with a rough dungeon floor plan drawn on it. */
export function battleMap({ size = 1024, seed = 33 } = {}) {
  const rand = rng(seed);
  const [c, ctx] = canvas(size);
  ctx.fillStyle = "#2b2a33";
  ctx.fillRect(0, 0, size, size);

  // stone-floored rooms and the corridors between them
  const rooms = [
    [90, 110, 300, 250], [470, 80, 260, 200], [180, 470, 340, 300],
    [600, 420, 320, 260], [430, 330, 120, 140],
  ];
  ctx.fillStyle = "#6f6a60";
  for (const [x, y, w, h] of rooms) ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#5e594f";
  for (const [ax, ay, bx, by, t] of [[390, 210, 470, 210, 46], [330, 360, 330, 470, 44], [550, 280, 550, 420, 42], [520, 560, 600, 560, 44]]) {
    ctx.fillRect(Math.min(ax, bx) - (ax === bx ? t / 2 : 0), Math.min(ay, by) - (ay === by ? t / 2 : 0),
      ax === bx ? t : Math.abs(bx - ax), ay === by ? t : Math.abs(by - ay));
  }

  // flagstone mottling inside the lit areas
  for (let i = 0; i < 5200; i++) {
    const x = rand() * size, y = rand() * size;
    ctx.fillStyle = rand() > 0.5 ? "rgba(255,250,235,0.05)" : "rgba(0,0,0,0.07)";
    ctx.fillRect(x, y, 2 + rand() * 6, 2 + rand() * 6);
  }

  // the grid every DM argues about
  ctx.strokeStyle = "rgba(20,18,16,0.38)";
  ctx.lineWidth = 1.5;
  const step = size / 24;
  for (let i = 0; i <= 24; i++) {
    ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(size, i * step); ctx.stroke();
  }

  // room outlines, drawn in ink over the grid
  ctx.strokeStyle = "rgba(15,13,12,0.75)";
  ctx.lineWidth = 4;
  for (const [x, y, w, h] of rooms) ctx.strokeRect(x, y, w, h);

  return {
    map: toTexture(c, { srgb: true }),
    normalMap: toTexture(normalFrom(c, 0.5)),
    roughnessMap: toTexture(roughnessFrom(c, 0.6, 0.92)),
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
