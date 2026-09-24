// Bootstrap. On a desktop-sized screen with WebGL, Horn.os goes on the monitor
// of a 3D office; on phones, without WebGL, with ?flat, or if the 3D fails to
// load, Horn.os fills the page.

import { profile } from "./content/profile.js";
import { dialogue } from "./content/dialogue.js";
import { createHornOS } from "./os/hornos.js";

const params = new URLSearchParams(location.search);

// Night theme from 21:00 to 06:59 local time — the same hours the room's night
// phase will use.
function themeFor(date) {
  const hour = date.getHours();
  return hour >= 21 || hour < 7 ? "dark" : "light";
}

const forced = params.get("theme");
const theme = forced === "light" || forced === "dark" ? forced : themeFor(new Date());

// A handle for tests and the console; ?debug only.
const debug = params.has("debug");
if (debug) window.__streamLog = [];
const onStream = debug ? (isStreaming) => window.__streamLog.push(isStreaming) : undefined;

function supportsWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function startFlat() {
  document.body.classList.add("flat");
  const os = createHornOS(document.getElementById("os"), { profile, dialogue, theme, onStream });
  if (debug) window.__os = os;
  document.getElementById("loader")?.remove();
}

async function start3D() {
  const { createOffice } = await import("./scene/office.js");
  const stage = document.getElementById("stage");
  const back = document.getElementById("back");
  const hint = document.getElementById("hint");
  const loader = document.getElementById("loader");
  const osElement = document.createElement("div");
  osElement.className = "os-screen";

  let os = null;
  const office = createOffice({
    container: stage,
    osElement,
    onFocus() {
      os?.focus();
      hint.hidden = true;
      back.hidden = false;
    },
    onWide() {
      os?.blur();
      back.hidden = true;
      hint.hidden = false;
    },
  });
  // Horn.os is built once its element is in the DOM with its size (the office
  // put it there), so the windows can place themselves.
  os = createHornOS(osElement, { profile, dialogue, theme, onStream });
  os.blur();

  back.addEventListener("click", () => office.wide());
  hint.addEventListener("click", () => office.focus());
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && office.mode === "focus") office.wide();
  });

  if (debug) {
    window.__os = os;
    window.__office = office;
    window.__debug = office.debug;
  }
  await office.ready;
  loader.classList.add("hidden");
  hint.hidden = false;
}

const wantFlat = params.has("flat") || window.innerWidth < 900 || !supportsWebGL();
if (wantFlat) startFlat();
else
  start3D().catch((err) => {
    console.error("3D office failed, showing Horn.os directly:", err);
    document.getElementById("stage")?.remove();
    startFlat();
  });
