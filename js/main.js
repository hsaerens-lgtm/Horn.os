import { content } from "./content.js";
import { createSheet } from "./sheet.js";

const root = document.getElementById("sheet-root");
const loader = document.getElementById("loader");
const hint = document.querySelector(".hint");
const back = document.querySelector(".back");
const params = new URLSearchParams(location.search);

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
  const scene = createScene({
    container: document.getElementById("scene"),
    sheetRoot: root,
    agents: content.party,
    onEnter() {
      hint.classList.add("hidden");
      back.classList.remove("hidden");
      sheet.scrollTop();
    },
    onExit() {
      back.classList.add("hidden");
      hint.classList.remove("hidden");
    },
  });
  const sheet = createSheet(root, content);
  hint.addEventListener("click", () => scene.enter());
  back.addEventListener("click", () => scene.exit());
  loader.classList.add("hidden");
  hint.classList.remove("hidden");
}

const wantFallback = params.has("fallback") || window.innerWidth < 900 || !supportsWebGL();

if (wantFallback) startFallback();
else start3D().catch((err) => {
  console.error("3D mode failed, using fallback:", err);
  startFallback("3D table unavailable — showing the character sheet directly.");
});
