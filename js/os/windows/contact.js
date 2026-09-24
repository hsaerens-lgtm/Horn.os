import { h, externalLink } from "../dom.js";

export function renderContact(body, profile) {
  body.append(
    h(
      "div",
      { class: "doc contact" },
      h("h1", {}, "Get in touch"),
      h("p", { class: "doc-meta" }, profile.availability),
      h(
        "ul",
        { class: "contact-list" },
        h("li", {}, h("span", {}, "E-mail"), externalLink(`mailto:${profile.email}`, profile.email)),
        h("li", {}, h("span", {}, "LinkedIn"), externalLink(profile.links.linkedin, "horn-saerens")),
        h("li", {}, h("span", {}, "GitHub"), externalLink(profile.links.github, "hsaerens-lgtm")),
      ),
      h("a", { class: "btn", href: profile.resumePdf, download: "Horn_Saerens_CV.pdf" }, "Download the résumé (PDF)"),
    ),
  );
}
