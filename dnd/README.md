# Horn Saerens — the Dungeon Master's sheet

A 3D table set for a D&D session, in somebody's living room: a fire going, a
television left on, posters that have been up since about 2003. I am the DM; the
players are the models I actually run — **Fable** (Claude Code), **Gemini**, **Qwen**
(an open model on local hardware) and **Codex**. They sit around the table on
chairs, one colour each, each wearing a television for a head with that model's
mark on the screen: two opposite, one at each
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

## The players' surface

RobotExpressive ships with **no maps and no UVs**: four flat colours at roughness
0.9 and metalness 0.1. That is a matte chalk which takes light the same way from
every direction, and in a room where the table, the floor and the wall all carry 2K
scans they were the only things in frame with no surface on them. It showed.

Nothing could be mapped until there was somewhere to put it, so `boxProjectUVs`
writes a box projection: each vertex takes the two axes its normal is *least*
aligned with, so no face samples the texture edge-on. The cost is a seam wherever
neighbouring faces choose different axes — invisible on a grain with no direction,
and unusable for anything with a pattern.

On top of that, one shared `paintedShell` set — the orange peel of sprayed paint, a
brushed pass under it, specks and scuffs — driving albedo, normal and roughness. It
is near-white, so it multiplies into each player's own accent and one texture serves
all four. The roughness map carries a deliberately narrow band, 0.29 to 0.49: that
is one finish, not two materials, and its job is only to stop a highlight being a
clean oval. Metalness goes to 0.38 on the shell and 0.72 on the joints, which is
what lets them pick up the hearth and the windows as *coloured* reflections.

The first pass got the grain scale wrong — a tile of 10 cm on a 70 cm figure, so at
the distance the players are actually seen from it averaged out to a flat field. The
texture was there and invisible, which is the worst of both. It is 2.5× coarser now
and there is large-scale patina under it.

Finally, **cavity occlusion baked into vertex colours**. An armpit, a neck, the gap
between a finger and a palm are darker in life, and a renderer with no AO has no
idea. Ray casting 7,200 vertices against 7,200 triangles on the main thread is not
affordable, so this uses the standard cheap estimate: for each vertex, how many of
its neighbours within a small radius sit *in front of* its tangent plane. None, on a
flat panel or a convex edge. Most, in a crease. Every part is pooled into one space
first so a crease *between* two parts is found as readily as one within a part, and
it runs after the figure is posed — an armpit is only an armpit once the arm is
down. It comes out at 0.4 to 1.0, and the shoulders and torso are the darkest, which
is where the creases are.

## Testing

Everything above this line was judged through a preview pane that resized itself,
stopped drawing when the window went behind another one, and throttled
`requestAnimationFrame` to nothing. Three separate frame-rate readings taken that
way were artefacts. And a screenshot from it was a different picture every time,
because the idle camera is a function of elapsed time — so no two captures could
be compared, which is the one thing a screenshot is for.

`test/shots.mjs` runs the page in headless Chromium through Playwright, on
SwiftShader so there is real WebGL, pins the camera to four fixed poses, and
writes PNGs to `test/out`. It also measures the shadows the only way that means
anything: render the frame twice, once with the casting lights' shadows on and
once off, and count how many pixels moved and by how much.

```bash
npm install && npx playwright install chromium
npm run shots          # against the local server on :4330
npm run shots:live     # against GitHub Pages
```

`test/rays.mjs` traces every light through every object to where its shadow lands,
and `test/visible.mjs` adds the question that mattered most: whether the camera can
see that place. `test/lights.mjs`, `test/lamp.mjs`, `test/cone.mjs` and
`test/variants.mjs` are the bench — they try whole rigs, head positions, cone widths
and complete lighting setups rather than single parameters, write each to a PNG,
and score it. Nothing in `test/` ships — the page is still static files with no
build step.

## Why there were no shadows

"Still no shadows — is there no way to have a dynamic light so the shadow happens
naturally, or do we have to do the shadow of every object?"

