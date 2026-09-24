// Timings for the chat's two illusions: the visitor "typing" a scripted
// question, and the assistant "streaming" its answer. Pure; `rand` is
// injectable so the tests are deterministic.

export const TYPE_MS = 35; // mean delay per character when a chip types itself
export const WORD_MS = 28; // delay per word when an answer streams

export function typeDelay(rand = Math.random) {
  return Math.round(TYPE_MS * (0.6 + 0.8 * rand()));
}

export function thinkingDelay(rand = Math.random) {
  return 600 + Math.round(400 * rand());
}

// One real keystroke writes the next 1–3 characters of the scripted question,
// never the key that was pressed.
export function advanceTyping(typed, target, rand = Math.random) {
  const from = target.startsWith(typed) ? typed.length : 0;
  const step = 1 + Math.floor(3 * rand());
  return target.slice(0, Math.min(target.length, from + step));
}
