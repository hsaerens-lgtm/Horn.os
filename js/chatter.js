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
  // One line every four to seven seconds, measured trigger to trigger. The
  // bubble holds for three and a half of those, so at the fastest there is
  // still half a second of quiet between one player and the next.
  const SHOW = 3500;
  const EVERY_MIN = 4000;
  const EVERY_MAX = 7000;

  let current = null;
  let nextAt = performance.now() + 3000; // let the room settle before anyone speaks
  let lastSpeaker = -1;
  const anchor = new THREE.Vector3();

  /**
   * A shuffled bag: draw without replacement, reshuffle when it runs dry.
   *
   * Drawing at random each time is random, but it does not look it — with ten
   * lines it repeats one within the first few draws often enough that the table
   * seems to be stuck. A bag is just as random over any stretch and never says
   * the same thing twice before it has said everything once.
   */
  const draw = (owner, key, n) => {
    let bag = owner[key];
    if (!bag?.length) {
      bag = [...Array(n).keys()];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      owner[key] = bag;
    }
    return bag.pop();
  };

  const pick = (pool) => {
    // Speaker at random, never the same one twice running so the eye moves
    // around the table rather than settling on whoever spoke last.
    let i = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && i === lastSpeaker) i = (i + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length;
    lastSpeaker = i;
    const s = pool[i];
    return { speaker: s, text: s.agent.lines[draw(s, "bag", s.agent.lines.length)] };
  };

  const speak = (now, pool) => {
    const { speaker, text } = pick(pool);
    const map = speechBubble(text, speaker.agent.name, speaker.agent.colour);
    sprite.material.map?.dispose();
    sprite.material.map = map;
    sprite.material.needsUpdate = true;
    sprite.visible = true;
    current = { speaker, t0: now };
    // Scheduled from this trigger, not from when the bubble clears, so the
    // cadence is the one the interval actually names.
    nextAt = now + EVERY_MIN + Math.random() * (EVERY_MAX - EVERY_MIN);
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
        nextAt = Math.max(nextAt, now + 2000);
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
        return;
      }

      // in quickly, out over the last fifth, and still for the two and a half
      // seconds in between — which is the part you actually read
      const fade = k < 0.12 ? EASE(k / 0.12) : k > 0.82 ? 1 - EASE((k - 0.82) / 0.18) : 1;
      sprite.material.opacity = fade;

      current.speaker.mount.getWorldPosition(anchor);
      sprite.position.set(anchor.x, anchor.y + 0.3 + fade * 0.035, anchor.z);
      sprite.scale.set(width * (0.9 + fade * 0.1), HEIGHT * (0.9 + fade * 0.1), 1);
    },
  };
}
