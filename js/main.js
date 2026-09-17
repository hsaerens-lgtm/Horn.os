import { content } from "./content.js";
import { createOS } from "./os.js";

const root = document.getElementById("os-root");
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
  const os = createOS(root, content, { onBack: null });
  loader.classList.add("hidden");
  os.boot();
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
    osRoot: root,
    onEnter() {
      hint.classList.add("hidden");
      back.classList.remove("hidden");
      os.boot();
    },
    onExit() {
      back.classList.add("hidden");
      hint.classList.remove("hidden");
    },
  });
  const os = createOS(root, content, { onBack: () => scene.exit() });
  hint.addEventListener("click", () => scene.enter());
  back.addEventListener("click", () => scene.exit());
  loader.classList.add("hidden");
  hint.classList.remove("hidden");
}

const wantFallback = params.has("fallback") || window.innerWidth < 900 || !supportsWebGL();

if (wantFallback) startFallback();
else start3D().catch((err) => {
  console.error("3D mode failed, using fallback:", err);
  startFallback("3D scene unavailable — showing the desktop directly.");
});
