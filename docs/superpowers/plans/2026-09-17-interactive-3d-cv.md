# Interactive 3D CV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static site (GitHub Pages) showing a 3D desk with a CRT computer; clicking the screen zooms in and reveals a Windows 95/98-style OS containing the CV.

**Architecture:** Vanilla ES modules, no build. `WebGLRenderer` and `CSS3DRenderer` share one camera; the OS root `<div>` is a `CSS3DObject` placed on the monitor. `main.js` decides between 3D mode and a full-screen OS fallback.

**Tech Stack:** Three.js r170+ via jsdelivr `importmap`, plain CSS, plain JS. Verification is manual in a browser (no test runner — the deliverable is visual).

**Spec:** `docs/superpowers/specs/2026-09-17-interactive-3d-cv-design.md`

## Global Constraints

- No build step; deploys as-is. Three.js from `https://cdn.jsdelivr.net/npm/three@0.170.0/` (`three` and `three/addons/`).
- No post-processing. `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`.
- Content in English, only from CV v3 — no invented metrics.
- Fallback (no 3D) when `innerWidth < 900` or WebGL unavailable or CDN import fails.
- External links: `target="_blank" rel="noopener"`.

---

### Task 1: Content data

**Files:**
- Create: `js/content.js`

**Interfaces:**
- Produces: `export const content = { name, title, location, contact: { email, phone, linkedin, github }, profile: string, skills: [{ label, items }], experience: [{ role, dates, bullets: [] }], projects: [{ id, name, status, problem?, built?, result?, summary? }], education: [], languages: string, resumePdf: 'assets/Horn_Saerens_CV_2026.pdf' }`

- [ ] **Step 1:** Transcribe the CV v3 text (profile, 5 skill lines, 4 roles, 6 projects, education, languages) into the object above. Projects FreeScout and Perseus carry `problem/built/result`; the others carry `summary`.
- [ ] **Step 2:** Verify in the browser console: `import('./js/content.js').then(m => console.log(m.content.projects.length))` → `6`.
- [ ] **Step 3:** Commit: `git add js/content.js && git commit -m "feat: add CV content data"`.

### Task 2: Retro OS (CSS + window manager)

**Files:**
- Create: `css/os.css`, `js/os.js`
- Create: `index.html` (temporary: mounts the OS full-screen for development)

**Interfaces:**
- Consumes: `content` from Task 1.
- Produces: `export function createOS(root, content, { onBack }) → { boot(), openWindow(id) }`. `root` is a `<div class="os">` sized 1024×768 by CSS. `onBack` may be `null` (fallback mode hides the "Back to room" item).

- [ ] **Step 1:** `os.css`: `.os` 1024×768, teal desktop `#008080`, `.boot` black screen with monospace green text, `.icon` grid (64px icons, white label with shadow), `.window` (grey `#c0c0c0`, 2px outset border, blue title bar `#000080` → `#1084d0` gradient, buttons `_ □ ×`), `.taskbar` 28px bottom bar with Start button and clock, `.start-menu` popup. Fonts: `"MS Sans Serif", Tahoma, Arial`.
- [ ] **Step 2:** `os.js`: boot sequence (array of BIOS lines appended every 120 ms, click skips; then `desktop.classList.add('visible')`); desktop icons built from a static list (`about`, `experience`, `projects`, `skills`, `contact`, `resume`); `openWindow(id)` creates or focuses a window, renders body HTML from `content`, cascades position `(40 + n*24, 30 + n*24)`; drag by title bar via `pointerdown/pointermove/pointerup` on the title bar; minimize toggles `hidden` and taskbar button; close removes; z-index counter; taskbar clock via `setInterval` 1000 ms; Start menu with LinkedIn, GitHub, Email, and "Back to room" when `onBack` provided; `projects` window lists project "files"; clicking one opens `project:<id>` window.
- [ ] **Step 3:** `index.html` mounts `<div id="os-root" class="os">` full-screen and runs `createOS(root, content, { onBack: null }).boot()`. Open in the browser: boot plays, every icon opens a window, drag/minimize/close work, no console errors.
- [ ] **Step 4:** Commit: `git add index.html css/os.css js/os.js && git commit -m "feat: retro OS desktop and window manager"`.

### Task 3: 3D scene

**Files:**
- Create: `js/scene.js`

**Interfaces:**
- Produces: `export function createScene({ container, osRoot, onEnter, onExit }) → { enter(), exit(), isFocused() }`. `osRoot` becomes the CSS3DObject; `onEnter`/`onExit` are callbacks for UI (hide hint, show Back button).

