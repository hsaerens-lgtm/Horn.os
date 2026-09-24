import { test } from "node:test";
import assert from "node:assert/strict";
import { parseInline, wordTokens } from "../../js/os/inline.js";

test("plain text is one text segment", () => {
  assert.deepEqual(parseInline("hello there"), [{ kind: "text", text: "hello there" }]);
});

test("bold and links split the text", () => {
  assert.deepEqual(parseInline("a **b c** d [e](mailto:x@y.z) f"), [
    { kind: "text", text: "a " },
    { kind: "bold", text: "b c" },
    { kind: "text", text: " d " },
    { kind: "link", text: "e", href: "mailto:x@y.z" },
    { kind: "text", text: " f" },
  ]);
});

test("word tokens rebuild the text exactly and remember their segment", () => {
  const segs = parseInline("One  **two three** four");
  const tokens = wordTokens(segs);
  assert.equal(tokens.map((t) => t.text).join(""), "One  two three four");
  assert.deepEqual(tokens.map((t) => t.seg), [0, 1, 1, 2]);
});