Neither, as it turned out. Every object was already casting: 62 of the 74 things on
the table have `castShadow`, and the tabletop and the floor both receive. And the
pendant's shadow was already changing **13.7% of the frame** by more than 2%. The
shadows were there. They were just never *dark*: only **one pixel in a thousand** was
being darkened by more than 10%.

Shadow depth is not a property of the shadow map. It is the ratio between the light
that is blocked and the light that is not — and the one light that casts was
contributing about a third of what reaches the table. Everything else, fourteen
lights and an environment map, fills its shadows straight back in.

Which is why more lights is the wrong instinct, and the measurements say so. Three
were tried:

| added light | pixels its shadow changed >2% |
|---|---|
| a raking spot from the right | 1.0% |
| the hearth aimed into the room | 0.1% |
| a shadow on the players' key | **0%** |

Each new unshadowed light makes every *other* shadow shallower. And a light placed
on the camera's side casts its shadows away from the viewer, where by construction
they cannot be seen.

Raising the key light from 15 to 38 was the first half of the fix. Measured across 15, 24,
30, 38, 48 and 60, the pixels darkened more than 10% go from 0.1% to 11.4% — and the
picture does not get brighter. Frame mean moves 0.334 → 0.345, the crushed fraction
does not move at all, and blown highlights stay under 1%. It is a spot confined to
the table, and the table already sits on the shoulder of the tone curve: the lit side
saturates while the shadowed side does not move, which is precisely the ratio that
was wanted. 38 is where it stops paying; past about 48 the shadows go black rather
than dark.

### And then it still was not enough

Reported again, with a screenshot, as having no shadows — and the screenshot was
right. Deepening the pendant's shadow made the dark parts darker without making any
shadow *readable*, because the problem was never depth. It was position.

`test/rays.mjs` settles it the way the obvious method says: from each light, trace a
ray through each object, and the first surface past it is where its shadow lands.
Then ask of that place, in order, because the first "no" is the answer — is it
inside the light's cone at all; is it inside the shadow camera's frustum; does the
pixel there actually go darker.

Every row came back the same: **OUTSIDE CONE.** The pendant's half-angle is 56° and
the landing points were at 67-86°. A spot lights a circle of radius `height x
tan(angle)`, 2.8 m here, and a player sitting 1.2 m off the axis throws its shadow
out to 2.5-4 m, past the edge. Outside the circle there is no light to block.

Widening the cone fixes the geometry and not the picture. At 1.4 rad, 24 of 24
shadows land inside the lit circle and exactly **one** darkens a pixel — a point
light falls off as the inverse square, so three metres out it contributes about a
twelfth of what it does over the table, and the ambient swamps the rest.

`test/visible.mjs` then found what none of the earlier measurements could see. It
adds one question, *can the camera see the place where the shadow lands*, and the
tally settles it:

| | hidden | too weak | reads |
|---|---|---|---|
| pendant | **15** | 0 | 0 |
| directional through the window | 12 | 1 | 1 |

The pendant's shadows are neither missing nor faint. They fall **ten centimetres
behind each player, on that player's own chair**, where the player's body is between
them and the camera. A light almost overhead puts the shadow almost underneath, and
the thing casting it is exactly what hides it.

**The rule, measured rather than assumed: a shadow reads only when it is thrown
sideways relative to the camera's line of sight through its caster.** Overhead hides
it underneath, behind hides it behind, and the camera's own side hides it behind too
— which is why the players' key light, the hearth aimed into the room and a wider
pendant cone all came to nothing, and why a lamp on the left edge throwing right
across the table worked immediately.

So there are two new lights and both are lateral:

- **A clamp lamp on the table's left edge**, head 28 cm above the tabletop. Seven
  rigs and then seven head positions were scored on a fixed shot. Lowering the
  pendant instead — the obvious thing to try — makes it worse, narrowing the cone
  faster than it shortens the throw. And the position is sharp: 16 cm along z, from
  0.42 to 0.26, takes the deep fraction from 1.7% to zero.
- **A directional light aligned with the left window.** Directional and not a point,
  precisely because of the inverse-square problem above: no distance term, so a
  shadow three metres away is as dark as one three centimetres away. It throws right
  and forwards, both lateral to the view.

