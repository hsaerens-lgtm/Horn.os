# Office & Horn.os — Plan 1 of 3: move the D&D table, build Horn.os full screen

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The D&D table lives at `/dnd/` unchanged, and the site root serves Horn.os full screen — a desktop with a dock, draggable windows (Resume, Skills, Projects, Contact, DnD) and the scripted assistant chat — working on desktop and phone widths.

**Architecture:** Horn.os is a plain-DOM module with no Three.js dependency (`js/os/`), fed by two data modules (`js/content/profile.js`, `js/content/dialogue.js`). Pure logic (dialogue validation, typing, inline markdown) lives in modules with no DOM access so Node's built-in test runner covers it; DOM behaviour is covered by Playwright driven from `node:test`. Plans 2 and 3 will mount this same module on the 3D monitor.

**Tech Stack:** Vanilla ES modules, no build step; CSS custom properties for the light/dark theme; Node 24 `node:test`; Playwright 1.63 (`chromium` channel); `serve.py` as the static server.

**Spec:** `docs/superpowers/specs/2026-09-24-office-horn-os-design.md`

**Plans in this series:** 1 — D&D move + Horn.os (this file). 2 — the room by day, monitor with Horn.os mounted, camera focus. 3 — plants, cat, guitar, day cycle and clock, finish.

## Global Constraints

- No build step, no framework: plain ES modules served as static files, deployable as-is to GitHub Pages under `https://hsaerens-lgtm.github.io/Horn.os/` — therefore **every URL in HTML and JS is relative** (never a leading `/`).
- All copy in English. All words live in `js/content/`.
- Nothing invented: every claim traces to CV v2 (`../Horn_Saerens_CV_2026_v2.docx`) or to a vault note. These claims stay dropped: FreeScout "sole designer & developer", "Perseus AI Platform" as a name, the LibreChat platform "in production", Hermes "running", Odysseus document figures. No salary information.
- No free-text input reaches anything: no LLM, no backend.
- The chat's assistant speaks about Horn in the third person.
- Inside `dnd/`, the only permitted edits are asset paths and the back link. `assets/` is shared: add files, never modify or delete an existing one — except replacing `assets/Horn_Saerens_CV_2026.pdf` with the CV v2 PDF (spec decision).
- Build DOM with `h()` / text nodes, never `innerHTML` with content strings.
- `prefers-reduced-motion: reduce` → typing and streaming are instant, no CSS animation.
- Work on branch `office`; `main` keeps serving the D&D table on GitHub Pages until the office is ready.
- Commit messages end with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## File map

```
dnd/index.html, dnd/js/*, dnd/css/sheet.css, dnd/README.md   moved from the root (git mv)
test/dnd/*.mjs                                                moved from test/ (git mv)
index.html                    new root page: Horn.os full screen
css/hornos.css                Horn.os styles, light + dark tokens
js/main.js                    new bootstrap (Horn.os only in this plan)
js/content/profile.js         identity, résumé, skills, projects, contact
js/content/dialogue.js        the question tree
js/content/validate.js        validateProfile(), validateDialogue(), WINDOW_IDS — pure
js/os/inline.js               parseInline(), wordTokens() — pure
js/os/typing.js               typing/streaming timings, advanceTyping() — pure
js/os/dom.js                  h(), renderInline(), segmentEl(), externalLink()
js/os/icons.js                ICONS: dock/card SVG icons
js/os/wm.js                   createWindowManager()
js/os/chat.js                 createChat()
js/os/hornos.js               createHornOS()
js/os/windows/resume.js, skills.js, projects.js, contact.js, dnd.js
test/unit/content.test.mjs, dialogue.test.mjs, inline.test.mjs, typing.test.mjs
test/e2e/harness.mjs          startServer(), openPage()
test/e2e/dnd.test.mjs, hornos-shell.test.mjs, hornos-chat.test.mjs
test/hornos-shots.mjs         screenshots into test/out/
README.md                     rewritten for the office
```

---

### Task 1: Move the D&D table to `dnd/` and prove it still loads

**Files:**
- Move: `index.html`, `js/`, `css/`, `README.md` → `dnd/`; `test/*.mjs` → `test/dnd/`
- Modify: `dnd/js/*.js` (asset paths), `dnd/index.html` (back link), `dnd/css/sheet.css` (back link style), `test/dnd/*.mjs` (URLs), `package.json`, `.gitignore`
- Replace: `assets/Horn_Saerens_CV_2026.pdf` with `../Horn_Saerens_CV_2026_v2.pdf`
- Create: `test/e2e/harness.mjs`, `test/e2e/dnd.test.mjs`

**Interfaces:**
- Produces: `startServer(port) → Promise<{ url: string, stop(): void }>` and `openPage(url, { width?, height?, reducedMotion? }) → Promise<{ page, errors: string[], failed: string[], close(): Promise<void> }>` in `test/e2e/harness.mjs`, used by every later e2e test. `errors` collects page errors and console errors; `failed` collects URLs that answered ≥ 400.

- [ ] **Step 1: Branch and commit the spec and this plan**

```bash
cd "/c/Users/Horn S/Desktop/Resume/cv-3d"
git switch -c office
git add docs/superpowers/specs/2026-09-24-office-horn-os-design.md docs/superpowers/plans/2026-09-24-hornos-plan-1-dnd-move-and-hornos.md
git commit -m "docs: spec and first plan for the office and Horn.os

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 2: Write the e2e harness**

Create `test/e2e/harness.mjs`:

```js
// Shared plumbing for the end-to-end tests: a static server per test file and
// a real Chromium page that records what went wrong while it loaded.
//
// The "chromium" channel is the full browser, not Playwright's headless shell:
// the shell lost WebGL on this machine during the D&D work, and the D&D smoke
// test needs WebGL.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chromium } from "playwright";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function startServer(port) {
  const proc = spawn("python", ["serve.py", String(port)], { cwd: ROOT, stdio: "ignore" });
  const url = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return { url, stop: () => proc.kill() };
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  proc.kill();
  throw new Error(`static server did not start on port ${port}`);
}

export async function openPage(url, { width = 1280, height = 800, reducedMotion = "no-preference" } = {}) {
  const browser = await chromium.launch({ channel: "chromium" });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion });
  const page = await ctx.newPage();
  const errors = [];
  const failed = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(url, { waitUntil: "load" });
  return { page, errors, failed, close: () => browser.close() };
}
```

- [ ] **Step 3: Write the failing D&D smoke test**

Create `test/e2e/dnd.test.mjs`:

```js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, openPage } from "./harness.mjs";

let server;
before(async () => {
  server = await startServer(4340);
});
after(() => server.stop());

test("the D&D table loads at dnd/ with every asset found", { timeout: 240000 }, async () => {
  const { page, errors, failed, close } = await openPage(`${server.url}dnd/`);
  try {
    // The loader hides only when the room, the players and the bake are done.
    await page.waitForFunction(() => document.getElementById("loader")?.classList.contains("hidden"), null, {
      timeout: 180000,
    });
    assert.deepEqual(failed, [], "no request may 404");
    assert.deepEqual(errors.filter((e) => !e.includes("GPU stall")), []);
  } finally {
    await close();
  }
});

