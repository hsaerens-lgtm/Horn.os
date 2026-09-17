# Horn Saerens — the Dungeon Master's sheet

A 3D table set for a D&D session. I am the DM; the players are the AI agents I
actually run — **Perseus**, **Hermes**, **Odysseus** and **Codex**, each at its own
terminal across the table. Click the character sheet lying beside the DM screen and
the camera drops overhead: the CV *is* the DM's character sheet.

The metaphor is the job. An AI Solutions Consultant sets the scope, writes the rules,
hands the agents their tools, and makes sure what happens at the table is something
the business can actually use.

Built with [Three.js](https://threejs.org/) — `WebGLRenderer` for the room and
`CSS3DRenderer` to lay a real, scrollable HTML sheet flat on the table.
No build step, no framework: plain ES modules served as static files.

## Run locally

```bash
python serve.py 4330
```

then open <http://localhost:4330>. `serve.py` is a plain static server that sends
no-cache headers, so edited ES modules are actually re-fetched on reload.

Add `?fallback=1` to read the sheet without the 3D table — this is also what phones
and non-WebGL browsers get.

## Structure

```
index.html        page shell, importmap for Three.js (jsDelivr CDN)
css/sheet.css     parchment character sheet + page UI
js/content.js     all CV text, as sheet data — edit this to update the résumé
js/sheet.js       renders the character sheet
js/scene.js       3D table, camera states, sheet projection
js/textures.js    procedural battle map, parchment and agent terminals
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

All third-party assets are from [Poly Haven](https://polyhaven.com/) under
[CC0](https://polyhaven.com/license) — public domain, commercial use allowed, no
attribution required. Credited here anyway.

Texture scans (diffuse + OpenGL normal + ARM):

| Surface | Asset |
|---|---|
| Desk | [American Walnut Veneer](https://polyhaven.com/a/american_walnut_veneer) |
| Floor | [Herringbone Parquet](https://polyhaven.com/a/herringbone_parquet) |
| Wall | [Concrete Wall 008](https://polyhaven.com/a/concrete_wall_008) |

Models (glTF):

| Prop | Asset |
|---|---|
| Armchair | [Modern Arm Chair 01](https://polyhaven.com/a/modern_arm_chair_01) |
| Table plant | [Potted Plant 04](https://polyhaven.com/a/potted_plant_04) |
| Alarm clock | [Alarm Clock 01](https://polyhaven.com/a/alarm_clock_01) |

Art direction is a modern room, not a fantasy tavern: polished herringbone, smooth
concrete and walnut, lit by one pendant lamp over the table. The dice, the battle
map, the DM screen and the four agent terminals are generated in code — icosahedron,
dodecahedron and the rest come straight out of Three.js.

Every texture is downscaled to 512px and re-encoded, which keeps the whole site near
2 MB rather than 15 MB at the original 1K. Models load asynchronously and only in 3D
mode, so the fallback desktop downloads none of them.

No third-party UI assets are redistributed here.
