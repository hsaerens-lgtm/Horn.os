# The Office and Horn.os — Design

Date: 2026-09-24
Status: approved by Horn section by section (chat), 2026-09-24
Supersedes: the D&D table as the main page (2026-09-17 spec, and everything built after it)

## Purpose

Return to the original idea, made professional: a bright 3D room with a desk,
a modern PC and a lot of plants, lit by a light that changes with the time of
day. The PC runs **Horn.os**, a clean custom desktop whose centrepiece is a
chat in the style of an LLM interface: Horn's assistant answers questions about
his CV through a scripted tree of questions. The D&D table stays online as a
bonus page, reached from a DnD icon on the PC.

Target readers: recruiters and hiring managers for AI Solutions Consultant,
Forward Deployed Engineer and Applied AI Engineer roles. The bar is "vitrine
pro": every element is judged against the best thing in the frame.

## Constraints

- Three.js, loaded from the CDN via `importmap`. No build step, no framework:
  plain ES modules served as static files, deployable as-is to GitHub Pages
  (repo `hsaerens-lgtm/Horn.os`).
- No watercolour pass or other stylising post effect. Tone mapping only.
  Pixel ratio capped at 2.
- All copy in English. All words live in `js/content/`.
- Nothing invented. Every claim traces to the CV v2
  (`Desktop/Resume/Horn_Saerens_CV_2026_v2.docx`) or to a note in the Obsidian
  vault; claims already dropped as unsupported (Hermes "running", Odysseus
  document figures, "Perseus AI Platform", "sole designer & developer" on
  FreeScout, platform "in production") stay dropped. No salary information.
- No free-text input reaches anything: there is no LLM and no backend.

## Decisions taken in the brainstorm

| Question | Decision |
|---|---|
| How the agent answers | Fully scripted tree. The visitor's "typing" writes the scripted question. |
| Art direction | Realistic and bright, with a day → sunset → night cycle. |
| What drives the cycle | Visitor's local time on load, plus a clickable wall clock that steps to the next phase. |
| Screen style | Modern, clean custom OS ("Horn.os"), flat modern monitor. |
| Who speaks | An assistant speaking about Horn in the third person. |
| Code organisation | D&D frozen in `dnd/`, the office built fresh at the root. |
| Extra props | A sleeping cat on the window sill, a guitar on a stand. |

## Architecture

```
cv-3d/
  index.html              the office: WebGL canvas + CSS3D layer for the screen
  dnd/                    the D&D table, frozen
    index.html
    js/  css/             moved from the root unchanged, except asset paths
  assets/                 shared, read-only binaries (textures, models, PDF)
  js/
    main.js               bootstrap: WebGL and width >= 900 -> 3D, else Horn.os full screen
    scene/
      stage.js            renderer, CSS3D renderer, resize, render loop, shader warm-up
      room.js             walls, large window with sky backdrop, parquet, shelf, rug
      desk.js             desk, monitor (with the CSS3D screen mount), keyboard, mouse, lamp, mug, notebooks, chair
      plants.js           copied from the D&D build and extended (floor monstera, ficus, hanging plants, desk pots)
      cat.js              sleeping cat on a cushion: breathing, ear/tail reaction on click
      guitar.js           acoustic guitar on a stand
      lighting.js         the light rig and the three phase presets, interpolated by one parameter
      daycycle.js         local time -> phase; clock click -> animated transition
      camera.js           wide shot <-> screen focus, mouse parallax
      picking.js          raycast clicks: screen, clock, cat
    os/
      hornos.js           createHornOS(root, options) -> desktop, dock, window manager
      chat.js             the chat engine: suggestions, simulated typing, streamed replies
      windows/            resume.js, skills.js, projects.js, contact.js, dnd.js
    content/
      profile.js          identity, résumé, skills, projects, contact links
      dialogue.js         the question tree
    lib/                  copied helpers: merge.js, shapes.js, textures.js (only what the office uses)
  css/hornos.css
  test/
    dnd/                  the existing D&D harness, pointed at /dnd/
    ...                   the office harness (see Verification)
```

**Horn.os is a DOM module with no Three.js dependency.** The same code runs
mounted on the monitor (as a `CSS3DObject`) and full screen on mobile or
without WebGL. It is developed and tested on its own first.

### Moving the D&D table

- `index.html`, `js/` and `css/` of the current build move to `dnd/`.
  Module-relative imports keep working. Asset URLs (`assets/...`, resolved
  against the document) become `../assets/...` — the only edits allowed in
  `dnd/`.