test("the D&D page links back to the office", async () => {
  const { page, close } = await openPage(`${server.url}dnd/?fallback`);
  try {
    const href = await page.getAttribute(".office-link", "href");
    assert.equal(new URL(href, page.url()).href, server.url);
  } finally {
    await close();
  }
});
```

- [ ] **Step 4: Run it to make sure it fails**

Run: `node --test test/e2e/dnd.test.mjs`
Expected: FAIL — `dnd/` does not exist yet (404 on the page, loader never found).

- [ ] **Step 5: Move the files**

```bash
cd "/c/Users/Horn S/Desktop/Resume/cv-3d"
mkdir -p dnd test/dnd
git mv index.html js css README.md dnd/
git mv test/*.mjs test/dnd/
```

- [ ] **Step 6: Point the D&D code at the shared assets**

Asset URLs in the D&D modules resolve against the document (`dnd/index.html`), so `assets/...` must become `../assets/...`. Module imports are module-relative and need no change.

```bash
cd "/c/Users/Horn S/Desktop/Resume/cv-3d"
sed -i "s#\([\"'\`]\)assets/#\1../assets/#g" dnd/js/*.js
grep -rn "assets/" dnd/js dnd/css dnd/index.html | grep -v "\.\./assets/"
```

Expected: the `grep` prints nothing (every asset reference now starts with `../assets/`). Then confirm the four known references changed:

```bash
grep -n "\.\./assets/" dnd/js/*.js
```

Expected: `content.js` (resumePdf) and three lines in `scene.js` (textures, RobotExpressive, models).

- [ ] **Step 7: Add the back link**

In `dnd/index.html`, inside `<div id="ui">`, add as its first child:

```html
    <a class="office-link" href="../">← Back to the office</a>
```

Append to `dnd/css/sheet.css`:

```css
/* The way back to the main page. Parchment card, like the rest of the table's UI. */
.office-link {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 30;
  padding: 8px 12px;
  font: 600 13px/1 system-ui, sans-serif;
  letter-spacing: 0.04em;
  color: #2b2118;
  background: #efe4cc;
  border: 1px solid #2b2118;
  box-shadow: inset 0 0 0 3px #efe4cc, inset 0 0 0 4px #8c2f22;
  text-decoration: none;
}
.office-link:hover { background: #f6eedb; }
```

- [ ] **Step 8: Point the D&D harness at `/dnd/`**

```bash
cd "/c/Users/Horn S/Desktop/Resume/cv-3d"
sed -i "s#localhost:4330/#localhost:4330/dnd/#g; s#github.io/Horn.os/#github.io/Horn.os/dnd/#g" test/dnd/*.mjs
grep -hno "https\?://[^\"'\` ]*" test/dnd/*.mjs | sort -u
```

Expected: every URL contains `/dnd/`.

- [ ] **Step 9: Scripts, ignore rules and the current résumé**

Replace the `description` and `scripts` of `package.json` with:

```json
  "description": "Horn Saerens — the office and Horn.os. No build step: the page is static files. This manifest exists only for the test harness.",
  "scripts": {
    "serve": "python serve.py 4330",
    "test": "node --test \"test/unit/*.test.mjs\"",
    "test:e2e": "node --test --test-concurrency=1 \"test/e2e/*.test.mjs\"",
    "shots:os": "node test/hornos-shots.mjs",
    "dnd:shots": "node test/dnd/shots.mjs",
    "dnd:shots:live": "node test/dnd/shots.mjs --live",
    "dnd:bench:lights": "node test/dnd/lights.mjs",
    "dnd:bench:lamp": "node test/dnd/lamp.mjs",
    "dnd:bench:flicker": "node test/dnd/flicker.mjs",
    "dnd:bench:perf": "node test/dnd/perf.mjs",
    "dnd:bench:load": "node test/dnd/loadtime.mjs \"?debug=1\""
  },
```

Append to `.gitignore`:

```
test/dnd/out/
```

Replace the résumé PDF with CV v2 (same file name, so both pages link to the current one):

```bash
cp "/c/Users/Horn S/Desktop/Resume/Horn_Saerens_CV_2026_v2.pdf" "/c/Users/Horn S/Desktop/Resume/cv-3d/assets/Horn_Saerens_CV_2026.pdf"
```

- [ ] **Step 10: Run the smoke test to make sure it passes**

Run: `node --test test/e2e/dnd.test.mjs`
Expected: 2 tests PASS. If `failed` lists a 404, a D&D asset path was missed — fix it with the same `../assets/` rule and re-run.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "refactor: move the D&D table to dnd/, frozen, with a way back

The office takes the root. The table keeps working one folder down, reading the
shared assets through ../assets/, and its harness targets /dnd/. The résumé PDF
is now CV v2.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The profile and the content validator

**Files:**
- Create: `js/content/validate.js`, `js/content/profile.js`
- Test: `test/unit/content.test.mjs`

**Interfaces:**
- Produces:
  - `WINDOW_IDS: string[]` = `["chat","resume","skills","projects","contact","dnd"]`
  - `validateProfile(profile) → string[]` (empty = valid)
  - `validateDialogue(dialogue, profile) → string[]` (empty = valid)
  - `profile` object with: `name, title, focus, location, availability, email, links: { linkedin, github }, resumePdf, summary, company, experience: [{ role, dates, bullets: string[] }], skills: [{ group, items: string[] }], projects: [{ id, name, kind, status, stack: string[], problem?, built?, result?, summary? }], education: string[], languages`
  - Dialogue shape (validated here, written in Task 3): `{ start: string, nodes: { [id]: { question?: string, answer: Block[], again?: Block[], next: string[] } } }` where `Block = { p: string } | { list: string[] } | { project: string } | { open: string, label: string }`. `p` and list items support `**bold**` and `[label](href)` (not nested).

- [ ] **Step 1: Write the failing tests**

Create `test/unit/content.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateDialogue, validateProfile } from "../../js/content/validate.js";
import { profile } from "../../js/content/profile.js";

const tinyProfile = {
  name: "N", title: "T", email: "e", resumePdf: "r", summary: "s",
  projects: [{ id: "a", name: "A", kind: "k", status: "s", summary: "x" }],
};
const tiny = () => ({
  start: "root",
  nodes: {
    root: { answer: [{ p: "hi" }], again: [{ p: "again" }], next: ["x", "y"] },
    x: { question: "X?", answer: [{ project: "a" }], next: ["y"] },
    y: { question: "Y?", answer: [{ open: "resume", label: "Open" }, { list: ["one"] }], next: ["x"] },
  },
});

test("a well-formed tree has no errors", () => {
  assert.deepEqual(validateDialogue(tiny(), tinyProfile), []);
});

test("catches a next id that does not exist", () => {
  const d = tiny();
  d.nodes.x.next = ["nope"];
  assert.ok(validateDialogue(d, tinyProfile).some((e) => e.includes('"nope" does not exist')));
});

test("catches an unreachable node", () => {
  const d = tiny();
  d.nodes.z = { question: "Z?", answer: [{ p: "z" }], next: ["x"] };
  assert.ok(validateDialogue(d, tinyProfile).some((e) => e.startsWith("z: unreachable")));
});

test("catches an unknown project and an unknown window", () => {
  const d = tiny();
  d.nodes.x.answer = [{ project: "ghost" }];
  d.nodes.y.answer = [{ open: "terminal", label: "Open" }];
  const errors = validateDialogue(d, tinyProfile);
  assert.ok(errors.some((e) => e.includes('unknown project "ghost"')));
  assert.ok(errors.some((e) => e.includes('unknown window "terminal"')));
});

test("catches more than four next questions, and a start with fewer than two", () => {
  const d = tiny();
  d.nodes.x.next = ["y", "y", "y", "y", "y"];
  d.nodes.root.next = ["x"];
  const errors = validateDialogue(d, tinyProfile);
  assert.ok(errors.some((e) => e.startsWith("x: needs 1–4")));
  assert.ok(errors.some((e) => e.startsWith("root: needs 2–4")));
});

test("catches duplicate questions and a next that points back at the start", () => {
  const d = tiny();
  d.nodes.y.question = "X?";
  d.nodes.y.next = ["root"];
  const errors = validateDialogue(d, tinyProfile);
  assert.ok(errors.some((e) => e.includes("duplicates")));
  assert.ok(errors.some((e) => e.includes("must not point at the start")));
});

test("catches a block with two kinds and a start without an again answer", () => {
  const d = tiny();
  d.nodes.x.answer = [{ p: "a", list: ["b"] }];
  delete d.nodes.root.again;
  const errors = validateDialogue(d, tinyProfile);
  assert.ok(errors.some((e) => e.includes("exactly one of")));
  assert.ok(errors.some((e) => e.includes('"again"')));
});

test("validateProfile catches a project with neither a story nor a summary", () => {
  const p = structuredClone(tinyProfile);
  p.projects.push({ id: "b", name: "B", kind: "k", status: "s" });
  assert.ok(validateProfile(p).some((e) => e.startsWith("b: needs")));
});

test("the real profile is valid", () => {
  assert.deepEqual(validateProfile(profile), []);
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --test test/unit/content.test.mjs`
Expected: FAIL — `Cannot find module '.../js/content/validate.js'`.

- [ ] **Step 3: Write the validator**

Create `js/content/validate.js`:

```js
// Checks on the content modules, run by the unit tests. Pure: no DOM, no I/O.
//
// The dialogue is a graph written by hand, and a typo in a `next` id is a dead
// end a recruiter would hit. These checks make every such mistake a failing
// test instead.

export const WINDOW_IDS = ["chat", "resume", "skills", "projects", "contact", "dnd"];
const BLOCK_KINDS = ["p", "list", "project", "open"];

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
      if (kind === "p" && typeof b.p !== "string") errors.push(`${id}: block ${i} p must be text`);
      if (kind === "list" && (!Array.isArray(b.list) || b.list.length === 0)) errors.push(`${id}: block ${i} empty list`);
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
```

- [ ] **Step 4: Write the profile**

Create `js/content/profile.js`:

```js
// Horn, as data. Every line traces to CV v2 (Desktop/Resume/Horn_Saerens_CV_2026_v2.docx)
// or to a note in the Obsidian vault. Claims dropped as unsupported stay dropped:
// FreeScout "sole designer & developer", "Perseus AI Platform", the LibreChat
// platform "in production". Nothing here is rounded up.
//
// The résumé window reads this in the CV's own first person; the assistant in
// the chat talks about Horn in the third person from js/content/dialogue.js.

export const profile = {
  name: "Horn Saerens",
  title: "AI Solutions Consultant",
  focus: "AI agents, integrations & adoption",
  location: "Amsterdam",
  availability: "Based in Amsterdam · EU citizen · one-month notice",
  email: "saerenshorn@gmail.com",
  links: {
    linkedin: "https://www.linkedin.com/in/horn-saerens-7426b022b",
    github: "https://github.com/hsaerens-lgtm",
  },
  resumePdf: "assets/Horn_Saerens_CV_2026.pdf",

  summary:
    "I turn business problems into AI solutions that get deployed and actually used. Promoted through " +
    "four roles in four years at Spotzer Digital — Sales → Team Lead → Sales Operations → AI Solutions " +
    "Consultant — by building the solutions the business needed at each step. Hybrid profile: business " +
    "understanding, end-to-end technical ownership (architecture, development, integration, deployment), " +
    "and a track record of adoption by non-technical teams.",

  company: "Spotzer Digital, Amsterdam — promoted four times in four years",
  experience: [
    {
      role: "AI Solutions Consultant",
      dates: "Aug 2025 – Present",
      bullets: [
        "Own the full delivery cycle of AI solutions across sales, support, production, CRM and knowledge access: discovery, architecture, development, integration, deployment and enablement.",
        "Design AI agents connected to business tools and data (CRM, Google Workspace, support systems), with grounded outputs and human validation embedded in every flow.",
        "Benchmark and select models per use case: frontier APIs where capability drives value, self-hosted local models where customer data must stay in-house.",
        "Lead company-wide AI enablement on prompting, data security, hallucination control and agent creation.",
      ],
    },
    {
      role: "Sales Operations Manager",
      dates: "Jul 2024 – Aug 2025",
      bullets: [
        "Owned forecasting, market performance and strategy analysis; introduced the company's first AI-assisted processes into sales operations — the bridge to the AI role.",
      ],
    },
    {
      role: "Team Leader Sales",
      dates: "Sep 2023 – Jul 2024",
      bullets: ["Led and coached a sales team and streamlined sales-to-delivery handovers; **CEO Award**, Sep 2023."],
    },
    {
      role: "Sales Market Leader — FR Market",
      dates: "Apr 2022 – Oct 2023",
      bullets: ["Owned French-market sales through direct client engagement and tailored offers."],
    },
  ],

  skills: [
    {
      group: "AI agents & integrations",
      items: ["Agent design", "MCP servers", "REST APIs", "n8n", "LibreChat", "Codex", "Claude Code", "Prompting small self-hosted models"],
    },
    {
      group: "LLMs & model strategy",
      items: ["Claude, GPT, Gemini", "LM Studio, vLLM, Ollama", "Benchmarking & selection", "RAG", "Prompt evaluation on real samples", "Guardrails & hallucination control"],
    },
    {
      group: "Deployment & self-hosting",
      items: ["Docker & Compose", "GitHub Actions", "Caddy", "Render", "WSL2", "Self-hosted model serving"],
    },
    {
      group: "Engineering",
      items: ["TypeScript", "React / Vite", "Node.js / Express", "Python", "SQLite", "Supabase", "MongoDB", "Vitest / Playwright", "Electron", "Git"],
    },
    {
      group: "Business tools",
      items: ["Salesforce", "Twenty CRM", "Google Workspace APIs", "Power BI", "Tableau"],
    },
  ],

  projects: [
    {
      id: "freescout",
      name: "FreeScout AI Copilot",
      kind: "Support workspace",
      status: "In use by the support team",
      stack: ["React", "TypeScript", "Node / Express", "Docker", "Caddy", "Playwright"],
      problem:
        "Support agents juggled tickets, call transcripts and AI tools across separate systems, with customer data at risk of third-party exposure.",
      built:
        "A full-stack workspace unifying FreeScout tickets and call transcripts with contextual AI search, draft replies, per-mailbox HTML templates and business instructions, scheduled sends with a team calendar and a Cortex customer-brief tab. Google OAuth, per-operator identity, strict customer-context isolation before any model call, timeouts and rate limits on every outbound call.",
      result:
        "Deployed with Docker and Caddy, with a Render blueprint; provider-agnostic, so local models can replace cloud APIs; 268 unit and integration tests, 26 Playwright end-to-end tests, CI; prompts benchmarked on 30 real customer e-mails. The support team uses it with human review before every send.",
    },
    {
      id: "platform",
      name: "Internal AI platform on LibreChat",
      kind: "Internal platform",
      status: "Built from source · local build and online instance",
      stack: ["LibreChat", "Docker Compose", "MongoDB", "Meilisearch", "pgvector", "MCP", "LM Studio"],
      problem:
        "Give non-technical teams a safe, governed ChatGPT-like environment connected to company tools, instead of scattered personal AI accounts.",
      built:
        "LibreChat rebuilt from its sources: a container stack with MongoDB, Meilisearch, a RAG API and pgvector; a local model endpoint through LM Studio; Google Workspace, Atlassian and Gmail connected over MCP; an agent catalogue with search, indexing and access rules; duplicate detection that survives a provider being down. Plus a transportable backup-and-restore bundle for the whole environment, and a reusable skill that installs and verifies a new MCP server.",
      result:
        "Business teams create and reuse governed agents on one platform. The catalogue fixes are documented for replication on the online instance; guided agent creation for non-technical users is the work in progress.",
    },
    {
      id: "docflow",
      name: "Docflow",
      kind: "Document governance portal",
      status: "V1 delivered · connected to Google Workspace",
      stack: ["Node.js", "React", "SQLite", "Google Drive API", "Ollama"],
      problem:
        "Across thousands of Drive files nobody could tell which document was current, owned or approved, and AI tools had no governed corpus to read from.",
      built:
        "A portal with Google Drive as the single source of truth: admission with deterministic classification suggestions and versioning, a SQLite registry with an audit log, ACL-aware search by cited passages, knowledge capsules per audience, update sessions with Calendar and Meet, and local OCR through Ollama. Optional model-written answers never alter the retrieved passages.",
      result:
        "252 backend tests, Playwright end-to-end and CI; registry benchmarked at 1,000 and 3,000 documents; production preflight and Render blueprint ready.",
    },
    {
      id: "crm",
      name: "Daily Spotz",
      kind: "Internal CRM replacing Salesforce",
      status: "In progress since September 2026",
      stack: ["Twenty", "WSL2", "Docker"],
      summary:
        "Scoped and started an internal CRM on the open-source Twenty base, under five rules: extend rather than rewrite, no Enterprise spend, self-hosted, 100+ users, one isolated workspace per partner. WSL2 and Docker development stack, first core patches each documented with its proof, business logic planned as an SDK app with telephony webhooks.",
    },
    {
      id: "cortex",
      name: "Cortex conversation intelligence",
      kind: "Prompt engineering & integration",
      status: "Athena platform",
      stack: ["Gemma 4 E4B", "Prompt benchmarking"],
      summary:
        "Inventoried and unified the LLM prompts of the Cortex pipeline for a small self-hosted model, with a benchmark harness comparing prompt versions on real samples; integrated Cortex customer briefs into the support copilot and its reply prompts.",
    },
    {
      id: "callcoach",
      name: "Call Coach",
      kind: "Desktop call-evaluation app",
      status: "Desktop app",
      stack: ["Electron", "React"],
      summary:
        "Audio import and transcription, AI-generated QA scoring templates for support, sales and compliance, multi-provider model choice with API keys kept out of the renderer, local history and CSV / JSON export.",
    },
    {
      id: "enablement",
      name: "AI Day & AI Explorer",
      kind: "Company-wide AI enablement",
      status: "Delivered",
      stack: ["Workshop", "Training site"],
      summary:
        "A company-wide workshop — prompting, data security, hallucinations, RAG, MCP, hands-on agent creation — extended into a self-serve site: foundations, mindset, a prompting lab and a five-step agent-architect builder (purpose, knowledge, boundaries, persona, review).",
    },
    {
      id: "local",
      name: "Local models, end to end",
      kind: "Keeping customer data in-house",
      status: "Ongoing line of work",
      stack: ["LM Studio", "vLLM", "Ollama", "Docker"],
      summary:
        "A local model endpoint (LM Studio) wired into the platform's containers; a self-hosted vLLM or Ollama endpoint chosen as the support copilot's production target so customer data never leaves; a local-first AI workspace explored on local hardware with an open model. And one agent installed and then deliberately paused: too powerful to run unsupervised on a work machine with sensitive data.",
    },
    {
      id: "toolbox",
      name: "horn-dev",
      kind: "Personal Claude Code plugin",
      status: "Installed and in use",
      stack: ["Claude Code", "Vitest", "Playwright", "GitHub Actions"],
      problem:
        "Every project with a coding agent started from zero: which checks to run, how big a change is, what counts as proof.",
      built:
        "A plugin with one entry point that classifies the request (implement, fix, analyse, review, verify), sizes the work and picks the checks from what was touched; eight specialised commands; explicit approval before anything runs; verification reports tied to a fingerprint of the exact code they checked.",
      result:
        "Installed once and shared by all his projects; each project keeps only its own configuration, status and reports. Thirty tests cover the plugin itself.",
    },
    {
      id: "vault",
      name: "Obsidian working vault",
      kind: "Knowledge base for people and agents",
      status: "In use",
      stack: ["Obsidian", "Claude Code", "Codex"],
      summary:
        "Every project, decision, stack note and lesson in one vault, fed by the coding agents themselves through a sync skill and read by them before they touch a project — what was built, how and why, without moving the code out of its repositories.",
    },
    {
      id: "briefing",
      name: "Automated AI briefing",
      kind: "AI watch",
      status: "Prototype",
      stack: ["Newsletter", "Podcast script"],
      summary:
        "A recurring AI watch written for the job — adoption, agents, local models, simple tools — turned into a readable newsletter and a five-to-eight-minute podcast script. Scheduling it from a local coding agent proved unreliable; an external orchestrator is the recommended next step.",
    },
    {
      id: "salesops",
      name: "Sales & ops tooling",
      kind: "Internal tools",
      status: "Internal tools",
      stack: ["WordPress", "WebMCP"],
      summary:
        "A WordPress quote calculator (60-service catalogue, tolerant search, WebMCP tools), a deterministic client filter for order exports with a QA report, and AI lead-enrichment workflows: deduplication, profiling, product matching, scoring.",
    },
  ],

  education: [
    "Self-taught in AI engineering and software delivery — the projects are the proof of work.",
    "Architecture studies, ENSAG, Grenoble — 2013–2015.",
  ],
  languages: "French (native) · English (fluent)",
};
```

- [ ] **Step 5: Run the tests to make sure they pass**

Run: `node --test test/unit/content.test.mjs`
Expected: 9 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add js/content/validate.js js/content/profile.js test/unit/content.test.mjs
git commit -m "feat: Horn's profile as data, and a validator for it and the dialogue

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The dialogue tree

**Files:**
- Create: `js/content/dialogue.js`
- Test: `test/unit/dialogue.test.mjs`

**Interfaces:**
- Consumes: `validateDialogue(dialogue, profile)` and `profile` from Task 2.
- Produces: `dialogue` (shape defined in Task 2). Node ids used by later tests: `root`, `who`, `built`, `agents`, `contact`, `freescout`. The question text `"What has he built?"` is used by e2e tests and the screenshot script.

- [ ] **Step 1: Write the failing test**

Create `test/unit/dialogue.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateDialogue } from "../../js/content/validate.js";
import { profile } from "../../js/content/profile.js";
import { dialogue } from "../../js/content/dialogue.js";

test("the real dialogue is a valid, fully reachable tree", () => {
  assert.deepEqual(validateDialogue(dialogue, profile), []);
});

test("the start node offers the four entry topics", () => {
  const labels = dialogue.nodes[dialogue.start].next.map((id) => dialogue.nodes[id].question);
  assert.deepEqual(labels, ["Who is Horn?", "What has he built?", "How does he work with AI agents?", "How can I contact him?"]);
});

test("the assistant speaks about Horn, not as Horn", () => {
  const text = JSON.stringify(dialogue);
  assert.doesNotMatch(text, /\bI (built|am Horn|designed|worked)\b/);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test test/unit/dialogue.test.mjs`
Expected: FAIL — `Cannot find module '.../js/content/dialogue.js'`.

- [ ] **Step 3: Write the dialogue**

Create `js/content/dialogue.js`:

```js
// What Horn's assistant says in Horn.os. A tree of scripted answers: the visitor
// picks a question (or "types" it — every keystroke writes the scripted text),
// and each answer offers the next questions. There is no model behind it, so it
// can never say anything that is not written here.
//
// Rules for editing: the assistant talks about Horn in the third person; every
// claim traces to CV v2 or the vault, like js/content/profile.js; 1–4 `next`
// questions per node (2–4 at the start); never point `next` at "root" — the
// chat adds "Back to topics" itself. `node --test test/unit/dialogue.test.mjs`
// catches dead ends, unreachable nodes and unknown project ids.
//
// Blocks: { p } paragraph, { list } bullets, { project: id } a card that opens
// the Projects window, { open: windowId, label } a button that opens a window.
// Text supports **bold** and [label](href), not nested.

export const dialogue = {
  start: "root",
  nodes: {
    root: {
      answer: [
        { p: "Hi, I'm Horn's assistant. I can tell you about his work, his projects, or why he'd fit your team." },
        { p: "Pick a question below — or just start typing." },
      ],
      again: [{ p: "Sure. What would you like to know?" }],
      next: ["who", "built", "agents", "contact"],
    },

    who: {
      question: "Who is Horn?",
      answer: [
        {
          p: "**Horn Saerens** is an AI Solutions Consultant at Spotzer Digital in Amsterdam. He turns business problems into AI solutions that get deployed and actually used — from discovery and architecture to development, integration, deployment and training the people who use them.",
        },
        { p: "His profile is hybrid: he came up through the business, and he now owns the technical delivery end to end." },
      ],
      next: ["background", "roles", "where", "skills"],
    },

    background: {
      question: "What's his background?",
      answer: [
        { p: "He was promoted **four times in four years** at Spotzer Digital, each time by building what the business needed next:" },
        {
          list: [
            "**Sales Market Leader**, French market — from 2022",
            "**Team Leader Sales** — from 2023, with a CEO Award that September",
            "**Sales Operations Manager** — from 2024, where he brought the first AI-assisted processes into sales operations",
            "**AI Solutions Consultant** — since August 2025",
          ],
        },
        { p: "He is self-taught in AI engineering and software delivery. Before that, he studied architecture at ENSAG in Grenoble." },
        { open: "resume", label: "Open the résumé" },
      ],
      next: ["roles", "built"],
    },

    roles: {
      question: "What roles is he looking for?",
      answer: [
        { p: "Roles where AI has to work in a real business, not just in a demo:" },
        { list: ["**AI Solutions Consultant / Engineer**", "**Forward Deployed Engineer**", "**Applied AI Engineer**"] },
        {
          p: "In practice: sitting with a team, understanding the process, building the agent or the integration, deploying it, and making sure people actually adopt it.",
        },
      ],
      next: ["fit", "where"],
    },

    fit: {
      question: "Why would he fit an AI Solutions or FDE role?",
      answer: [
        { p: "Because it's the job he already does:" },
        {
          list: [
            "**He speaks both languages.** Years in sales and sales operations mean he starts from the business problem, not from the model.",
            "**He ships end to end.** Architecture, code, Docker deployment, CI and tests — the support copilot alone carries 268 unit and integration tests and 26 end-to-end tests.",
            "**He picks the right model.** Frontier APIs where capability matters, self-hosted models where customer data must stay in-house — benchmarked on real samples.",
            "**He drives adoption.** He runs company-wide AI training and designs every flow with a human validating the output.",
          ],
        },
      ],
      next: ["built", "agents", "contact"],
    },

    where: {
      question: "Where is he based?",
      answer: [
        { p: "In **Amsterdam**. He's an EU citizen, so no visa is needed, and his notice period is **one month**." },
        { p: "He works in **French** (native) and **English** (fluent)." },
      ],
      next: ["contact", "roles"],
    },

    built: {
      question: "What has he built?",
      answer: [
        { p: "Here are the main ones. Pick a question to go deeper, or open a card for the details." },
        { project: "freescout" },
        { project: "platform" },
        { project: "local" },
      ],
      next: ["freescout", "platform", "local", "more"],
    },

    freescout: {
      question: "Tell me about the FreeScout AI Copilot.",
      answer: [
        {
          p: "The support team was juggling tickets, call transcripts and AI tools across separate systems, and customer data risked ending up with third parties.",
        },
        {
          p: "Horn built a **single support workspace**: FreeScout tickets and call transcripts side by side, with contextual AI search, draft replies, per-mailbox templates and scheduled sends. A human reviews every draft before it goes out.",
        },
        { project: "freescout" },
      ],
      next: ["freescout-how", "freescout-stack"],
    },

    "freescout-how": {
      question: "How does it keep customer data safe?",
      answer: [
        { p: "Three rules shape it:" },
        {
          list: [
            "**Isolation first.** Before any model call, the context is strictly limited to the current customer — nothing else is sent.",
            "**Identity everywhere.** Google sign-in, per-operator identity, timeouts and rate limits on every outbound call.",
            "**Provider-agnostic.** It talks to OpenAI-compatible endpoints, so a self-hosted local model can replace a cloud API without a rewrite.",
          ],
        },
        { p: "The prompts were benchmarked on 30 real customer e-mails before the team relied on them." },
      ],
      next: ["freescout-stack", "local"],
    },

    "freescout-stack": {
      question: "What's the copilot's stack?",
      answer: [
        {
          list: [
            "**Front end:** React and TypeScript",
            "**Back end:** Node and Express",
            "**Deployment:** Docker and Caddy, with a Render blueprint",
            "**Quality:** 268 unit and integration tests, 26 Playwright end-to-end tests, CI on every change",
          ],
        },
      ],
      next: ["freescout-how", "platform"],
    },

    platform: {
      question: "What's the LibreChat platform?",
      answer: [
        {
          p: "Non-technical teams needed a safe, governed ChatGPT-like environment connected to company tools — instead of everyone using their own personal AI accounts.",
        },
        {
          p: "Horn **rebuilt LibreChat from source** into an internal platform: a full container stack with RAG, a local model endpoint, Google Workspace, Atlassian and Gmail connected over MCP, and an agent catalogue with search and access rules. Business teams create and reuse governed agents in one place.",
        },
        { project: "platform" },
      ],
      next: ["platform-docker", "platform-mcp"],
    },

    "platform-docker": {
      question: "What was the Docker migration?",
      answer: [
        {
          p: "The whole environment runs as containers: LibreChat, MongoDB, Meilisearch, a RAG API with pgvector, and a local model endpoint through LM Studio.",
        },
        { p: "He also packaged a **transportable backup-and-restore bundle**, so the entire environment can be moved to another machine and brought back up." },
      ],
      next: ["platform-mcp", "local"],
    },

    "platform-mcp": {
      question: "What's the MCP installer?",
      answer: [
        { p: "Connecting a new tool to the platform over **MCP** used to mean redoing the same procedure by hand every time." },
        {
          p: "Horn turned it into a **reusable skill**: it installs a new MCP server and verifies that it works, so adding a connector is a repeatable step, not a one-off procedure.",
        },
      ],
      next: ["platform-docker", "agents"],
    },

    local: {
      question: "What about local models?",
      answer: [
        {
          p: "For anything that must not leave the building, Horn runs **open models on local hardware**: an LM Studio endpoint wired into the platform, and a self-hosted vLLM or Ollama endpoint chosen as the support copilot's production target.",
        },
        {
          p: "He also knows when not to: one agent was installed and then **deliberately paused** — too powerful to run unsupervised on a work machine with sensitive data.",
        },
        { project: "local" },
      ],
      next: ["local-why", "agents-models"],
    },

    "local-why": {
      question: "Why keep the data home?",
      answer: [
        { p: "Because it's the first question every business team asks: **where does my data go?**" },
        {
          p: "Local models answer it cleanly — customer data never leaves the company's infrastructure. They take more effort to set up and are smaller than frontier models, so Horn writes prompts for them specifically and benchmarks them on real samples before trusting them.",
        },
      ],
      next: ["agents-models", "freescout"],
    },

    more: {
      question: "What else has he built?",
      answer: [
        { p: "Quite a lot. A few more:" },
        { project: "docflow" },
        { project: "crm" },
        { project: "cortex" },
        { project: "callcoach" },
        { open: "projects", label: "Open all projects" },
      ],
      next: ["toolbox", "enablement", "contact"],
    },

    enablement: {
      question: "Does he train people too?",
      answer: [
        {
          p: "Yes — adoption is half the job. He designed and ran a company-wide **AI Day** workshop: prompting, data security, hallucinations, RAG, MCP and hands-on agent creation.",
        },
        {
          p: "It grew into **AI Explorer**, a self-serve training site with foundations, a prompting lab and a five-step agent-architect builder: purpose, knowledge, boundaries, persona, review.",
        },
        { project: "enablement" },
      ],
      next: ["agents", "fit"],
    },

    toolbox: {
      question: "What is horn-dev?",
      answer: [
        { p: "**horn-dev** is his personal Claude Code plugin — the method he makes every coding agent follow:" },
        {
          list: [
            "One entry point that classifies the request and sizes the work",
            "Checks picked from what the change touched",
            "Explicit approval before anything runs",
            "Verification reports tied to the exact code they checked",
          ],
        },
        { p: "It's installed once and shared by all his projects, with thirty tests covering the plugin itself." },
        { project: "toolbox" },
      ],
      next: ["agents-reliable", "more"],
    },

    agents: {
      question: "How does he work with AI agents?",
      answer: [
        { p: "Like a lead with a team: he sets the scope, writes the rules, hands each agent its tools, and checks what comes back." },
        {
          p: "He builds agents that connect to business tools and data — CRM, Google Workspace, support systems — with **grounded outputs** and a **human validating** every flow that matters.",
        },
      ],
      next: ["agents-models", "agents-reliable", "toolbox"],
    },

    "agents-models": {
      question: "Which models does he use?",
      answer: [
        {
          list: [
            "**Frontier models** — Claude, GPT and Gemini, where capability drives the value",
            "**Local models** — through LM Studio, vLLM and Ollama, where data has to stay in-house",
            "**Coding agents** — Claude Code and Codex, every day",
          ],
        },
        { p: "The choice is made per use case and benchmarked on real samples, not decided once for everything." },
      ],
      next: ["local", "agents-reliable"],
    },

    "agents-reliable": {
      question: "How does he keep them reliable?",
      answer: [
        {
          list: [
            "**Grounding:** answers come from the customer's or the company's own data, with the context bounded before every call",
            "**Humans in the loop:** a person validates the output wherever it reaches a customer",
            "**Evaluation:** prompts are compared on real samples before they ship",
            "**Method:** his coding agents follow horn-dev — approval before action, proof after",
          ],
        },
      ],
      next: ["toolbox", "fit"],
    },

    skills: {
      question: "What are his skills?",
      answer: [
        {
          list: [
            "**AI agents & integrations:** agent design, MCP servers, REST APIs, n8n, LibreChat, Claude Code, Codex",
            "**LLMs & model strategy:** frontier and local models, benchmarking, RAG, guardrails and hallucination control",
            "**Deployment:** Docker & Compose, GitHub Actions, Caddy, Render, WSL2",
            "**Engineering:** TypeScript, React, Node / Express, Python, SQLite, Supabase, MongoDB, Vitest, Playwright, Electron",
            "**Business tools:** Salesforce, Twenty CRM, Google Workspace APIs, Power BI, Tableau",
          ],
        },
        { open: "skills", label: "Open Skills" },
      ],
      next: ["built", "agents", "contact"],
    },

    contact: {
      question: "How can I contact him?",
      answer: [
        { p: "The best way is e-mail: [saerenshorn@gmail.com](mailto:saerenshorn@gmail.com)" },
        {
          list: [
            "LinkedIn: [horn-saerens](https://www.linkedin.com/in/horn-saerens-7426b022b)",
            "GitHub: [hsaerens-lgtm](https://github.com/hsaerens-lgtm)",
          ],
        },
        { open: "resume", label: "Open the résumé" },
      ],
      next: ["roles", "built"],
    },
  },
};
```

- [ ] **Step 4: Run the tests to make sure they pass**

Run: `node --test test/unit/dialogue.test.mjs`
Expected: 3 tests PASS. If the validator reports an error, fix the node it names — never loosen the validator.

- [ ] **Step 5: Commit**

```bash
git add js/content/dialogue.js test/unit/dialogue.test.mjs
git commit -m "feat: the assistant's question tree, drafted from the CV and the vault

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Pure chat helpers — inline markdown and typing

**Files:**
- Create: `js/os/inline.js`, `js/os/typing.js`
- Test: `test/unit/inline.test.mjs`, `test/unit/typing.test.mjs`

**Interfaces:**
- Produces:
  - `parseInline(text: string) → Array<{ kind: "text"|"bold"|"link", text: string, href?: string }>`
  - `wordTokens(segments) → Array<{ seg: number, text: string }>` — joining every `text` reproduces the concatenated segment texts exactly
  - `TYPE_MS = 35`, `WORD_MS = 28`
  - `typeDelay(rand?) → number` in [21, 49]
  - `thinkingDelay(rand?) → number` in [600, 1000]
  - `advanceTyping(typed: string, target: string, rand?) → string` — a prefix of `target`, 1–3 characters longer than `typed` (capped at `target`); restarts from `""` if `typed` is not a prefix of `target`

- [ ] **Step 1: Write the failing tests**

Create `test/unit/inline.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseInline, wordTokens } from "../../js/os/inline.js";

test("plain text is one text segment", () => {
  assert.deepEqual(parseInline("hello there"), [{ kind: "text", text: "hello there" }]);
});

test("bold and links split the text", () => {
  assert.deepEqual(parseInline("a **b c** d [e](mailto:x@y.z) f"), [
    { kind: "text", text: "a " },
    { kind: "bold", text: "b c" },
    { kind: "text", text: " d " },
    { kind: "link", text: "e", href: "mailto:x@y.z" },
    { kind: "text", text: " f" },
  ]);
});

test("word tokens rebuild the text exactly and remember their segment", () => {
  const segs = parseInline("One  **two three** four");
  const tokens = wordTokens(segs);
  assert.equal(tokens.map((t) => t.text).join(""), "One  two three four");
  assert.deepEqual(tokens.map((t) => t.seg), [0, 1, 1, 2]);
});
```

Create `test/unit/typing.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceTyping, typeDelay, thinkingDelay } from "../../js/os/typing.js";

const fixed = (v) => () => v;

test("a keystroke advances one to three characters", () => {
  assert.equal(advanceTyping("", "Who is Horn?", fixed(0)), "W");
  assert.equal(advanceTyping("W", "Who is Horn?", fixed(0.5)), "Who");
  assert.equal(advanceTyping("Who", "Who is Horn?", fixed(0.999)), "Who is");
});

test("typing never runs past the question", () => {
  assert.equal(advanceTyping("Who is Horn", "Who is Horn?", fixed(0.999)), "Who is Horn?");
  assert.equal(advanceTyping("Who is Horn?", "Who is Horn?", fixed(0.999)), "Who is Horn?");
});

test("typing restarts when the target changed", () => {
  assert.equal(advanceTyping("Who", "Where is he based?", fixed(0)), "W");
  assert.equal(advanceTyping("Wx", "Where is he based?", fixed(0)), "W");
});

test("delays stay in their ranges", () => {
  assert.equal(typeDelay(fixed(0)), 21);
  assert.equal(typeDelay(fixed(0.999)), 49);
  assert.equal(thinkingDelay(fixed(0)), 600);
  assert.equal(thinkingDelay(fixed(1)), 1000);
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --test test/unit/inline.test.mjs test/unit/typing.test.mjs`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the helpers**

Create `js/os/inline.js`:

```js
// The two inline marks the dialogue uses, **bold** and [label](href), parsed
// into segments; and those segments cut into words for streaming. Pure.
// Nesting (a link inside bold) is deliberately not supported.

const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(text) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ kind: "bold", text: m[1] });
    else out.push({ kind: "link", text: m[2], href: m[3] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

// Each token keeps the whitespace around it, so writing the tokens one after
// another rebuilds the paragraph exactly.
export function wordTokens(segments) {
  const tokens = [];
  segments.forEach((s, seg) => {
    for (const w of s.text.match(/\s*\S+\s*|\s+/g) ?? []) tokens.push({ seg, text: w });
  });
  return tokens;
}
```

Create `js/os/typing.js`:

```js
// Timings for the chat's two illusions: the visitor "typing" a scripted
// question, and the assistant "streaming" its answer. Pure; `rand` is
// injectable so the tests are deterministic.

export const TYPE_MS = 35; // mean delay per character when a chip types itself
export const WORD_MS = 28; // delay per word when an answer streams

export function typeDelay(rand = Math.random) {
  return Math.round(TYPE_MS * (0.6 + 0.8 * rand()));
}

export function thinkingDelay(rand = Math.random) {
  return 600 + Math.round(400 * rand());
}

// One real keystroke writes the next 1–3 characters of the scripted question,
// never the key that was pressed.
export function advanceTyping(typed, target, rand = Math.random) {
  const from = target.startsWith(typed) ? typed.length : 0;
  const step = 1 + Math.floor(3 * rand());
  return target.slice(0, Math.min(target.length, from + step));
}
```

- [ ] **Step 4: Run the tests to make sure they pass**

Run: `npm test`
Expected: all unit tests PASS (content, dialogue, inline, typing).

- [ ] **Step 5: Commit**

```bash
git add js/os/inline.js js/os/typing.js test/unit/inline.test.mjs test/unit/typing.test.mjs
git commit -m "feat: inline marks and typing timings for the chat, pure and tested

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The Horn.os desktop, window manager and content windows

**Files:**
- Create: `js/os/dom.js`, `js/os/icons.js`, `js/os/wm.js`, `js/os/hornos.js`, `js/os/windows/resume.js`, `js/os/windows/skills.js`, `js/os/windows/projects.js`, `js/os/windows/contact.js`, `js/os/windows/dnd.js`, `css/hornos.css`, `index.html`, `js/main.js`
- Test: `test/e2e/hornos-shell.test.mjs`

**Interfaces:**
- Consumes: `profile` (Task 2), `parseInline` (Task 4), `startServer`/`openPage` (Task 1).
- Produces:
  - `h(tag, attrs?, ...children) → HTMLElement` — `class` sets className, `on*` adds listeners, `true` → empty attribute, `null`/`false` skipped
  - `segmentEl(segment, text) → Node`, `renderInline(text) → DocumentFragment`, `externalLink(href, text) → HTMLAnchorElement`
  - `ICONS: { chat, resume, skills, projects, contact, dnd: () => SVGElement }`
  - `createWindowManager(desktopEl, { onChange? }) → { register(id, spec), open(id, arg?), close(id), minimise(id), focus(id), toggle(id), top() → id|null, state(id) → "closed"|"open"|"minimised", api(id) }` where `spec = { title, width?, height?, center?, render(bodyEl, { close }) → api|undefined }`. `open(id, arg)` calls `api.show(arg)` when `arg` is given; `close` calls `api.dispose?.()`; reopening after close re-renders.
  - `createHornOS(root, { profile, theme?, onBack?, dndHref? }) → { wm, open(id, arg?), setTheme(t), focus(), blur() }` (Task 6 adds `dialogue` and `onStream` options)
  - `renderProjects(body, profile) → { show(projectId) }`
  - DOM hooks used by tests: `.hornos[data-theme]`, `.dock-item[data-open=<id>]` with `.is-open` / `.is-front`, `.win[data-win=<id>]`, `.win-bar`, `[data-act="min"]`, `[data-act="close"]`, `.proj-detail h1`, `.proj-item[data-project]`
  - `window.__os` (the Horn.os handle) when the URL has `?debug`; `?theme=light|dark` forces the theme

- [ ] **Step 1: Write the failing e2e tests**

Create `test/e2e/hornos-shell.test.mjs`:

```js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, openPage } from "./harness.mjs";

let server;
before(async () => {
  server = await startServer(4341);
});
after(() => server.stop());

const isOpen = (page, id) => page.locator(`.dock-item[data-open="${id}"]`).evaluate((e) => e.classList.contains("is-open"));

test("the desktop renders with its dock and no errors", async () => {
  const { page, errors, failed, close } = await openPage(server.url);
  try {
    await page.waitForSelector(".hornos-dock");
    const labels = await page.$$eval(".dock-item", (els) => els.map((e) => e.getAttribute("aria-label")));
    assert.deepEqual(labels, ["Resume", "Skills", "Projects", "Contact", "DnD"]);
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
  } finally {
    await close();
  }
});

test("a dock icon opens its window, which drags, minimises in place and closes", async () => {
  const { page, close } = await openPage(server.url);
  try {
    await page.click('.dock-item[data-open="resume"]');
    const win = page.locator('.win[data-win="resume"]');
    await win.waitFor({ state: "visible" });
    assert.match(await win.textContent(), /Horn Saerens/);

    const start = await win.boundingBox();
    const bar = await win.locator(".win-bar").boundingBox();
    await page.mouse.move(bar.x + 80, bar.y + 20);
    await page.mouse.down();
    await page.mouse.move(bar.x + 180, bar.y + 80, { steps: 6 });
    await page.mouse.up();
    const moved = await win.boundingBox();
    assert.ok(Math.abs(moved.x - start.x - 100) <= 2 && Math.abs(moved.y - start.y - 60) <= 2, `moved by ${moved.x - start.x}, ${moved.y - start.y}`);

    await win.locator('[data-act="min"]').click();
    await win.waitFor({ state: "hidden" });
    assert.ok(await isOpen(page, "resume"), "a minimised window keeps its dock dot");
    await page.click('.dock-item[data-open="resume"]');
    await win.waitFor({ state: "visible" });
    assert.equal((await win.boundingBox()).x, moved.x, "restored where it was left");

    await win.locator('[data-act="close"]').click();
    await win.waitFor({ state: "hidden" });
    assert.ok(!(await isOpen(page, "resume")), "a closed window loses its dock dot");
  } finally {
    await close();
  }
});

test("the Projects window can be opened on a given project", async () => {
  const { page, close } = await openPage(`${server.url}?debug=1`);
  try {
    await page.waitForFunction(() => !!window.__os);
    await page.evaluate(() => window.__os.open("projects", "docflow"));
    assert.equal(await page.textContent(".proj-detail h1"), "Docflow");
    await page.click('.proj-item[data-project="freescout"]');
    assert.equal(await page.textContent(".proj-detail h1"), "FreeScout AI Copilot");
  } finally {
    await close();
  }
});

test("the résumé download points at a real PDF", async () => {
  const { page, close } = await openPage(server.url);
  try {
    await page.click('.dock-item[data-open="resume"]');
    const href = await page.getAttribute('.win[data-win="resume"] a[download]', "href");
    const res = await page.request.get(new URL(href, page.url()).href);
    assert.equal(res.status(), 200);
    assert.equal(res.headers()["content-type"], "application/pdf");
  } finally {
    await close();
  }
});

test("the DnD window leads to the bonus page", async () => {
  const { page, close } = await openPage(server.url);
  try {
    await page.click('.dock-item[data-open="dnd"]');
    await page.click('.win[data-win="dnd"] a.btn');
    await page.waitForURL(/\/dnd\/$/);
  } finally {
    await close();
  }
});

test("on a phone-width screen a window fills the width", async () => {
  const { page, close } = await openPage(server.url, { width: 390, height: 844 });
  try {
    await page.click('.dock-item[data-open="skills"]');
    const box = await page.locator('.win[data-win="skills"]').boundingBox();
    assert.equal(Math.round(box.width), 390);
  } finally {
    await close();
  }
});

test("?theme=dark forces the dark theme", async () => {
  const { page, close } = await openPage(`${server.url}?theme=dark`);
  try {
    assert.equal(await page.getAttribute(".hornos", "data-theme"), "dark");
  } finally {
    await close();
  }
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --test test/e2e/hornos-shell.test.mjs`
Expected: FAIL — the root has no `index.html` (404), `.hornos-dock` never appears.

- [ ] **Step 3: Write the DOM helpers and icons**

Create `js/os/dom.js`:

```js
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
```

Create `js/os/icons.js`:

```js
// Line icons for the dock and the project cards: 24-unit grid, drawn with the
// current text colour so they follow the theme.

const NS = "http://www.w3.org/2000/svg";

function icon(...paths) {
  return () => {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", "icon");
    for (const d of paths) {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", d);
      svg.append(p);
    }
    return svg;
  };
}

export const ICONS = {
  chat: icon("M4 5h16v11H9l-5 4z", "M8 9h8", "M8 12h5"),
  resume: icon("M6 3h9l3 3v15H6z", "M15 3v3h3", "M9 11h6", "M9 15h6"),
  skills: icon("M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"),
  projects: icon("M3 7h7l2 2h9v10H3z"),
  contact: icon("M3 6h18v12H3z", "M3 7l9 6 9-6"),
  dnd: icon("M12 2l9 5v10l-9 5-9-5V7z", "M12 7l5 9H7z"),
};
```

- [ ] **Step 4: Write the window manager**

Create `js/os/wm.js`:

```js
// Windows on the Horn.os desktop: open, focus, drag by the title bar, minimise
// (keeps state and position), close (discards; reopening renders afresh).
// On narrow screens CSS makes every window full-bleed and dragging is off.

import { h } from "./dom.js";

const NARROW = "(max-width: 700px)";
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createWindowManager(desktop, { onChange = () => {} } = {}) {
  const entries = new Map(); // id -> { spec, el, body, api, state }
  let z = 10;
  let cascade = 0;

  function register(id, spec) {
    entries.set(id, { spec, el: null, body: null, api: null, state: "closed" });
  }

  function build(id, entry) {
    const { title } = entry.spec;
    const body = h("div", { class: "win-body" });
    const bar = h(
      "header",
      { class: "win-bar" },
      h("span", { class: "win-title" }, title),
      h(
        "div",
        { class: "win-ctrl" },
        h("button", { type: "button", class: "win-btn", "data-act": "min", "aria-label": `Minimise ${title}`, onclick: () => minimise(id) }, "–"),
        h("button", { type: "button", class: "win-btn", "data-act": "close", "aria-label": `Close ${title}`, onclick: () => close(id) }, "×"),
      ),
    );
    const el = h("section", { class: "win", "data-win": id, role: "dialog", "aria-label": title }, bar, body);
    el.addEventListener("pointerdown", () => focus(id));
    makeDraggable(el, bar, desktop);
    desktop.append(el);
    entry.el = el;
    entry.body = body;
  }

  function place(entry) {
    const { spec, el } = entry;
    const W = desktop.clientWidth;
    const H = desktop.clientHeight;
    const w = Math.min(spec.width ?? 640, W - 24);
    const ht = Math.min(spec.height ?? 480, H - 24);
    let x;
    let y;
    if (spec.center) {
      x = (W - w) / 2;
      y = (H - ht) / 2;
    } else {
      x = 48 + (cascade % 5) * 32;
      y = 40 + (cascade % 5) * 28;
      cascade++;
    }
    el.style.width = `${w}px`;
    el.style.height = `${ht}px`;
    el.style.left = `${Math.round(clamp(x, 0, W - w))}px`;
    el.style.top = `${Math.round(clamp(y, 0, H - ht))}px`;
  }

  function open(id, arg) {
    const entry = entries.get(id);
    if (!entry) return;
    if (!entry.el) build(id, entry);
    if (entry.state === "closed") {
      entry.body.replaceChildren();
      entry.api = entry.spec.render(entry.body, { close: () => close(id) }) ?? null;
      place(entry);
    }
    entry.state = "open";
    entry.el.hidden = false;
    focus(id);
    if (arg !== undefined) entry.api?.show?.(arg);
    onChange();
  }

  function minimise(id) {
    const e = entries.get(id);
    if (!e || e.state !== "open") return;
    e.state = "minimised";
    e.el.hidden = true;
    onChange();
  }

  function close(id) {
    const e = entries.get(id);
    if (!e || e.state === "closed") return;
    e.state = "closed";
    e.el.hidden = true;
    e.api?.dispose?.();
    onChange();
  }

  function focus(id) {
    const e = entries.get(id);
    if (!e?.el) return;
    e.el.style.zIndex = String(++z);
    for (const other of entries.values()) other.el?.classList.toggle("is-front", other === e);
    onChange();
  }

  function top() {
    let best = null;
    let bestZ = -1;
    for (const [id, e] of entries) {
      if (e.state !== "open") continue;
      const zi = Number(e.el.style.zIndex);
      if (zi > bestZ) {
        bestZ = zi;
        best = id;
      }
    }
    return best;
  }

  function toggle(id) {
    const e = entries.get(id);
    if (!e) return;
    if (e.state === "open" && top() === id) minimise(id);
    else open(id);
  }

  return {
    register,
    open,
    close,
    minimise,
    focus,
    toggle,
    top,
    state: (id) => entries.get(id)?.state ?? "closed",
    api: (id) => entries.get(id)?.api ?? null,
  };
}

function makeDraggable(el, handle, bounds) {
  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest("button") || matchMedia(NARROW).matches) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const left = el.offsetLeft;
    const top = el.offsetTop;
    handle.setPointerCapture(e.pointerId);
    const move = (ev) => {
      el.style.left = `${clamp(left + ev.clientX - startX, 0, bounds.clientWidth - el.offsetWidth)}px`;
      el.style.top = `${clamp(top + ev.clientY - startY, 0, bounds.clientHeight - 40)}px`;
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  });
}
```

- [ ] **Step 5: Write the content windows**

Create `js/os/windows/resume.js`:

```js
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
```

Create `js/os/windows/skills.js`:

```js
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
```

Create `js/os/windows/projects.js`:

```js
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
```

Create `js/os/windows/contact.js`:

```js
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
```

Create `js/os/windows/dnd.js`:

```js
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
```

- [ ] **Step 6: Write the Horn.os shell**

Create `js/os/hornos.js`:

```js
// Horn.os: the desktop on Horn's monitor. Plain DOM, no Three.js — the same
// module runs full screen (phones, no WebGL) and, from plan 2 on, mounted on
// the 3D monitor through CSS3D.

import { h } from "./dom.js";
import { ICONS } from "./icons.js";
import { createWindowManager } from "./wm.js";
import { renderResume } from "./windows/resume.js";
import { renderSkills } from "./windows/skills.js";
import { renderProjects } from "./windows/projects.js";
import { renderContact } from "./windows/contact.js";
import { renderDnd } from "./windows/dnd.js";

const DOCK = [
  { id: "resume", label: "Resume" },
  { id: "skills", label: "Skills" },
  { id: "projects", label: "Projects" },
  { id: "contact", label: "Contact" },
  { id: "dnd", label: "DnD" },
];

export function createHornOS(root, { profile, theme = "light", onBack = null, dndHref = "dnd/" } = {}) {
  const desktop = h("div", { class: "hornos-desktop" });
  const clock = h("span", { class: "hornos-clock" });
  const bar = h(
    "div",
    { class: "hornos-bar" },
    h("span", { class: "hornos-brand" }, "Horn.os"),
    h("span", { class: "hornos-who" }, `${profile.name} · ${profile.title}`),
    clock,
    onBack && h("button", { type: "button", class: "hornos-back", onclick: onBack }, "← Back"),
  );
  const dock = h("nav", { class: "hornos-dock", "aria-label": "Applications" });
  const shell = h("div", { class: "hornos", "data-theme": theme }, bar, desktop, dock);
  root.replaceChildren(shell);

  const wm = createWindowManager(desktop, { onChange: syncDock });
  wm.register("resume", { title: "Resume", width: 720, height: 560, render: (b) => renderResume(b, profile) });
  wm.register("skills", { title: "Skills", width: 620, height: 500, render: (b) => renderSkills(b, profile) });
  wm.register("projects", { title: "Projects", width: 840, height: 560, render: (b) => renderProjects(b, profile) });
  wm.register("contact", { title: "Contact", width: 460, height: 380, render: (b) => renderContact(b, profile) });
  wm.register("dnd", { title: "DnD — bonus project", width: 500, height: 400, render: (b) => renderDnd(b, dndHref) });

  for (const item of DOCK) {
    dock.append(
      h(
        "button",
        { type: "button", class: "dock-item", "data-open": item.id, "aria-label": item.label, title: item.label, onclick: () => wm.toggle(item.id) },
        ICONS[item.id](),
        h("span", { class: "dock-label" }, item.label),
      ),
    );
  }

  function syncDock() {
    const front = wm.top();
    for (const btn of dock.querySelectorAll(".dock-item")) {
      btn.classList.toggle("is-open", wm.state(btn.dataset.open) !== "closed");
      btn.classList.toggle("is-front", front === btn.dataset.open);
    }
  }

  const tick = () => {
    clock.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };
  tick();
  setInterval(tick, 30_000);

  let active = true;
  return {
    wm,
    open: (id, arg) => wm.open(id, arg),
    setTheme(t) {
      shell.dataset.theme = t;
    },
    focus() {
      active = true;
    },
    blur() {
      active = false;
    },
    get active() {
      return active;
    },
  };
}
```

- [ ] **Step 7: Write the stylesheet**

Create `css/hornos.css`:

```css
/* Horn.os — a calm, modern desktop. Two themes on the same tokens; the room
   sets the theme from its day cycle (plan 3), ?theme= forces it. */

.hornos {
  --font: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --radius: 14px;
  --bg: radial-gradient(120% 90% at 20% 10%, #f4efe4 0%, #e3eadf 55%, #cfdcd2 100%);
  --surface: #ffffff;
  --surface-2: #f4f3ef;
  --text: #1c1c1a;
  --muted: #6a6963;
  --line: rgba(20, 20, 10, 0.09);
  --accent: #2f6f5e;
  --accent-ink: #ffffff;
  --accent-soft: #e2eee8;
  --shadow: 0 18px 50px rgba(30, 40, 30, 0.18), 0 2px 6px rgba(30, 40, 30, 0.08);
  --bar: rgba(255, 255, 255, 0.62);
  --dock: rgba(255, 255, 255, 0.72);

  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: grid;
  grid-template-rows: 36px 1fr auto;
  font: 15px/1.55 var(--font);
  color: var(--text);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
}
.hornos[data-theme="dark"] {
  --bg: radial-gradient(120% 90% at 20% 10%, #23302b 0%, #181c1e 60%, #111315 100%);
  --surface: #1e1f22;
  --surface-2: #27292d;
  --text: #ebebe7;
  --muted: #9b9b95;
  --line: rgba(255, 255, 255, 0.08);
  --accent: #7cc3aa;
  --accent-ink: #0f1a16;
  --accent-soft: #22332d;
  --shadow: 0 18px 50px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.3);
  --bar: rgba(20, 22, 24, 0.7);
  --dock: rgba(28, 30, 33, 0.78);
}
.hornos *,
.hornos *::before,
.hornos *::after { box-sizing: border-box; }
.hornos button { font: inherit; color: inherit; }
.hornos a { color: var(--accent); }
.hornos :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* top bar */
.hornos-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  font-size: 13px;
  background: var(--bar);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--line);
}
.hornos-brand { font-weight: 700; letter-spacing: 0.02em; }
.hornos-who { color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hornos-clock { margin-left: auto; color: var(--muted); font-variant-numeric: tabular-nums; }
.hornos-back {
  padding: 3px 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  cursor: pointer;
}

.hornos-desktop { position: relative; overflow: hidden; }

/* dock */
.hornos-dock {
  justify-self: center;
  display: flex;
  gap: 6px;
  margin: 0 16px 14px;
  padding: 8px;
  background: var(--dock);
  backdrop-filter: blur(14px);
  border: 1px solid var(--line);
  border-radius: 20px;
  box-shadow: var(--shadow);
}
.dock-item {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 2px;
  width: 68px;
  padding: 8px 4px 6px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s;
}
.dock-item:hover { background: var(--surface-2); transform: translateY(-2px); }
.dock-item .icon { width: 26px; height: 26px; }
.dock-item[data-open="chat"] { color: var(--accent); }
.dock-label { font-size: 11px; color: var(--muted); }
.dock-item.is-open::after {
  content: "";
  position: absolute;
  bottom: 1px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--text);
  opacity: 0.5;
}
.dock-item.is-front::after { background: var(--accent); opacity: 1; }
.icon { fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }

