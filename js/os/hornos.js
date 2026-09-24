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

const DOCK = [
  { id: "chat", label: "Horn.os" },
  { id: "resume", label: "Resume" },
  { id: "skills", label: "Skills" },
  { id: "projects", label: "Projects" },
  { id: "contact", label: "Contact" },
  { id: "game", label: "Arcade" },
  { id: "dnd", label: "DnD" },
];

export function createHornOS(root, { profile, dialogue, theme = "light", onBack = null, onStream = () => {}, dndHref = "dnd/" } = {}) {
  const desktop = h("div", { class: "hornos-desktop" });
  const clock = h("span", { class: "hornos-clock" });
  const bar = h(
    "div",
    { class: "hornos-bar" },
    h("span", { class: "hornos-brand" }, "Horn.os"),
    h("span", { class: "hornos-who" }, `${profile.name} · ${profile.title}`),
    clock,
    onBack && h("button", { type: "button", class: "hornos-back", onclick: onBack }, "← Back"),
  );
  const dock = h("nav", { class: "hornos-dock", "aria-label": "Applications" });
  const shell = h("div", { class: "hornos", "data-theme": theme }, bar, desktop, dock);
  root.replaceChildren(shell);

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
