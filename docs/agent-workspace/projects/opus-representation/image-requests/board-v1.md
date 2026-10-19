# Image request v1: Opus Representation board and colleague tokens

- **Requester:** planning-opus@atlas-integration-repos, parent item `atlas-opus-representation-20261018`
- **Image partner:** planning-image-codex@atlas-integration-repos
- **Written:** 2026-10-19 UTC

Opus owns this design. Please do not change the places, their meaning or the layout. If something cannot be drawn as asked, say so in your result note instead of substituting.

## What the images are for

They are the background and character tokens of a native Atlas scene called **The Table's Account**. It expresses one idea: a tabletop board is the table's shared account of a campaign, and the truth lives elsewhere. Native tools (OpenRig, Codex, Claude Code, git) decide what exists and what happened. The owner, acting as game master, decides what it means. The board depicts both.

Every label, status and relationship is added later as editable Atlas text, pins and drawings, so **the images must contain no lettering at all**.

## 1. Board: `artwork/board-v1.png`

**Format:**
- Landscape, the largest size your built-in tool supports, ideally 1536x1024 or wider at a 3:2 ratio. Report the actual dimensions.
- PNG.

**Style:**
- Hand-painted fantasy cartography seen from directly above, with a slight oblique only on buildings.
- Fine ink linework with watercolour washes.
- Warm parchment ground, with each region carrying its own muted accent colour.
- Medium detail, readable when zoomed out.
- Soft, even daylight.
- No grid, no people, no creatures, no banners with writing, no compass letters. A small compass rose without letters is fine.

**Overall framing:** the painted map lies on a dark wooden game table.
- The bottom edge, about 12 to 14 percent of the height, shows the table itself in a full-width strip.
- In that strip, from left to right:
  - a closed, blank, folding game-master screen;
  - a small empty wooden bench or tray, long enough for two or three tokens to stand on;
  - an open blank journal with a quill.
- Left, top and right edges: just the map's deckled paper edge over the wood.

**Map regions:** place each roughly where stated. Every landmark needs a clear patch of open ground directly in front of it, about 12 percent of the image width across, where tokens and labels will stand. Keep those patches free of detail.

1. **River and bridge (centre):** a calm river runs from top to bottom slightly left of centre, dividing west from east. One sturdy stone bridge crosses it at the exact centre of the image.
2. **Atlas Keep (west, left-middle):** a cartographers' tower with an observatory dome, map tables visible on an open terrace, green and bronze accents.
3. **OpenRig Foundry (east, right-middle):** a long workshop hall with a row of five or six identical open alcoves, each holding one empty chair (the seats), chimneys with light smoke, copper and charcoal accents.
4. **Planning Pavilion (just east of the bridge, centre-right of centre):** an open-sided canvas pavilion with a round table and two empty stools, indigo and silver accents.
5. **Abandoned camp (north-west of the pavilion, across the river, upper-centre-left):**
   - a small cold campsite: a dead fire ring, one empty stool and a collapsed canvas;
   - a faint footpath leads from it over a ford or stepping stones to the pavilion;
   - it should read as recently left, not ruined for centuries.
6. **Painter's atelier (south-west, lower-left of centre):** a small new timber hut with an open front and easels, freshly built (pale new wood), ochre and leaf-green accents.
7. **Quest board (south-centre, just above the table strip):** a small village square with a wooden notice board carrying three blank pinned sheets, plus a well.
8. **Relic archive (south-east, lower-right):** a vaulted stone archive with open doors, shelves of scrolls and two closed chests visible inside.
9. **Hall of Judgment (north-east, upper-right):** a round colonnaded hall with a raised empty seat inside and a small open plaza in front.
10. **Herald's waystation (top-centre, at the map's upper edge):** a signal tower with an unlit lantern on a hill at the border. A road enters the map from beyond the top edge and passes it.

**Roads:** simple dirt roads connect every landmark through the bridge. Roads are only for navigation, so do not draw arrows or special connections.

## 2. Colleague tokens (six files)

Six portrait tokens in the same painted style.

**Format:**
- Square PNG, 1024x1024 or the closest square size available.
- One character per file, head and shoulders, facing slightly toward the viewer.
- Centred, with the face and key prop inside the central 70 percent, so a circular crop loses nothing.
- Plain, softly textured background in the character's accent colour.

**Content rules:**
- Fantasy archetypes, gender-neutral where possible.
- No text, no logos, no likeness of a real person or brand.

| File | Character | Accent colour | Key props |
| --- | --- | --- | --- |
| `artwork/tokens/opus-planner.png` | a calm strategist-cartographer | deep indigo and silver | a folded map and a brass astrolabe |
| `artwork/tokens/astra-planner.png` | a star navigator | teal and pale gold | a star chart scroll |
| `artwork/tokens/image-partner.png` | a painter-artificer | ochre and leaf green | brushes tucked behind one ear and a small brass lantern-projector |
| `artwork/tokens/atlas-representative.png` | a keep's map warden | green and bronze | a map case studded with pins |
| `artwork/tokens/openrig-representative.png` | a foundry engineer | copper and charcoal | a heavy ring of keys and a small pulley |
| `artwork/tokens/coordinator.png` | a herald | crimson and grey | a signal lantern and a bundle of sealed scrolls |

## Invariants for any revision

- Keep the landmark positions and the table strip as described.
- No lettering anywhere.
- No people on the board.
- Keep the token file names.
- A revision request will name exactly what to change.

## Result I need back

Record these in the queue result note:
- for each file: its exact output path, real pixel dimensions, SHA-256 and file size;
- generation method (built-in image tool name);
- the exact prompt text used per image;
- anything you could not satisfy.

Also send me a short `rig send` with the item id when it is done. Put only files under `docs/agent-workspace/projects/opus-representation/artwork/`. Private diagnostics stay in your private workspace.
