// The only way Horn.os builds DOM: elements and text nodes, never innerHTML,
// so no content string is ever parsed as markup.

import { parseInline } from "./inline.js";

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

export function externalLink(href, text) {
  const external = /^https?:/.test(href);
  return h("a", { href, target: external ? "_blank" : null, rel: external ? "noopener" : null }, text);
}

// One DOM node for one inline segment. Streaming appends words to the node's
// textContent, so every kind must return a node whose text can grow.
export function segmentEl(segment, text) {
  if (segment.kind === "bold") return h("strong", {}, text);
  if (segment.kind === "link") return externalLink(segment.href, text);
  return document.createTextNode(text);
}

export function renderInline(text) {
  const frag = document.createDocumentFragment();
  for (const s of parseInline(text)) frag.append(segmentEl(s, s.text));
  return frag;
}
