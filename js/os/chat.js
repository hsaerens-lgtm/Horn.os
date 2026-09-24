// The Horn.os chat: an LLM-style conversation over a scripted tree. The
// visitor never writes free text — clicking a suggestion types it out letter
// by letter, and any real keystroke writes the next letters of the highlighted
// suggestion — and the assistant's answers stream in word by word.

import { h, segmentEl } from "./dom.js";
import { ICONS } from "./icons.js";
import { parseInline, wordTokens } from "./inline.js";
import { advanceTyping, thinkingDelay, typeDelay, WORD_MS } from "./typing.js";

const BACK = "Back to topics";

export function createChat(
  body,
  {
    dialogue,
    profile,
    onOpen = () => {},
    onStream = () => {},
    rand = Math.random,
    reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches,
  },
) {
  const log = h("div", { class: "chat-log", "aria-live": "polite" });
  const chips = h("div", { class: "chat-chips", role: "group", "aria-label": "Suggested questions" });
  const input = h("input", {
    class: "chat-field",
    readonly: true,
    tabindex: "-1",
    "aria-label": "Your question",
    placeholder: "Pick a question below, or just start typing…",
  });
  const send = h("button", { type: "submit", class: "chat-send", "aria-label": "Send" }, "↑");
  const form = h("form", { class: "chat-input", onsubmit: (e) => (e.preventDefault(), submit()) }, input, send);
  body.append(h("div", { class: "chat" }, log, h("div", { class: "chat-bottom" }, chips, form)));

  let options = []; // [{ id, label, back? }]
  let hot = 0; // highlighted option
  let typed = "";
  let busy = false; // typing out, thinking or streaming
  let alive = true;

  const wait = (ms) => new Promise((r) => setTimeout(r, reducedMotion ? 0 : ms));
  const scrollDown = () => {
    log.scrollTop = log.scrollHeight;
  };
  const nodeFor = (id) => dialogue.nodes[id] ?? dialogue.nodes[dialogue.start];

  function setOptions(nodeId) {
    const node = nodeFor(nodeId);
    options = node.next.filter((n) => dialogue.nodes[n]).map((n) => ({ id: n, label: dialogue.nodes[n].question }));
    if (nodeId !== dialogue.start) options.push({ id: dialogue.start, label: BACK, back: true });
    hot = 0;
    setTyped("");
    chips.replaceChildren(
      ...options.map((o, i) =>
        h(
          "button",
          {
            type: "button",
            class: o.back ? "chip chip-back" : "chip",
            "data-node": o.id,
            onclick: () => pick(i),
            onfocus: () => highlight(i),
          },
          o.back ? `← ${o.label}` : o.label,
        ),
      ),
    );
    paintHot();
  }

  function setTyped(text) {
    typed = text;
    input.value = text;
  }

  function paintHot() {
    [...chips.children].forEach((c, i) => c.classList.toggle("is-hot", i === hot));
  }

  function highlight(i) {
    if (busy || i === hot) return;
    hot = i;
    setTyped("");
    paintHot();
  }

  async function pick(i) {
    if (busy || !options[i]) return;
    hot = i;
    paintHot();
    busy = true;
    const target = options[i].label;
    if (!target.startsWith(typed)) setTyped("");
    while (alive && typed.length < target.length) {
      setTyped(target.slice(0, typed.length + 1));
      await wait(typeDelay(rand));
    }
    busy = false;
    if (alive) submit();
  }

  async function submit() {
    if (busy || !options[hot]) return;
    const option = options[hot];
    busy = true;
    chips.replaceChildren();
    setTyped("");
    log.append(h("div", { class: "msg msg-user" }, option.label));
    scrollDown();
    const node = nodeFor(option.id);
    await answer(option.back ? node.again : node.answer);
    if (!alive) return;
    busy = false;
    setOptions(option.id);
  }

  async function answer(blocks) {
    const dots = h("div", { class: "typing", "aria-label": "Assistant is typing" }, h("span"), h("span"), h("span"));
    log.append(dots);
    scrollDown();
    await wait(thinkingDelay(rand));
    dots.remove();

    const msg = h("div", { class: "msg msg-bot" });
    log.append(msg);
    let skipped = false;
    const skip = () => {
      skipped = true;
    };
    msg.addEventListener("click", skip);
    onStream(true);
    for (const block of blocks) {
      if (block.p !== undefined) await stream(msg.appendChild(h("p")), block.p, () => skipped);
      else if (block.list) {
        const ul = msg.appendChild(h("ul"));
        for (const item of block.list) await stream(ul.appendChild(h("li")), item, () => skipped);
      } else if (block.project) msg.append(projectCard(block.project));
      else if (block.open) msg.append(h("button", { type: "button", class: "msg-action", onclick: () => onOpen(block.open) }, block.label));
      scrollDown();
    }
    msg.removeEventListener("click", skip);
    onStream(false);
  }

  async function stream(el, text, isSkipped) {
    const segments = parseInline(text);
    const nodes = new Map();
    for (const token of wordTokens(segments)) {
      let node = nodes.get(token.seg);
      if (!node) {
        node = segmentEl(segments[token.seg], "");
        el.append(node);
        nodes.set(token.seg, node);
      }
      node.textContent += token.text;
      if (!reducedMotion && !isSkipped()) {
        scrollDown();
        await wait(WORD_MS);
      }
    }
  }

  function projectCard(id) {
    const p = profile.projects.find((x) => x.id === id);
    return h(
      "button",
      { type: "button", class: "project-card", "data-project": id, onclick: () => onOpen("projects", id) },
      ICONS.projects(),
      h("span", { class: "project-card-text" }, h("strong", {}, p.name), h("span", {}, `${p.kind} · ${p.status}`)),
      h("span", { class: "project-card-go", "aria-hidden": "true" }, "→"),
    );
  }

  function move(delta) {
    hot = (hot + delta + options.length) % options.length;
    setTyped("");
    paintHot();
  }

  // Returns true when the key was used, so the caller can preventDefault.
  function handleKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const printable = e.key.length === 1;
    if (busy) return printable || e.key === "Enter";
    if (!options.length) return false;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") return move(1), true;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") return move(-1), true;
    if (e.key === "Enter") {
      // Enter on a focused chip is that chip's own click.
      if (e.target?.closest?.(".chip")) return false;
      setTyped(options[hot].label);
      submit();
      return true;
    }
    if (e.key === "Backspace") return setTyped(typed.slice(0, -1)), true;
    if (printable) return setTyped(advanceTyping(typed, options[hot].label, rand)), true;
    return false;
  }

  busy = true;
  answer(nodeFor(dialogue.start).answer).then(() => {
    if (!alive) return;
    busy = false;
    setOptions(dialogue.start);
  });

  return {
    handleKey,
    dispose() {
      alive = false;
    },
  };
}
