import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceTyping, typeDelay, thinkingDelay } from "../../js/os/typing.js";

const fixed = (v) => () => v;

test("a keystroke advances one to three characters", () => {
  assert.equal(advanceTyping("", "Who is Horn?", fixed(0)), "W");
  assert.equal(advanceTyping("W", "Who is Horn?", fixed(0.5)), "Who");
  assert.equal(advanceTyping("Who", "Who is Horn?", fixed(0.999)), "Who is");
});

test("typing never runs past the question", () => {
  assert.equal(advanceTyping("Who is Horn", "Who is Horn?", fixed(0.999)), "Who is Horn?");
  assert.equal(advanceTyping("Who is Horn?", "Who is Horn?", fixed(0.999)), "Who is Horn?");
});

test("typing restarts when the target changed", () => {
  assert.equal(advanceTyping("Who", "Where is he based?", fixed(0)), "W");
  assert.equal(advanceTyping("Wx", "Where is he based?", fixed(0)), "W");
});

test("delays stay in their ranges", () => {
  assert.equal(typeDelay(fixed(0)), 21);
  assert.equal(typeDelay(fixed(0.999)), 49);
  assert.equal(thinkingDelay(fixed(0)), 600);
  assert.equal(thinkingDelay(fixed(1)), 1000);
});
