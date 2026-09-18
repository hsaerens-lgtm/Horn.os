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
  natural 1. A natural 20 puts fireworks over the table. A natural 1 blows the
  furniture out of the room, and then, eight seconds later, puts it all back.

The wheel pulls the camera in and out of the room, and scrolls the sheet once you
are reading it: the same gesture moves you through whatever you are looking at.

Left alone, the party breathes — each on its own rhythm, none of them on the same
one — and talks: ten lines each, one every four to seven seconds, drawn from a
shuffled bag so nobody repeats themselves before they have said everything once. The lines are the corporate world read as a dungeon, and they live
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

## Lighting and edges

The pendant is a spotlight, not a point light. A shade physically blocks the
sideways light, so a cone is what a pendant casts — and a spot has one shadow map
whose frustum can be tightened around the table, where a point light spends six
cube faces covering a room nothing stands in. A small unshadowed point light puts
back the spill the cone loses.

The composer is handed its own render target with `samples: 4`. Left to itself it
allocates one with no samples, and a renderer's `antialias: true` only ever applied
to the default framebuffer — which a composer bypasses. From the day the watercolour
chain was added until this was found, the scene rendered with no antialiasing at all,
and the Sobel in the paint pass was sharpening the jaggies.

There is no ambient-occlusion pass, and that is measured rather than assumed. GTAOPass
works here and is safe for the alpha cut-out, but it costs ten times the frame: 55 fps
without, 5 with. Dropping its internal resolution to an eighth changed nothing, which
puts the cost in the second pass it makes over the scene for depth and normals — this
room is 553 separate meshes, and drawing all of them twice is the whole budget.
Contact is done the old way instead, with a soft quad under each piece of furniture.

## Draw calls

Two passes over the scene's cost, both measured rather than guessed:

| | before | after |
|---|---|---|
| meshes | 553 | 400 |
| materials | 289 | 140 |
| shadow casters | 419 | 264 |
| triangles | 135 k | 135 k |

Small static pieces are baked into single meshes by `js/merge.js` — seventy books
into one, seven miniatures into one, ninety-odd battlements, walls, roofs and
standing stones into three. They keep their individual colours through a
vertex-colour attribute. Only things that never move relative to each other are
merged: each piece of furniture is merged into itself, never into its neighbour,
because a natural 1 still has to throw the bookcase across the room.

The triangle count is unchanged on purpose. Merging removes draw calls, not
geometry.

Materials are collapsed after the scene is built rather than by rewriting five
modules to pull from a shared palette. `js/palette.js` walks the graph and points
every mesh at one instance per distinct surface. It skips sprites, which animate
their own material every frame — a speech bubble, a flame, a floating score —
and would otherwise all end up showing the last thing assigned to any of them.

## Windows and plants

The back wall is a shape with two rectangles cut out of it, not a plane. A window
painted on a wall gives itself away the moment the camera drifts off axis, because
the reveal does not move against the view — so these are real openings with a jamb,
a sill and glass set back 17 cm. Cutting the wall costs one triangulation at
start-up and nothing per frame; the only care it needs is the UVs, which
`ShapeGeometry` writes in metres and which have to be remapped to 0..1 or the
wallpaper tiles a hundred and sixty times across.

Where they are was not a composition choice. Reading the back wall from the left:
bookcase, chimney breast, five posters, dartboard, television. The only clear runs
are outside all of that, so the windows flank the room rather than sitting behind
the party, and they swing in and out of frame as the camera sweeps. Most of the
time what you see of them is the light.

What is outside is the blue hour, not daylight: the clock reads twenty past eleven
and the fire is lit. A cool window against a warm hearth is the contrast that makes
an interior read as a place rather than a lit box, and daylight would wash the fire
out. Both windows use the same generator with a horizontal offset — two windows on
one wall look onto the same street, not onto two.