Pixels darkened by more than 25%, per fixed shot:

| | before | + lamp | + window |
|---|---|---|---|
| wide | 0.07% | 0.56% | **1.30%** |
| table | 0.06% | 2.63% | 2.65% |
| players | 0.00% | 2.61% | 2.61% |
| floor | 0.07% | 0.21% | **0.79%** |

What this does not do is give everything a shadow. Twelve of eighteen traced shadows
are still hidden even with the window light, and that is inherent — the room is
dense and most shadows land behind some other piece of furniture. The claim is only
that the ones which *can* be seen now are.

### The fill was the rest of it

Still reported as not enough, and the remaining cause was the one the ray tests
had pointed at without naming: **too much fill**. Sixteen lights, three of which
cast, and every one of the other thirteen pouring light into every shadow the three
made. The worst offender sat 4 cm from the key light — an unshadowed point light put
there to give back the sideways spill of a bare bulb, which meant it filled the
key's own shadows from the key's own position, unblockable by construction.

Six complete rigs were rendered side by side (`test/variants.mjs`) and looked at,
not just measured. The one kept: that spill light removed, the environment halved
from 0.65 to 0.35, the window light raised from 2.2 to 3.2, hearth and player key
untouched. A stronger variant that also halved the hearth scored higher on deep
shadow and was rejected on sight — it darkened by putting out the room's warmest
source, and the posters went with it.

| pixels darkened >25% | start | + lamp + window | + this |
|---|---|---|---|
| wide | 0.07% | 1.30% | **3.73%** |
| table | 0.06% | 2.65% | **4.14%** |
| players | 0.00% | 2.61% | **2.92%** |
| floor | 0.07% | 0.79% | **3.11%** |

The environment at 0.65 was set to open up the corners after they were reported
as blocked. Halving it will darken them again, but the dark is shaped now — a wall
with a gradient, a floor with a pool — where before it was a flat band. If the
corners still read as blocked, the lever is the +Z panel in `environment.js`, which
lights what faces the camera without filling the table.

A note on the harness: Playwright's `headless_shell` lost WebGL entirely partway
through the day — every flag set returned no context. The scripts now launch the
full Chromium (`channel: "chromium"`), which runs on the machine's real GPU: what
users see, and roughly a hundred times faster than SwiftShader. The six-rig sweep
that had timed out took seconds.

## The players, rebuilt

Four bodies, one per agent, built in `js/robots.js` from primitives — capsules,
cylinders, extruded and rounded boxes — and placed in a seated pose by
construction rather than by folding a skeleton. The television head is unchanged;
it was always the part that said which agent this is.

Each has its own silhouette, keyed by role, so you can tell them apart across the
room with the screens off:

| agent | role | body |
|---|---|---|
| FABLE | The Chronicler | broad, tapered chest, plated, shoulder pads, a server rack on its back |
| GEMINI | The Scribe | a slim spindle with rings, two back fins, lit aerials |
| QWEN | The Local | a drum with a dish on one shoulder, a compass rose on the chest, a rolled chart |
| CODEX | The Artificer | a box with a front panel, gauntlets on both forearms, a tool rack, a power pack |

The body, the prop on the table and the emblem on the screen are chosen by three
fields on each player in `js/content.js` — `body`, `prop`, `mark` — so renaming a
player is a change to that file alone; nothing in the scene modules knows a player
by name. The players were first named after Greek heroes; they are named for what
they are now, because the picture is a Dungeon Master directing his agents, and the
projects on the sheets in front of them are real work described without the agents'
names in it.

Each body is three merged meshes per moving group — painted shell, bare metal,
lit accents — so twenty-odd parts cost six draw calls. Every part has UVs, so the
painted-shell maps apply the ordinary way, and the cavity occlusion bakes on the
result once it is posed. Nothing else in the scene changed: the click box, the
bubble mount, the screen glow and the chair were already independent of the body.

