# Native scene verification

Coordinator-operated Obsidian 1.14.4 in `/Users/farieds/Project/atlas-agent-workspace-review`, 2026-10-18 UTC. The canonical campaign vault was not used. Builds used `npm run build:ci`; only the isolated review plugin received `main.js`, `styles.css` and `manifest.json`.

## Observed native journey

- Created the integration workspace through its registered command, using the normal Atlas view, asset index and `.atlasmap` lifecycle.
- Moved both seat tokens to `(525,315)` and `(1155,385)`. Native Undo and Redo restored their positions.
- Added and edited the ordinary text annotation: “Integration desk / Placement is authored context. / Owned work changes through OpenRig.” Native Undo and Redo preserved the expected text changes.
- Duplicated the Atlas token. The duplicate had a different scene object ID and the same external reference. Delete, undo and redo affected the local representation only.
- Opened the Atlas repository note through its existing note pin.
- Applied the illustrated studio through the registered command and existing map image worker/asset/background APIs. Undo removed the background; Redo restored it without changing any scene objects.
- Explicitly attached the completed original mapping evidence. Every authored object field and ID was preserved; one missing review-work card was added. One Undo restored exact prior objects; Redo reapplied the attachment.
- Inspected the accepted proposal and exact SHA-256, independent reviewer/coordinator attribution, stable seat identity, native conversation, OpenRig session and occupant generation. Selecting the historical launch checkpoint showed the proposal as not recorded then, with authored objects unchanged.
- Closed the Atlas leaf and reopened. Full background plus objects were equal, comparison digest `32d983d885ee1f6c08d7ccabff6751b2e6cc39a83befa436c4697779d1a692fc`. Saved scene revision and image digests are in context v3.
- Created an ordinary `Tabletop smoke check` scene through the existing map/scene flow. Added an annotation and used native undo/redo. It had no recorded-evidence inspector. Existing tabletop toolbar tools remained available. This is a focused smoke check, not a full tabletop regression suite.

The current scene is illustrated in [studio-native.png](studio-native.png). Scene-local undo history ends when its view closes; saved authored objects persist. Checkpoint selection is temporary view state and resets on reopen.

## Source and transport checks

Before the repository-roster correction, 46 focused tests across nine files passed, plus TypeScript, touched-source ESLint and a production build. The final studio-note text addition passed its three focused tests and another build. Existing jsdom canvas/Node and build Sass/PostCSS warnings were present; these checks are not substitutes for the native observations above. Obsidian `dev:errors` returned “No errors captured” after the installed build reopened.

Focused tests use native store/history/persistence and fail on attempted feature transport. Source inspection found no OpenRig client or execution path. The native resource-entry observation contained no OpenRig endpoint requests. Spatial actions preserve frozen recording bytes and do not call OpenRig; explicit coordinator and seat CLI operations are a separate workflow. This is a scoped source/test/native observation, not packet-level monitoring of every unrelated plugin.

After repository-roster replacement and first-use changes, the same nine focused files passed 49 tests. Helper/command changes also passed TypeScript and touched-source lint. The final repository-qualified journey follows below. This document does not treat the earlier visual verification as evidence that the original representatives had correct repository launch environments.

## Final repository-qualified journey

After the attributed requalification review and coordinator corrections, the explicit **Attach repository team evidence** command changed only four known seat references (two tokens and their two labels), preserved all existing object IDs/authored fields/background, retained predecessor work/artifact references and added two current work cards. Native Undo restored exact prior objects; Redo restored exact attached objects.

The coordinator used native pointer drags to arrange the two new work cards inside the illustrated studio. Undo moved the review card from `(1050,1100.968096809681)` back to `(1050,1620)`; Redo restored exact full scene state. These are coordinator-mediated authored edits, not agent movements or work transitions.

Both compact agent cards displayed the verified native harness/model and repository/actual cwd. Secondary recorded details exposed the new stable node IDs, native conversation, session and independently sourced generation. The Atlas card offered source, project brief and **Open agent instructions**, explicitly saying direct opening is not connected. The current review card displayed owner, predecessor, claim and completed review; accepted artifact links resolved to the two exact files at source revision `28e9fb5f504205e7135a5db4e2f0ced6b768b051`, with separate acceptance-evidence and digest-manifest links. Link targets were inspected locally; external browser navigation was not exercised.

At the repository-launch checkpoint the later review explicitly showed **Not recorded at this checkpoint**. Full background and objects remained equal. After returning to the latest capture, closing the native Atlas leaf and reopening through its registered command, full background plus objects again matched exactly. Canonical sorted JSON digest: `3f381b8012000aad76b990874c699149d0b69b0a36ac8298315c48879b5f94e9`.

Final focused verification: **59 tests in nine files**, TypeScript, touched-source ESLint and `npm run build:ci` passed. The last compact-card/accepted-artifact changes are coordinator-qualified, not attributed retroactively to the representatives' earlier mapping review. `dev:errors` returned **No errors captured**. The native leaf remained `atlas-vtt`; observed resource entries contained no OpenRig endpoint requests. The immutable current recording SHA-256 remained `a3164a25b5a1298864288b40b649e78deca42495e147935ac253c73fb5be57f6`.

The final explicit [context v4](workspace/scene-context-v4.json) captures native scene bytes, image and recording digests, objects, updated linked notes and accepted product direction. [Entry v4](workspace/ENTRY-v4.md) identifies current and historical context. The scene is one project-specific experiment; no universal project configuration or cross-project importer was introduced. Full repository CI is the remote delivery gate. Private raw native/provider records remain outside this repository.

A final read-only Sol review found that the reopen command unnecessarily initialized starter art first. A failing regression reproduced the problem; reopening now resolves existing authored scenes before starter notes/artwork, while first-use creation retains its exclusive duplicate check. Targeted regression, TypeScript/lint and the final build passed. The isolated vault reloaded this final bundle and reopened with exact unchanged background/objects and no captured errors. Starter-image absence is covered by the focused regression, not a destructive native file-removal exercise.
