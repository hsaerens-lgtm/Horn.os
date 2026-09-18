# Horn Saerens — the Dungeon Master's sheet

A 3D table set for a D&D session, in somebody's living room: a fire going, a
television left on, posters that have been up since about 2003. I am the DM; the
players are the AI agents I actually run — **Perseus**, **Hermes**, **Odysseus** and
**Codex**. They sit around the table on chairs, one colour each, each wearing a
television for a head with that agent's mark on the screen: two opposite, one at each
end, the DM where the camera is. In front of every player lies their character sheet.

Three things are clickable:

- **The DM's sheet**, beside the screen — the camera drops overhead and the CV reads
  as the Dungeon Master's character sheet. Scroll or drag it to read on.
- **Any player**, or the sheet in front of them — their sheet lifts off the table,
  turns to face you and grows, and it holds what that agent actually is: how it is
  deployed, its stack, and the project it maps to.
- **The board** — the camera drops to the table and leans in over the map, close
  enough to read the settlement names and the tables printed on the DM screen.
- **Any die** — it tumbles and a score floats up: gold on a natural 20, red on a
  natural 1.

The wheel pulls the camera in and out of the room, and scrolls the sheet once you
are reading it: the same gesture moves you through whatever you are looking at.

Left alone, the party breathes — each on its own rhythm, none of them on the same
one — and talks. The lines are the corporate world read as a dungeon, and they live
in `content.js` with everything else that is words. One bubble at a time, and only in
the wide shot: a table where everyone speaks at once is noise, and every closer view
already has something of its own to read.

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

Add `?players=suit` to swap the robots for the hand-built suited figures the table
started with. See **The players** below.

## Structure

```
index.html        page shell, importmap for Three.js (jsDelivr CDN)
css/sheet.css     parchment character sheet + page UI
js/content.js     all CV text, as sheet data — edit this to update the résumé
js/sheet.js       renders the DM's sheet and each player's sheet
js/scene.js       3D table, camera states, sheet projection and raising
js/board.js       the board: the tray, and the terrain standing on the map
js/props.js       what each player brought: a mug, a dice cup, a map, a notepad
js/chatter.js     the speech bubbles, one at a time
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

`assets/models/RobotExpressive/` is [RobotExpressive](https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive)
by [Tomás Laulhé](https://www.patreon.com/quaternius), CC0, with modifications by
[Don McCurdy](https://donmccurdy.com/) — 464 KB, and the only model the page loads
for the party.

## The players

The party is RobotExpressive, seated, one colour each, each wearing a television for
a head with that agent's mark on the screen, and each with one small thing of its own
on the table in front of it — a table with nothing personal on it reads as a
showroom. The props are matched to their owner rather than dealt out: the platform
that runs overnight gets the coffee, the navigator gets the rolled map. It is the **only rigged character
three.js ships that is actually CC0** — Soldier, Michelle and Xbot are Mixamo, and
readyplayer.me carries its own terms.

Three things about that rig are worth knowing, because none of them was obvious
until the robot was in the scene:

- Its `Sitting` clip is **not a seated pose**. It is a 0.42 s crouch: the hips drop a
  sixth of the body height, and the feet do not move at all. The chair pose in
  `ROBOT_POSE` is authored here, bone by bone, with the bend axes read off the rest
  rotations — the knee sits at a plain 0.72 about local X and nothing else.
- The **feet are not attached to the legs**. They hang off the root bone as siblings
  of the body, so bending the knees leaves them standing where they were; they are
  placed under the knees by hand.
- `Box3.setFromObject` reports the model as 4.8 units tall when its head is at 3.0,
  because two of its meshes are skinned and a bounding box measures those in their
  bind pose. Scaling off that box produced four robots the size of the table. It
  scales off the distance between two landmark bones instead.

`?players=suit` brings back the figures this table started with: a jacket extruded
from a profile, each with its own cloth colour, lean, head turn and reach across the
table. They are kept because they are one URL away if the tone ever wants to be a
straighter one.

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
