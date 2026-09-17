# Interactive 3D CV — Design

Date: 2026-09-17
Status: approved by Horn (chat), 2026-09-17

## Purpose

A portfolio site in the style of henryheffernan.com: a 3D room with a retro
computer. Clicking the screen zooms the camera in; the screen shows a
Windows 95/98-style OS whose windows contain the content of the CV v3
(`Desktop/Resume/Horn_Saerens_CV_2026.pdf`). Target roles: AI Solutions
Consultant / Engineer, Forward Deployed Engineer, Applied AI Engineer.

Hosted on GitHub Pages as `hsaerens-lgtm.github.io` — this also gives the
public GitHub profile a visible, real project.

## Constraints

- No build step. Three.js loaded from a CDN via `importmap`. The folder
  deploys as-is to GitHub Pages.
- No licensed 3D assets: the scene is built from Three.js primitives.
- No post-processing (bloom etc.). Pixel ratio capped at 2.
- Content in English. All copy lives in one data file (`js/content.js`).
- Nothing invented: content is the CV v3 text, no fabricated metrics.

## Architecture

```
cv-3d/
  index.html          – shell: canvas container, CSS3D container, fallback root, importmap
  css/os.css          – retro OS styling (desktop, windows, taskbar, boot screen)
  js/content.js       – single exported object: profile, skills, experience, projects, contact
  js/scene.js         – Three.js scene, camera states & tweens, screen plane, raycast click
  js/os.js            – OS: boot sequence, desktop icons, window manager, taskbar, clock
  js/main.js          – bootstraps: WebGL/viewport check → 3D mode or fallback mode
  assets/Horn_Saerens_CV_2026.pdf
  docs/superpowers/specs/…
```

### scene.js

- `createScene(container, cssContainer, screenElement)` → `{ enter(), exit(), dispose() }`.
- WebGLRenderer (transparent over a dark page background) and CSS3DRenderer
  stacked in the same container; both render each frame with the same camera.
- Room: floor, back wall, desk, CRT monitor (body, bezel, screen plane), keyboard,
  mouse, desk lamp with warm `PointLight`, cool `PointLight` from the screen,
  dim ambient/hemisphere light, ~150 dust particles (`Points`) slowly drifting.
- The screen is a `CSS3DObject` wrapping the OS root element, sized to match the
  bezel opening; a matching invisible `Mesh` with a raycast target catches clicks.
- Camera states: `idle` (slow auto-orbit around the desk, mouse parallax) and
  `focused` (screen fills the viewport). Transitions are eased tweens
  (~1.2 s, cubic in/out) implemented in-house — no GSAP dependency.
- Interaction: click on screen or "Enter" button → `enter()`; `Esc` or
  "← Back" button → `exit()`. Pointer events on the OS are enabled only when
  focused.

### os.js

- `createOS(root, content, { onBack })` → `{ boot() }`.
- Boot: 2–3 s of BIOS-style lines, then the desktop fades in. Skippable on click.
- Desktop icons: `About.txt`, `Experience`, `Projects` (folder → one file per
  project), `Skills`, `Contact`, `Resume.pdf` (link to the PDF).
- Window manager: open/focus/minimize/close, drag by title bar (pointer
  events), z-order, cascade placement, taskbar buttons for open windows.
- Taskbar: Start menu (LinkedIn, GitHub, email, Back to room), clock.
- Projects use the CV's Problem / Built / Result structure with a status badge
  (internal tool, in production, POC, delivered).

### main.js

- If `window.innerWidth < 900` or WebGL is unavailable → fallback: OS root is
  mounted full-viewport, no Three.js import.
- Else → import `scene.js`, mount the OS inside the CSS3D screen, boot.

## Error handling

- WebGL context failure caught → fallback mode.
- CDN import failure caught → fallback mode with a small notice.
- External links open in a new tab with `rel="noopener"`.

## Verification

Manual, in the built-in browser: no console errors; zoom in/out round trip;
every window opens, drags, minimizes, closes; Start menu links correct;
fallback mode at mobile width; screenshot of the idle scene and the desktop.