Two things fixed on sight from the harness rather than by eye: the Messenger's
shoulders sat at 0.17 on a column only 0.11 across, and the arms hung three
centimetres clear of it; and the Platform's first chest was a straight box, which
read as a filing cabinet — it is an extruded trapezoid now, square at the shoulders
and narrowing to the waist.

One more fix from the harness: the hands and aerials came out coarse. Every
primitive arrives with UVs running 0..1 across itself, so a three-centimetre finger
wore one whole tile of the paint texture, the same as a forty-centimetre torso. The
primitives' UVs are thrown away after the merge and replaced with a box projection
in metres, so texel density is a physical constant — one tile every 25 cm on a
finger, an aerial or a chest alike. `test/closeup.mjs` frames a hand and an aerial
to check it.

And the paint itself. Each agent's colour is its *screen* colour — a light, cyan at
93% saturation, amber at 100% — and painted onto a body it came out as toy plastic.
The earlier fix, accent × 0.62, could never help: a uniform multiply darkens a colour
without touching its chroma. The shell now goes through HSL, takes saturation down
to 52% of the screen's and sets lightness to that of a paint under lacquer, so the
four read as sage, teal, ochre and mauve on metal. The small lit accents keep the
full screen colour, which is what still says whose body it is.

### Joints, housed

The first cut of these bodies was capsules and spheres set next to each other,
and the wide shot read it as what it was: a tube for an arm, a ball for an elbow,
two blocks for a hand, each floating beside the next. The difference between a
designed robot and a stack of primitives is not the count of parts. It is that
every joint is *housed* and every limb runs joint to joint with no gap.

So the limbs are now solved from three explicit points a side — shoulder, elbow,
wrist — and built *between* them as tapered tubes, which is why none has a gap at
either end. The shoulder joint sits under a painted pauldron with a dark rim and a
bolt; the elbow is a ball with a hinge disc either side; the wrist is a ring; the
knee is a ball under a painted cap; the ankle a ring above a booted foot with a
painted toe. Seam rings sit where one shell meets the next, a dark abdomen shows
at the waist, a yoke crosses the shoulders and the neck is a bellows. The hands
are palms with three curled fingers and a thumb, resting on the table.

Resting *on* it: the arms live in the `upper` group, which leans, and the table
does not. Placing the wrist at table height in the leaning frame put it seven
centimetres into the wood for the player who leans most. The wrist is now placed
in the room and rotated back by the lean, and the palm is pitched by the same
angle, so every hand lies on the table plane whatever the posture.

The bare-metal parts went from roughness 0.9 to 0.45. A metal with no highlight
on it is a grey, and the joints and hands were the flattest things on the bodies.

Two of the new parts were wrong in the first render and fixed from the close-ups:
the pauldron's rim had its own tilt and leaned the other way from its cap, a hoop
floating beside a dome; and the palms hovered a centimetre over their own shadows.
Cap, rim and bolt share one frame now, and the palm hangs below the wrist.
`test/closeup.mjs` frames the slab body head-on and the box body from the side for this.

`?players=gltf` brings back the RobotExpressive bodies and `?players=suit` the
suited figures, both kept as the two earlier answers to this table.

### The chairs, the card and the posters

Once the players had bodies, the chairs under them were the poorest things in
the room: a grey slab on four steel pins. They are dining chairs now — walnut like
the table, four tapered legs splayed at the foot, an H of stretchers, the rear legs
running on up as the uprights, and two curved slats across the back. Each slat is
the region between two arcs extruded through its height, and its middle is set
three centimetres behind the uprights so the ends land on their front faces and
the back bows away between the posts, as a bentwood back does. The frame is one
merged mesh with metric UVs, so the grain is the same size on a leg as on a slat;
the leather pad is a second. `along`, `between` and `ring`, the joint-to-joint
builders the players are made with, moved to `js/shapes.js` for this.

The hint at the bottom of the screen was a translucent grey bar — the one thing on
screen the room had not made. It is a parchment card now, in the sheet's own ink
and type, with a small red die before the text. The back button matches.

