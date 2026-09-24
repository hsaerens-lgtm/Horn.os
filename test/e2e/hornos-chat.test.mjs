import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, openPage } from "./harness.mjs";
import { dialogue } from "../../js/content/dialogue.js";
import { parseInline } from "../../js/os/inline.js";

// The rendered text of an answer's blocks, the same way chat.js's stream()
// turns them into DOM text: markup stripped, blocks concatenated with no
// separator. Used as the "full length" a partial, mid-stream render must fall
// short of.
function renderedAnswerText(blocks) {
  let out = "";
  for (const block of blocks) {
    if (block.p !== undefined) out += parseInline(block.p).map((s) => s.text).join("");
    else if (block.list) for (const item of block.list) out += parseInline(item).map((s) => s.text).join("");
  }
  return out;
}

let server;
before(async () => {
  server = await startServer(4342);
});
after(() => server.stop());

const CHIP = ".chat-chips .chip:not(.chip-back)";
const chipNamed = (page, label) => page.locator(".chat-chips").getByRole("button", { name: label, exact: true });

test("the assistant greets and offers the four entry questions", async () => {
  const { page, errors, close } = await openPage(server.url);
  try {
    await page.waitForSelector(CHIP, { timeout: 10000 });
    assert.match(await page.textContent(".msg-bot"), /Horn's assistant/);
    assert.equal(await page.locator(".chat-chips .chip").count(), 4);
    assert.deepEqual(errors, []);
  } finally {
    await close();
  }
});

test("clicking a question types it into the field, then sends it", async () => {
  const { page, close } = await openPage(server.url);
  try {
    await page.waitForSelector(CHIP, { timeout: 10000 });
    const label = await page.textContent(CHIP);
    await page.click(CHIP);
    await page.waitForFunction(
      (l) => {
        const v = document.querySelector(".chat-field").value;
        return v.length > 2 && v.length < l.length;
      },
      label,
      { polling: 5, timeout: 3000 },
    );
    assert.ok(label.startsWith(await page.inputValue(".chat-field")), "mid-typing, the field holds a prefix of the question");
    await page.waitForSelector(".msg-user");
    assert.equal(await page.textContent(".msg-user"), label);
    await page.waitForSelector(".chip-back", { timeout: 15000 });
    assert.equal(await page.locator(".msg-bot").count(), 2);
  } finally {
    await close();
  }
});

test("keystrokes type the highlighted question, never the key itself", async () => {
  const { page, close } = await openPage(server.url, { reducedMotion: "reduce" });
  try {
    await page.waitForSelector(CHIP, { timeout: 10000 });
    const first = await page.textContent(".chip.is-hot");
    await page.keyboard.press("z");
    const v = await page.inputValue(".chat-field");
    assert.ok(v.length >= 1 && v.length <= 3 && first.startsWith(v), `"${v}" should start "${first}"`);
    for (let i = 0; i < 40; i++) await page.keyboard.press("q");
    assert.equal(await page.inputValue(".chat-field"), first, "typing stops at the end of the question");

    await page.keyboard.press("ArrowRight");
    assert.equal(await page.inputValue(".chat-field"), "", "moving the highlight clears the field");
    const second = await page.textContent(".chip.is-hot");
    assert.notEqual(second, first);

    await page.keyboard.press("Enter");
    await page.waitForSelector(".msg-user");
    assert.equal(await page.textContent(".msg-user"), second);
  } finally {
    await close();
  }
});

// Fix round 2, finding 1: arrow keys must move real DOM focus along with the
// highlight, not just the `.is-hot` class — otherwise Enter (a native click on
// whichever chip still holds focus) sends the wrong question.
test("arrow keys move focus with the highlight, so Enter sends the highlighted chip", async () => {
  const { page, close } = await openPage(server.url, { reducedMotion: "reduce" });
  try {
    await page.waitForSelector(CHIP, { timeout: 10000 });
    await page.locator(".chat-chips .chip").first().focus();
    await page.keyboard.press("ArrowRight");
    const hot = await page.textContent(".chip.is-hot");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".msg-user");
    assert.equal(await page.textContent(".msg-user"), hot);
  } finally {
    await close();
  }
});

test("Back to topics returns to the entry questions", async () => {
  const { page, close } = await openPage(server.url, { reducedMotion: "reduce" });
  try {
    await page.waitForSelector(CHIP, { timeout: 10000 });
    await page.click(CHIP);
    await page.click(".chip-back");
    await page.waitForFunction(() => document.querySelectorAll(".msg-user").length === 2);
    await page.waitForSelector(CHIP);
    assert.equal(await page.locator(".chip-back").count(), 0);
    assert.equal(await page.locator(".chat-chips .chip").count(), 4);
    assert.match(await page.locator(".msg-bot").last().textContent(), /What would you like to know/);
  } finally {
    await close();
  }
});

test("with reduced motion the answer appears at once", async () => {
  const { page, close } = await openPage(server.url, { reducedMotion: "reduce" });
  try {
    await page.waitForSelector(CHIP, { timeout: 10000 });
    const t0 = Date.now();
    await page.click(CHIP);
    await page.waitForSelector(".chip-back", { timeout: 2000 });
    assert.ok(Date.now() - t0 < 1000, `took ${Date.now() - t0} ms`);
  } finally {
    await close();
  }
});

