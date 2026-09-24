import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, openPage } from "./harness.mjs";
import { dialogue } from "../../js/content/dialogue.js";

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
