# Horn Saerens — Interactive CV

A 3D desk with a retro CRT computer. Click the screen to zoom in; the computer boots
a Windows 95/98-style desktop whose windows contain my CV (About, Experience,
Projects, Skills, Contact, Resume.pdf).

Built with [Three.js](https://threejs.org/) — `WebGLRenderer` for the room and
`CSS3DRenderer` to project a real, clickable HTML desktop onto the monitor.
No build step, no framework: plain ES modules served as static files.

## Run locally

```bash
python serve.py 4330
```

then open <http://localhost:4330>. `serve.py` is a plain static server that sends
no-cache headers, so edited ES modules are actually re-fetched on reload.

Add `?fallback=1` to preview the desktop without the 3D scene — this is also what
phones and non-WebGL browsers get.

## Structure

```
index.html        page shell, importmap for Three.js (jsDelivr CDN)
css/os.css        retro OS styling + page UI
js/content.js     all CV text — edit this to update the résumé
js/os.js          boot sequence, desktop icons, window manager, taskbar
js/scene.js       3D room, camera states, screen projection
js/textures.js    procedural plastic grain and the wall print
js/main.js        bootstrap: 3D mode or full-screen fallback
assets/           Horn_Saerens_CV_2026.pdf
assets/textures/  PBR texture sets (diffuse + normal + ARM), 512px JPG
serve.py          local dev server with no-cache headers
```

## Deploy (GitHub Pages)

The repository is <https://github.com/hsaerens-lgtm/Horn.os>, so the site is published
as a project page at **<https://hsaerens-lgtm.github.io/Horn.os/>**.

1. Push this folder to the `main` branch.
2. Settings -> Pages -> Source: *Deploy from a branch*, branch `main`, folder `/ (root)`.
3. Wait a minute, then open the URL above.

All paths in the site are relative, so it works from that subpath without changes.
The `.nojekyll` file tells Pages to serve the files exactly as they are.

## Credits

Room surfaces use PBR texture scans from [Poly Haven](https://polyhaven.com/),
released under [CC0](https://polyhaven.com/license) (public domain — no attribution
required; credited here anyway):

| Surface | Asset |
|---|---|
| Desk | [American Walnut Veneer](https://polyhaven.com/a/american_walnut_veneer) |
| Floor | [Dark Wooden Planks](https://polyhaven.com/a/dark_wooden_planks) |
| Wall | [Grey Plaster 02](https://polyhaven.com/a/grey_plaster_02) |

Each set was downscaled to 512px and re-encoded (482 KB total, down from 5.4 MB at
1K). The CRT plastic grain, the framed print and the desktop icons are generated in
code — no third-party UI assets are redistributed here.
