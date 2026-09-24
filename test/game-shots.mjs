// Screenshots of Nebula Run, the Horn.os arcade game, in each of its states.
//
//   node test/game-shots.mjs

import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startServer, openPage } from "./e2e/harness.mjs";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "out");
mkdirSync(OUT, { recursive: true });
const server = await startServer(4347);
const { page, errors, close } = await openPage(`${server.url}?flat&debug=1&theme=dark`, { width: 1440, height: 900 });
const shot = async (name) => {
  await page.screenshot({ path: join(OUT, `${name}.png`), clip: await page.locator('.win[data-win="game"]').boundingBox() });
  console.log(`${name}.png`);
};
try {
  await page.waitForFunction(() => !!window.__os);
  await page.evaluate(() => window.__os.open("game"));
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  await shot("game-title");

  await page.keyboard.press("Enter");
  await page.keyboard.down(" ");
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(700);
  await page.keyboard.up("ArrowLeft");
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(600);
  await page.keyboard.up("ArrowUp");
  await page.waitForTimeout(3500);
  await shot("game-play");

  await page.evaluate(() => window.__game.debug.setWeapon("spread"));
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(900);
  await page.keyboard.up("ArrowRight");
  await page.waitForTimeout(1200);
  await shot("game-spread");

  await page.evaluate(() => window.__game.debug.setWeapon("laser"));
  await page.waitForTimeout(1500);
  await shot("game-laser");

  await page.evaluate(() => window.__game.debug.spawnBoss());
  await page.waitForTimeout(5000);
  await shot("game-boss");

  await page.evaluate(() => window.__game.debug.win());
  await page.waitForTimeout(1300);
  await shot("game-win-blast");
  await page.waitForTimeout(3200);
  await shot("game-win");

  await page.keyboard.up(" ");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__game.debug.lose());
  await page.waitForTimeout(500);
  await shot("game-lose-blast");
  await page.waitForTimeout(2600);
  await shot("game-over");
  if (errors.length) console.log("errors:", errors.join(" | "));
} finally {
  await close();
  server.stop();
}
