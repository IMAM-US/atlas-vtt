# The integration studio

Accepted owner addition: actual images should represent sections of the work. The first visual is a quiet overhead studio with an Atlas cartography bench, an OpenRig systems bench, a shared review table and an evidence library. This is an authored spatial metaphor, not an operational topology.

| Native object | Identity and meaning |
| --- | --- |
| Studio image/map asset | One piece of artwork with its own asset ID and vault path. It defines no agents, work or permissions. |
| Integration scene | One editable view of this project; native scene asset `scene-1792286764203-ykkw4w` in the review vault. Other scenes may represent this same project differently. |
| Two plain seat tokens | Independent scene object IDs with references to stable OpenRig seats. Their artwork, labels and placement remain authorable. |
| Repository labels and pins | Human-authored place definitions and links to ordinary repository orientation notes. The bench painted beneath a label has no machine-enforced boundary. |
| Proposal and review cards | References to authored artifacts and their exact evidence revisions; a card is not the document or its acceptance. |
| Work cards | References to the author obligation and its real review successor. Moving one onto the review table does not hand it off. |
| Annotation | Ordinary editable text, with normal undo and persistence. It can describe intent without asserting a runtime fact. |

The image is a local generated asset. Atlas's existing image worker converts it into a 1400 by 1400 WebP, its map asset service registers it, and the native scene background action applies it. Existing scene objects are preserved. New scenes receive it at creation; existing scenes use the explicit **Add integration studio artwork** command. Reopening never resets an authored background.

Candidate meanings to explore later: evidence shelves could collect linked knowledge; the review table could express a proposed coordination focus; a resource cabinet could reference a database without granting database access. None is an operational rule in this milestone.

## Generation provenance

Built-in imagegen was used, without an API-key workflow. Source: `src/app/agent-workspace/assets/integration-studio-v1.png`. The original is 1254 by 1254 pixels; Atlas performs ordinary import sizing and WebP conversion. The prompt was:

> Use case: stylized-concept. Asset type: a square top-down illustrated workspace map used as the background of an editable Atlas agent workspace, not a screenshot or a UI mockup. Create a beautiful quiet architectural atelier for two software repository specialists collaborating. Orthographic straight-overhead floor plan, absolutely no isometric perspective, no people. A single spacious square studio, softly lit charcoal slate floor, restrained walnut furniture, copper and muted teal details. Four evocative sections: upper-left a cartographer/designer bench with rolled maps, dividers and small geometric scene pieces (Atlas); upper-right a systems engineer bench with a neat patch panel, cables and a small mechanical relay model (OpenRig); lower-middle a shared broad review table with two matching document trays and one empty central folio (review and handoff); bottom edge a shallow evidence library with archival boxes, a globe and indexed shelves. A small open threshold at bottom center. Furniture should cluster along the perimeter and corners, leaving extensive quiet dark floor in the middle and wide clear areas at approximately 25% and 75% of width, 20%-45% height, for movable agent tokens and readable labels. Each bench needs a distinct recognizable material silhouette, but avoid visual clutter. Refined hand-painted architectural game-map illustration, tactile materials, calm intelligent workshop, warm pools of desk lighting against dark floor. No text, letters, logos, numbers, status badges, arrows, grid lines, characters, humanoids or embedded interface controls. The scene must stay usable beneath editable dark-backed Atlas labels. Square aspect ratio.