/* windows */
.win {
  position: absolute;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
  animation: win-in 0.18s ease-out;
}
.win[hidden] { display: none; }
.win.is-front { border-color: color-mix(in srgb, var(--accent) 30%, var(--line)); }
@keyframes win-in {
  from { opacity: 0; transform: translateY(8px) scale(0.985); }
}
.win-bar {
  display: flex;
  align-items: center;
  height: 40px;
  flex: none;
  padding: 0 8px 0 16px;
  background: var(--surface-2);
  border-bottom: 1px solid var(--line);
  cursor: grab;
  user-select: none;
  touch-action: none;
}
.win-bar:active { cursor: grabbing; }
.win-title { font-size: 13px; font-weight: 600; }
.win-ctrl { margin-left: auto; display: flex; gap: 2px; }
.win-btn {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.win-btn:hover { background: var(--line); color: var(--text); }
.win-body { flex: 1; min-height: 0; overflow: auto; }

/* documents */
.doc { max-width: 760px; padding: 28px 32px 36px; }
.doc h1,
.proj-detail h1 { margin: 0 0 4px; font-size: 26px; line-height: 1.2; letter-spacing: -0.01em; }
.doc h2,
.proj-detail h2 {
  margin: 28px 0 10px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}
.doc h3 { margin: 0; font-size: 15px; }
.doc ul { margin: 8px 0 0; padding-left: 20px; }
.doc li { margin: 4px 0; }
.doc-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 16px; }
.doc-sub { margin: 0; font-weight: 500; }
.doc-meta { margin: 4px 0 0; font-size: 13px; color: var(--muted); }
.doc-lead { margin: 20px 0 0; font-size: 16px; }
.doc-kicker { margin: 0 0 6px; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); }
.role { margin-top: 16px; }
.role-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; }
.role-dates { font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 20px;
  padding: 8px 16px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--text) !important;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}
