// Ambient occlusion on the floor, baked once when the page loads.
//
// The room has needed this since the pendant became a spotlight aimed at the
// table: nothing standing on the floor casts a shadow at all, and furniture
// without a shadow does not sit on the floor, it hovers a centimetre above it.
// The stopgap was twenty-four soft quads, one per item, sized from its bounding
// box — which gets the darkness roughly right and the *shape* of it completely
// wrong. A bookcase is not an ellipse. Neither is a fern.
//
// The real-time answer was tried and rejected: a GTAO pass costs ten times the
// frame at this mesh count, all of it in the second pass it makes over the
// scene. But nothing says the occlusion has to be computed every frame. None of
// this furniture moves — except for the eight seconds after a natural 1, when
// the whole thing is hidden anyway.
//
// So it is baked, at load, by rendering the room from straight above.
//
// How it works
// ------------
// An orthographic camera looks down at the floor, and the scene is drawn into
// it several times with the near and far planes clipped to a slice of height:
// 2 to 22 cm, 22 to 55, and so on. Each pass comes back as a silhouette of
// everything in that slice — real outlines, chair legs and leaves included,
// because they are the actual geometry rasterised by the actual renderer.
//
// Each slice is then blurred by an amount that grows with its height and mixed
// in with a weight that falls with it, which is what occlusion does: the
// contact patch under a table leg is small and almost black, the shadow of the
// table top two feet above is wide and faint. Slicing by height is what makes
// the one blur radius per pass legitimate — everything in a slice is at roughly
// the same height, so it casts at roughly the same softness.
//
// Rendering it instead of ray casting is the whole trick. The GPU rasterises a
// hundred thousand triangles in microseconds; casting rays at them from the CPU
// without a spatial index would take the best part of a minute, and building an
// index means another dependency for something that runs once.

import * as THREE from "three";

// lo/hi are metres above the floor; blur is the radius in metres this slice is
// smeared by; weight is how much of the light it takes away.
//
// The bottom slice starts BELOW the floor, which looks like a mistake and is
// the opposite. Seen from straight above, a vertical surface has no projected
// area at all — a table leg is four vertical faces and two horizontal caps, and
// the only one of those a top-down camera can see is a cap. Its bottom cap sits
// at y = -0.01 because the rounded box bevels below its nominal base, so a
// slice starting at +0.015 clipped it away and the leg cast nothing whatsoever.
// Measured, on a profile across the leg: a smooth ramp from 22 to 53 with no
// peak where the leg is. Starting under the floor catches the underside of
// everything that stands on it, which is exactly the surface that decides how
// dark the contact is. It also means the floor and the rug have to be excluded
// by name rather than by being below the slice.
const SLICES = [
  { lo: -0.05, hi: 0.2, blur: 0.045, weight: 0.86 },
  { lo: 0.2, hi: 0.52, blur: 0.13, weight: 0.52 },
  { lo: 0.52, hi: 1.05, blur: 0.28, weight: 0.3 },
  { lo: 1.05, hi: 2.3, blur: 0.55, weight: 0.15 },
];

/** Three box blurs in a row is a Gaussian to within a few per cent, at O(n). */
function blur(src, w, h, radius) {
  if (radius < 1) return src;
  let a = src;
  let b = new Float32Array(w * h);
  for (let pass = 0; pass < 3; pass++) {
    // horizontal
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let sum = 0;
      for (let x = -radius; x <= radius; x++) sum += a[row + Math.min(w - 1, Math.max(0, x))];
      const inv = 1 / (radius * 2 + 1);
      for (let x = 0; x < w; x++) {
        b[row + x] = sum * inv;
        sum -= a[row + Math.min(w - 1, Math.max(0, x - radius))];
        sum += a[row + Math.min(w - 1, Math.max(0, x + radius + 1))];
      }
    }
    // vertical
    const t = a;
    a = b;
    b = t;
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -radius; y <= radius; y++) sum += a[Math.min(h - 1, Math.max(0, y)) * w + x];
      const inv = 1 / (radius * 2 + 1);
      for (let y = 0; y < h; y++) {
        b[y * w + x] = sum * inv;
        sum -= a[Math.min(h - 1, Math.max(0, y - radius)) * w + x];
        sum += a[Math.min(h - 1, Math.max(0, y + radius + 1)) * w + x];
      }
    }
    const t2 = a;
    a = b;
    b = t2;
  }
  return a;
}

