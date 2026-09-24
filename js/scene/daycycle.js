// Day → sunset → night. Each phase is a set of light values and a painted sky;
// a transition interpolates every value from one phase to the next, so the sun
// is seen going down rather than the room cutting to a new state.

import * as THREE from "three";

export const PHASES = ["day", "sunset", "night"];

// Local time → phase. The same hours Horn.os uses for its dark theme.
export function phaseFor(date) {
  const h = date.getHours();
  if (h >= 7 && h < 18) return "day";
  if (h >= 18 && h < 21) return "sunset";
  return "night";
}

const C = (hex) => new THREE.Color(hex);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Light values per phase. `sun` doubles as the moon at night: cool, faint,
// still shadowed, so the window frame still lands on the floor.
export const PRESETS = {
  day: {
    sunColor: C(0xfff0d8), sunI: 4.2, sunPos: V(-7.8, 4.6, 1.4),
    hemiSky: C(0xdfe9f5), hemiGround: C(0xb89c7c), hemiI: 0.5,
    env: 0.32, skyLightColor: C(0xe4eefc), skyLightI: 3.2,
    lampI: 0, glowI: 0.35, fillI: 0, dust: 0.55, exposure: 1.0,
    bulb: 0,
    skyTop: C(0x4f8fd6), skyHorizon: C(0xd6e4ee), sunDisc: C(0xfff4de), sunSize: 1,
    stars: 0, night: 0, cityAmbient: C(0x9aa6b4), cloudColor: C(0xffffff), cloudOpacity: 0.9,
  },
  sunset: {
    sunColor: C(0xff8a4c), sunI: 3.6, sunPos: V(-8.0, 1.5, 3.0),
    hemiSky: C(0xf2b894), hemiGround: C(0x6a4a3a), hemiI: 0.32,
    env: 0.18, skyLightColor: C(0xffb07e), skyLightI: 1.8,
    lampI: 1.1, glowI: 0.7, fillI: 0.25, dust: 0.7, exposure: 1.0,
    bulb: 1,
    skyTop: C(0x3b4c86), skyHorizon: C(0xf6a56a), sunDisc: C(0xffb870), sunSize: 2.4,
    stars: 0.15, night: 0.45, cityAmbient: C(0x8a6a74), cloudColor: C(0xffa98a), cloudOpacity: 0.85,
  },
  night: {
    sunColor: C(0x8fa6e8), sunI: 0.45, sunPos: V(-7.0, 5.5, -1.5),
    hemiSky: C(0x2a3550), hemiGround: C(0x16110d), hemiI: 0.12,
    env: 0.05, skyLightColor: C(0x5b6fa8), skyLightI: 0.35,
    lampI: 1.8, glowI: 0.6, fillI: 0.8, dust: 0, exposure: 1.15,
    bulb: 1,
    skyTop: C(0x050918), skyHorizon: C(0x1c2748), sunDisc: C(0xc8d4ff), sunSize: 0.8,
    stars: 1, night: 1, cityAmbient: C(0x1a2030), cloudColor: C(0x3a4466), cloudOpacity: 0.35,
  },
};

export function mixPreset(a, b, w) {
  const out = {};
  for (const k of Object.keys(a)) {
    const va = a[k];
    const vb = b[k];
    if (va instanceof THREE.Color) out[k] = va.clone().lerp(vb, w);
    else if (va instanceof THREE.Vector3) out[k] = va.clone().lerp(vb, w);
    else out[k] = va + (vb - va) * w;
  }
  return out;
}
