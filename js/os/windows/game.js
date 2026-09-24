// The Arcade window: Nebula Run, loaded only when the window is opened.

import { h } from "../dom.js";

export function renderGame(body) {
  const box = h("div", { class: "game" }, h("div", { class: "game-loading" }, "Loading Nebula Run…"));
  body.append(box);
  let game = null;
  let disposed = false;
  let paused = false;
  import("../../game/space.js")
    .then(({ createSpaceGame }) => {
      if (disposed) return;
      box.replaceChildren();
      game = createSpaceGame(box);
      if (paused) game.pause();
      if (new URLSearchParams(location.search).has("debug")) window.__game = game;
    })
    .catch((err) => {
      box.replaceChildren(h("div", { class: "game-loading" }, "The game needs WebGL, which is not available here."));
      console.error(err);
    });
  return {
    onKey: (e, down) => game?.onKey(e, down) ?? false,
    pause() {
      paused = true;
      game?.pause();
    },
    resume() {
      paused = false;
      game?.resume();
    },
    dispose() {
      disposed = true;
      game?.dispose();
    },
  };
}
