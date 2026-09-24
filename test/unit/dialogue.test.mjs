import { test } from "node:test";
import assert from "node:assert/strict";
import { validateDialogue } from "../../js/content/validate.js";
import { profile } from "../../js/content/profile.js";
import { dialogue } from "../../js/content/dialogue.js";

test("the real dialogue is a valid, fully reachable tree", () => {
  assert.deepEqual(validateDialogue(dialogue, profile), []);
});

test("the start node offers the four entry topics", () => {
  const labels = dialogue.nodes[dialogue.start].next.map((id) => dialogue.nodes[id].question);
  assert.deepEqual(labels, ["Who is Horn?", "What has he built?", "How does he work with AI agents?", "How can I contact him?"]);
});

test("the assistant speaks about Horn, not as Horn", () => {
  const text = JSON.stringify(dialogue);
  assert.doesNotMatch(text, /\bI (built|am Horn|designed|worked)\b/);
});
