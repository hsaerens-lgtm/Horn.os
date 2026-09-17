# Horn Saerens — Interactive CV

A 3D desk with a retro CRT computer. Click the screen to zoom in; the computer boots
a Windows 95/98-style desktop whose windows contain my CV (About, Experience,
Projects, Skills, Contact, Resume.pdf).

Built with [Three.js](https://threejs.org/) — `WebGLRenderer` for the room and
`CSS3DRenderer` to project a real, clickable HTML desktop onto the monitor.
No build step, no framework: plain ES modules served as static files.

## Run locally

Any static server works, for example:

```bash
python -m http.server 4321
```

then open <http://localhost:4321>. Add `?fallback=1` to preview the desktop
without the 3D scene (this is also what phones and non-WebGL browsers get).

## Structure

```
index.html        page shell, importmap for Three.js (jsDelivr CDN)
css/os.css        retro OS styling + page UI
js/content.js     all CV text — edit this to update the résumé
js/os.js          boot sequence, desktop icons, window manager, taskbar
js/scene.js       3D room, camera states, screen projection
js/main.js        bootstrap: 3D mode or full-screen fallback
assets/           Horn_Saerens_CV_2026.pdf
```

## Deploy (GitHub Pages)

1. Create a public repository named `hsaerens-lgtm.github.io`.
2. Push this folder to its `main` branch.
3. Settings → Pages → Source: *Deploy from a branch*, branch `main`, folder `/ (root)`.

The `.nojekyll` file tells Pages to serve the files exactly as they are.
