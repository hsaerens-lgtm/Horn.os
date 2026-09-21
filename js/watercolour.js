// A watercolour pass over the rendered scene.
//
// Four things make a render read as painted rather than photographed: the paper
// shows through, edges carry more pigment than the middle of a wash, colour sits
// in steps rather than a smooth ramp, and nothing is sampled on a perfectly
// straight line. This pass does those four in that order.
//
// The one constraint that shapes the code: the character sheet on the table is a
// CSS3D element showing through a transparent hole punched in the WebGL canvas.
// Every pass therefore has to carry alpha through untouched, or the sheet would
// vanish behind the painting.

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { paperGrain } from "./textures.js";

const WatercolourShader = {
  uniforms: {
    tDiffuse: { value: null },
    tPaper: { value: null },
    uTexel: { value: new THREE.Vector2(1 / 1280, 1 / 800) },
    uPaperScale: { value: new THREE.Vector2(3, 2) },
    // Tamed, all of it. At uBleed 1.45 / uEdge 1.4 / a 0.22 quantise, the pass
    // inked every luminance step in the frame at up to 70% — including the
    // centre dot of every wallpaper motif, which is what the "wall covered in
    // black specks" complaint was, and the grain of every scan. The Sobel now
    // runs through a threshold (uEdgeLo..uEdgeHi) so a 2% texture ripple is
    // left alone and only an actual boundary — a silhouette against the wall,
    // a table edge — gets pigment, and it gets less of it.
    uBleed: { value: 0.5 },
    uEdge: { value: 1.0 },
    uEdgeLo: { value: 0.09 },
    uEdgeHi: { value: 0.42 },
    uStep: { value: 0.0 },
    uGrain: { value: 0.12 },
    uVignette: { value: 0.3 },
    uExposure: { value: 0.88 },
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tPaper;
    uniform vec2 uTexel;
    uniform vec2 uPaperScale;
    uniform float uBleed;
    uniform float uEdge;
    uniform float uEdgeLo;
    uniform float uEdgeHi;
    uniform float uStep;
    uniform float uGrain;
    uniform float uVignette;
    uniform float uExposure;
    varying vec2 vUv;

    float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

    // The scene arrives with highlights well above 1.0. Everything below works in
    // display range, so tone map first — quantising or graining an HDR value
    // produces coloured banding rather than a wash.
    vec3 filmic(vec3 x) {
      x *= uExposure;
      return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
    }

    void main() {
      vec4 paper = texture2D(tPaper, vUv * uPaperScale);

      // 1. Wobble the sampling with the paper's low-frequency noise, so contours
      //    waver the way a loaded brush does instead of following the geometry.
      vec2 wobble = (vec2(paper.r, paper.g) - 0.5) * uTexel * 7.5 * uBleed;
      vec4 raw = texture2D(tDiffuse, vUv + wobble);
      vec4 base = vec4(filmic(raw.rgb), raw.a);

      // The transparent cut-out is where the character sheet shows through.
      // Leave it exactly as it is and stop.
      if (base.a < 0.02) {
        gl_FragColor = base;
        return;
      }

      // 2. A short cross-shaped blur is the wash spreading into the paper.
      vec3 spread = base.rgb;
      spread += filmic(texture2D(tDiffuse, vUv + vec2(uTexel.x * 1.6, 0.0) + wobble).rgb);
      spread += filmic(texture2D(tDiffuse, vUv - vec2(uTexel.x * 1.6, 0.0) + wobble).rgb);
      spread += filmic(texture2D(tDiffuse, vUv + vec2(0.0, uTexel.y * 1.6) + wobble).rgb);
      spread += filmic(texture2D(tDiffuse, vUv - vec2(0.0, uTexel.y * 1.6) + wobble).rgb);
      spread /= 5.0;
      vec3 col = mix(base.rgb, spread, 0.55 * uBleed);

      // 3. Pigment gathers where the wash stops. A Sobel on luminance finds those
      //    boundaries; darkening them is what sells the medium more than anything.
      float l00 = luma(filmic(texture2D(tDiffuse, vUv + vec2(-uTexel.x, -uTexel.y)).rgb));
      float l10 = luma(filmic(texture2D(tDiffuse, vUv + vec2(0.0, -uTexel.y)).rgb));
      float l20 = luma(filmic(texture2D(tDiffuse, vUv + vec2(uTexel.x, -uTexel.y)).rgb));
      float l01 = luma(filmic(texture2D(tDiffuse, vUv + vec2(-uTexel.x, 0.0)).rgb));
      float l21 = luma(filmic(texture2D(tDiffuse, vUv + vec2(uTexel.x, 0.0)).rgb));
      float l02 = luma(filmic(texture2D(tDiffuse, vUv + vec2(-uTexel.x, uTexel.y)).rgb));
      float l12 = luma(filmic(texture2D(tDiffuse, vUv + vec2(0.0, uTexel.y)).rgb));
      float l22 = luma(filmic(texture2D(tDiffuse, vUv + vec2(uTexel.x, uTexel.y)).rgb));
      float gx = (l20 + 2.0 * l21 + l22) - (l00 + 2.0 * l01 + l02);
      float gy = (l02 + 2.0 * l12 + l22) - (l00 + 2.0 * l10 + l20);
      //    Through a threshold: below uEdgeLo is texture and is ignored, above
      //    uEdgeHi is a contour and is fully inked. Between the two the ink
      //    fades in, so a soft shadow edge gets a little and a silhouette a lot.
      float mag = sqrt(gx * gx + gy * gy);
      float edge = smoothstep(uEdgeLo, uEdgeHi, mag);
      col *= 1.0 - edge * 0.42 * uEdge;

      // 4. Quantise, if asked (uStep 0 leaves it off). Full posterisation reads
      //    as cel shading; even the fine ladder that was here showed as blotches
      //    on the wall once the room had a lot of wall in it.
      vec3 stepped = floor(col * 18.0 + 0.5) / 18.0;
      col = mix(col, stepped, uStep);

      // The paper itself: tooth over the whole image, strongest in the mid tones
      // where a real wash is thinnest.
      float tooth = (paper.b - 0.5) * 2.0;
      float midtone = 1.0 - abs(luma(col) - 0.45) * 1.7;
      col *= 1.0 + tooth * uGrain * clamp(midtone, 0.25, 1.0);

      // Pigment is never quite as saturated as a rendered specular, and the
      // lightest areas are simply paper left bare.
      float l = luma(col);
      col = mix(vec3(l), col, 0.94);
      col = mix(col, vec3(min(1.0, l * 1.12)), smoothstep(0.82, 1.0, l) * 0.18);

      // A vignette, which is the cheapest thing that makes a frame look
      // composed: the corners were fighting the table for attention.
      float r = length((vUv - 0.5) * vec2(1.0, 0.8)) * 1.45;
      col *= 1.0 - uVignette * smoothstep(0.55, 1.15, r);

      gl_FragColor = vec4(col, base.a);
    }
  `,
};

/**
 * Wraps a renderer and scene in the watercolour chain.
 * Returns { render, setSize, pass } — call render() in place of renderer.render().
 */
export function createWatercolour(renderer, scene, camera) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());

  // EffectComposer's own target, made explicitly, for one reason: left to
  // itself it allocates `{ type: HalfFloatType }` and nothing else, and
  // `samples` defaults to zero. The renderer's own `antialias: true` only ever
  // applied to the default framebuffer, which a composer bypasses — so from the
  // day this chain was added the scene has been rendering with no antialiasing
  // at all, and the Sobel below has been sharpening the jaggies it produced.
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
    samples: 4,
  });

  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));

  // There is no ambient-occlusion pass here, and that was measured rather than
  // assumed. GTAOPass works and is safe for the alpha cut-out — both its
  // shaders write alpha 1 and its blend multiplies destination alpha by source
  // alpha, so the character sheets still show through — but it costs ten times
  // the frame: 55 fps without, 5 with. Dropping its internal resolution to an
  // eighth changed nothing, which locates the cost in the full second pass it
  // makes over the scene to collect depth and normals. This room is 553
  // separate meshes; drawing all of them twice is the whole budget.
  //
  // Contact darkening is done in js/room.js instead, with a soft quad under
  // each piece of furniture. It is a much older trick and it costs one textured
  // quad each.

  const pass = new ShaderPass(WatercolourShader);
  const paper = paperGrain();
  pass.uniforms.tPaper.value = paper;
  composer.addPass(pass);

  composer.addPass(new OutputPass());

  const setSize = (w, h) => {
    composer.setSize(w, h);
    pass.uniforms.uTexel.value.set(1 / w, 1 / h);
    // Keep the paper at a constant physical size rather than stretching it with
    // the window, so the grain does not change scale when the viewport does.
    pass.uniforms.uPaperScale.value.set(w / 420, h / 420);
  };

  setSize(renderer.domElement.width, renderer.domElement.height);

  // `target` is exposed for the pre-compile at load: a shader's cache key
  // includes the colour space of the target it is compiled against, and the
  // scene is drawn into this one, not the canvas.
  return { render: () => composer.render(), setSize, pass, target };
}