/**
 * Bakes the floor's occlusion and returns a mesh to lay on it, plus how long it
 * took — this runs on the main thread and the number belongs in the open.
 *
 * `exclude` is anything that must not cast: the floor itself, the rug, whatever
 * is already lying flat. Everything vertical is left in on purpose, walls
 * included — the darkening along the foot of a wall is real.
 */
export function bakeFloorOcclusion(
  renderer,
  scene,
  { min = [-5, -2.14], max = [5, 2.5], width = 1024, strength = 0.86, exclude = [] } = {}
) {
  const t0 = performance.now();
  const spanX = max[0] - min[0];
  const spanZ = max[1] - min[1];
  const W = width;
  const H = Math.round((width * spanZ) / spanX);
  const perMetre = W / spanX;
  const cx = (min[0] + max[0]) / 2;
  const cz = (min[1] + max[1]) / 2;
  const TOP = 6;

  const cam = new THREE.OrthographicCamera(-spanX / 2, spanX / 2, spanZ / 2, -spanZ / 2, 0.1, TOP);
  cam.position.set(cx, TOP, cz);
  // Looking straight down, the default up vector is parallel to the view, which
  // is degenerate. World -Z becomes screen up, so a row of the readback runs
  // along X and the rows run along Z.
  cam.up.set(0, 0, -1);
  cam.lookAt(cx, 0, cz);

  const target = new THREE.WebGLRenderTarget(W, H, {
    depthBuffer: true,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
  });

  // Save everything this is about to trample.
  const hidden = [];
  const hide = (o) => {
    if (!o.visible) return;
    o.visible = false;
    hidden.push(o);
  };
  for (const o of exclude) hide(o);
  scene.traverse((o) => {
    // Sprites and points have their own materials and their own geometry rules;
    // an override material on them renders nonsense, and a speech bubble has no
    // business casting a shadow on the floor anyway.
    if (o.isSprite || o.isPoints) hide(o);
  });

  const prevTarget = renderer.getRenderTarget();
  const prevOverride = scene.overrideMaterial;
  const prevClear = new THREE.Color();
  renderer.getClearColor(prevClear);
  const prevAlpha = renderer.getClearAlpha();
  const prevShadow = renderer.shadowMap.enabled;

  // Flat white on black: all this pass is asked is whether anything is there.
  scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  renderer.shadowMap.enabled = false;
  renderer.setClearColor(0x000000, 1);

  const pixels = new Uint8Array(W * H * 4);
  let visibility = new Float32Array(W * H).fill(1);

  for (const slice of SLICES) {
    cam.near = Math.max(0.01, TOP - slice.hi);
    cam.far = TOP - slice.lo;
    cam.updateProjectionMatrix();

    renderer.setRenderTarget(target);
    renderer.clear(true, true, true);
    renderer.render(scene, cam);
    renderer.readRenderTargetPixels(target, 0, 0, W, H, pixels);

    const cover = new Float32Array(W * H);
    for (let i = 0, p = 0; i < cover.length; i++, p += 4) cover[i] = pixels[p] > 8 ? 1 : 0;

    const soft = blur(cover, W, H, Math.round(slice.blur * perMetre));
    // Multiplied, not added. Four slices summed saturate to black under
    // anything with legs; multiplying visibility is what stacking occluders
    // actually does to the light reaching a point.
    for (let i = 0; i < visibility.length; i++) visibility[i] *= 1 - slice.weight * Math.min(1, soft[i]);
  }

  scene.overrideMaterial.dispose();
  scene.overrideMaterial = prevOverride;
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevClear, prevAlpha);
  renderer.shadowMap.enabled = prevShadow;
  for (const o of hidden) o.visible = true;
  target.dispose();

  // Black with the occlusion in the alpha. readRenderTargetPixels hands back
  // rows bottom-up, the way GL stores them, and a canvas is top-down — so the
  // rows go in backwards.
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const img = canvas.getContext("2d").createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const src = (H - 1 - y) * W;
    const dst = y * W;
    for (let x = 0; x < W; x++) {
      const i = (dst + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 0;
      img.data[i + 3] = Math.round(255 * Math.min(1, (1 - visibility[src + x]) * strength));
    }
  }
  canvas.getContext("2d").putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(spanX, spanZ),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(cx, 0.004, cz);
  mesh.renderOrder = -1;

  return { mesh, ms: Math.round(performance.now() - t0), size: [W, H] };
}
