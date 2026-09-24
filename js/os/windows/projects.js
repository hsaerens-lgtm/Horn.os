import { h } from "../dom.js";

export function renderProjects(body, profile) {
  const list = h("ul", { class: "proj-list", "aria-label": "Projects" });
  const detail = h("article", { class: "proj-detail", tabindex: "-1" });
  const buttons = new Map();

  for (const p of profile.projects) {
    const btn = h(
      "button",
      { type: "button", class: "proj-item", "data-project": p.id, onclick: () => show(p.id) },
      h("span", { class: "proj-name" }, p.name),
      h("span", { class: "proj-kind" }, p.kind),
    );
    buttons.set(p.id, btn);
    list.append(h("li", {}, btn));
  }

  function show(id) {
    const p = profile.projects.find((x) => x.id === id) ?? profile.projects[0];
    for (const [pid, b] of buttons) b.classList.toggle("is-active", pid === p.id);
    detail.replaceChildren(projectDetail(p));
    detail.scrollTop = 0;
  }

  body.append(h("div", { class: "projects" }, list, detail));
  show(profile.projects[0].id);
  return { show };
}

function projectDetail(p) {
  const parts = [h("h1", {}, p.name), h("p", { class: "proj-status" }, `${p.kind} · ${p.status}`)];
  if (p.problem) {
    parts.push(h("h2", {}, "Problem"), h("p", {}, p.problem), h("h2", {}, "Built"), h("p", {}, p.built), h("h2", {}, "Result"), h("p", {}, p.result));
  } else {
    parts.push(h("p", {}, p.summary));
  }
  if (p.stack?.length) parts.push(h("h2", {}, "Stack"), h("ul", { class: "badges" }, ...p.stack.map((s) => h("li", { class: "badge" }, s))));
  return h("div", {}, ...parts);
}
