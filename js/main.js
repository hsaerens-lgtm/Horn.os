import { content } from "./content.js";
import { createSheet, renderAgentSheet } from "./sheet.js";

const root = document.getElementById("sheet-root");
const loader = document.getElementById("loader");
const hint = document.querySelector(".hint");
const back = document.querySelector(".back");
const scrollHint = document.querySelector(".scroll-hint");
const params = new URLSearchParams(location.search);

const questOf = (agent) => content.quests.find((q) => q.name === agent.quest);

function supportsWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function startFallback(reason) {
  document.body.classList.add("fallback");
  createSheet(root, content);
  loader.classList.add("hidden");
  if (reason) {
    const n = document.createElement("div");
    n.className = "notice";
    n.textContent = reason;
    document.body.appendChild(n);
  }
}

async function start3D() {
  const { createScene } = await import("./scene.js");

  // One sheet per player, built up front and handed to the scene, which lays
  // them on the table in front of their seats. They are never appended here —
  // the CSS3D renderer takes ownership of each element.
  const agentRoots = content.party.slice(0, 4).map((agent) => {
    const el = document.createElement("div");
    renderAgentSheet(el, agent, questOf(agent));
    return el;
  });

  const scene = createScene({
    container: document.getElementById("scene"),
    sheetRoot: root,
    agentRoots,
    agents: content.party,
    // The party is four bodies built in js/robots.js, one silhouette each.
    // ?players=gltf brings back the CC0 RobotExpressive bodies and
    // ?players=suit the hand-built suited figures — the two earlier versions of
    // this table, kept one URL away.
    players: ["suit", "gltf"].includes(params.get("players")) ? params.get("players") : "robot",
    onEnter() {
      hint.classList.add("hidden");
      back.classList.remove("hidden");
      scrollHint.classList.remove("hidden");
      sheet.scrollTop();
    },
    onAgent() {
      hint.classList.add("hidden");
      back.classList.remove("hidden");
    },
    onBoard() {
      hint.classList.add("hidden");
      back.classList.remove("hidden");
    },
    onExit() {
      back.classList.add("hidden");
      scrollHint.classList.add("hidden");
      hint.classList.remove("hidden");
    },
  });
  const sheet = createSheet(root, content);
  // A handle for tuning from the console; ?debug only, never on the live page.
  if (params.has("debug")) window.__scene = scene;
  hint.addEventListener("click", () => scene.enter());
  back.addEventListener("click", () => scene.exit());
  // The players load after the room does. Waiting for them costs a moment on
  // the loader and saves the table visibly filling up with people.
  await scene.ready;
  loader.classList.add("hidden");
  hint.classList.remove("hidden");
}

const wantFallback = params.has("fallback") || window.innerWidth < 900 || !supportsWebGL();

if (wantFallback) startFallback();
else start3D().catch((err) => {
  console.error("3D mode failed, using fallback:", err);
  startFallback("3D table unavailable — showing the character sheet directly.");
});
