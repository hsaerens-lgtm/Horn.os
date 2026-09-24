// Windows on the Horn.os desktop: open, focus, drag by the title bar, minimise
// (keeps state and position), close (discards; reopening renders afresh).
// On narrow screens CSS makes every window full-bleed and dragging is off.

import { h } from "./dom.js";

const NARROW = "(max-width: 700px)";
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createWindowManager(desktop, { onChange = () => {} } = {}) {
  const entries = new Map(); // id -> { spec, el, body, api, state }
  let z = 10;
  let cascade = 0;

  function register(id, spec) {
    entries.set(id, { spec, el: null, body: null, api: null, state: "closed" });
  }

  function build(id, entry) {
    const { title } = entry.spec;
    const body = h("div", { class: "win-body" });
    const bar = h(
      "header",
      { class: "win-bar" },
      h("span", { class: "win-title" }, title),
      h(
        "div",
        { class: "win-ctrl" },
        h("button", { type: "button", class: "win-btn", "data-act": "min", "aria-label": `Minimise ${title}`, onclick: () => minimise(id) }, "–"),
        h("button", { type: "button", class: "win-btn", "data-act": "close", "aria-label": `Close ${title}`, onclick: () => close(id) }, "×"),
      ),
    );
    const el = h("section", { class: "win", "data-win": id, role: "dialog", "aria-label": title }, bar, body);
    el.addEventListener("pointerdown", () => focus(id));
    makeDraggable(el, bar, desktop);
    desktop.append(el);
    entry.el = el;
    entry.body = body;
  }

  function place(entry) {
    const { spec, el } = entry;
    const W = desktop.clientWidth;
    const H = desktop.clientHeight;
    const w = Math.min(spec.width ?? 640, W - 24);
    const ht = Math.min(spec.height ?? 480, H - 24);
    let x;
    let y;
    if (spec.center) {
      x = (W - w) / 2;
      y = (H - ht) / 2;
    } else {
      x = 48 + (cascade % 5) * 32;
      y = 40 + (cascade % 5) * 28;
      cascade++;
    }
    el.style.width = `${w}px`;
    el.style.height = `${ht}px`;
    el.style.left = `${Math.round(clamp(x, 0, W - w))}px`;
    el.style.top = `${Math.round(clamp(y, 0, H - ht))}px`;
  }

  function open(id, arg) {
    const entry = entries.get(id);
    if (!entry) return;
    if (!entry.el) build(id, entry);
    if (entry.state === "closed") {
      entry.body.replaceChildren();
      entry.api = entry.spec.render(entry.body, { close: () => close(id) }) ?? null;
      place(entry);
    }
    entry.state = "open";
    entry.el.hidden = false;
    focus(id);
    if (arg !== undefined) entry.api?.show?.(arg);
    onChange();
  }

  function minimise(id) {
    const e = entries.get(id);
    if (!e || e.state !== "open") return;
    e.state = "minimised";
    e.el.hidden = true;
    syncFront();
    onChange();
  }

  function close(id) {
    const e = entries.get(id);
    if (!e || e.state === "closed") return;
    e.state = "closed";
    e.el.hidden = true;
    e.api?.dispose?.();
    syncFront();
    onChange();
  }

  function focus(id) {
    const e = entries.get(id);
    if (!e?.el) return;
    e.el.style.zIndex = String(++z);
    syncFront();
    onChange();
  }

  // The front border (`.is-front`) belongs on whichever open window is
  // actually on top. Minimising or closing the front window used to leave it
  // stuck there (or on nothing) until something else called focus() —
  // recomputed here so it always tracks top().
  function syncFront() {
    const frontId = top();
    for (const [eid, e] of entries) e.el?.classList.toggle("is-front", eid === frontId);
  }

  function top() {
    let best = null;
    let bestZ = -1;
    for (const [id, e] of entries) {
      if (e.state !== "open") continue;
      const zi = Number(e.el.style.zIndex);
      if (zi > bestZ) {
        bestZ = zi;
        best = id;
      }
    }
    return best;
  }

  function toggle(id) {
    const e = entries.get(id);
    if (!e) return;
    if (e.state === "open" && top() === id) minimise(id);
    else open(id);
  }

  return {
    register,
    open,
    close,
    minimise,
    focus,
    toggle,
    top,
    state: (id) => entries.get(id)?.state ?? "closed",
    api: (id) => entries.get(id)?.api ?? null,
  };
}

function makeDraggable(el, handle, bounds) {
  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest("button") || matchMedia(NARROW).matches) return;
    // Under a CSS3D transform the window is drawn smaller or larger than its
    // CSS size; divide pointer deltas by that scale so it tracks the cursor.
    const k = bounds.getBoundingClientRect().width / bounds.offsetWidth || 1;
    const startX = e.clientX;
    const startY = e.clientY;
    const left = el.offsetLeft;
    const top = el.offsetTop;
    handle.setPointerCapture(e.pointerId);
    const move = (ev) => {
      el.style.left = `${clamp(left + (ev.clientX - startX) / k, 0, bounds.clientWidth - el.offsetWidth)}px`;
      el.style.top = `${clamp(top + (ev.clientY - startY) / k, 0, bounds.clientHeight - 40)}px`;
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  });
}
