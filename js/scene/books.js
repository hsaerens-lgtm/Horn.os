// Books with real spines: hardbacks, paperbacks, cloth-bound and art books,
// standing, leaning and stacked, each with its own spine design and title.
//
// All the spines are painted into one atlas and each shelf's books are baked
// into a single mesh, so a full bookcase is a handful of draw calls.

import * as THREE from "three";
import { mergeParts } from "../lib/merge.js";

const COLS = 16;
const ROWS = 8;
const CELL_W = 128;
const CELL_H = 256;
const PAGES = COLS * ROWS - 1; // the last cell holds the page edges

const TITLES = [
  "Designing Data-Intensive Applications", "The Pragmatic Programmer", "Clean Architecture", "Thinking, Fast and Slow",
  "Sapiens", "Dune", "The Design of Everyday Things", "Deep Learning", "AI Engineering", "Refactoring", "Atomic Habits",
  "Le Petit Prince", "L'Étranger", "Hands-On Machine Learning", "The Mythical Man-Month", "Code", "Gödel, Escher, Bach",
  "Neuromancer", "Foundation", "Zero to One", "The Lean Startup", "Designing ML Systems", "Bauhaus", "Le Corbusier",
  "Towards a New Architecture", "The Art of Game Design", "Houseplants", "Monstera", "Kinfolk", "Tokyo", "Amsterdam",
  "Staff Engineer", "Team Topologies", "Accelerate", "Working in Public", "The Phoenix Project", "Domain-Driven Design",
  "Structure and Interpretation", "Grenoble", "Les Misérables", "Madame Bovary", "Le Seigneur des Anneaux", "Astérix",
  "Tintin", "Blacksad", "Prompt Engineering", "Build a Large Language Model", "Superintelligence", "Life 3.0",
  "The Alignment Problem", "Human Compatible", "Shape Up", "Inspired", "Continuous Discovery", "Sprint", "Hooked",
];

const PALETTE = [
  ["#1f3b57", "#e8d9b0"], ["#6b1f1f", "#e8d0a0"], ["#2f4f3a", "#efe6cf"], ["#c9962b", "#1f1f1f"], ["#ece6d8", "#2a2a2a"],
  ["#2b2b2d", "#d9c089"], ["#1f5e63", "#f1ead8"], ["#b4552d", "#f6eee0"], ["#d8cbb0", "#3a2f24"], ["#4f5d6b", "#f0ebe0"],
  ["#d9b44a", "#2a2419"], ["#c98f8f", "#2e2020"], ["#f5f2ea", "#b3462d"], ["#394a2c", "#e9d9a8"], ["#7d3c5a", "#f3e7ef"],
  ["#223a70", "#f2c14e"], ["#e24a2f", "#ffffff"], ["#0f0f10", "#ffffff"], ["#6d8a9c", "#15212a"], ["#a7b59a", "#2c3526"],
];

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
}

