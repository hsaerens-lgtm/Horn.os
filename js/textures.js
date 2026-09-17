// Procedural textures drawn on canvases — no image assets to license or download.
// Each generator returns a PBR-ish set: { map, normalMap, roughnessMap }.
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

/** Bundle an albedo canvas into the three maps a MeshStandardMaterial wants. */
function pbr(c, { repeat = [1, 1], normalStrength = 2.2, rough = [0.35, 0.8] } = {}) {
  return {
    map: toTexture(c, { repeat, srgb: true }),
    normalMap: toTexture(normalFrom(c, normalStrength), { repeat }),
    roughnessMap: toTexture(roughnessFrom(c, rough[0], rough[1]), { repeat }),
  };
}

function speckle(ctx, size, count, rand, alphaMax, light) {
  for (let i = 0; i < count; i++) {
    const a = rand() * alphaMax;
    ctx.fillStyle = light ? "rgba(255,240,220," + a + ")" : "rgba(0,0,0," + a + ")";
    ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 2, 1 + rand() * 2);
  }
}

/** Warm wood with long grain along X. */
export function wood({ base = "#6a4527", size = 1024, seed = 7, repeat = [1, 1] } = {}) {
  const rand = rng(seed);
  const [c, ctx] = canvas(size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 1) {
    const wave = Math.sin(y * 0.021 + Math.sin(y * 0.0031) * 4) * 0.5 + 0.5;
    const noise = rand();
    ctx.fillStyle = "rgba(20,8,0," + (0.06 + wave * 0.16 + noise * 0.08) + ")";
    ctx.fillRect(0, y, size, 1);
    if (noise > 0.93) {
      ctx.fillStyle = "rgba(255,200,150," + (0.05 + rand() * 0.06) + ")";
      ctx.fillRect(0, y, size, 1);
    }
  }
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = "rgba(0,0,0," + (0.05 + rand() * 0.12) + ")";
    ctx.fillRect(rand() * size, rand() * size, 40 + rand() * 300, 1 + rand() * 1.5);
  }
  for (let i = 0; i < 3; i++) {
    const x = rand() * size, y = rand() * size, r = 14 + rand() * 18;
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, "rgba(30,12,2,0.75)");
    g.addColorStop(0.5, "rgba(60,30,10,0.35)");
    g.addColorStop(1, "rgba(60,30,10,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.8, r, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  speckle(ctx, size, 6000, rand, 0.12, false);

  // Varnished wood: fairly smooth overall, grain slightly duller than the surface.
  return pbr(c, { repeat, normalStrength: 1.6, rough: [0.38, 0.62] });
}

/** Dark floorboards. */
export function floorboards({ size = 1024, seed = 11, repeat = [6, 6] } = {}) {
  const rand = rng(seed);
  const [c, ctx] = canvas(size);
  const planks = 5;
  const pw = size / planks;
  for (let p = 0; p < planks; p++) {
    const shade = 22 + rand() * 14;
    ctx.fillStyle = "rgb(" + (shade + 8) + "," + (shade + 2) + "," + (shade - 4) + ")";
    ctx.fillRect(p * pw, 0, pw, size);
    for (let x = p * pw; x < (p + 1) * pw; x += 1) {
      ctx.fillStyle = "rgba(0,0,0," + (0.05 + rand() * 0.18) + ")";
      ctx.fillRect(x, 0, 1, size);
    }
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(p * pw, rand() * size, pw, 3);
    ctx.fillRect(p * pw, 0, 3, size);
  }
  speckle(ctx, size, 4000, rand, 0.25, false);
  speckle(ctx, size, 1500, rand, 0.05, true);
  return pbr(c, { repeat, normalStrength: 2.4, rough: [0.55, 0.9] });
}

/** Plaster wall with faint mottling. */
export function plaster({ base = "#242433", size = 512, seed = 3, repeat = [4, 2] } = {}) {
  const rand = rng(seed);
  const [c, ctx] = canvas(size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 300; i++) {
    const x = rand() * size, y = rand() * size, r = 20 + rand() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rand() > 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.06)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  speckle(ctx, size, 5000, rand, 0.08, false);
  speckle(ctx, size, 2500, rand, 0.05, true);
  return pbr(c, { repeat, normalStrength: 1.2, rough: [0.85, 0.98] });
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

/** A framed print for the wall: abstract bars in the OS palette. */
export function poster({ size = 512, seed = 9 } = {}) {
  const rand = rng(seed);
  const [c, ctx] = canvas(size);
  ctx.fillStyle = "#efe9dc";
  ctx.fillRect(0, 0, size, size);
  const cols = ["#008080", "#000080", "#c0c0c0", "#1084d0", "#e8c34a"];
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = cols[i % cols.length];
    ctx.fillRect(60 + rand() * 340, 60 + rand() * 340, 30 + rand() * 120, 30 + rand() * 120);
  }
  ctx.fillStyle = "#222";
  ctx.font = "bold 28px monospace";
  ctx.fillText("HORN OS", 60, 470);
  return toTexture(c, { srgb: true });
}
