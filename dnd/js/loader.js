// The d20 on the loading screen.
//
// A real icosahedron, projected and shaded every frame, rather than a picture
// of one spun about its centre. The difference is the whole point: a flat image
// rotated in 2D reads as a sticker turning, and a CSS `rotateY` on a flat image
// reads as a sticker turning edge-on. Twenty faces coming and going, each
// catching the light differently as it turns, is what reads as a die.
//
// This is deliberately its own script and deliberately not a module of the
// scene. Three.js comes off a CDN and the room takes a moment to build; the die
// has to be turning before any of that arrives, or the loading screen is a line
// of text for the exact stretch it is meant to cover.

const PHI = (1 + Math.sqrt(5)) / 2;

// The twelve vertices, as three golden rectangles at right angles to each other.
const RAW = [
  [0, 1, PHI], [0, -1, PHI], [0, 1, -PHI], [0, -1, -PHI],
  [1, PHI, 0], [-1, PHI, 0], [1, -PHI, 0], [-1, -PHI, 0],
  [PHI, 0, 1], [-PHI, 0, 1], [PHI, 0, -1], [-PHI, 0, -1],
];

// Found rather than typed out. Every edge of this construction is exactly 2
// long, so a face is any three vertices that are all 2 apart — which is quicker
// to verify than a hand-written table of twenty triples is to proofread.
const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const FACES = [];
for (let i = 0; i < 12; i++) {
  for (let j = i + 1; j < 12; j++) {
    if (Math.abs(d2(RAW[i], RAW[j]) - 4) > 1e-6) continue;
    for (let k = j + 1; k < 12; k++) {
      if (Math.abs(d2(RAW[i], RAW[k]) - 4) > 1e-6) continue;
      if (Math.abs(d2(RAW[j], RAW[k]) - 4) > 1e-6) continue;
      FACES.push([i, j, k]);
    }
  }
}

const R = Math.hypot(1, PHI);
const V = RAW.map(([x, y, z]) => [x / R, y / R, z / R]);

const SVG = "http://www.w3.org/2000/svg";

export function spinningD20(host, watch = host) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "-1.25 -1.25 2.5 2.5");
  svg.setAttribute("class", "d20");
  svg.setAttribute("aria-hidden", "true");
  host.appendChild(svg);

  // Elements are made once and mutated. Rebuilding the markup every frame is
  // twenty allocations and a reparse sixty times a second, for a shape that
  // only ever changes its numbers.
  const polys = FACES.map(() => {
    const p = document.createElementNS(SVG, "polygon");
    p.setAttribute("stroke-linejoin", "round");
    p.setAttribute("stroke-width", "0.024");
    svg.appendChild(p);
    return p;
  });
  const label = document.createElementNS(SVG, "text");
  label.setAttribute("text-anchor", "middle");
  label.setAttribute("dominant-baseline", "central");
  label.setAttribute("class", "d20-pip");
  label.textContent = "20";
  svg.appendChild(label);

  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const rotated = V.map(() => [0, 0, 0]);
  let raf = 0;

  const draw = (t) => {
    // Two rates that do not divide into each other, so it tumbles instead of
    // returning to the same pose every turn. Held at a three-quarter view when
    // motion is not wanted, which is the angle a die is always drawn from.
    const a = still ? 0.62 : t * 0.00042;
    const b = still ? 0.5 : t * 0.00071;
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    for (let i = 0; i < V.length; i++) {
      const [x, y, z] = V[i];
      const y1 = y * ca - z * sa;
      const z1 = y * sa + z * ca;
      rotated[i][0] = x * cb + z1 * sb;
      rotated[i][1] = y1;
      rotated[i][2] = -x * sb + z1 * cb;
    }

    let bestFace = -1;
    let bestZ = 0.62; // only carry the number when the face is properly facing us
    let bestCx = 0;
    let bestCy = 0;

    for (let f = 0; f < FACES.length; f++) {
      const [i, j, k] = FACES[f];
      const A = rotated[i], B = rotated[j], C = rotated[k];
      // For a regular solid centred on the origin the face centroid points
      // along the face normal, so this is the normal without a cross product.
      const cx = (A[0] + B[0] + C[0]) / 3;
      const cy = (A[1] + B[1] + C[1]) / 3;
      const cz = (A[2] + B[2] + C[2]) / 3;
      const nz = cz / Math.hypot(cx, cy, cz);

      if (nz <= 0.01) {
        polys[f].setAttribute("points", "");
        continue;
      }
      // Front faces of a convex solid never overlap each other, so culling is
      // all the sorting this needs.
      polys[f].setAttribute(
        "points",
        `${A[0]},${-A[1]} ${B[0]},${-B[1]} ${C[0]},${-C[1]}`
      );
      const shade = 0.34 + nz * 0.66;
      polys[f].setAttribute("fill", `rgb(${Math.round(150 * shade)},${Math.round(58 * shade)},${Math.round(44 * shade)})`);
      polys[f].setAttribute("stroke", `rgba(236,224,200,${(0.18 + nz * 0.5).toFixed(3)})`);

      if (nz > bestZ) {
        bestZ = nz;
        bestFace = f;
        bestCx = cx;
        bestCy = cy;
      }
    }

    if (bestFace >= 0) {
      label.setAttribute("x", bestCx.toFixed(4));
      label.setAttribute("y", (-bestCy).toFixed(4));
      // Fades in as the face turns towards us rather than appearing at once,
      // which would look like the number jumping between faces.
      label.setAttribute("opacity", Math.min(1, (bestZ - 0.62) / 0.22).toFixed(3));
    } else {
      label.setAttribute("opacity", "0");
    }
  };

  const tick = (t) => {
    draw(t);
    // Stops itself when the loader goes: nothing else knows this is running.
    if (watch.classList.contains("hidden")) return;
    raf = requestAnimationFrame(tick);
  };
  draw(0);
  if (!still) raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

const loader = document.getElementById("loader");
if (loader) spinningD20(loader.querySelector(".d20-slot") ?? loader, loader);
