import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, openPage } from "./harness.mjs";

let server;
before(async () => {
  server = await startServer(4341);
});
after(() => server.stop());

const isOpen = (page, id) => page.locator(`.dock-item[data-open="${id}"]`).evaluate((e) => e.classList.contains("is-open"));

test("the desktop renders with its dock and no errors", async () => {
  const { page, errors, failed, close } = await openPage(`${server.url}?flat`);
  try {
    await page.waitForSelector(".hornos-dock");
    const labels = await page.$$eval(".dock-item", (els) => els.map((e) => e.getAttribute("aria-label")));
    assert.deepEqual(labels, ["Horn.os", "Resume", "Skills", "Projects", "Contact", "DnD"]);
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
  } finally {
    await close();
  }
});

test("a dock icon opens its window, which drags, minimises in place and closes", async () => {
  const { page, close } = await openPage(`${server.url}?flat`);
  try {
    await page.click('.dock-item[data-open="resume"]');
    const win = page.locator('.win[data-win="resume"]');
    await win.waitFor({ state: "visible" });
    assert.match(await win.textContent(), /Horn Saerens/);

    const start = await win.boundingBox();
    const bar = await win.locator(".win-bar").boundingBox();
    await page.mouse.move(bar.x + 80, bar.y + 20);
    await page.mouse.down();
    await page.mouse.move(bar.x + 180, bar.y + 80, { steps: 6 });
    await page.mouse.up();
    const moved = await win.boundingBox();
    assert.ok(Math.abs(moved.x - start.x - 100) <= 2 && Math.abs(moved.y - start.y - 60) <= 2, `moved by ${moved.x - start.x}, ${moved.y - start.y}`);

    await win.locator('[data-act="min"]').click();
    await win.waitFor({ state: "hidden" });
    assert.ok(await isOpen(page, "resume"), "a minimised window keeps its dock dot");
    await page.click('.dock-item[data-open="resume"]');
    await win.waitFor({ state: "visible" });
    assert.equal((await win.boundingBox()).x, moved.x, "restored where it was left");

    await win.locator('[data-act="close"]').click();
    await win.waitFor({ state: "hidden" });
    assert.ok(!(await isOpen(page, "resume")), "a closed window loses its dock dot");
  } finally {
    await close();
  }
});

test("the Projects window can be opened on a given project", async () => {
  const { page, close } = await openPage(`${server.url}?flat&debug=1`);
  try {
    await page.waitForFunction(() => !!window.__os);
    await page.evaluate(() => window.__os.open("projects", "docflow"));
    assert.equal(await page.textContent(".proj-detail h1"), "Docflow");
    await page.click('.proj-item[data-project="freescout"]');
    assert.equal(await page.textContent(".proj-detail h1"), "FreeScout AI Copilot");
  } finally {
    await close();
  }
});

test("the résumé download points at a real PDF", async () => {
  const { page, close } = await openPage(`${server.url}?flat`);
  try {
    await page.click('.dock-item[data-open="resume"]');
    const href = await page.getAttribute('.win[data-win="resume"] a[download]', "href");
    const res = await page.request.get(new URL(href, page.url()).href);
    assert.equal(res.status(), 200);
    assert.equal(res.headers()["content-type"], "application/pdf");
  } finally {
    await close();
  }
});

test("the DnD window leads to the bonus page", async () => {
  const { page, close } = await openPage(`${server.url}?flat`);
  try {
    await page.click('.dock-item[data-open="dnd"]');
    await page.click('.win[data-win="dnd"] a.btn');
    await page.waitForURL(/\/dnd\/$/);
  } finally {
    await close();
  }
});

test("on a phone-width screen a window fills the width", async () => {
  const { page, close } = await openPage(`${server.url}?flat`, { width: 390, height: 844 });
  try {
    await page.click('.dock-item[data-open="skills"]');
    const box = await page.locator('.win[data-win="skills"]').boundingBox();
    assert.equal(Math.round(box.width), 390);
  } finally {
    await close();
  }
});

// Fix round 2, finding 2: the six-item dock overflowed the viewport at 360 px
// and clipped items at 320 px. The dock and every item must stay fully inside
// the viewport at both widths.
for (const width of [360, 320]) {
  test(`the dock fits inside a ${width} px viewport`, async () => {
    const { page, close } = await openPage(`${server.url}?flat`, { width, height: 700 });
    try {
      await page.waitForSelector(".hornos-dock");
      const dockBox = await page.locator(".hornos-dock").boundingBox();
      assert.ok(dockBox.x >= 0, `dock left ${dockBox.x} should be >= 0`);
      assert.ok(dockBox.x + dockBox.width <= width, `dock right ${dockBox.x + dockBox.width} should be <= ${width}`);
      const items = await page.locator(".dock-item").all();
      assert.equal(items.length, 6);
      for (const item of items) {
        const box = await item.boundingBox();
        assert.ok(box.x >= 0, `item left ${box.x} should be >= 0`);
        assert.ok(box.x + box.width <= width, `item right ${box.x + box.width} should be <= ${width}`);
      }
    } finally {
      await close();
    }
  });
}

test("?theme=dark forces the dark theme", async () => {
  const { page, close } = await openPage(`${server.url}?flat&theme=dark`);
  try {
    assert.equal(await page.getAttribute(".hornos", "data-theme"), "dark");
  } finally {
    await close();
  }
});