- [ ] **Step 1:** Renderers: CSS3DRenderer div (z 1) and WebGLRenderer canvas with `alpha: true`, `pointerEvents: none` (z 2) appended to `container`; page background `#07070c`. Camera `PerspectiveCamera(45, aspect, 0.1, 100)`.
- [ ] **Step 2:** Geometry (units in metres): floor 8×8 `#1a1a22`; back wall; desk top `2.0×0.05×0.9` at y 0.75 wood `#6b4a2b`, 4 legs; monitor group at desk centre: body box `0.62×0.5×0.5` beige `#d8d2c2`, bezel frame via `ExtrudeGeometry` with a hole `0.48×0.36`, screen plane in the hole; keyboard box `0.45×0.02×0.15`; mouse; lamp (arm cylinders + shade cone) with `PointLight(0xffb070, 8, 5)`; screen glow `PointLight(0x5aa0ff, 2, 2)`; `HemisphereLight(0x223355, 0x080808, 0.6)`; 150 dust `Points` drifting upward and wrapping.
- [ ] **Step 3:** Screen: `CSS3DObject(osRoot)` scaled `0.48/1024` so 1024 CSS px = 0.48 m, positioned in the bezel hole; invisible raycast `Mesh` at the same transform; a `MeshBasicMaterial` with `blending: NoBlending, opacity: 0` cut-out plane behind so WebGL does not draw over the CSS layer.
- [ ] **Step 4:** Camera states: `idle` orbit centre `(0, 1.0, 0)`, radius 2.6, height 1.45, angle drifting `±0.35 rad` with mouse parallax; `focused` position along the screen normal at distance such that screen height fills ~90 % of the viewport (`d = (0.36/2) / tan(fov/2) / 0.9`). `tween(from, to, 1200 ms, easeInOutCubic)` updated in the animation loop.
- [ ] **Step 5:** Interaction: `pointerdown` on the container → raycast against the screen mesh → `enter()`; `keydown Escape` → `exit()`. When focused: `osRoot.style.pointerEvents = 'auto'`, else `'none'`. Resize handler for both renderers.
- [ ] **Step 6:** Commit: `git add js/scene.js && git commit -m "feat: 3D desk scene with CSS3D screen"`.

### Task 4: Bootstrap, fallback and page shell

**Files:**
- Create: `js/main.js`
- Modify: `index.html` (final shell), `css/os.css` (add `.fallback .os` full-viewport rule and page UI: hint, Back button, loader)

**Interfaces:**
- Consumes: `createOS`, `createScene`, `content`.

- [ ] **Step 1:** `index.html`: `<title>Horn Saerens — Interactive CV</title>`, importmap for `three` + `three/addons/`, `#scene` container, `#os-root`, `#ui` with `.hint` ("Click the screen to start") and `.back` button, `#loader`. `<script type="module" src="js/main.js">`.
- [ ] **Step 2:** `main.js`: `supportsWebGL()` via a probe canvas; if `innerWidth < 900 || !supportsWebGL()` → `document.body.classList.add('fallback')`, `createOS(root, content, { onBack: null }).boot()`; else `try { const { createScene } = await import('./scene.js'); … } catch { fallback }`. Wire hint/back button to `scene.enter()/exit()`; OS boots on first `enter()`.
- [ ] **Step 3:** Verify in browser at desktop width: idle scene renders, click screen → zoom → boot → desktop usable → Esc → zoom out. Resize to 375 px and reload → OS full-screen. No console errors.
- [ ] **Step 4:** Commit: `git add -A && git commit -m "feat: bootstrap with 3D mode and mobile fallback"`.

### Task 5: Polish and deploy files

**Files:**
- Create: `README.md`, `.nojekyll`
- Modify: `js/scene.js` (any visual tuning found in Task 4), `css/os.css`

- [ ] **Step 1:** Visual pass: screenshot idle + focused; tune lamp intensity, camera radius, icon spacing.
- [ ] **Step 2:** `README.md`: what it is, how to run locally (`npx serve .`), how to deploy (push to `hsaerens-lgtm.github.io`, Pages → main root). `.nojekyll` so Pages serves files untouched.
- [ ] **Step 3:** Commit: `git add -A && git commit -m "docs: README and Pages config"`.

## Self-review

- Spec coverage: structure (T1–T4), scene (T3), OS (T2), fallback (T4), error handling (T4 try/catch, T2 links), verification (T4 step 3, T5 step 1). Covered.
- Placeholder scan: none.
- Type consistency: `createOS(root, content, { onBack })` and `createScene({ container, osRoot, onEnter, onExit })` used identically in T2/T3/T4.