Three more from looking at those renders: the chair walnut, at the table's own
colour, rendered near black in the room's darker half and is a warmer, lighter
brown now; the Artificer, seen from behind, was a plain box where every other player
carries something, and has a power pack with a handle, two lit gauges and a hose
down to the belt; and the speech bubble was the last comic-book thing on the
table — a seven-pixel outline in the speaker's colour — and is a card in the
hint's language now: parchment wash, a hairline of ink, a second hairline inside
it in the speaker's colour, the name in tracked capitals over a rule.

The posters are drawn at twice the size they are laid out at. The designs are
written in 512 × 724 units, and at that resolution a 66 cm poster carried 7.7
pixels to the centimetre — soft in any shot closer than the wide one. The layout
stays in its own units; only the backing canvas doubled.

## What the players actually needed

Three maps where there had been none, a clearcoat, cavity occlusion in the creases,
and a shadow-casting hearth — and the honest report back was "I can't see a
difference". That is worth measuring rather than arguing with, so each change was
switched off in a live frame and the finished image differenced against itself:

| change | mean Δ over the frame | pixels changed >2% |
|---|---|---|
| hearth's spot light and its shadow | 0.0004 | **0.1%** |
| clearcoat | 0.0013 | 0.1% |
| cavity occlusion | 0.0020 | 2.9% |
| shell maps + PBR response | 0.0067 | 5.5% |
| **a key light on the players** | **0.0103** | **12.1%** |

Everything done to the *surface* lands at around one per cent, which is below the
threshold at which anybody notices. The reason is the same for all of it: **the only
strong light in the room hangs directly over the table.** It lands on the tops of
their heads and their shoulders and nowhere else, and a surface has to be lit across
it to show what it is made of. The maps were not the problem; there was nothing
raking across them.

So the players have their own key now, warm and soft from the camera's side. It is
motivated rather than invented — the near half of the room is floor, rug and sofa,
and it bounces the pendant back; the environment map already carries that bounce as
a flat panel, and this is the same light given a direction so that it models instead
of only lifting. No shadow map: by construction its shadows fall away from the
viewer.

It costs 0.011 on the frame mean (0.339 → 0.350 in the test frame) and takes the
crushed fraction *down* slightly, so the room keeps its falloff.

**And the hearth's shadow was reverted.** A fire at ankle height throwing long
shadows is most of what a hearth does to a room — the argument was good and the
result was 0.0004 of the tonal range, not one pixel in a thousand moved by more than
2%. Its shadows land on the floor between the table and the camera, which is hidden
behind the table from every angle the camera takes and already darkened by the baked
occlusion. A light and a whole shadow pass for four ten-thousandths of an image is
not a trade worth making, however well it reasoned.

## Ambient light

Reworked against a histogram of the finished frame rather than by eye, because
"the room looks a bit flat" is not something you can act on and a histogram is.

**Before:** mean luminance 0.292, 38.6% of the frame below 0.125 with a single 30%
spike in one narrow dark band, 54% below 0.25, and **nothing at all above 0.94**.
A picture with no highlights and almost no midtones — a dark mass, and the pool on
the table, and a gap between them.

The cause was the ambient itself. It was three.js's `RoomEnvironment` — a generic
bright studio box, the right answer for a product turntable and the wrong one for a
room lit by a hearth — plus a hemisphere light and a directional fill. All three
are flat: they raise every surface by the same amount whichever way it faces, which
lifts the floor of the histogram without putting anything into it.

`js/environment.js` replaces it with a box whose walls are the room's own sources:
hearth warm and low on one side, two cold windows behind, the pendant's bounce
overhead, the television's blue on the right, everything else nearly black. Indirect
light then has a direction and a colour, so a surface facing the fire gets a
different answer from one facing a window — and that difference is midtones.

The one number that had to be found and not designed is the shell, the part that
*is* flat. The first version had it at 0.30 and the room came out evenly lit like an
afternoon, with the wall as bright as the table; the histogram was better and the
picture was worse, which is the whole argument for looking as well as measuring. It
sits at 0.045 now and the panels carry the light.

