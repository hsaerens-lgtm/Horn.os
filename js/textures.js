// Procedural textures drawn on canvases — no image assets to license or download.
import * as THREE from "three";

// Small deterministic PRNG so the scene looks the same on every load.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvas(size) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return [c, c.getContext("2d")];
}

function finish(c, { repeat = [1, 1], color = true } = {}) {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 8;
  if (color) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function speckle(ctx, size, count, rand, alphaMax, light) {
  for (let i = 0; i < count; i++) {
    const a = rand() * alphaMax;
    ctx.fillStyle = light ? `rgba(255,240,220,${a})` : `rgba(0,0,0,${a})`;
    ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 2, 1 + rand() * 2);
  }
}

/** Warm wood with long grain along X. Returns { map, bumpMap }. */
export function wood({ base = "#6a4527", size = 1024, seed = 7, repeat = [1, 1] } = {}) {
  const rand = rng(seed);
  const [c, ctx] = canvas(size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // grain: many horizontal streaks with slowly varying brightness and a gentle wave
  for (let y = 0; y < size; y += 1) {
    const wave = Math.sin(y * 0.021 + Math.sin(y * 0.0031) * 4) * 0.5 + 0.5;
    const noise = rand();
    const dark = 0.06 + wave * 0.16 + noise * 0.08;
    ctx.fillStyle = `rgba(20,8,0,${dark})`;
    ctx.fillRect(0, y, size, 1);
    if (noise > 0.93) {
      ctx.fillStyle = `rgba(255,200,150,${0.05 + rand() * 0.06})`;
      ctx.fillRect(0, y, size, 1);
    }
  }
  // broken streaks so the grain isn't perfectly continuous
  for (let i = 0; i < 900; i++) {
    const y = rand() * size;
    const x = rand() * size;
    const w = 40 + rand() * 300;
    ctx.fillStyle = `rgba(0,0,0,${0.05 + rand() * 0.12})`;
    ctx.fillRect(x, y, w, 1 + rand() * 1.5);
  }
  // a few knots
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

  const map = finish(c, { repeat });
  const bumpMap = finish(c, { repeat, color: false });
  return { map, bumpMap };
}

/** Dark floorboards. */
export function floorboards({ size = 1024, seed = 11, repeat = [6, 6] } = {}) {
  const rand = rng(seed);
  const [c, ctx] = canvas(size);
  const planks = 5;
  const pw = size / planks;
  for (let p = 0; p < planks; p++) {
    const shade = 22 + rand() * 14;
    ctx.fillStyle = `rgb(${shade + 8},${shade + 2},${shade - 4})`;
    ctx.fillRect(p * pw, 0, pw, size);
    // grain along Y for the floor (planks run away from the camera)
    for (let x = p * pw; x < (p + 1) * pw; x += 1) {
      const a = 0.05 + rand() * 0.18;
      ctx.fillStyle = `rgba(0,0,0,${a})`;
      ctx.fillRect(x, 0, 1, size);
    }
    // plank end joints, staggered
    const joint = rand() * size;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(p * pw, joint, pw, 3);
    // gap between planks
    ctx.fillRect(p * pw, 0, 3, size);
  }
  speckle(ctx, size, 4000, rand, 0.25, false);
  speckle(ctx, size, 1500, rand, 0.05, true);
  const map = finish(c, { repeat });
  const bumpMap = finish(c, { repeat, color: false });
  return { map, bumpMap };
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
    const light = rand() > 0.5;
    g.addColorStop(0, light ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.06)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  speckle(ctx, size, 5000, rand, 0.08, false);
  speckle(ctx, size, 2500, rand, 0.05, true);
  const map = finish(c, { repeat });
  const bumpMap = finish(c, { repeat, color: false });
  return { map, bumpMap };
}

/** Fine grain for plastics — used as a roughness/bump map so the CRT shell isn't dead flat. */
export function plasticGrain({ size = 256, seed = 5, repeat = [3, 3] } = {}) {
  const rand = rng(seed);
  const [c, ctx] = canvas(size);
  ctx.fillStyle = "#9a9a9a";
  ctx.fillRect(0, 0, size, size);
  speckle(ctx, size, 9000, rand, 0.35, false);
  speckle(ctx, size, 9000, rand, 0.35, true);
  return finish(c, { repeat, color: false });
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
    const x = 60 + rand() * 340, y = 60 + rand() * 340;
    ctx.fillRect(x, y, 30 + rand() * 120, 30 + rand() * 120);
  }
  ctx.fillStyle = "#222";
  ctx.font = "bold 28px monospace";
  ctx.fillText("HORN OS", 60, 470);
  return finish(c, { color: true });
}
