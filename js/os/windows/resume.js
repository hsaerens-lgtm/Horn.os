import { h, renderInline } from "../dom.js";

export function renderResume(body, profile) {
  body.append(
    h(
      "article",
      { class: "doc resume" },
      h(
        "header",
        { class: "doc-head" },
        h(
          "div",
          {},
          h("h1", {}, profile.name),
          h("p", { class: "doc-sub" }, `${profile.title} · ${profile.focus}`),
          h("p", { class: "doc-meta" }, profile.availability),
        ),
        h("a", { class: "btn btn-primary", href: profile.resumePdf, download: "Horn_Saerens_CV.pdf" }, "Download PDF"),
      ),
      h("p", { class: "doc-lead" }, profile.summary),
      h("h2", {}, "Experience"),
      h("p", { class: "doc-meta" }, profile.company),
      ...profile.experience.map((x) =>
        h(
          "section",
          { class: "role" },
          h("div", { class: "role-head" }, h("h3", {}, x.role), h("span", { class: "role-dates" }, x.dates)),
          h("ul", {}, ...x.bullets.map((b) => h("li", {}, renderInline(b)))),
        ),
      ),
      h("h2", {}, "Education"),
      h("ul", {}, ...profile.education.map((e) => h("li", {}, e))),
      h("h2", {}, "Languages"),
      h("p", {}, profile.languages),
    ),
  );
}
