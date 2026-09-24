import { test } from "node:test";
import assert from "node:assert/strict";
import { validateDialogue, validateProfile } from "../../js/content/validate.js";
import { profile } from "../../js/content/profile.js";

const tinyProfile = {
  name: "N", title: "T", email: "e", resumePdf: "r", summary: "s",
  projects: [{ id: "a", name: "A", kind: "k", status: "s", summary: "x" }],
};
const tiny = () => ({
  start: "root",
  nodes: {
    root: { answer: [{ p: "hi" }], again: [{ p: "again" }], next: ["x", "y"] },
    x: { question: "X?", answer: [{ project: "a" }], next: ["y"] },
    y: { question: "Y?", answer: [{ open: "resume", label: "Open" }, { list: ["one"] }], next: ["x"] },
  },
});

test("a well-formed tree has no errors", () => {
  assert.deepEqual(validateDialogue(tiny(), tinyProfile), []);
});

test("catches a next id that does not exist", () => {
  const d = tiny();
  d.nodes.x.next = ["nope"];
  assert.ok(validateDialogue(d, tinyProfile).some((e) => e.includes('"nope" does not exist')));
});

test("catches an unreachable node", () => {
  const d = tiny();
  d.nodes.z = { question: "Z?", answer: [{ p: "z" }], next: ["x"] };
  assert.ok(validateDialogue(d, tinyProfile).some((e) => e.startsWith("z: unreachable")));
});

test("catches an unknown project and an unknown window", () => {
  const d = tiny();
  d.nodes.x.answer = [{ project: "ghost" }];
  d.nodes.y.answer = [{ open: "terminal", label: "Open" }];
  const errors = validateDialogue(d, tinyProfile);
  assert.ok(errors.some((e) => e.includes('unknown project "ghost"')));
  assert.ok(errors.some((e) => e.includes('unknown window "terminal"')));
});

test("catches more than four next questions, and a start with fewer than two", () => {
  const d = tiny();
  d.nodes.x.next = ["y", "y", "y", "y", "y"];
  d.nodes.root.next = ["x"];
  const errors = validateDialogue(d, tinyProfile);
  assert.ok(errors.some((e) => e.startsWith("x: needs 1–4")));
  assert.ok(errors.some((e) => e.startsWith("root: needs 2–4")));
});

test("catches duplicate questions and a next that points back at the start", () => {
  const d = tiny();
  d.nodes.y.question = "X?";
  d.nodes.y.next = ["root"];
  const errors = validateDialogue(d, tinyProfile);
  assert.ok(errors.some((e) => e.includes("duplicates")));
  assert.ok(errors.some((e) => e.includes("must not point at the start")));
});

test("catches a block with two kinds and a start without an again answer", () => {
  const d = tiny();
  d.nodes.x.answer = [{ p: "a", list: ["b"] }];
  delete d.nodes.root.again;
  const errors = validateDialogue(d, tinyProfile);
  assert.ok(errors.some((e) => e.includes("exactly one of")));
  assert.ok(errors.some((e) => e.includes('"again"')));
});

test("catches an empty or whitespace-only paragraph", () => {
  const d = tiny();
  d.nodes.root.answer = [{ p: "   " }];
  assert.ok(validateDialogue(d, tinyProfile).some((e) => e.includes("p is empty")));
});

test("catches an empty list item", () => {
  const d = tiny();
  d.nodes.y.answer = [{ list: ["fine", "  "] }];
  assert.ok(validateDialogue(d, tinyProfile).some((e) => e.includes("item 1 is empty")));
});

test("catches a paragraph link whose scheme is not https: or mailto:", () => {
  const d = tiny();
  d.nodes.root.answer = [{ p: "See [this](javascript:alert(1))" }];
  const errors = validateDialogue(d, tinyProfile);
  assert.ok(errors.some((e) => e.includes('must be https: or mailto:')));
});

test("catches a list item link whose scheme is not https: or mailto:", () => {
  const d = tiny();
  d.nodes.y.answer = [{ list: ["See [this](ftp://example.com/file)"] }];
  const errors = validateDialogue(d, tinyProfile);
  assert.ok(errors.some((e) => e.includes('must be https: or mailto:')));
});

test("allows https: and mailto: links in a paragraph and a list item", () => {
  const d = tiny();
  d.nodes.root.answer = [{ p: "Email [me](mailto:x@y.com) or visit [site](https://example.com)" }];
  d.nodes.y.answer = [{ list: ["A [link](https://example.com)"] }];
  assert.deepEqual(validateDialogue(d, tinyProfile), []);
});

test("validateProfile catches a project with neither a story nor a summary", () => {
  const p = structuredClone(tinyProfile);
  p.projects.push({ id: "b", name: "B", kind: "k", status: "s" });
  assert.ok(validateProfile(p).some((e) => e.startsWith("b: needs")));
});

test("the real profile is valid", () => {
  assert.deepEqual(validateProfile(profile), []);
});
