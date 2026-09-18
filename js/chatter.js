// What the players say while the session runs.
//
// One bubble at a time, never two. A table where everyone talks at once is
// noise, and the lines are meant to be read — the point of them is the joke,
// and a joke you only half catch is worse than no joke.
//
// The lines themselves live in content.js with everything else that is words.

import * as THREE from "three";
import { speechBubble, BUBBLE } from "./textures.js";

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

  const HEIGHT = width * (BUBBLE.h / BUBBLE.w);

  /**
   * How long one line stays up, from its own length.
   *
   * A flat three and a half seconds was the same time for "Nat 20." and for a
   * two-clause joke with a punchline, which is why the long ones read as too
   * fast: they were. Ordinary prose reads at roughly fifteen characters a
   * second, so this allows about half that and adds a beat at the front for
   * noticing the bubble at all and a beat at the end for the joke to land.
   */
  const showFor = (text) => Math.min(8000, 1900 + String(text).length * 85);
  // Quiet between one bubble clearing and the next opening. Scheduling from the
  // trigger the way this used to means a long line leaves no gap at all.
  const GAP_MIN = 1400;
  const GAP_MAX = 3200;

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
    current = { speaker, t0: now, show: showFor(text) };
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

      const k = (now - current.t0) / current.show;
      if (k >= 1) {
        sprite.visible = false;
        current = null;
        nextAt = now + GAP_MIN + Math.random() * (GAP_MAX - GAP_MIN);
        return;
      }

      // In quickly, out over the last eighth, and still for everything in
      // between — which is the part you actually read. Both ramps are fractions
      // of the hold, so a long line is not also a slow fade.
      const fade = k < 0.1 ? EASE(k / 0.1) : k > 0.87 ? 1 - EASE((k - 0.87) / 0.13) : 1;
      sprite.material.opacity = fade;

      current.speaker.mount.getWorldPosition(anchor);
      sprite.position.set(anchor.x, anchor.y + 0.3 + fade * 0.035, anchor.z);
      sprite.scale.set(width * (0.9 + fade * 0.1), HEIGHT * (0.9 + fade * 0.1), 1);
    },
  };
}