Twenty-four plants — floor, mantel, hearth, bookcase, television, both sills, and two
hung from the ceiling on macramé cords that run up out of frame. Each one is **two
meshes**: a pot, and a canopy. A monstera is eight leaves and a fern a hundred and
twenty leaflets, so the naive build would have cost several hundred draw calls; they
go through the same merge path as the bookcase, with the colour variation between
leaves carried on a vertex attribute. The pot's body and rim bake together, and the
soil rides along in the canopy merge with a brown vertex colour rather than costing
a mesh of its own — that alone took the room from 251 meshes back to 203. The leaves are
flat outlines bent twice — down along their length and up along their width. A leaf
modelled as a flat card vanishes edge-on and takes light as a single tone; the
second bend is what makes a canopy read as many surfaces rather than a green cloud.

Placements were measured, not eyeballed. Successive passes put the monstera 8 cm
inside the chimney breast, a fern 28 x 49 cm inside the sofa, the mantel plant's
vines through the brickwork, a pot on the bookcase 7 cm up through the window sill
above it, and two ferns with their leaves 6 cm through the back wall. None of that
was visible in a screenshot at this distance; all of it was visible in a
bounding-box sweep, which is now the check every new plant goes through: canopy
against canopy, canopy against the wall, canopy against the floor.

## Rain

It is raining outside, which is half the reason the windows are there. Two things
make rain read and they are not the same thing: the falling streaks give it
movement, and the water sitting on the glass gives it the cosiness, because that is
the part that says you are on the dry side of it.

The streaks are two scrolling sheets per window inside the reveal, between the view
and the pane, at different rates — one sheet has no depth, and the near one falling
visibly faster than the far one is the whole illusion. They are wider than the
opening so the wall crops them, because a sheet cut to the opening shows its own
edge the moment the camera is off axis. The slant is drawn into the texture rather
than produced by scrolling diagonally: scrolling diagonally walks the tile seam
sideways into view after a few seconds. The water on the pane is a normal map of
beads and runnels — the beads only have to catch the fire and the pendant and bend
them.

A particle system for this would be a thousand points to see two hundred of.
Wrapping a texture offset is free.

## The loading screen

A real icosahedron, projected and shaded per frame in SVG, not a picture of one
spun about its centre — twenty faces coming and going is what reads as a die. The
"20" rides on whichever face is most towards the viewer and fades as that face
turns away. It respects `prefers-reduced-motion` by holding a three-quarter view.

`js/loader.js` is its own script on purpose: Three.js comes off a CDN and the room
takes a moment to build, so the die has to be turning before any of that arrives,
or the loading screen is a line of text for exactly the stretch it exists to cover.

## Speech bubbles

Two things made the table talk hard to read, and both were measurable.

The text was drawn centred and never measured: **17 of the 40 lines ran past the
outline**, the worst by 200 px. Lines are now wrapped to the bubble at the largest
size from a ladder that fits, with the authored line breaks kept as hard breaks —
they are the comic timing, the pause between setup and punchline.

And the hold was a flat 3.5 s whatever the line — the same time for "Nat 20." as for
a two-clause joke. It scales with length now, roughly 1.9 s plus 85 ms a character
and capped at 8, with a 1.4–3.2 s pause after the bubble clears rather than a
cadence measured from the trigger, which left no gap at all after a long line.

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
js/effects.js     what a natural 20 and a natural 1 do to the room
js/merge.js       baking small static pieces into single meshes
js/palette.js     collapsing duplicate materials once the scene is built
js/shapes.js      rounded boxes — nothing in a room has a knife edge
js/plants.js      houseplants: procedural leaves, one merged mesh per plant
js/room.js        the room around it: posters, fireplace, sofa, television, windows
js/watercolour.js the painted look: post-processing chain and its shader
js/textures.js    every drawn surface: battle map, DM screen, posters, cloth, marks
js/loader.js      the spinning d20 on the loading screen, in plain SVG
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

Everything that lies flat on the table owns its own patch of it, and the layout is
checked rather than eyeballed. Two flat things at the same height in the same place
do not layer, they fight: the depth buffer picks a winner per pixel per frame and the
result flickers. The board was overlapping the DM's sheet by 21 x 14 cm and one
player's by 19 x 5 cm.

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
