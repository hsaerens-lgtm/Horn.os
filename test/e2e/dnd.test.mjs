import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, openPage } from "./harness.mjs";

let server;
before(async () => {
  server = await startServer(4340);
});
after(() => server.stop());

test("the D&D table loads at dnd/ with every asset found", { timeout: 240000 }, async () => {
  const { page, errors, failed, close } = await openPage(`${server.url}dnd/`);
  try {
    // The loader hides only when the room, the players and the bake are done.
    await page.waitForFunction(() => document.getElementById("loader")?.classList.contains("hidden"), null, {
      timeout: 180000,
    });
    assert.deepEqual(failed, [], "no request may 404");
    assert.deepEqual(errors.filter((e) => !e.includes("GPU stall")), []);
  } finally {
    await close();
  }
});

test("the D&D page links back to the office", async () => {
  const { page, close } = await openPage(`${server.url}dnd/?fallback`);
  try {
    const href = await page.getAttribute(".office-link", "href");
    assert.equal(new URL(href, page.url()).href, server.url);
  } finally {
    await close();
  }
});
