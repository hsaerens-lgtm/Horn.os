// Prints what each player's sheet actually says, and the party list on the DM's sheet.
import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chromium", args: ["--enable-unsafe-swiftshader"] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 704 } })).newPage();
p.on("pageerror", (e) => console.log("  [page error]", e.message));
await p.goto("http://localhost:4330/dnd/?debug=1", { waitUntil: "load" });
await p.waitForFunction(() => document.getElementById("loader")?.classList.contains("hidden"), null, { timeout: 180000 });
const r = await p.evaluate(() => ({
  agents: [...document.querSelectorAll?.(".pc") ?? document.querySelectorAll(".pc")].map((el) => ({
    head: [...el.querySelectorAll(".pc-hdr > div")].map((d) => d.textContent.trim()),
    quest: el.querySelector(".pc-sec + .pc-real")?.textContent.trim(),
    sections: [...el.querySelectorAll(".pc-sec")].map((d) => d.textContent.trim()),
  })),
  party: [...document.querySelectorAll(".party li")].map((li) => li.textContent.replace(/\s+/g, " ").trim()),
  quests: [...document.querySelectorAll(".quest .qn, .quests-brief .qn")].map((q) => q.textContent.replace(/\s+/g, " ").trim()),
}));
console.log(JSON.stringify(r, null, 1));
await b.close();
