// Books with real spines: cloth and leather hardbacks whose boards overhang
// the page block, glossy paperbacks and tall art books, standing, leaning and
// stacked, each with its own spine design, title and author.
//
// All the spines are painted into one atlas and each shelf's books are baked
// into a single mesh, so a full bookcase is a handful of draw calls.

import * as THREE from "three";
import { mergeParts } from "../lib/merge.js";

const COLS = 16;
const ROWS = 8;
const CELL_W = 128;
const CELL_H = 256;
const PAGE_CELLS = [COLS * ROWS - 1, COLS * ROWS - 2, COLS * ROWS - 3]; // page edges, three shades of age
const SPINES = COLS * ROWS - PAGE_CELLS.length;

const BOOKS = [
  ["Designing Data-Intensive Applications", "Kleppmann"], ["The Pragmatic Programmer", "Hunt · Thomas"], ["Clean Architecture", "Martin"],
  ["Thinking, Fast and Slow", "Kahneman"], ["Sapiens", "Harari"], ["Dune", "Herbert"], ["The Design of Everyday Things", "Norman"],
  ["Deep Learning", "Goodfellow"], ["AI Engineering", "Huyen"], ["Refactoring", "Fowler"], ["Atomic Habits", "Clear"],
  ["Le Petit Prince", "Saint-Exupéry"], ["L'Étranger", "Camus"], ["Hands-On Machine Learning", "Géron"],
  ["The Mythical Man-Month", "Brooks"], ["Code", "Petzold"], ["Gödel, Escher, Bach", "Hofstadter"], ["Neuromancer", "Gibson"],
  ["Foundation", "Asimov"], ["Zero to One", "Thiel"], ["The Lean Startup", "Ries"], ["Designing ML Systems", "Huyen"],
  ["Bauhaus", "Droste"], ["Le Corbusier", "Cohen"], ["Towards a New Architecture", "Le Corbusier"], ["The Art of Game Design", "Schell"],
  ["Houseplants", "Kew"], ["Staff Engineer", "Larson"], ["Team Topologies", "Skelton"], ["Accelerate", "Forsgren"],
  ["The Phoenix Project", "Kim"], ["Domain-Driven Design", "Evans"], ["Les Misérables", "Hugo"], ["Madame Bovary", "Flaubert"],
  ["Le Seigneur des Anneaux", "Tolkien"], ["Astérix", "Goscinny"], ["Tintin", "Hergé"], ["Blacksad", "Canales"],
  ["Superintelligence", "Bostrom"], ["Life 3.0", "Tegmark"], ["The Alignment Problem", "Christian"], ["Human Compatible", "Russell"],
  ["Shape Up", "Singer"], ["Inspired", "Cagan"], ["Continuous Discovery Habits", "Torres"], ["Sprint", "Knapp"], ["Hooked", "Eyal"],
  ["A Pattern Language", "Alexander"], ["Ways of Seeing", "Berger"], ["Grenoble", "Guide"],
];

// [cover, ink, material]; material: cloth, leather, paper (glossy jacket)
const PALETTE = [
  ["#1f3b57", "#e8d9b0", "cloth"], ["#6b1f1f", "#e2c27a", "leather"], ["#2f4f3a", "#e6d49c", "cloth"], ["#c9962b", "#1f1f1f", "paper"],
  ["#ece6d8", "#2a2a2a", "paper"], ["#2b2b2d", "#d9c089", "leather"], ["#1f5e63", "#f1ead8", "cloth"], ["#b4552d", "#f6eee0", "paper"],
  ["#d8cbb0", "#3a2f24", "cloth"], ["#4f5d6b", "#f0ebe0", "cloth"], ["#d9b44a", "#2a2419", "paper"], ["#c98f8f", "#2e2020", "paper"],
  ["#f5f2ea", "#b3462d", "paper"], ["#394a2c", "#e3cf8e", "leather"], ["#7d3c5a", "#f3e7ef", "cloth"], ["#223a70", "#f2c14e", "paper"],
  ["#e24a2f", "#ffffff", "paper"], ["#0f0f10", "#ffffff", "paper"], ["#6d8a9c", "#15212a", "cloth"], ["#a7b59a", "#2c3526", "cloth"],
  ["#5a3a22", "#e8c98a", "leather"], ["#8c1c1c", "#f0d9a0", "cloth"], ["#e9e2cf", "#1d3b5a", "paper"],
];

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
}