- `assets/` stays at the root and is shared. The office may add files there but
  never modifies or deletes an existing one.
- `assets/Horn_Saerens_CV_2026.pdf` is replaced by the PDF of CV v2 (same file
  name), so both pages link to the current résumé.
- The existing Playwright scripts move to `test/dnd/` and target `/dnd/`.
- `dnd/` gets a small "← Back to the office" link to `/`.

## The room

**Layout (wide shot).** A light-wood desk side-on to a large window, so the sun
comes in laterally (the D&D measurements showed that only lateral light gives
readable shadows). On the desk: flat monitor, keyboard, mouse, articulated
lamp, mug, notebooks. An office chair, a rug, a wall shelf with books and
pots, a wall clock. Plants everywhere: a large floor monstera, a ficus, hanging
plants in front of the window, small pots on the desk and shelf. A sleeping cat
curled on a cushion on the window sill, in the sun. An acoustic guitar on a
stand in the corner by the shelf.

**The three phases.**

| | Day | Sunset | Night |
|---|---|---|---|
| Window backdrop | clear blue sky | orange-pink gradient | deep blue, a few city lights |
| Sun (DirectionalLight, shadows) | warm white, a marked patch on the floor | orange, very low, long shadows | off (faint cool moonlight, no shadow) |
| Desk lamp (SpotLight) | off | on, no shadow | main light, shadows on |
| Screen light (RectAreaLight, no shadow) | subtle | visible | lights the desk in blue |
| Dust motes in the beam | yes | yes | no |
| Horn.os theme | light | light | dark |

Only one light casts shadows at a time: the sun by day and sunset, the lamp
at night. Every other light is unshadowed and kept low, because every fill
light lowers every shadow's contrast.

**Local time → phase:** day 07:00–17:59, sunset 18:00–20:59, night
21:00–06:59. `?phase=day|sunset|night` overrides it.

**Transitions.** Clicking the wall clock steps day → sunset → night → day over
2.5 s: `lighting.js` interpolates every colour, intensity and the sun's
position from one parameter, so the sun is seen going down. The camera does
not move.

**Always moving.** Leaves sway slightly and their shadows move on the floor and
wall; dust drifts in the sun beam; the screen light follows Horn.os (its
colour follows the theme, and it brightens slightly while an answer streams —
the CSS3D screen is not in the WebGL image, so this is driven by events from
Horn.os, not by sampling pixels); the cat breathes. Clicking the cat makes an ear twitch and the tail
flick once (about 1.2 s).

**Interaction.** Click the screen → the camera eases (about 1.2 s) until the
monitor fills the view, and Horn.os takes pointer and keyboard input. "← Back"
or Esc → back to the wide shot. Mouse parallax in the wide shot only. Keyboard
input goes to Horn.os only while focused.

**Objects.** Plants from the procedural generator (one merged canopy mesh per
plant). Furniture and objects built in code with the existing walnut and
herringbone textures, joint-to-joint with housed joints, and box-projected
metric UVs on merged meshes. A CC0 model (Poly Haven) may replace any object
that looks amateur beside the rest. The cat is built in code first; if it does
not hold up, Horn is asked before any model is downloaded.

## Horn.os

`createHornOS(root, { profile, dialogue, theme, onBack })` returns
`{ setTheme(theme), focus(), blur() }`.

**Desktop.** A soft wallpaper whose tint follows the theme; a dock at the
bottom with: **Horn.os** (the chat, highlighted), **Resume**, **Skills**,
**Projects**, **Contact**, **DnD**. The chat window opens automatically.
Windows have rounded corners, can be dragged by the title bar, closed and
minimised, and come to the front on click.

**Windows.**
- *Resume* — the CV v2, readable, with a "Download PDF" button.
- *Skills* — grouped (AI & agents, integration, data, tools), as badges.
- *Projects* — one card per real vault project (FreeScout AI Copilot, the
  LibreChat platform with its Docker migration and MCP installer, horn-dev,
  Documentation organique, the local-models line, the Obsidian vault, the
  morning briefing, and the CV projects), each as problem → what he built →
  result. Opening a project by id is exposed so the chat can link to it.
- *Contact* — email, LinkedIn, GitHub.
- *DnD* — "Bonus project: a D&D table where the AI agents are the party", a
  line on why it exists, and an "Open" button to `/dnd/`.

**The chat.**
- Layout of a current LLM interface: assistant messages on the left, the
  visitor's on the right, an input bar at the bottom, 2–4 suggestion chips
  under it.