test("clicking a streaming answer finishes it", async () => {
  const { page, close } = await openPage(server.url);
  try {
    await page.waitForSelector(CHIP, { timeout: 10000 });
    await chipNamed(page, "Who is Horn?").click();
    await page.waitForFunction(() => document.querySelectorAll(".msg-bot").length === 2);
    await page.locator(".msg-bot").last().click({ force: true });
    await page.waitForSelector(".chip-back", { timeout: 800 });
  } finally {
    await close();
  }
});

// Fix round 1, finding 2: closing the chat mid-stream must balance onStream
// (Plan 2 drives the screen light off it) and must not keep streaming into a
// detached message afterwards.
//
// Fix round 2, finding 9: prove the close really did land mid-stream, not
// after the answer happened to finish — compare the streamed text's length
// at close against the full rendered answer (a lower bound the word-by-word
// stream needs several seconds to reach), and confirm the text is frozen
// afterwards, not just the onStream count.
test("closing the chat mid-stream balances onStream and stops the stream", async () => {
  const { page, close } = await openPage(`${server.url}?debug=1`);
  try {
    await page.waitForSelector(CHIP, { timeout: 10000 });
    const nodeId = dialogue.nodes[dialogue.start].next.find((id) => dialogue.nodes[id].question === "Who is Horn?");
    const fullText = renderedAnswerText(dialogue.nodes[nodeId].answer);

    await chipNamed(page, "Who is Horn?").click();
    await page.waitForFunction(() => document.querySelectorAll(".msg-bot").length === 2);
    const atClose = await page.locator(".msg-bot").last().textContent();
    await page.click('.win[data-win="chat"] [data-act="close"]');

    assert.ok(
      atClose.length < fullText.length,
      `expected a partial answer at close (${atClose.length} of ${fullText.length} chars): ${JSON.stringify(atClose)}`,
    );

    const afterClose = await page.evaluate(() => window.__streamLog.slice());
    assert.deepEqual(
      afterClose.slice(-2),
      [true, false],
      `expected the "Who is Horn?" stream's own true/false pair at the end, got ${JSON.stringify(afterClose)}`,
    );
    const textAfterClose = await page.locator(".msg-bot").last().textContent();
    await page.waitForTimeout(1500);
    const later = await page.evaluate(() => window.__streamLog.slice());
    assert.deepEqual(later, afterClose, "no further onStream calls after dispose");
    const textLater = await page.locator(".msg-bot").last().textContent();
    assert.equal(textLater, textAfterClose, "the streamed text must not keep growing after the window closes");
  } finally {
    await close();
  }
});

test("a project card opens the Projects window on that project", async () => {
  const { page, close } = await openPage(server.url, { reducedMotion: "reduce" });
  try {
    await page.waitForSelector(CHIP, { timeout: 10000 });
    await chipNamed(page, "What has he built?").click();
    await page.click('.project-card[data-project="freescout"]');
    await page.locator('.win[data-win="projects"]').waitFor({ state: "visible" });
    assert.equal(await page.textContent(".proj-detail h1"), "FreeScout AI Copilot");
  } finally {
    await close();
  }
});

// Fix round 1, finding 1: Enter on a focused control (a project card here)
// must be that control's own activation, never hijacked into sending the
// currently highlighted chip.
test("Enter on a focused project card opens it, not the highlighted chip", async () => {
  const { page, close } = await openPage(server.url, { reducedMotion: "reduce" });
  try {
    await page.waitForSelector(CHIP, { timeout: 10000 });
    await chipNamed(page, "What has he built?").click();
    const card = page.locator('.project-card[data-project="freescout"]');
    await card.waitFor({ state: "visible" });
    const usersBefore = await page.locator(".msg-user").count();
    await card.focus();
    await page.keyboard.press("Enter");
    await page.locator('.win[data-win="projects"]').waitFor({ state: "visible" });
    assert.equal(await page.textContent(".proj-detail h1"), "FreeScout AI Copilot");
    assert.equal(await page.locator(".msg-user").count(), usersBefore, "no chip was sent");
  } finally {
    await close();
  }
});

// Walks to every node of the real tree and checks the chat renders it: the
// graph test proves the ids line up, this proves every block renders.
test("every node of the tree renders its answer and its questions", { timeout: 300000 }, async () => {
  const parent = { [dialogue.start]: null };
  const queue = [dialogue.start];
  while (queue.length) {
    const id = queue.shift();
    for (const n of dialogue.nodes[id].next) if (!(n in parent)) (parent[n] = id), queue.push(n);
  }
  const pathTo = (id) => (parent[id] === null ? [] : [...pathTo(parent[id]), id]);

  const { page, errors, close } = await openPage(server.url, { reducedMotion: "reduce" });
  try {
    for (const id of Object.keys(dialogue.nodes).filter((n) => n !== dialogue.start)) {
      await page.reload();
      await page.waitForSelector(CHIP, { timeout: 10000 });
      // The old chips stay on screen while a question types itself out; they are
      // cleared in the same tick the visitor's message is added. So wait for the
      // message count first, then for the new chips.
      const path = pathTo(id);
      for (const [k, step] of path.entries()) {
        await chipNamed(page, dialogue.nodes[step].question).click();
        await page.waitForFunction((n) => document.querySelectorAll(".msg-user").length === n, k + 1);
        await page.waitForSelector(".chip-back");
      }
      const answer = await page.locator(".msg-bot").last().textContent();
      assert.ok(answer.trim().length > 20, `${id}: answer rendered`);
      assert.equal(await page.locator(".chat-chips .chip").count(), dialogue.nodes[id].next.length + 1, `${id}: chips`);
    }
    assert.deepEqual(errors, []);
  } finally {
    await close();
  }
});