// Paint every spine design into the atlas.
function atlas() {
  const c = document.createElement("canvas");
  c.width = COLS * CELL_W;
  c.height = ROWS * CELL_H;
  const g = c.getContext("2d");
  const r = seeded(42);
  for (let i = 0; i < COLS * ROWS; i++) {
    const x0 = (i % COLS) * CELL_W;
    const y0 = Math.floor(i / COLS) * CELL_H;
    if (i === PAGES) {
      g.fillStyle = "#efe7d4";
      g.fillRect(x0, y0, CELL_W, CELL_H);
      for (let y = 0; y < CELL_H; y += 2) {
        g.fillStyle = `rgba(120,100,70,${0.05 + r() * 0.08})`;
        g.fillRect(x0, y0 + y, CELL_W, 1);
      }
      continue;
    }
    const [bg, fg] = PALETTE[Math.floor(r() * PALETTE.length)];
    const style = Math.floor(r() * 5);
    g.fillStyle = bg;
    g.fillRect(x0, y0, CELL_W, CELL_H);
    // cloth weave / paper grain
    for (let k = 0; k < 500; k++) {
      g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
      g.fillRect(x0 + r() * CELL_W, y0 + r() * CELL_H, 1 + r() * 3, 1);
    }
    g.fillStyle = fg;
    g.strokeStyle = fg;
    const band = (y, h) => g.fillRect(x0 + 10, y0 + y, CELL_W - 20, h);
    if (style === 0) {
      band(14, 3);
      band(20, 1.5);
      band(CELL_H - 22, 1.5);
      band(CELL_H - 17, 3);
    } else if (style === 1) {
      g.globalAlpha = 0.9;
      g.fillRect(x0 + 10, y0 + CELL_H * 0.62, CELL_W - 20, CELL_H * 0.22);
      g.globalAlpha = 1;
    } else if (style === 2) {
      g.beginPath();
      g.arc(x0 + CELL_W / 2, y0 + CELL_H - 22, 10, 0, Math.PI * 2);
      g.fill();
    } else if (style === 3) {
      for (let y = 30; y < CELL_H - 30; y += 46) band(y, 1);
    }
    // the title, running up the spine
    const title = TITLES[Math.floor(r() * TITLES.length)];
    g.save();
    g.translate(x0 + CELL_W / 2, y0 + CELL_H / 2 + (style === 1 ? -20 : 0));
    g.rotate(-Math.PI / 2);
    const serif = r() < 0.5;
    let size = 34;
    g.font = `${r() < 0.5 ? 600 : 400} ${size}px ${serif ? "Georgia, serif" : "Inter, Arial, sans-serif"}`;
    while (g.measureText(title).width > CELL_H * 0.7 && size > 14) {
      size -= 2;
      g.font = g.font.replace(/\d+px/, `${size}px`);
    }
    g.fillStyle = style === 1 ? bg : fg;
    if (style === 1) g.translate(-CELL_H * 0.2 - 20, 0), (g.fillStyle = fg);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(title, 0, 0);
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

let sharedMaterial = null;
function material() {
  if (!sharedMaterial) sharedMaterial = new THREE.MeshStandardMaterial({ map: atlas(), roughness: 0.72 });
  return sharedMaterial;
}

// A box whose +z face is the spine (atlas cell `cell`), with page edges on
// top, bottom and back and the cover colour on the two sides.
function bookGeometry(w, h, d, cell) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  const cu = (cell % COLS) / COLS;
  const cv = 1 - (Math.floor(cell / COLS) + 1) / ROWS;
  const pu = (PAGES % COLS) / COLS;
  const pv = 1 - (Math.floor(PAGES / COLS) + 1) / ROWS;
  const cw = 1 / COLS;
  const ch = 1 / ROWS;
  const inset = 0.08; // leave the cell's edges out of the spine
  for (let face = 0; face < 6; face++) {
    for (let k = 0; k < 4; k++) {
      const i = face * 4 + k;
      const u = uv.getX(i);
      const v = uv.getY(i);
      if (face === 4) uv.setXY(i, cu + cw * (inset + u * (1 - 2 * inset)), cv + ch * (0.02 + v * 0.96));
      else if (face === 0 || face === 1) uv.setXY(i, cu + cw * 0.03, cv + ch * (0.3 + v * 0.4)); // cover colour
      else uv.setXY(i, pu + cw * (0.1 + u * 0.8), pv + ch * (0.1 + v * 0.8));
    }
  }
  return geo;
}

/**
 * Fills one shelf between x0 and x1 (shelf-local), standing on y.
 * `plan` is a list of runs: { kind: "row" | "stack", width?, count?, lean? }.
 */
export function shelfBooks(y, x0, x1, plan, seed = 1) {
  const r = seeded(seed);
  const parts = [];
  let x = x0;
  const pick = () => Math.floor(r() * PAGES);
  const kinds = {
    paperback: () => ({ w: 0.016 + r() * 0.014, h: 0.18 + r() * 0.025, d: 0.12 + r() * 0.015 }),
    hardback: () => ({ w: 0.026 + r() * 0.022, h: 0.225 + r() * 0.04, d: 0.16 + r() * 0.03 }),
    art: () => ({ w: 0.018 + r() * 0.02, h: 0.29 + r() * 0.04, d: 0.23 + r() * 0.03 }),
  };
  for (const run of plan) {
    if (run.kind === "gap") {
      x += run.width;
      continue;
    }
    if (run.kind === "stack") {
      // books lying flat, largest at the bottom, spines to the room
      let yy = y;
      const n = run.count ?? 3;
      let maxW = 0;
      for (let i = 0; i < n; i++) {
        const b = kinds[run.type ?? "art"]();
        const len = b.h * (1 - i * 0.05);
        const g = bookGeometry(b.w, len, b.d * (1 - i * 0.04), pick()).rotateZ(-Math.PI / 2);
        g.translate(x + len / 2 + (r() - 0.5) * 0.01, yy + b.w / 2, 0.14 - b.d / 2 + (r() - 0.5) * 0.01);
        parts.push({ geometry: g });
        yy += b.w;
        maxW = Math.max(maxW, len);
      }
      x += maxW + 0.012;
      continue;
    }
    // a standing row
    const end = Math.min(x1, x + (run.width ?? x1 - x));
    while (x < end - 0.02) {
      const b = kinds[run.type ?? (r() < 0.55 ? "hardback" : "paperback")]();
      if (x + b.w > end) break;
      const g = bookGeometry(b.w, b.h, b.d, pick());
      g.translate(x + b.w / 2, y + b.h / 2, 0.14 - b.d / 2 - r() * 0.012);
      parts.push({ geometry: g });
      x += b.w + 0.0015;
    }
    if (run.lean) {
      // the last book of the run tipped against its neighbours
      const b = kinds.hardback();
      const a = 0.32;
      const g = bookGeometry(b.w, b.h, b.d, pick());
      g.translate(-b.w / 2, b.h / 2, 0).rotateZ(a).translate(x + Math.sin(a) * b.h + b.w, y, 0.14 - b.d / 2);
      parts.push({ geometry: g });
      x += Math.sin(a) * b.h + b.w + 0.01;
    }
  }
  const mesh = new THREE.Mesh(mergeParts(parts), material());
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}