function paintSpine(g, x0, y0, r) {
  const W = CELL_W;
  const H = CELL_H;
  const [bg, ink, stuff] = PALETTE[Math.floor(r() * PALETTE.length)];
  g.fillStyle = bg;
  g.fillRect(x0, y0, W, H);
  // the material
  if (stuff === "cloth") {
    for (let y = 0; y < H; y += 2) {
      g.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.04})`;
      g.fillRect(x0, y0 + y, W, 1);
    }
    for (let x = 0; x < W; x += 2) {
      g.fillStyle = `rgba(255,255,255,${0.025 + r() * 0.03})`;
      g.fillRect(x0 + x, y0, 1, H);
    }
  } else if (stuff === "leather") {
    for (let k = 0; k < 260; k++) {
      g.fillStyle = r() < 0.5 ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.05)";
      g.beginPath();
      g.ellipse(x0 + r() * W, y0 + r() * H, 1 + r() * 4, 1 + r() * 3, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    const sheen = g.createLinearGradient(x0, 0, x0 + W, 0);
    sheen.addColorStop(0.3, "rgba(255,255,255,0)");
    sheen.addColorStop(0.45, "rgba(255,255,255,0.12)");
    sheen.addColorStop(0.6, "rgba(255,255,255,0)");
    g.fillStyle = sheen;
    g.fillRect(x0, y0, W, H);
  }
  const [title, author] = BOOKS[Math.floor(r() * BOOKS.length)];
  const style = Math.floor(r() * 5);
  g.fillStyle = ink;
  const band = (y, h) => g.fillRect(x0 + 6, y0 + y, W - 12, h);
  // hardback decoration: gilt rules and raised bands; paperbacks: a publisher mark
  if (stuff === "leather") {
    for (const y of [22, 60, H - 60, H - 22]) {
      g.fillStyle = "rgba(0,0,0,0.35)";
      g.fillRect(x0, y0 + y - 3, W, 6);
      g.fillStyle = ink;
      band(y - 5, 1.5);
      band(y + 4, 1.5);
    }
    // a contrasting title label
    g.fillStyle = r() < 0.5 ? "#1c1a17" : "#7a1e1a";
    g.fillRect(x0 + 10, y0 + 74, W - 20, H - 150);
    g.strokeStyle = ink;
    g.lineWidth = 1.5;
    g.strokeRect(x0 + 14, y0 + 78, W - 28, H - 158);
    g.fillStyle = ink;
  } else if (stuff === "cloth" && style < 3) {
    band(12, 2.5);
    band(18, 1);
    band(H - 19, 1);
    band(H - 14, 2.5);
  } else if (stuff === "paper") {
    if (style === 1) {
      g.globalAlpha = 0.9;
      g.fillRect(x0, y0 + H * 0.66, W, H * 0.2);
      g.globalAlpha = 1;
    }
    g.beginPath();
    g.arc(x0 + W / 2, y0 + H - 18, 8, 0, Math.PI * 2);
    g.fill();
  }
  // title up the spine, author at the foot
  g.save();
  g.translate(x0 + W / 2, y0 + H * 0.46);
  g.rotate(-Math.PI / 2);
  const serif = stuff !== "paper" || r() < 0.4;
  let size = stuff === "leather" ? 26 : 34;
  const weight = r() < 0.5 ? 700 : 500;
  const font = () => `${weight} ${size}px ${serif ? "Georgia, serif" : "Inter, Arial, sans-serif"}`;
  g.font = font();
  const maxW = H * (stuff === "leather" ? 0.5 : 0.62);
  while (g.measureText(title).width > maxW && size > 12) {
    size -= 2;
    g.font = font();
  }
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = ink;
  g.fillText(title, 0, 0);
  g.restore();
  g.save();
  g.translate(x0 + W / 2, y0 + H * 0.84);
  g.rotate(-Math.PI / 2);
  g.font = `500 ${Math.max(11, size * 0.45)}px ${serif ? "Georgia, serif" : "Inter, Arial, sans-serif"}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = ink;
  g.globalAlpha = 0.85;
  g.fillText(author.toUpperCase(), 0, 0);
  g.restore();
  g.globalAlpha = 1;
  // a rounded spine: shade towards both edges; a little wear at head and tail
  const round = g.createLinearGradient(x0, 0, x0 + W, 0);
  round.addColorStop(0, "rgba(0,0,0,0.38)");
  round.addColorStop(0.18, "rgba(0,0,0,0.05)");
  round.addColorStop(0.5, "rgba(255,255,255,0.06)");
  round.addColorStop(0.82, "rgba(0,0,0,0.05)");
  round.addColorStop(1, "rgba(0,0,0,0.38)");
  g.fillStyle = round;
  g.fillRect(x0, y0, W, H);
  for (let k = 0; k < 40; k++) {
    const y = r() < 0.5 ? 8 + r() * 10 : H - 8 - r() * 10;
    g.fillStyle = `rgba(255,255,255,${0.05 + r() * 0.1})`;
    g.fillRect(x0 + r() * W, y0 + y, 1 + r() * 4, 1);
  }
  // a plain swatch of the cover colour in the cell's bottom 6 px: the covers
  // and boards sample it, the spine face never reaches it
  g.fillStyle = bg;
  g.fillRect(x0, y0 + H - 6, W, 6);
}

