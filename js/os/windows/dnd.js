import { h } from "../dom.js";

export function renderDnd(body, href) {
  body.append(
    h(
      "div",
      { class: "doc dnd" },
      h("p", { class: "doc-kicker" }, "Bonus project"),
      h("h1", {}, "The D&D table"),
      h(
        "p",
        {},
        "A 3D table set for a Dungeons & Dragons session. The players are the AI models Horn works with — Claude Code, Gemini, an open local model and Codex — and their character sheets are his real projects.",
      ),
      h("p", {}, "It began as an experiment in art direction and grew into a Three.js playground: procedural bodies, baked occlusion, a watercolour pass. Less formal than this desk, and more fun."),
      h("a", { class: "btn btn-primary", href }, "Open the table →"),
    ),
  );
}
