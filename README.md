# Horn Saerens — the Dungeon Master's sheet

A 3D table set for a D&D session, in somebody's living room: a fire going, a
television left on, posters that have been up since about 2003. I am the DM; the
players are the AI agents I actually run — **Perseus**, **Hermes**, **Odysseus** and
**Codex**. They sit around the table on chairs, suited figures with a television for
a head, each screen showing that agent's mark: two opposite, one at each end, the DM
where the camera is. In front of every player lies their character sheet.

Three things are clickable:

- **The DM's sheet**, beside the screen — the camera drops overhead and the CV reads
  as the Dungeon Master's character sheet. Scroll or drag it to read on.
- **Any player**, or the sheet in front of them — their sheet lifts off the table,
  turns to face you and grows, and it holds what that agent actually is: how it is
  deployed, its stack, and the project it maps to.
- **Any die** — it tumbles and a score floats up: gold on a natural 20, red on a
  natural 1.

The metaphor is the job. An AI Solutions Consultant sets the scope, writes the rules,
hands the agents their tools, and makes sure what happens at the table is something
the business can actually use.

Built with [Three.js](https://threejs.org/) — `WebGLRenderer` for the room and
`CSS3DRenderer` to lay a real, scrollable HTML sheet flat on the table. The room is
then painted: a watercolour pass lays paper grain over the image, pools pigment at
the edges and lets the washes bleed, while the sheet itself stays crisp.
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
js/sheet.js       renders the DM's sheet and each player's sheet
js/scene.js       3D table, camera states, sheet projection and raising
js/board.js       the board: the tray, and the terrain standing on the map
js/shapes.js      rounded boxes — nothing in a room has a knife edge
js/room.js        the room around it: posters, fireplace, sofa, television, lamp
js/watercolour.js the painted look: post-processing chain and its shader
js/textures.js    every drawn surface: battle map, DM screen, posters, cloth, marks
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

The walls are painted plaster generated in `js/textures.js`. A concrete scan stood
there first and was the single thing making the room read as a basement: its stains
are metres across at wall scale, and a wall is the largest surface in frame.

Models (glTF):

| Prop | Asset |
|---|---|
| Armchair | [Modern Arm Chair 01](https://polyhaven.com/a/modern_arm_chair_01) |
| Table plant | [Potted Plant 04](https://polyhaven.com/a/potted_plant_04) |
| Alarm clock | [Alarm Clock 01](https://polyhaven.com/a/alarm_clock_01) |

The sofa, the fireplace, the television and its console are built from primitives in
`js/room.js`, so there is nothing more to download for them.

Art direction is a modern-retro living room, not a fantasy tavern: polished
herringbone, painted plaster and walnut, a pendant over the table with a hearth and a
cathode tube for company. Everything that is not a Poly Haven scan is drawn in code —
the battle map, the DM screen printed on both sides, the five wall posters, the
suiting, the agents' marks and the flames. The party is built from capsules and
boxes, and the icosahedron and dodecahedron come straight out of Three.js.

The posters are original artwork in the visual language of the early 2000s — code
rain, Y2K chrome, a pixel arcade screen, a LAN party flyer, a skate print. None of
them reproduces a real poster, which would be someone else's copyright.

Every noticeable slab in the scene is a rounded box rather than a `BoxGeometry`:
corners are the first thing the eye uses to tell a model from an object, and a
room made of knife edges reads as blocked-out. The radius is capped rather than
proportional — a proportional radius on a 74 cm television gives a 12 cm corner,
which stops being a rounded edge and starts being a bar of soap.

The board in the middle is drawn and built from one description. `MAP_PLAN` in
`js/textures.js` says where the coast, the forests, the mountains, the river, the
roads and the three settlements are, in normalised coordinates; the map is drawn
from it, and `js/board.js` stands the terrain on the same numbers. That is why the
trees are inside the forest and the bridge is on the river — not because the two
were nudged into agreement by hand. Anything repeated on the board is an
`InstancedMesh`, so sixty trees cost two draw calls rather than sixty.

Every texture is downscaled to 512px and re-encoded, which keeps the whole site near
2 MB rather than 15 MB at the original 1K. Models load asynchronously and only in 3D
mode, so the fallback desktop downloads none of them.

No third-party UI assets are redistributed here.
