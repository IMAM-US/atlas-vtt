# Reference Observatory verification

2026-10-18 UTC. Base: PR #14 merged at `365497432578551da121284643542f9314c0d496` following explicit owner authorization on local/native evidence. No remote required checks existed at merge. This second project has its own verification, not inherited acceptance from the studio's historical review.

## Implemented and observed

All native actions used the isolated `atlas-agent-workspace-review` vault. The coordinator applied scene changes through Atlas controls; ordinary note files were authored through Obsidian's CLI. No automatic agent subscription or context dispatch was involved.

| Journey | Observed result |
| --- | --- |
| Create independent project | Created Reference Observatory collection with **No game system**, imported its own image through the native map converter, and created an ordinary scene from it. The collection has UID `c4920059-c08b-4c52-a575-be006f67c7f1`; scene asset `scene-1792294457006-5vv76g`. Neither carries a recording seed. |
| Reuse one resource | Copied the studio's current review card with normal Copy/Paste across collections. New object `text_1792294476224_r22zs3n0z` preserves the exact reference of source `text_1792291563001_v1udjtwcl`. It refers to completed review work and its accepted artifacts, not a newly assigned task. |
| Author local content | Changed that card's local label to **Shared source: integration review**. Added five ordinary text objects defining the question and places, plus two pins to this project's notes. |
| Undo/redo label | Undo restored **Repository-grounded independent review**; redo restored the authored label. Read-only native-store observation confirmed the reference was unchanged. |
| Move and undo/redo | Native drag moved the card from `(348.72790294627396, 385.55285961871755)` to `(390.1374927787407, 431.39919121894854)`. One Undo returned the exact earlier coordinates; Redo restored the moved coordinates. |
| Inspect evidence | The local authored label appears separately from the recorded title. The inspector shows original owner, claim, predecessor, Done status, exact acceptance wording and pinned accepted-artifact links. No external browser was opened to follow those links during this slice. |
| Historical inspection | At repository launch, the later review says **Not recorded at this checkpoint**. Returning to the accepted checkpoint restores its evidence. The local placement and annotations persist. |
| Note navigation and reopen | The central pin opens this project's actual Start here note. Returning to the scene after note navigation and plugin reload preserves exact object equality. The background path and saved background/object digest also match. Undo history resets with the view as expected. |
| Studio isolation | Source studio background/objects remain canonical SHA-256 `3f381b8012000aad76b990874c699149d0b69b0a36ac8298315c48879b5f94e9`, matching the prior milestone. The original source label and placement remain unchanged. |
| Correct command scope | Before the fix, the copied current-review reference made studio artwork eligible. After installing the isolated build, all three studio-only commands report unavailable in the Observatory. The original seeded studio still reports artwork available. No command was invoked against the new scene to demonstrate the failure. |
| Versioned configuration | Native Export collection produced v1: 2 assets, 9 payload files, one scene, its map/cover/thumbnails and 2 directly linked notes. Manifest file hashes all match; the scene retains exactly one recording reference. No source review document or recording JSON is packaged. |
| Operational boundary | Native resource-entry inspection found no OpenRig endpoint requests during the observed scene journey. The implementation adds no OpenRig transport. Bundled operational recordings retain their prior hashes. The canonical campaign vault and OpenRig installation were not changed. |

The second project's saved background/objects digest is `c916399580eee088825a94696da2e4f6c0858a4f2abf9bc18c58a4cc011af654`. Exact exported scene, bundle, notes, artwork and installed-build hashes are in [provenance.json](provenance.json). The [scene screenshot](native-scene.png) and [inspector screenshot](native-inspector.png) show the rendered project. An accidental extra scene from multiline keyboard entry was removed through the native asset manager before the single-scene export.

## Source qualification

The observed studio-artwork command defect received focused failing tests before the fix. The native scene asset's loaded recording seed and exact known edition now scope studio-only commands; references alone remain sufficient to inspect evidence in other scenes. The loaded-index lookup fails closed without reading disk. Current object editions may differ from their original seed after an explicit evidence attachment.

- 21 tests passed across `registerRecordedWorkspace`, `assetService.sceneLookup`, `recordedSceneEditing` and `recordedWorkspaceOverlay`.
- TypeScript and touched-source ESLint passed. `changelog:check` passed.
- `build:ci` passed; only its `main.js`, `styles.css` and `manifest.json` were installed into the isolated review vault. No canonical-vault build hook was run.
- Obsidian reported **No errors captured** after reload and reopen. Existing jsdom canvas/Node and Sass warnings were non-fatal. Full repository CI was left to the remote provider; it was not replayed locally.

Native GPT-6.1 Sol performed scoped harness investigation and the command-scope fix. External Opus 5.5 reviewed through [agent-worker](/Users/farieds/.codex/skills/agent-worker/SKILL.md), native conversation `caed9a3e-8c49-4de7-8adc-fc32d31bb99b`, reported model `claude-opus-5-5`; effort was requested xhigh and not independently verified. These were bounded helpers, not new OpenRig seats. The reviewer found no blocking production defect, but identified masked older guard tests and a missing upgraded-studio case. Both were corrected and the focused tests rerun. Documentation was tightened to distinguish observed artwork eligibility, tested predecessor cases and whole-scene ancestry. The coordinator retained native verification and delivery ownership. Raw worker/provider records remain private.

## Source-derived understanding and untested directions

Source inspection establishes that native collection export/import carries scene metadata, including studio seed ancestry on whole-scene copies. The recording registry and arbitrary external artifact targets are not dependencies automatically collected from a recording reference. General Markdown links are not recursively packaged or rewritten. The actual native export confirms which files traveled here; a second-vault installation and unresolved-reference behavior were not tested.

The experiment establishes independent same-vault project authoring with a pinned shared resource. It does not establish a universal project schema, whole-scene fork semantics, portable evidence resolution, per-project native-session provisioning or live agent navigation. Those remain candidate next scenarios requiring an owner choice.