.btn-primary { background: var(--accent); border-color: transparent; color: var(--accent-ink) !important; }
.doc-head .btn { margin-top: 0; }
.badges { display: flex; flex-wrap: wrap; gap: 6px; list-style: none; padding: 0 !important; margin: 8px 0 0; }
.badge { margin: 0 !important; padding: 4px 10px; border-radius: 999px; background: var(--accent-soft); font-size: 13px; }
.contact-list { list-style: none; padding: 0 !important; }
.contact-list li { display: grid; grid-template-columns: 90px 1fr; padding: 10px 0; border-bottom: 1px solid var(--line); }
.contact-list span { color: var(--muted); }

/* projects */
.projects { display: grid; grid-template-columns: 240px 1fr; height: 100%; }
.proj-list { margin: 0; padding: 8px; list-style: none; overflow: auto; background: var(--surface-2); border-right: 1px solid var(--line); }
.proj-item {
  display: grid;
  gap: 1px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.proj-item:hover { background: var(--line); }
.proj-item.is-active { background: var(--surface); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); }
.proj-name { font-size: 14px; font-weight: 600; }
.proj-kind { font-size: 12px; color: var(--muted); }
.proj-detail { padding: 28px 32px 36px; overflow: auto; }
.proj-detail p { max-width: 62ch; }
.proj-status { margin: 0; font-size: 13px; color: var(--muted); }