function paintPages(g, x0, y0, tone, r) {
  g.fillStyle = tone;
  g.fillRect(x0, y0, CELL_W, CELL_H);
  for (let y = 0; y < CELL_H; y += 1.5) {
    g.fillStyle = `rgba(90,70,40,${0.04 + r() * 0.08})`;
    g.fillRect(x0, y0 + y, CELL_W, 0.7);
  }
  const edge = g.createLinearGradient(0, y0, 0, y0 + CELL_H);
  edge.addColorStop(0, "rgba(120,95,60,0.18)");
  edge.addColorStop(0.1, "rgba(0,0,0,0)");
  edge.addColorStop(0.9, "rgba(0,0,0,0)");
  edge.addColorStop(1, "rgba(120,95,60,0.18)");
  g.fillStyle = edge;
  g.fillRect(x0, y0, CELL_W, CELL_H);
}

// Paint every spine design into the atlas.
function atlas() {
  const c = document.createElement("canvas");
  c.width = COLS * CELL_W;
  c.height = ROWS * CELL_H;
  const g = c.getContext("2d");
  const r = seeded(42);
  const tones = ["#f1ead8", "#e9dfc6", "#ddd0b0"];
  for (let i = 0; i < COLS * ROWS; i++) {
    const x0 = (i % COLS) * CELL_W;
    const y0 = Math.floor(i / COLS) * CELL_H;
    const p = PAGE_CELLS.indexOf(i);
    if (p >= 0) paintPages(g, x0, y0, tones[p], r);
    else paintSpine(g, x0, y0, r);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

let sharedMaterial = null;
function material() {
  if (!sharedMaterial) sharedMaterial = new THREE.MeshStandardMaterial({ map: atlas(), roughness: 0.7 });
  return sharedMaterial;
}

// Atlas rectangles and a face-by-face UV remap for BoxGeometry
// (faces: 0 +x, 1 -x, 2 +y, 3 -y, 4 +z = spine, 5 -z).
function cellRect(cell) {
  return { u: (cell % COLS) / COLS, v: 1 - (Math.floor(cell / COLS) + 1) / ROWS, w: 1 / COLS, h: 1 / ROWS };
}
function mapFaces(geo, faceRect) {
  const uv = geo.attributes.uv;
  for (let face = 0; face < 6; face++) {
    const r = faceRect(face);
    for (let k = 0; k < 4; k++) {
      const i = face * 4 + k;
      uv.setXY(i, r.u + r.w * (r.x0 + uv.getX(i) * (r.x1 - r.x0)), r.v + r.h * (r.y0 + uv.getY(i) * (r.y1 - r.y0)));
    }
  }
  return geo;
}

function paperback(w, h, d, spine, pages) {
  const s = cellRect(spine);
  const p = cellRect(pages);
  return [
    mapFaces(new THREE.BoxGeometry(w, h, d), (f) =>
      f === 4 ? { ...s, x0: 0.02, x1: 0.98, y0: 0.035, y1: 0.99 } : f === 0 || f === 1 ? { ...s, x0: 0.3, x1: 0.7, y0: 0.004, y1: 0.018 } : { ...p, x0: 0.05, x1: 0.95, y0: 0.05, y1: 0.95 },
    ),
  ];
}

// A hardback: a page block inset from the boards, two boards and a spine.
function hardback(w, h, d, spine, pages) {
  const s = cellRect(spine);
  const p = cellRect(pages);
  const board = Math.min(0.0028, w * 0.12);
  const over = 0.003; // the boards overhang the pages at head, tail and fore-edge
  const cover = { ...s, x0: 0.3, x1: 0.7, y0: 0.004, y1: 0.018 };
  const parts = [];
  const pg = mapFaces(new THREE.BoxGeometry(w - 2 * board, h - 2 * over, d - over - board), () => ({ ...p, x0: 0.05, x1: 0.95, y0: 0.05, y1: 0.95 }));
  pg.translate(0, 0, (over - board) / 2); // from the fore-edge inset to just behind the spine
  parts.push(pg);
  for (const side of [-1, 1]) {
    const b = mapFaces(new THREE.BoxGeometry(board, h, d - board * 0.6), () => cover);
    b.translate(side * (w / 2 - board / 2), 0, -board * 0.3);
    parts.push(b);
  }
  const sp = mapFaces(new THREE.BoxGeometry(w + 0.0008, h, board), (f) => (f === 4 ? { ...s, x0: 0.0, x1: 1.0, y0: 0.035, y1: 1.0 } : cover));
  sp.translate(0, 0, d / 2 - board / 2);
  parts.push(sp);
  return parts;
}

/**
 * Fills one shelf between x0 and x1 (shelf-local), standing on y, spines at
 * z = front. `plan` is a list of runs: { kind: "row" | "stack" | "gap", type?, width?, count?, lean? }.
 */
export function shelfBooks(y, x0, x1, plan, seed = 1, front = 0.14) {
  const r = seeded(seed);
  const parts = [];
  let x = x0;
  const pickSpine = () => Math.floor(r() * SPINES);
  const pickPages = () => PAGE_CELLS[Math.floor(r() * PAGE_CELLS.length)];
  const kinds = {
    paperback: () => ({ w: 0.016 + r() * 0.014, h: 0.18 + r() * 0.025, d: 0.12 + r() * 0.015, hard: false }),
    hardback: () => ({ w: 0.026 + r() * 0.022, h: 0.225 + r() * 0.04, d: 0.16 + r() * 0.03, hard: true }),
    art: () => ({ w: 0.018 + r() * 0.02, h: 0.29 + r() * 0.04, d: 0.23 + r() * 0.03, hard: true }),
  };
  const book = (b) => (b.hard ? hardback : paperback)(b.w, b.h, b.d, pickSpine(), pickPages());
  const place = (geos, fn) => {
    for (const geo of geos) {
      fn(geo);
      parts.push({ geometry: geo });
    }
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
      let maxL = 0;
      for (let i = 0; i < n; i++) {
        const b = kinds[run.type ?? "art"]();
        b.h *= 1 - i * 0.05;
        b.d *= 1 - i * 0.04;
        const jx = (r() - 0.5) * 0.012;
        const jz = (r() - 0.5) * 0.01;
        place(book(b), (geo) => geo.rotateZ(-Math.PI / 2).translate(x + b.h / 2 + jx, yy + b.w / 2, front - b.d / 2 + jz));
        yy += b.w;
        maxL = Math.max(maxL, b.h);
      }
      x += maxL + 0.012;
      continue;
    }
    // a standing row, spines not quite in line
    const end = Math.min(x1, x + (run.width ?? x1 - x));
    while (x < end - 0.02) {
      const b = kinds[run.type ?? (r() < 0.55 ? "hardback" : "paperback")]();
      if (x + b.w > end) break;
      const back = r() * 0.012;
      place(book(b), (geo) => geo.translate(x + b.w / 2, y + b.h / 2, front - b.d / 2 - back));
      x += b.w + 0.0012;
    }
    if (run.lean) {
      // the last book of the run tipped against its neighbours — if it fits
      const b = kinds.hardback();
      const a = 0.32;
      const bx = x + Math.sin(a) * b.h + b.w;
      if (bx > x1) continue;
      place(book(b), (geo) => geo.translate(-b.w / 2, b.h / 2, 0).rotateZ(a).translate(bx, y, front - b.d / 2));
      x = bx + 0.01;
    }
  }
  const mesh = new THREE.Mesh(mergeParts(parts), material());
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}
