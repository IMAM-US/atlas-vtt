# Epic Map Forge

**An inspiration interview + editable JSON map specification + prompt compiler.**

Built for fantasy regional maps, worlds, settlements, battlemaps and dungeons. It authors the map brief and image instructions. It does **not** generate images, create VTT scenes, or require an API key.

The regional example takes broad visual cues from the supplied ink-and-watercolor atlas reference while using original geography and names. The tactical example uses a different, strictly top-down construction. Both have complete JSON configurations.

## Start here

For the lightest workflow, use `SKILL.md` as instructions for your agent and provide `templates/starter-brief.json` or your own idea. The agent asks a few focused questions, develops the map, and returns an editable JSON response. Python is optional.

For a conversation-based workflow, attach `SKILL.md`, the schema files and one example, then use the text in `templates/launch-prompt.txt`. This explicitly supplies the workflow to that conversation; it does not claim to install a persistent skill.

For local Codex use, put this **whole folder** at:

```text
~/.agents/skills/epic-map-forge/
```

Or in a repository:

```text
.agents/skills/epic-map-forge/
```

Then invoke `$epic-map-forge`. These paths follow the documentation checked on 2026-10-01; see `references/renderer-and-sources.md`. No installation in your environment has been performed by this deliverable.

## A useful first request

> Use Epic Map Forge. I want a regional map of a mountain sanctuary above a valley where the forest is turning into glass. Keep the fine ink-and-watercolor treatment of my reference, but make the geography original. Ask only the unanswered questions that materially change the result. Return the complete editable JSON plus compiled image instructions. Do not generate an image.

The included `starter-brief.json` expresses a similar request as compact JSON. It is intentionally not a full canonical map: the skill turns it into one. The full spec is longer because it records explicit design decisions rather than hiding them in a paragraph.

## Files

| File | Purpose |
|---|---|
| `SKILL.md` | Agent workflow: interview, curate, specify, validate, compile, refine |
| `schemas/map-spec.schema.json` | Full canonical input contract |
| `schemas/response.schema.json` | JSON dialogue/output envelope |
| `schemas/patch.schema.json` | Supported revision operations |
| `templates/starter-brief.json` | Small inspiration-first input |
| `templates/launch-prompt.txt` | Copyable conversation instructions |
| `examples/regional-atlas.map.json` | Fully specified original regional adventure map |
| `examples/tactical-mill.map.json` | Fully specified 32 × 24 cell battlemap |
| `examples/discovery.response.json` | Example inspirational questions in JSON |
| `examples/regional-night.patch.json` | Focused revision preserving source geometry |
| `examples/regional-atlas.response.json` | Compiled regional response, including editable source |
| `examples/tactical-mill.response.json` | Compiled tactical response, including editable source |
| `examples/regional-player.render-brief.json` | Audience-filtered brief without the private master |
| `scripts/map_spec.py` | Optional validator, patcher and deterministic compiler |
| `tests/test_map_spec.py` | Automated authoring/compilation tests |
| `references/` | Art direction, data semantics, renderer boundaries and sources |

## Optional local tools

Requires Python 3.10 or newer and `jsonschema`. Run from inside the `epic-map-forge` folder:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt

python scripts/map_spec.py validate examples/regional-atlas.map.json
python scripts/map_spec.py compile examples/regional-atlas.map.json -o my-brief.response.json
```

The output contains the complete editable map and the compiled image instructions. To extract just the image-facing text, or an audience-filtered JSON brief:

```bash
python scripts/map_spec.py compile examples/regional-atlas.map.json \
  --audience player --text -o image-instructions.txt

python scripts/map_spec.py compile examples/regional-atlas.map.json \
  --audience player --render-brief -o render-brief.json
```

To apply the example night revision:

```bash
python scripts/map_spec.py patch examples/regional-atlas.map.json \
  examples/regional-night.patch.json -o my-night-map.json

python scripts/map_spec.py compile my-night-map.json -o my-night.response.json
```

The patch tests revision 1, modifies only its declared fields, validates the result and writes revision 2. It does not render or modify a picture. Faithful visual variants still require an actual approved base image and a later editing step.

## What is configurable

Each entity has its own stable ID, kind, name, visibility, importance, quantity, target bounding box, optional shape path, materials/appearance, mandatory features, exclusions and gameplay role. Routes name endpoints and intermediate locations, define their path, and can specify minimum clear width. Relationships state requirements like “north of,” “inside,” and “crosses.”

The rest of the map controls visual hierarchy, medium, palette, texture, season, weather, lighting, aspect ratio, output targets, grid type, cell scale, exact label strings, overlay placement, player/GM information and edit locks.

For example, changing `entities.glass_spires.quantity` changes the requested count. Changing one of its must-show details changes its distinctive appearance. Changing `environment.time_of_day` does not silently move the citadel. Locked paths require explicit approval before the patcher changes them.

The schemas deliberately do not pretend that these are native image-model controls. They are authoring controls compiled into understandable instructions or a postproduction plan.

## Important boundaries

**Private source versus player output.** The full `.map.json` and `.response.json` files can contain GM notes and hidden locations. They are private master documents. The compiler excludes explicit `gm_only` elements and `gm_notes` from player image instructions, but it cannot detect a secret carelessly written into an otherwise public description. Review shared prose.

**Planned geometry versus actual art.** Normalized coordinates, graph connections and grid arithmetic can be validated in JSON. That does not prove that a future rendered bridge meets the bank, a doorway is open, a label is spelled correctly, or a path is wide enough for a token. Inspect and calibrate the actual output.

**Output target versus native resolution.** Requested pixels and file format are delivery goals. The package neither invokes an image API nor verifies any resulting image file. It does not automatically upscale, tile, draw overlays or author a VTT scene.

**Source stability versus image stability.** The compiler is deterministic and records a source hash. Image generation is not guaranteed to be repeatable from that hash. For variants, edit a supplied approved base image and verify what changed.

## Tests and evidence

```bash
python -m unittest discover -s tests -v
```

The delivered version was checked against both example specs and the response schema. The automated suite covers compilation stability, revisions, locks, counts/IDs as data, basic placement rules, graph reachability, grid arithmetic, explicit GM filtering, and refusal to overwrite the input file. See `TEST-REPORT.md` for the executed result.

No images were generated or visually evaluated for this release. Therefore this is a tested **prompt-authoring package**, not a demonstrated benchmark of map-image quality.