That first pass left the corners blocked up: 22% of the frame crushed to black,
against 8.7% before. Averages hid where it was, so the frame was split into a
nine-cell grid and each cell measured on its own — **the top-left cell was 53%
crushed against 7% in the middle.** That cell is the hearth, the mantel and the
bookcase, and the reason is not obvious until you look for it: *they all face the
camera*, and there was nothing on the camera's side of the environment box. The
whole near half of the room — floor, rug, sofa, and the warm bounce off all three —
had simply been left out. One dim warm panel there takes that cell from 53% to 11%,
and the picture keeps its falloff because the panel only reaches what turns towards
the viewer.

**After:** mean 0.359, 10.6% crushed, 21.7% below 0.125 instead of 38.6, 32.2% below
0.25 instead of 54.2, the dark spike spread across four bins, and 0.7% of the frame
above 0.94 where there had been none. No cell of the nine is above 19%.

Those highlights came from the practicals. A filmic tone curve is mostly shoulder,
and only 1.4% of the scene was ever above 1.0, so the shoulder never came into play.
The bulb, the embers, the lamp shade and the television now render brighter than
white — a lit bulb is not a white object, it is a source, and the brightest thing in
frame reaches 42 in linear terms instead of barely clearing 1.

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

That Sobel was also what covered the wall in black specks. At its original
settings the pass inked every luminance step in the frame at up to 70% — a
silhouette against the wall, yes, but also the centre dot of every wallpaper motif,
the grain of every scan and the text on every poster, which is why "PRESS START"
read as "FRESO STARR" from across the room. The edge now goes through a threshold:
a gradient under 0.09 is texture and is left alone, over 0.42 is a contour and gets
its pigment, and it gets less of it (42% rather than 70%). The sampling wobble is a
third of what it was, the quantise step is off, the grain is lighter and there is a
vignette. The dust motes, which were the other source of specks on the wall, are
fewer and fainter. Same shader, same alpha carry-through for the CSS3D sheet.

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

## Textures and baked occlusion

The photo scans are 2048 square. At 512 the floor was the softest thing in the
render, and not only because of the resolution: the parquet tiled 2.2 times across
a 14 m plane, which is 6.4 m to a tile and 80 pixels to the metre — and a 6.4 m
parquet tile is not a parquet tile, it is a photograph of one enlarged until the
blocks are the size of floorboards. The tile is 2.5 m now and the texture four
times bigger, so the same square metre of floor carries about twelve times the
detail. Anisotropy went from 8 to whatever the GPU will give, because a floor read
at a grazing angle across ten metres is the case that filtering exists for.

Cost: 5.2 MB of JPEG, re-encoded down from the 14.5 MB Poly Haven ships.

The floor's ambient occlusion is **baked once at load**, in about 150 ms. Real-time
AO was tried and rejected — a `GTAOPass` costs ten times the frame at this mesh
count — but nothing says it has to be recomputed every frame. None of this
furniture moves, except for the eight seconds after a natural 1, when the whole
overlay is hidden anyway.

It is rendered, not ray cast. An orthographic camera looks down at the floor and
the room is drawn into it four times, with the near and far planes clipped to a
slice of height. Each pass comes back as a silhouette of everything in that slice —
real outlines, chair legs and leaves included, because it is the actual geometry
rasterised by the actual renderer. Each slice is then blurred by an amount that
grows with its height and mixed in with a weight that falls with it, which is what
occlusion does: the contact patch under a table leg is small and nearly black, the
shadow of the table top two feet above is wide and faint. Slicing by height is what
makes one blur radius per pass legitimate.

The one counterintuitive detail: **the bottom slice starts below the floor.** Seen
from straight above, a vertical surface has no projected area at all — a table leg
is four vertical faces and two horizontal caps, and only a cap is visible from up
there. Its bottom cap sits a centimetre under its nominal base because the rounded
box bevels, so a slice starting above the floor clipped it and the leg cast nothing
whatsoever. That was not visible in a screenshot; it was visible as a profile read
across the leg, which came back a smooth ramp from 22 to 53 with no peak where the
leg is. It reads 85 against 49 beside it now.

Twenty-four quads became one.

### The flicker

