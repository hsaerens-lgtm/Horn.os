// Bootstrap. In this first plan the page is Horn.os full screen; plan 2 puts
// it on the monitor of a 3D office and keeps this path as the fallback for
// phones and browsers without WebGL.

import { profile } from "./content/profile.js";
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
const os = createHornOS(document.getElementById("os"), { profile, theme });

// A handle for tests and the console; ?debug only.
if (params.has("debug")) window.__os = os;