- Opening message: "Hi, I'm Horn's assistant. I can tell you about his work,
  his projects, or why he'd fit your team."
- **Click a chip** → its text is typed into the input letter by letter
  (about 35 ms per character, with jitter), then sent automatically.
- **Or press any printable key** → each keystroke advances the typing of the
  highlighted chip by 1–3 characters; the key itself is never inserted.
  Tab / arrow keys change the highlighted chip; Enter completes and sends.
  The input's placeholder: "Pick a question below, or just start typing…".
- After sending: a typing indicator for 600–1000 ms, then the answer streams
  in word by word. Clicking the message skips to the end of the stream.
- Answers support paragraphs with bold, bullet lists, and a project card that
  opens the Projects window on that project.
- Every answer offers new chips; every node except the root offers
  "← Back to topics".
- `prefers-reduced-motion` → typing and streaming are instant.
- Messages sit in an `aria-live="polite"` region; chips are real buttons.

**The dialogue data.**

```js
// js/content/dialogue.js
export const dialogue = {
  start: "root",
  nodes: {
    root: { answer: [ /* blocks */ ], next: ["who", "built", "agents", "skills", "contact"] },
    who:  { question: "Who is Horn?", answer: [ ... ], next: ["background", "roles", "where"] },
    // ...
  },
};
// A block is { p: "text with **bold**" } | { list: ["...", "..."] } | { project: "freescout" }
```

**First draft of the tree** (the wording of every answer is drafted from the
sources and reviewed by Horn before it ships):

```
Who is Horn?
├── What's his background?
├── What roles is he looking for?
│   └── Why would he fit an AI Solutions / FDE role?
└── Where is he based?            (Amsterdam, EU citizen, 1-month notice)
What has he built?
├── FreeScout AI Copilot          → How does it work? / What stack?
├── The LibreChat platform        → The Docker migration / The MCP installer
├── Local models                  → Why keep the data home?
└── His dev toolbox (horn-dev)
How does he work with AI agents?
├── Which models does he use?
└── How does he keep them reliable?
What are his skills?
How can I contact him?            → email / LinkedIn / PDF
```

## Error handling and fallbacks

- No WebGL, a viewport under 900 px wide, or a failed CDN import → Horn.os
  mounts full screen with no Three.js. The CV is always reachable.
- A texture or model that fails to load → the object keeps a plain material;
  the page never blocks on it.
- A dialogue node id that does not exist → the chat falls back to the root
  node (and the graph test below makes that unreachable in practice).
- External links open in a new tab with `rel="noopener"`.

## Performance

- Loader hidden in under 3 s on a cold cache. Shaders compiled under the
  loader: `compileAsync` against the real render target, then one warm-up
  frame (the D&D lesson: compiling against the canvas produces useless
  programs, and never compiles shadow or post programs).
- No shader program growth after load (`test/perf.mjs`).
- Nothing laid flat shares a height with another flat surface (the rug
  flicker lesson).

## Verification

Through the Playwright harness, never the preview pane (it throttles rAF and
resizes itself). `?debug=1` exposes
`window.__debug = { scene, renderer, camera, pin(pos, target), setPhase(name) }`.

- **Shots:** wide shot, screen focus, cat close-up and guitar close-up, each
  in day, sunset and night, with the camera pinned. The PNGs are read as images.
- **Dialogue graph test** (Node, no browser): every `next` id exists, every
  node is reachable from the root, every non-root node offers at least one
  chip, every project block names an existing project.
- **Chat behaviour test** (Playwright, Horn.os full screen): chip click types
  and sends; keystrokes advance the highlighted chip without inserting the
  key; Enter sends; the stream completes and new chips appear; "← Back to
  topics" returns to the root; reduced motion is instant.
- **Load, frame time and flicker** with the camera moving.
- **Fallback:** at 800 px wide Horn.os is full screen and the chat works.
- **The D&D page** still loads at `/dnd/` and its `test/dnd/shots.mjs` passes.

## Build order

1. Move the D&D table to `dnd/` and prove it still works.
2. Horn.os full screen: desktop, windows, chat engine, dialogue tree and its
   tests. Usable on its own, including on mobile.
3. The room by day: desk, monitor with Horn.os mounted, camera focus.
4. Plants, cat, guitar, details.
5. The day cycle and the clock.
6. Finish, validation shots, README rewrite.

## Out of scope

- Any real LLM, backend or free-text understanding.
- Sound.
- Changes to the D&D scene beyond asset paths and the back link.
- A mobile 3D mode.