@media (max-width: 700px) {
  .win { left: 0 !important; top: 0 !important; width: 100% !important; height: 100% !important; border: 0; border-radius: 0; }
  .win-bar { cursor: default; }
  .hornos-who { display: none; }
  .dock-item { width: 52px; }
  .dock-label { font-size: 10px; }
  .projects { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
  .proj-list { display: flex; gap: 4px; overflow-x: auto; border-right: 0; border-bottom: 1px solid var(--line); }
  .proj-item { width: max-content; }
  .doc,
  .proj-detail { padding: 20px; }
}

@media (prefers-reduced-motion: reduce) {
  .win { animation: none; }
  .dock-item { transition: none; }
}
```

- [ ] **Step 8: Write the page and the bootstrap**

Create `index.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Horn Saerens — AI Solutions Consultant</title>
  <meta name="description" content="Horn Saerens, AI Solutions Consultant in Amsterdam. Ask his assistant on Horn.os about his work, his projects and why he'd fit your team." />
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%232f6f5e'/%3E%3Cpath d='M11 9v14M21 9v14M11 16h10' stroke='white' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
  <link rel="stylesheet" href="css/hornos.css" />
  <style>
    html, body { margin: 0; height: 100%; background: #111315; }
    #os { position: fixed; inset: 0; }
  </style>
</head>
<body>
  <div id="os"></div>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

Create `js/main.js`:

```js
// Bootstrap. In this first plan the page is Horn.os full screen; plan 2 puts
// it on the monitor of a 3D office and keeps this path as the fallback for
// phones and browsers without WebGL.

import { profile } from "./content/profile.js";
import { createHornOS } from "./os/hornos.js";

const params = new URLSearchParams(location.search);

// Night theme from 21:00 to 06:59 local time — the same hours the room's night
// phase will use.
function themeFor(date) {
  const hour = date.getHours();
  return hour >= 21 || hour < 7 ? "dark" : "light";
}

const forced = params.get("theme");
const theme = forced === "light" || forced === "dark" ? forced : themeFor(new Date());
const os = createHornOS(document.getElementById("os"), { profile, theme });

// A handle for tests and the console; ?debug only.
if (params.has("debug")) window.__os = os;
```

- [ ] **Step 9: Run the tests to make sure they pass**

Run: `node --test test/e2e/hornos-shell.test.mjs`
Expected: 7 tests PASS.

- [ ] **Step 10: Commit**

```bash
git add index.html js/main.js js/os css/hornos.css test/e2e/hornos-shell.test.mjs
git commit -m "feat: Horn.os desktop - dock, draggable windows, resume, skills, projects, contact, DnD

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The Horn.os chat

**Files:**
- Create: `js/os/chat.js`
- Modify: `js/os/hornos.js` (register and auto-open the chat, keyboard routing, `dialogue`/`onStream` options), `js/main.js` (pass `dialogue`), `css/hornos.css` (append chat styles), `test/e2e/hornos-shell.test.mjs` (dock labels now start with "Horn.os")
- Test: `test/e2e/hornos-chat.test.mjs`

**Interfaces:**
- Consumes: `h`, `segmentEl` (Task 5), `parseInline`, `wordTokens`, `advanceTyping`, `typeDelay`, `thinkingDelay`, `WORD_MS` (Task 4), `ICONS.projects` (Task 5), `dialogue` (Task 3), `profile` (Task 2).
- Produces:
  - `createChat(body, { dialogue, profile, onOpen(windowId, arg?), onStream(isStreaming: boolean), rand?, reducedMotion? }) → { handleKey(event) → boolean, dispose() }`
  - `createHornOS` gains options `dialogue` and `onStream`; the chat window id is `"chat"`, it opens centred on start, and printable keys / arrows / Enter / Backspace go to it while it is the front window and focus is on the page body or inside it.
  - DOM hooks: `.chat-log`, `.msg-user`, `.msg-bot`, `.typing`, `.chat-chips .chip` (`.is-hot` = highlighted, `.chip-back` = Back to topics), `.chat-field`, `.project-card[data-project]`, `.msg-action`
  - Plan 2 relies on `onStream` to drive the screen light.
  - Deliberate refinement of the spec: Tab is **not** intercepted (that would trap keyboard users in the chips). Tab moves native focus as usual, and a chip that receives focus becomes the highlighted one; arrow keys move the highlight.

- [ ] **Step 1: Write the failing e2e tests**

Create `test/e2e/hornos-chat.test.mjs`:

```js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, openPage } from "./harness.mjs";
import { dialogue } from "../../js/content/dialogue.js";

let server;
before(async () => {
  server = await startServer(4342);
});
after(() => server.stop());

const CHIP = ".chat-chips .chip:not(.chip-back)";
const chipNamed = (page, label) => page.locator(".chat-chips").getByRole("button", { name: label, exact: true });

test("the assistant greets and offers the four entry questions", async () => {
  const { page, errors, close } = await openPage(server.url);
  try {
    await page.waitForSelector(CHIP, { timeout: 10000 });
    assert.match(await page.textContent(".msg-bot"), /Horn's assistant/);
    assert.equal(await page.locator(".chat-chips .chip").count(), 4);
    assert.deepEqual(errors, []);
  } finally {
    await close();
  }
});

test("clicking a question types it into the field, then sends it", async () => {
  const { page, close } = await openPage(server.url);
  try {
    await page.waitForSelector(CHIP, { timeout: 10000 });
    const label = await page.textContent(CHIP);
    await page.click(CHIP);
    await page.waitForFunction(
      (l) => {
        const v = document.querySelector(".chat-field").value;
        return v.length > 2 && v.length < l.length;
      },
      label,
      { polling: 5, timeout: 3000 },
    );
    assert.ok(label.startsWith(await page.inputValue(".chat-field")), "mid-typing, the field holds a prefix of the question");
    await page.waitForSelector(".msg-user");
    assert.equal(await page.textContent(".msg-user"), label);
    await page.waitForSelector(".chip-back", { timeout: 15000 });
    assert.equal(await page.locator(".msg-bot").count(), 2);
  } finally {
    await close();
  }
});

test("keystrokes type the highlighted question, never the key itself", async () => {
  const { page, close } = await openPage(server.url, { reducedMotion: "reduce" });
  try {
    await page.waitForSelector(CHIP, { timeout: 10000 });
    const first = await page.textContent(".chip.is-hot");
    await page.keyboard.press("z");
    const v = await page.inputValue(".chat-field");
    assert.ok(v.length >= 1 && v.length <= 3 && first.startsWith(v), `"${v}" should start "${first}"`);
    for (let i = 0; i < 40; i++) await page.keyboard.press("q");
    assert.equal(await page.inputValue(".chat-field"), first, "typing stops at the end of the question");

    await page.keyboard.press("ArrowRight");
    assert.equal(await page.inputValue(".chat-field"), "", "moving the highlight clears the field");
    const second = await page.textContent(".chip.is-hot");
    assert.notEqual(second, first);

    await page.keyboard.press("Enter");
    await page.waitForSelector(".msg-user");
    assert.equal(await page.textContent(".msg-user"), second);
  } finally {
    await close();
  }
});

test("Back to topics returns to the entry questions", async () => {
  const { page, close } = await openPage(server.url, { reducedMotion: "reduce" });
  try {
    await page.waitForSelector(CHIP, { timeout: 10000 });
    await page.click(CHIP);
    await page.click(".chip-back");
    await page.waitForFunction(() => document.querySelectorAll(".msg-user").length === 2);
    await page.waitForSelector(CHIP);
    assert.equal(await page.locator(".chip-back").count(), 0);
    assert.equal(await page.locator(".chat-chips .chip").count(), 4);
    assert.match(await page.locator(".msg-bot").last().textContent(), /What would you like to know/);
  } finally {
    await close();
  }
});

test("with reduced motion the answer appears at once", async () => {
  const { page, close } = await openPage(server.url, { reducedMotion: "reduce" });
  try {
    await page.waitForSelector(CHIP, { timeout: 10000 });
    const t0 = Date.now();
    await page.click(CHIP);
    await page.waitForSelector(".chip-back", { timeout: 2000 });
    assert.ok(Date.now() - t0 < 1000, `took ${Date.now() - t0} ms`);
  } finally {
    await close();
  }
});

test("clicking a streaming answer finishes it", async () => {
  const { page, close } = await openPage(server.url);
  try {
    await page.waitForSelector(CHIP, { timeout: 10000 });
    await chipNamed(page, "Who is Horn?").click();
    await page.waitForFunction(() => document.querySelectorAll(".msg-bot").length === 2);
    await page.locator(".msg-bot").last().click();
    await page.waitForSelector(".chip-back", { timeout: 800 });
  } finally {
    await close();
  }
});

test("a project card opens the Projects window on that project", async () => {
  const { page, close } = await openPage(server.url, { reducedMotion: "reduce" });
  try {
    await page.waitForSelector(CHIP, { timeout: 10000 });
    await chipNamed(page, "What has he built?").click();
    await page.click('.project-card[data-project="freescout"]');
    await page.locator('.win[data-win="projects"]').waitFor({ state: "visible" });
    assert.equal(await page.textContent(".proj-detail h1"), "FreeScout AI Copilot");
  } finally {
    await close();
  }
});

// Walks to every node of the real tree and checks the chat renders it: the
// graph test proves the ids line up, this proves every block renders.
test("every node of the tree renders its answer and its questions", { timeout: 300000 }, async () => {
  const parent = { [dialogue.start]: null };
  const queue = [dialogue.start];
  while (queue.length) {
    const id = queue.shift();
    for (const n of dialogue.nodes[id].next) if (!(n in parent)) (parent[n] = id), queue.push(n);
  }
  const pathTo = (id) => (parent[id] === null ? [] : [...pathTo(parent[id]), id]);

  const { page, errors, close } = await openPage(server.url, { reducedMotion: "reduce" });
  try {
    for (const id of Object.keys(dialogue.nodes).filter((n) => n !== dialogue.start)) {
      await page.reload();
      await page.waitForSelector(CHIP, { timeout: 10000 });
      // The old chips stay on screen while a question types itself out; they are
      // cleared in the same tick the visitor's message is added. So wait for the
      // message count first, then for the new chips.
      const path = pathTo(id);
      for (const [k, step] of path.entries()) {
        await chipNamed(page, dialogue.nodes[step].question).click();
        await page.waitForFunction((n) => document.querySelectorAll(".msg-user").length === n, k + 1);
        await page.waitForSelector(".chip-back");
      }
      const answer = await page.locator(".msg-bot").last().textContent();
      assert.ok(answer.trim().length > 20, `${id}: answer rendered`);
      assert.equal(await page.locator(".chat-chips .chip").count(), dialogue.nodes[id].next.length + 1, `${id}: chips`);
    }
    assert.deepEqual(errors, []);
  } finally {
    await close();
  }
});
```

In `test/e2e/hornos-shell.test.mjs`, change the expected dock labels to:

```js
    assert.deepEqual(labels, ["Horn.os", "Resume", "Skills", "Projects", "Contact", "DnD"]);
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --test test/e2e/hornos-chat.test.mjs`
Expected: FAIL — `.chat-chips .chip` never appears.

- [ ] **Step 3: Write the chat**

Create `js/os/chat.js`:

```js
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
```

- [ ] **Step 4: Wire the chat into Horn.os**

In `js/os/hornos.js`:

Add the import after the `ICONS` import:

```js
import { createChat } from "./chat.js";
```

Put the chat first in the dock:

```js
const DOCK = [
  { id: "chat", label: "Horn.os" },
  { id: "resume", label: "Resume" },
  { id: "skills", label: "Skills" },
  { id: "projects", label: "Projects" },
  { id: "contact", label: "Contact" },
  { id: "dnd", label: "DnD" },
];
```

Change the signature to:

```js
export function createHornOS(root, { profile, dialogue, theme = "light", onBack = null, onStream = () => {}, dndHref = "dnd/" } = {}) {
```

Register the chat before the `resume` registration:

```js
  wm.register("chat", {
    title: "Horn.os — assistant",
    width: 600,
    height: 660,
    center: true,
    render: (b) => createChat(b, { dialogue, profile, onStream, onOpen: (id, arg) => wm.open(id, arg) }),
  });
```

Replace `let active = true;` (just above the `return`) with:

```js
  let active = true;
  // Keys go to the chat when it is the front window and the visitor is not
  // using the keyboard somewhere else (a dock button, a link in another window).
  document.addEventListener("keydown", (e) => {
    if (!active || wm.top() !== "chat") return;
    const focused = document.activeElement;
    const onPage = !focused || focused === document.body || focused.closest?.('.win[data-win="chat"]');
    if (onPage && wm.api("chat")?.handleKey(e)) e.preventDefault();
  });

  wm.open("chat");
```

In `js/main.js`, import the dialogue and pass it:

```js
import { dialogue } from "./content/dialogue.js";
```

```js
const os = createHornOS(document.getElementById("os"), { profile, dialogue, theme });
```

- [ ] **Step 5: Append the chat styles**

Append to `css/hornos.css`:

```css
/* chat */
.chat { display: grid; grid-template-rows: 1fr auto; height: 100%; }
.chat-log { display: flex; flex-direction: column; gap: 14px; padding: 20px 20px 8px; overflow: auto; }
.msg { max-width: 88%; }
.msg p { margin: 0 0 8px; }
.msg p:last-child { margin-bottom: 0; }
.msg ul { margin: 4px 0 8px; padding-left: 20px; }
.msg li { margin: 3px 0; }
.msg-user {
  align-self: flex-end;
  padding: 8px 14px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 18px 18px 4px 18px;
}
.msg-bot { position: relative; align-self: flex-start; padding-left: 38px; }
.msg-bot::before {
  content: "H";
  position: absolute;
  left: 0;
  top: 0;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 13px;
  font-weight: 700;
}
.typing { align-self: flex-start; display: flex; gap: 4px; margin-left: 38px; padding: 10px 12px; border-radius: 14px; background: var(--surface-2); }
.typing span { width: 6px; height: 6px; border-radius: 50%; background: var(--muted); animation: blink 1s infinite ease-in-out; }
.typing span:nth-child(2) { animation-delay: 0.15s; }
.typing span:nth-child(3) { animation-delay: 0.3s; }
@keyframes blink {
  0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
  40% { opacity: 1; transform: translateY(-2px); }
}
.project-card {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  margin: 8px 0;
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s;
}
.project-card:hover { border-color: var(--accent); transform: translateY(-1px); }
.project-card .icon { flex: none; width: 22px; height: 22px; color: var(--accent); }
.project-card-text { display: grid; }
.project-card-text span { font-size: 12px; color: var(--muted); }
.project-card-go { margin-left: auto; color: var(--accent); }
.msg-action {
  margin-top: 6px;
  padding: 6px 14px;
  border: 1px solid var(--accent);
  border-radius: 999px;
  background: transparent;
  color: var(--accent) !important;
  font-weight: 600;
  cursor: pointer;
}
.chat-bottom { padding: 10px 16px 16px; border-top: 1px solid var(--line); }
.chat-chips { display: flex; flex-wrap: wrap; gap: 6px; min-height: 32px; margin-bottom: 10px; }
.chip {
  padding: 6px 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}
.chip:hover,
.chip.is-hot { border-color: var(--accent); background: var(--accent-soft); }
.chip-back { color: var(--muted) !important; }
.chat-input {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 6px 6px 16px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface-2);
}
.chat-field { flex: 1; min-width: 0; border: 0; background: transparent; color: var(--text); font: inherit; outline: none; }
.chat-send {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 10px;
  background: var(--accent);
  color: var(--accent-ink) !important;
  font-weight: 700;
  cursor: pointer;
}

@media (prefers-reduced-motion: reduce) {
  .typing span { animation: none; }
  .project-card,
  .chip { transition: none; }
}
```

- [ ] **Step 6: Run the tests to make sure they pass**

Run: `node --test test/e2e/hornos-chat.test.mjs test/e2e/hornos-shell.test.mjs`
Expected: 8 chat tests and 7 shell tests PASS.

- [ ] **Step 7: Commit**

```bash
git add js/os/chat.js js/os/hornos.js js/main.js css/hornos.css test/e2e/hornos-chat.test.mjs test/e2e/hornos-shell.test.mjs
git commit -m "feat: the Horn.os chat - scripted questions typed out, answers streamed

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Screenshots, README, and Horn's review of the words

**Files:**
- Create: `test/hornos-shots.mjs`, `README.md`
- Modify: `js/content/dialogue.js`, `js/content/profile.js` (only the edits Horn asks for)

**Interfaces:**
- Consumes: `startServer`, `openPage` (Task 1); `window.__os` and `?theme=` (Task 5); the question `"What has he built?"` (Task 3).
- Produces: `test/out/hornos-light.png`, `hornos-dark.png`, `hornos-projects.png`, `hornos-phone.png`.

- [ ] **Step 1: Write the screenshot script**

Create `test/hornos-shots.mjs`:

```js
// Screenshots of Horn.os for judging the design by eye: desktop light and dark,
// the Projects window, and a phone. Written to test/out/. Read them as images.

import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startServer, openPage } from "./e2e/harness.mjs";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "out");
mkdirSync(OUT, { recursive: true });

const SHOTS = [
  { name: "hornos-light", query: "?theme=light", width: 1440, height: 900 },
  { name: "hornos-dark", query: "?theme=dark", width: 1440, height: 900 },
  { name: "hornos-projects", query: "?theme=light&debug=1", width: 1440, height: 900, projects: "freescout" },
  { name: "hornos-phone", query: "?theme=light", width: 390, height: 844 },
];

const server = await startServer(4343);
try {
  for (const s of SHOTS) {
    const { page, errors, close } = await openPage(server.url + s.query, { width: s.width, height: s.height, reducedMotion: "reduce" });
    await page.waitForSelector(".chat-chips .chip");
    await page.locator(".chat-chips").getByRole("button", { name: "What has he built?", exact: true }).click();
    await page.waitForSelector(".chip-back");
    if (s.projects) await page.evaluate((id) => window.__os.open("projects", id), s.projects);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(OUT, `${s.name}.png`) });
    console.log(`${s.name}.png${errors.length ? `  errors: ${errors.join(" | ")}` : ""}`);
    await close();
  }
} finally {
  server.stop();
}
```

- [ ] **Step 2: Take the screenshots and look at them**

Run: `npm run shots:os`
Expected: four lines, no errors. Open each PNG in `test/out/` with the Read tool and check against the spec and the "vitrine pro" bar: text readable at a glance, nothing clipped or overlapping, the dock centred, the chat centred with chips wrapping cleanly, dark theme contrast comfortable, the phone shot with the chat full-width and the dock fitting in 390 px. Fix anything that fails in `css/hornos.css`, re-run, and look again before continuing.

- [ ] **Step 3: Rewrite the README**

Create `README.md`:

```markdown
# Horn Saerens — Horn.os

The portfolio of Horn Saerens, AI Solutions Consultant in Amsterdam.

**Horn.os** is the desktop on Horn's computer. Its centrepiece is a chat in the
style of an LLM interface: Horn's assistant answers questions about his work,
his projects and why he'd fit your team. The conversation is a scripted tree —
click a suggested question and it types itself out, or just start typing and
every keystroke writes the next letters of the highlighted question. There is no
model behind it, so the assistant can never say anything that is not written in
`js/content/dialogue.js`, and every line there traces to Horn's CV or his own
project notes.

The dock also opens the résumé (with the PDF), the skills, one card per project,
the contact details, and a bonus: **the D&D table** at [`dnd/`](dnd/), a 3D
tabletop where the AI models Horn works with are the players and their character
sheets are his real projects.

A 3D office — a bright room full of plants, with the day turning to night
outside the window and Horn.os on the monitor — is being built around it.

## Running it

No build step: static files and plain ES modules.

    python serve.py 4330        # then open http://localhost:4330/

`?theme=light` or `?theme=dark` forces the theme (otherwise it follows the
visitor's clock: dark from 21:00 to 07:00). `?debug` exposes `window.__os`.

## Tests

    npm test                    # content, dialogue graph, typing, inline marks (Node)
    npm run test:e2e            # Horn.os and the D&D page in Chromium (Playwright)
    npm run shots:os            # screenshots into test/out/

Editing the dialogue: keep 1–4 questions per answer and never point `next` at
`root` — `npm test` fails on dead ends, unreachable answers and unknown project ids.

## Layout

    js/content/   profile.js (Horn as data), dialogue.js (the question tree), validate.js
    js/os/        hornos.js (desktop), wm.js (windows), chat.js, windows/*.js
    css/hornos.css
    dnd/          the D&D table, frozen — see dnd/README.md
```

- [ ] **Step 4: Run the whole suite**

Run: `npm test && npm run test:e2e`
Expected: every unit and e2e test PASS (the D&D smoke test included). Paste the summary lines (`# pass`, `# fail`) into the task report.

- [ ] **Step 5: Commit**

```bash
git add README.md test/hornos-shots.mjs css/hornos.css
git commit -m "docs: README for Horn.os, and a screenshot script for judging it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Horn reviews the words (gate)**

Stop and ask Horn to review the chat and the windows, in French, with the four screenshots attached and the local URL `http://localhost:4330/` (started with the `cv-3d` launch configuration). Ask specifically about: the greeting; every answer's wording; anything he wants added, removed or softened; the project statuses. Apply exactly the edits he asks for in `js/content/dialogue.js` / `js/content/profile.js`, run `npm test && npm run test:e2e`, and commit:

```bash
git add js/content
git commit -m "content: Horn's edits to the assistant and the profile

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Plan 1 is done when Horn has approved the words. Plan 2 (the room) is written next.