Something still flickered after all of that, and it was measured rather than
guessed at: `test/flicker.mjs` captures the canvas as displayed — after the paint
pass — on ten consecutive frames with the camera on its idle drift, and flags every
pixel whose frame-to-frame change flips sign on most of them with real amplitude.
Smooth motion (breathing, rain, the hearth) does not flip; a depth fight, shadow
acne, a sparkling highlight or a one-pixel edge popping in the ink does. It then
repeats with one suspect at a time switched off — dust, shadows, ink, wobble,
clearcoat, the floor's specular, each light — four times each, median kept, because
the idle camera's speed varies and a single capture is noise.

No suspect moved the number. What the overlay showed was a solid patch of flipping
pixels with a straight, slightly tilted top edge, on the floor between the sofa and
the television — the shape of the rug. The rug sits 4 mm above the floor. The baked
occlusion quad, drawn over the floor with multiply blending and no depth write, sat
at 4 mm too: exactly coplanar, so the depth test between them was decided by
rounding, per pixel, per frame, and the whole rug flickered between darkened and not
whenever the camera moved. The quad sits at 8 mm now with a polygon offset besides,
so nothing laid flat on the floor later can tie with it. The room's flipping pixels
went from bursts of 0.9% to a steady 0.07%, which is edge crawl on a drifting
camera and the rain doing what rain does.

## Compiling at load

The page stopped loading on one machine, and on a fast one the loader stayed up
for 25 seconds. `test/loadtime.mjs` times navigation to loader-hidden for a query
string, and `test/perf.mjs` collects nine hundred frame times, the shader count
over time and the worst frame. Three things, in order of size:

**The cavity bake was quadratic.** The rebuilt players are 330 000 non-indexed
vertices packed into half a cubic metre, and the bake compared every vertex with
every neighbour within 16 cm — thousands each — through a string-keyed grid.
Twenty-one seconds of the load, and never finishing on a slower machine. The grid
keys are integers now and each vertex samples at most twelve neighbours per cell,
striding evenly through the bucket; an estimate of enclosure over thirty spread
neighbours is as good as one over three thousand. Every primitive also lost
segments it did not need (a torus at 6 × 16 rather than 10 × 28, spheres at 12
rather than 18) — 190 000 vertices, the same picture. The four bodies now build
and bake in about a quarter of a second.

**The first frame compiled every shader on the spot.** 3.2 seconds frozen on a
cold shader cache, after the loader had already gone, with the die stuck mid-spin
because the main thread was busy. `renderer.compileAsync` moves that under the
loader and, where the driver allows (`KHR_parallel_shader_compile`, and it does
here), off the main thread. Two details had to be measured: a program's cache key
includes the colour space of the render target it is compiled against, and the
scene is drawn into the composer's linear HalfFloat target — compiled against the
canvas, all 21 programs were the wrong ones and the first frame compiled 21 more.
The target is set first. And compileAsync knows nothing of the shadow pass or the
post-processing chain, so one warm-up frame is drawn under the loader for those.

| cold load, fast GPU | before | after |
|---|---|---|
| loader hidden at | 23.6 s | about 5 s |
| first visible frame | frozen 3.2 s | 11 ms |
| shader programs | 48 | 29 |
| worst frame in the first 15 s | 744 ms | 20–31 ms |
| frames over 33 ms | 1 | 0 |

**Nothing compiles later.** The bubble, the sparks, the sheets' cut-outs are all
in the scene from the start, so the 744 ms hitch a few frames in — a material
meeting the GPU for the first time — is gone; the shader count does not move
after load.

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
js/robots.js      the players' bodies: four seated silhouettes built from primitives
js/chatter.js     the speech bubbles, one at a time
js/effects.js     what a natural 20 and a natural 1 do to the room
js/merge.js       baking small static pieces into single meshes
js/palette.js     collapsing duplicate materials once the scene is built
js/occlusion.js   the floor's ambient occlusion, baked from above at load
js/environment.js the ambient light, as a box of the room's own sources
js/shapes.js      rounded boxes, and box-projected UVs for models that have none
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
