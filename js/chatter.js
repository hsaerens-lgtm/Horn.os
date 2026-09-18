// What the players say while the session runs.
//
// One bubble at a time, never two. A table where everyone talks at once is
// noise, and the lines are meant to be read — the point of them is the joke,
// and a joke you only half catch is worse than no joke.
//
// The lines themselves live in content.js with everything else that is words.

import * as THREE from "three";
import { speechBubble } from "./textures.js";

const EASE = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// A metre across, which is wider than the player saying it. That is how comics
// have always done it, and it is the only size at which the joke is readable
// from the wide shot — at 0.78 m the text lands at seven pixels on screen.
export function createChatter(scene, speakers, { width = 1.02 } = {}) {
  // `speakers` fills in as the players arrive, and the robot bodies load
  // asynchronously — so the eligible list is read at each turn rather than
  // captured here, where it would still be empty.
  const eligible = () => speakers.filter((s) => s.agent.lines?.length);

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false, opacity: 0 })
  );
  sprite.renderOrder = 998;
  sprite.visible = false;
  scene.add(sprite);

  const HEIGHT = width * (260 / 640);
  const SHOW = 5200; // long enough to read twice if you are slow
  const GAP_MIN = 5000;
  const GAP_MAX = 9500;

  let current = null;
  let nextAt = performance.now() + 3500; // let the room settle before anyone speaks
  let lastSpeaker = -1;
  const anchor = new THREE.Vector3();

  const pick = (pool) => {
    // Never the same player twice running, so the eye moves around the table.
    let i = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && i === lastSpeaker) i = (i + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length;
    lastSpeaker = i;
    const s = pool[i];
    const lines = s.agent.lines;
    // Walk each speaker's lines rather than picking at random: with five lines,
    // random repeats itself often enough to notice.
    s.next = ((s.next ?? Math.floor(Math.random() * lines.length)) + 1) % lines.length;
    return { speaker: s, text: lines[s.next] };
  };

  const speak = (now, pool) => {
    const { speaker, text } = pick(pool);
    const map = speechBubble(text, speaker.agent.name, speaker.agent.colour);
    sprite.material.map?.dispose();
    sprite.material.map = map;
    sprite.material.needsUpdate = true;
    sprite.visible = true;
    current = { speaker, t0: now };
  };

  return {
    /**
     * `quiet` is true whenever a bubble would be in the way. In practice that is
     * everywhere except the wide shot: table talk belongs to the table, and any
     * of the close views has something of its own to read.
     */
    update(now, quiet) {
      if (quiet) {
        sprite.visible = false;
        current = null;
        nextAt = Math.max(nextAt, now + 2500);
        return;
      }

      if (!current) {
        if (now < nextAt) return;
        const pool = eligible();
        if (!pool.length) return;
        speak(now, pool);
      }

      const k = (now - current.t0) / SHOW;
      if (k >= 1) {
        sprite.visible = false;
        current = null;
        nextAt = now + GAP_MIN + Math.random() * (GAP_MAX - GAP_MIN);
        return;
      }

      // in over the first fifth, out over the last quarter, still in between
      const fade = k < 0.2 ? EASE(k / 0.2) : k > 0.76 ? 1 - EASE((k - 0.76) / 0.24) : 1;
      sprite.material.opacity = fade;

      current.speaker.mount.getWorldPosition(anchor);
      sprite.position.set(anchor.x, anchor.y + 0.3 + fade * 0.035, anchor.z);
      sprite.scale.set(width * (0.9 + fade * 0.1), HEIGHT * (0.9 + fade * 0.1), 1);
    },
  };
}
