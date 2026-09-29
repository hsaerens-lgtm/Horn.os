// Horn.os: the desktop on Horn's monitor. Plain DOM, no Three.js — the same
// module runs full screen (phones, no WebGL) and, from plan 2 on, mounted on
// the 3D monitor through CSS3D.

import { h } from "./dom.js";
import { ICONS } from "./icons.js";
import { createChat } from "./chat.js";
import { createWindowManager } from "./wm.js";
import { renderResume } from "./windows/resume.js";
import { renderSkills } from "./windows/skills.js";
import { renderProjects } from "./windows/projects.js";
import { renderContact } from "./windows/contact.js";
import { renderDnd } from "./windows/dnd.js";
import { renderGame } from "./windows/game.js";
import { renderWallpaperPicker } from "./windows/wallpaper.js";
import { WALLPAPERS, DEFAULT_WALLPAPER, createWallpaper } from "./wallpapers.js";

const WALLPAPER_KEY = "hornos-wallpaper";

const DOCK = [
  { id: "chat", label: "Horn.os" },
  { id: "resume", label: "Resume" },
  { id: "skills", label: "Skills" },
  { id: "projects", label: "Projects" },
  { id: "contact", label: "Contact" },
  { id: "game", label: "Arcade" },
  { id: "dnd", label: "DnD" },
];

export function createHornOS(root, { profile, dialogue, theme = "light", onBack = null, onStream = () => {}, dndHref = "dnd/", wallpaper: askedWallpaper = null } = {}) {
  const desktop = h("div", { class: "hornos-desktop" });
  const wallCanvas = h("canvas", { class: "hornos-wallpaper", "aria-hidden": "true" });
  const clock = h("span", { class: "hornos-clock" });
  const bar = h(
    "div",
    { class: "hornos-bar" },
    h("span", { class: "hornos-brand" }, "Horn.os"),
    h("span", { class: "hornos-who" }, `${profile.name} · ${profile.title}`),
    clock,
    h("button", { type: "button", class: "hornos-wp", "aria-label": "Wallpaper", title: "Wallpaper", onclick: () => wm.toggle("wallpaper") }, ICONS.wallpaper()),
    onBack && h("button", { type: "button", class: "hornos-back", onclick: onBack }, "← Back"),
  );
  const dock = h("nav", { class: "hornos-dock", "aria-label": "Applications" });
  const shell = h("div", { class: "hornos", "data-theme": theme }, wallCanvas, bar, desktop, dock);
  root.replaceChildren(shell);

  // The wallpaper: ?wallpaper= (tests, screenshots), else the visitor's last
  // pick, else the default.
  const known = (id) => WALLPAPERS.some((w) => w.id === id);
  let saved = null;
  try {
    saved = localStorage.getItem(WALLPAPER_KEY);
  } catch {
    /* storage may be unavailable */
  }
  const firstWallpaper = [askedWallpaper, saved].find(known) ?? DEFAULT_WALLPAPER;
  const wallpaper = createWallpaper(wallCanvas, { id: firstWallpaper, theme });
  shell.dataset.wallpaper = firstWallpaper;
  function setWallpaper(id) {
    wallpaper.set(id);
    shell.dataset.wallpaper = id;
    try {
      localStorage.setItem(WALLPAPER_KEY, id);
    } catch {
      /* ignore */
    }
  }

  const wm = createWindowManager(desktop, { onChange: syncDock });
  wm.register("chat", {
    title: "Horn.os — assistant",
    width: 600,
    height: 660,
    center: true,
    render: (b) => createChat(b, { dialogue, profile, onStream, onOpen: (id, arg) => wm.open(id, arg) }),
  });
  wm.register("resume", { title: "Resume", width: 720, height: 560, render: (b) => renderResume(b, profile) });
  wm.register("skills", { title: "Skills", width: 620, height: 500, render: (b) => renderSkills(b, profile) });
  wm.register("projects", { title: "Projects", width: 840, height: 560, render: (b) => renderProjects(b, profile) });
  wm.register("contact", { title: "Contact", width: 460, height: 380, render: (b) => renderContact(b, profile) });
  wm.register("dnd", { title: "DnD — bonus project", width: 500, height: 400, render: (b) => renderDnd(b, dndHref) });
  wm.register("game", { title: "Nebula Run", width: 860, height: 560, center: true, render: (b) => renderGame(b) });
  wm.register("wallpaper", {
    title: "Wallpaper",
    width: 780,
    height: 450,
    center: true,
    render: (b) => renderWallpaperPicker(b, { current: () => wallpaper.id, theme: () => shell.dataset.theme, onPick: setWallpaper }),
  });
  // Right-click on the empty desktop, as on any desktop.
  desktop.addEventListener("contextmenu", (e) => {
    if (e.target !== desktop) return;
    e.preventDefault();
    wm.open("wallpaper");
  });

  for (const item of DOCK) {
    dock.append(
      h(
        "button",
        { type: "button", class: "dock-item", "data-open": item.id, "aria-label": item.label, title: item.label, onclick: () => wm.toggle(item.id) },
        ICONS[item.id](),
        h("span", { class: "dock-label" }, item.label),
      ),
    );
  }

  function syncDock() {
    const front = wm.top();
    for (const btn of dock.querySelectorAll(".dock-item")) {
      btn.classList.toggle("is-open", wm.state(btn.dataset.open) !== "closed");
      btn.classList.toggle("is-front", front === btn.dataset.open);
    }
  }

  const tick = () => {
    clock.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };
  tick();
  setInterval(tick, 30_000);

  let active = true;
  // Keys go to the front window when the visitor is not using the keyboard
  // somewhere else (a dock button, a link in another window). The chat reads
  // key presses; the game also needs releases, to know when a key is let go.
  const route = (e, down) => {
    const top = wm.top();
    if (!active || !top) return;
    const focused = document.activeElement;
    const onPage = !focused || focused === document.body || focused.closest?.(`.win[data-win="${top}"]`);
    if (!onPage) return;
    const api = wm.api(top);
    const used = api?.onKey ? api.onKey(e, down) : down && api?.handleKey?.(e);
    if (used) e.preventDefault();
  };
  document.addEventListener("keydown", (e) => route(e, true));
  document.addEventListener("keyup", (e) => route(e, false));

  wm.open("chat");

  return {
    wm,
    open: (id, arg) => wm.open(id, arg),
    setTheme(t) {
      shell.dataset.theme = t;
      wallpaper.setTheme(t);
      wm.api("wallpaper")?.setTheme?.(t);
    },
    setWallpaper,
    get wallpaper() {
      return wallpaper.id;
    },
    focus() {
      active = true;
    },
    blur() {
      active = false;
    },
    get active() {
      return active;
    },
  };
}
