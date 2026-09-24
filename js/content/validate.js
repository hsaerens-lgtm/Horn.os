// Checks on the content modules, run by the unit tests. Pure: no DOM, no I/O.
//
// The dialogue is a graph written by hand, and a typo in a `next` id is a dead
// end a recruiter would hit. These checks make every such mistake a failing
// test instead.

import { parseInline } from "../os/inline.js";

export const WINDOW_IDS = ["chat", "resume", "skills", "projects", "contact", "dnd"];
const BLOCK_KINDS = ["p", "list", "project", "open"];
const ALLOWED_LINK_SCHEMES = ["https:", "mailto:"];

// A [label](href) inside a p or list item must go somewhere safe: no
// javascript:, data:, or bare relative paths slipping into the chat.
function checkLinks(text, label, errors) {
  for (const seg of parseInline(text)) {
    if (seg.kind !== "link") continue;
    let scheme = null;
    try {
      scheme = new URL(seg.href).protocol;
    } catch {
      scheme = null;
    }
    if (!ALLOWED_LINK_SCHEMES.includes(scheme)) errors.push(`${label}: link "${seg.href}" must be https: or mailto:`);
  }
}

export function validateProfile(profile) {
  const errors = [];
  for (const k of ["name", "title", "email", "resumePdf", "summary"]) {
    if (!profile?.[k]) errors.push(`profile: missing ${k}`);
  }
  const ids = new Set();
  for (const p of profile?.projects ?? []) {
    if (!p.id || ids.has(p.id)) errors.push(`project id "${p.id}" missing or duplicated`);
    ids.add(p.id);
    for (const k of ["name", "kind", "status"]) if (!p[k]) errors.push(`${p.id}: missing ${k}`);
    const story = p.problem && p.built && p.result;
    if (!story && !p.summary) errors.push(`${p.id}: needs problem/built/result or a summary`);
  }
  return errors;
}

export function validateDialogue(dialogue, profile) {
  const nodes = dialogue?.nodes ?? {};
  const start = dialogue?.start;
  if (!nodes[start]) return [`start node "${start}" does not exist`];

  const errors = [];
  const projectIds = new Set((profile?.projects ?? []).map((p) => p.id));
  if (!Array.isArray(nodes[start].again) || nodes[start].again.length === 0) {
    errors.push(`${start}: the start node needs an "again" answer (shown after Back to topics)`);
  }

  const questions = new Map();
  for (const [id, node] of Object.entries(nodes)) {
    const isStart = id === start;
    if (!isStart) {
      if (typeof node.question !== "string" || !node.question.trim()) errors.push(`${id}: missing question`);
      else if (questions.has(node.question)) errors.push(`${id}: question duplicates ${questions.get(node.question)}`);
      else questions.set(node.question, id);
    }
    if (!Array.isArray(node.answer) || node.answer.length === 0) errors.push(`${id}: empty answer`);

    const blocks = [...(node.answer ?? []), ...(isStart ? node.again ?? [] : [])];
    blocks.forEach((b, i) => {
      const kinds = BLOCK_KINDS.filter((k) => k in b);
      if (kinds.length !== 1) {
        errors.push(`${id}: block ${i} must have exactly one of ${BLOCK_KINDS.join(", ")}`);
        return;
      }
      const kind = kinds[0];
      if (kind === "p") {
        if (typeof b.p !== "string") errors.push(`${id}: block ${i} p must be text`);
        else if (!b.p.trim()) errors.push(`${id}: block ${i} p is empty`);
        else checkLinks(b.p, `${id}: block ${i}`, errors);
      }
      if (kind === "list") {
        if (!Array.isArray(b.list) || b.list.length === 0) errors.push(`${id}: block ${i} empty list`);
        else
          b.list.forEach((item, li) => {
            if (typeof item !== "string" || !item.trim()) errors.push(`${id}: block ${i} item ${li} is empty`);
            else checkLinks(item, `${id}: block ${i} item ${li}`, errors);
          });
      }
      if (kind === "project" && !projectIds.has(b.project)) errors.push(`${id}: unknown project "${b.project}"`);
      if (kind === "open" && !WINDOW_IDS.includes(b.open)) errors.push(`${id}: unknown window "${b.open}"`);
      if (kind === "open" && typeof b.label !== "string") errors.push(`${id}: block ${i} open needs a label`);
    });

    const next = node.next ?? [];
    const min = isStart ? 2 : 1;
    if (next.length < min || next.length > 4) errors.push(`${id}: needs ${min}–4 next questions, has ${next.length}`);
    for (const n of next) {
      if (n === start) errors.push(`${id}: next must not point at the start node (Back to topics does that)`);
      else if (!nodes[n]) errors.push(`${id}: next "${n}" does not exist`);
    }
  }

  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    for (const n of nodes[queue.shift()].next ?? []) {
      if (nodes[n] && !seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  for (const id of Object.keys(nodes)) if (!seen.has(id)) errors.push(`${id}: unreachable from ${start}`);
  return errors;
}
