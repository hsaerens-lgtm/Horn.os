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
  let streaming = false; // true while an onStream(true)…onStream(false) pair is open
  let streamMsg = null; // the .msg-bot currently streaming, for aria-busy cleanup

  const NEAR_BOTTOM = 48;
  const wait = (ms) => new Promise((r) => setTimeout(r, reducedMotion ? 0 : ms));
  const isNearBottom = () => log.scrollHeight - log.scrollTop - log.clientHeight <= NEAR_BOTTOM;
  const scrollDown = () => {
    log.scrollTop = log.scrollHeight;
  };
  const nodeFor = (id) => dialogue.nodes[id] ?? dialogue.nodes[dialogue.start];

  // onStream is the host's hook (Plan 2 drives a screen light off it); a bug in
  // it must never break the chat. Caught and logged, never left to reject the
  // streaming answer() promise and strand `busy`.
  function safeStream(v) {
    try {
      onStream(v);
    } catch (err) {
      console.error(err);
    }
  }

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

  // Fires onStream(false) at most once per onStream(true) — called either at
  // the natural end of an answer, or immediately from dispose() if the
  // window closes mid-stream. Whichever happens first wins; the other is a
  // no-op, so Plan 2's screen light never sees an unbalanced pair.
  function endStream() {
    if (!streaming) return;
    streaming = false;
    streamMsg?.removeAttribute("aria-busy");
    streamMsg = null;
    safeStream(false);
  }

  async function answer(blocks) {
    const dots = h("div", { class: "typing", role: "status", "aria-label": "Assistant is typing" }, h("span"), h("span"), h("span"));
    log.append(dots);
    scrollDown();
    await wait(thinkingDelay(rand));
    if (!alive) return;
    dots.remove();

    const msg = h("div", { class: "msg msg-bot", "aria-busy": "true" });
    log.append(msg);
    let skipped = false;
    const skip = () => {
      skipped = true;
    };
    msg.addEventListener("click", skip);
    streaming = true;
    streamMsg = msg;
    safeStream(true);
    for (const block of blocks) {
      if (!alive) break;
      if (block.p !== undefined) await stream(msg.appendChild(h("p")), block.p, () => skipped);
      else if (block.list) {
        const ul = msg.appendChild(h("ul"));
        for (const item of block.list) {
          if (!alive) break;
          await stream(ul.appendChild(h("li")), item, () => skipped);
        }
      } else if (block.project) msg.append(projectCard(block.project));
      else if (block.open) msg.append(h("button", { type: "button", class: "msg-action", onclick: () => onOpen(block.open) }, block.label));
      if (!alive) break;
      scrollDown();
    }
    msg.removeEventListener("click", skip);
    endStream();
  }

  async function stream(el, text, isSkipped) {
    const segments = parseInline(text);
    const nodes = new Map();
    for (const token of wordTokens(segments)) {
      if (!alive) return;
      // Only follow the stream down if the reader was already near the
      // bottom before this word lands — otherwise someone who scrolled up to
      // reread an earlier line keeps getting yanked back down.
      const stick = isNearBottom();
      let node = nodes.get(token.seg);
      if (!node) {
        node = segmentEl(segments[token.seg], "");
        el.append(node);
        nodes.set(token.seg, node);
      }
      node.textContent += token.text;
      if (!reducedMotion && !isSkipped()) {
        if (stick) scrollDown();
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
    // Roving focus: when a chip itself holds keyboard focus (Tab got us here),
    // move real DOM focus along with the highlight. Otherwise a stray Enter is
    // the still-focused chip's own native activation, sending the wrong
    // question — see fix round 2, finding 1.
    if (chips.contains(document.activeElement)) chips.children[hot]?.focus();
  }

  // Returns true when the key was used, so the caller can preventDefault.
  function handleKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    // Enter/Space on a focusable control — a chip, a project card, "Open the
    // résumé", a link inside an answer, the send button — is that control's
    // own activation. Never hijack it into typing or submitting a chip.
    if ((e.key === "Enter" || e.key === " ") && e.target?.closest?.("button, a")) return false;
    const printable = e.key.length === 1;
    if (busy) return printable || e.key === "Enter";
    if (!options.length) return false;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") return move(1), true;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") return move(-1), true;
    if (e.key === "Enter") {
      setTyped(options[hot].label);
      submit();
      return true;
    }
    if (e.key === "Backspace") return setTyped(typed.slice(0, -1)), true;
    if (printable) return setTyped(advanceTyping(typed, options[hot].label, rand)), true;
    return false;
  }

  busy = true;
  answer(nodeFor(dialogue.start).answer)
    .then(() => {
      if (!alive) return;
      busy = false;
      setOptions(dialogue.start);
    })
    .catch((err) => {
      console.error(err);
      if (!alive) return;
      busy = false;
      setOptions(dialogue.start);
    });

  return {
    handleKey,
    dispose() {
      alive = false;
      endStream();
    },
  };
}
