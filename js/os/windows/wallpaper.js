// The Wallpaper window: a live thumbnail of every wallpaper; picking one
// applies it to the desktop straight away. Thumbnails only run while the
// window is open.

import { h } from "../dom.js";
import { WALLPAPERS, createWallpaper } from "../wallpapers.js";

export function renderWallpaperPicker(body, { current, theme, onPick }) {
  const thumbs = [];
  const items = WALLPAPERS.map((wp) => {
    const canvas = h("canvas", { class: "wp-thumb", "aria-hidden": "true" });
    thumbs.push(createWallpaper(canvas, { id: wp.id, theme: theme(), thumb: true }));
    const tag = h("span", { class: "wp-tag" });
    const item = h(
      "button",
      { type: "button", class: "wp-item", "data-wallpaper": wp.id, onclick: () => pick(wp.id) },
      canvas,
      h("span", { class: "wp-name" }, wp.name, tag),
    );
    item.tag = tag;
    item.still = wp.still;
    return item;
  });

  function paint() {
    for (const item of items) {
      const on = item.dataset.wallpaper === current();
      item.setAttribute("aria-pressed", String(on));
      item.tag.textContent = on ? "In use" : item.still ? "Still" : "Animated";
    }
  }
  function pick(id) {
    onPick(id);
    paint();
  }
  paint();

  body.append(
    h(
      "div",
      { class: "wp" },
      h("p", { class: "wp-intro" }, "Pick a wallpaper for the desktop. It follows the room from day to night, and your choice is kept for your next visit."),
      h("div", { class: "wp-grid" }, items),
    ),
  );

  return {
    pause: () => thumbs.forEach((t) => t.pause()),
    resume: () => thumbs.forEach((t) => t.resume()),
    dispose: () => thumbs.forEach((t) => t.dispose()),
    setTheme: (t) => thumbs.forEach((th) => th.setTheme(t)),
  };
}
