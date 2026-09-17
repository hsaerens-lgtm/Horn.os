// Procedural textures drawn on canvases — no image assets to license or download.
// Used for the CRT plastic grain and the wall print; room surfaces use photo scans.
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
