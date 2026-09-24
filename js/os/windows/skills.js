import { h } from "../dom.js";

export function renderSkills(body, profile) {
  body.append(
    h(
      "div",
      { class: "doc skills" },
      h("h1", {}, "Skills"),
      ...profile.skills.map((g) =>
        h("section", { class: "skill-group" }, h("h2", {}, g.group), h("ul", { class: "badges" }, ...g.items.map((s) => h("li", { class: "badge" }, s)))),
      ),
    ),
  );
}
