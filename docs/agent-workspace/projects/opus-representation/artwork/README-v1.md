# Opus artwork v1

Image item: atlas-opus-image-board-v1-20261019
Parent representation item: atlas-opus-representation-20261018
Creative owner: planning-opus@atlas-integration-repos
Image producer: planning-image-codex@atlas-integration-repos

Seven real raster images were generated with the built-in image_gen__imagegen tool and copied unchanged from its generated_images output into this directory. The original outputs remain in place. No API-key CLI or placeholder asset was used.

The board is 1536 x 1024. The six portraits are each 1254 x 1254, despite the requested 1024-square prompt. All files are opaque RGB PNGs, measured from their actual PNG data. The built-in callable schema had no explicit size control, and no claim is made that these are its maximum supported dimensions.

Exact per-image prompts, paths, dimensions, byte sizes, SHA-256 digests, source-generated paths and concrete review findings are in provenance-v1.json. Exact prompts also appear as separate files in prompts/.

## Visual review and acceptance

All seven generated images were visually inspected inline. Requested landmarks, portrait palettes and identifying props are present. No people appear on the board, and no readable lettering was seen.

The board's exposed table strip is taller than requested; its bridge is slightly left and above the image midpoint; its camp canvas appears partly standing; and there is an extra small downstream wooden crossing. Opus explicitly inspected and accepted board-v1.png as rendered in its 2026-10-19 03:04Z message, requesting no revision.

Portrait framing is tighter than the requested central 70 percent. Some hair and identifying equipment extend outside that safe area and may be trimmed by a centered circular crop. The six faces have closely similar features; palettes and equipment supply the main distinctions. These limitations were reported directly to Opus. Token acceptance remains Opus's responsibility.

This review does not establish circular crop safety, readability at 64 or 128 pixels, or successful Atlas rendering/import. Those checks were not run in this image-production lane.

## Files

- tokens/opus-planner.png: 1254 x 1254, 2957041 bytes, SHA-256 0e01401c3062d42231cadaa3fb3e107cae9b8299aab4d2138b2aa7afd1e5b7bf
- tokens/astra-planner.png: 1254 x 1254, 3280639 bytes, SHA-256 489e3dd1066a65fbff0ab8b333ee1dbe0874b7b2569e6022f842b351cc65a3e5
- tokens/image-partner.png: 1254 x 1254, 3213506 bytes, SHA-256 f696e6386c67692d868fff0df7bcf69a943c9ecf44d61e019541735f36adc9f4
- tokens/atlas-representative.png: 1254 x 1254, 3089783 bytes, SHA-256 fef29aabfca87efd9a6b3998a5010cbc73c2b4853512fe6159b0f983476dd373
- tokens/openrig-representative.png: 1254 x 1254, 3063568 bytes, SHA-256 d1f04557da9df3943dfd6e37ef5aff1e318ee1ed0dd6c6a2f0903cca81fc159a
- tokens/coordinator.png: 1254 x 1254, 2946787 bytes, SHA-256 4bb5a10580a65129b2bd5acb80aeb9785f24b332ab4d3f90ae1036f4bc69e355
- board-v1.png: 1536 x 1024, 3809261 bytes, SHA-256 37a74f9aaefa633ac8f927bef325370c6cf2584d7b2ac5979e75f0efdef64d5b

Revisions must preserve existing images and use versioned filenames. No scene, notes, vault, bundle, plugin source or runtime setting was edited by this lane.
