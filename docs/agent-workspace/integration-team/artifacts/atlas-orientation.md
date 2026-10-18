# Atlas representative orientation

Observed: 2026-10-18T01:23:04Z. State: startup orientation complete; no assigned obligation. Await the coordinator's explicit authored snapshot and queue assignment before mapping work.

## Actual managed identity

Source: the existing managed environment's `rig whoami --json`, `rig whoami --full --json`, and `rig ps --nodes --session atlas-representative@atlas-integration --full --json`. No coordinator wrapper or identity override was used.

| Field | Observed value |
| --- | --- |
| Rig | atlas-integration |
| Rig ID | 01M569M8QH0BXDNXECRE3KJZMG |
| Logical seat | atlas.representative |
| Node ID | 01M569M8QKR9085ZDEG6CFHVVN |
| Pod | atlas, Atlas repository |
| Pod ID | 01M569M8QJMFX6MR1R84R6D0MA |
| Address | atlas-representative@atlas-integration |
| Runtime | codex |
| Native session ID | 01a14c9a-2d0d-7cf0-a94f-6a0f5359e0ff |
| OpenRig activity generation | 1711b9dd-f487-49eb-a8f8-e462fe635f0a |
| Generation provenance | resolved |
| Startup | ready; completed 2026-10-18T01:22:21.966Z |
| Counterpart | openrig.representative at openrig-representative@atlas-integration |
| Declared outgoing edge | collaborates_with counterpart |
| Transcript | /Users/farieds/.openrig-foundation/transcripts/atlas-integration/atlas-representative@atlas-integration.log |

The native session ID and OpenRig generation above come from live node records, not the startup persona. The node identity verdict was verified from `pane_process` at 2026-10-18T01:22:44.963Z. No independent provider-model verification was performed.

## Queue discovery

`rig queue whoami --json` resolved this address with pending=0, inProgress=0, blocked=0, currentWork=null, and asSource.total=0. `rig queue list --owned --full --json` returned `[]`. No row was claimed, created, completed or handed off. The described first obligation is conditional on assignment.

## Workspace context actually consumed

Working directory: /Users/farieds/Project/atlas-openrig-integration-workspace. This durable artifact workspace is not a Git checkout (`git status` returned "not a git repository").

| Context file | Bytes | SHA-256 |
| --- | ---: | --- |
| README.md | 772 | 4a5c18c1fc32718538d8229d0766255c25d5570030595d87e4b761ba4386cd4a |
| workspace/ENTRY.md | 655 | cbec0fdd8d1a43b4160462e66de369c759b3c4675d74d153157815f3b567975f |

ENTRY says the coordinator is preparing the native editable scene before assigning the first mapping obligation. It names the review vault `/Users/farieds/Project/atlas-agent-workspace-review` and intended scene `Atlas OpenRig integration workspace`. It supplies no authored scene snapshot or concrete object IDs yet. I have not opened that vault, consumed a scene, inspected native persistence, or verified a saved scene. The entry's bytes are coordination evidence only.

Also read the local role and startup files under `team/agents/integration/`, the supplied shared culture/rules, and the following repository context:

- Atlas canonical `/Users/farieds/Project/atlas-vtt`: `CLAUDE.md` and `docs/agent-workspace/WORKING.md`. Its working document still describes the earlier exploration phase.
- Atlas assigned implementation `/Users/farieds/Project/atlas-recorded-agent-scene`: `CLAUDE.md` (byte-identical to canonical), `docs/agent-workspace/WORKING.md`, `src/app/types.ts`, `src/app/services/MapPersistence.ts`, `src/app/stores/history.ts`, and `src/app/plugin/atlasLeaves.ts`.
- Current implementation under `src/app/agent-workspace/`: `recordedSceneBindings.ts`, `createRecordedScene.ts`, `buildRecordedScene.ts`, `RecordedWorkspaceOverlay.tsx`, `registerRecordedWorkspace.ts`, and `workspaceRecordings.ts`.
- OpenRig `/Users/farieds/Project/openrig`: `AGENTS.md`, `CLAUDE.md`, and `docs/reference/foundation/WORKING.md`. Its completed foundation scope is separate from the current integration.

Implementation HEAD is `1ed8f2e295d611c99a0a2f41add398adb2d7c6f0`, with coordinator-owned modified/untracked implementation files. Those working bytes, not HEAD alone, contain the current recorded-scene work. I made no source edits and ran no source tests. OpenRig source HEAD is `63db591720e7881ab1b2205d4295bc6ba516295f`. Installed `rig --version` independently returned `0.6.10 (3001cc43)`; source findings are not installed runtime observations.

Initial source orientation confirms separate object IDs and `RecordingReference`, normal scene persistence through `createAtlasStorage`, history transactions for the tracked spatial slices, and opening through the existing Atlas leaf. These are source observations only. A workspace-specific mapping and lifecycle proposal await the supplied snapshot and assigned row.

## Ownership and next action

Own only `artifacts/atlas-orientation.md`, `artifacts/mapping-proposal.md`, `artifacts/atlas-handoff.md`, and requested revisions. The external coordinator owns source integration, native scene operations and Git delivery. The counterpart reviews identity, continuity and work semantics. Do not edit the counterpart's files or native persistence.

Installed help discovered with `rig context list --json`; loaded `skills/queue-handoff` and `rig ps --help`. The local OpenRig skills index supplied the discovery path. No extra team, polling loop, browser session or work obligation was created.

Next action on nudge: rediscover owned queue work, claim an assigned row, read and hash the explicitly supplied authored context, then produce the bounded mapping proposal and atomically hand its frozen hash and context evidence to the counterpart. Proposal completion and reviewer acceptance must remain separate.

## Assignment discovered after orientation

On the parked-owner-consumer wake, live identity still resolves to this managed seat. The queue now contains `atlas-integration-mapping-20261018`, created at 2026-10-18T01:23:31.925Z by `atlas-integration-coordinator`. Its body requires waiting for ENTRY to publish `workspace/scene-context-v1.json` before claiming or mapping. At this check ENTRY still has the preparing status and the snapshot is absent from the workspace inventory. The row was therefore parked on `external:coordinator-published-scene-context-v1`, with its concrete continuation and one 15-minute timer backstop. No scene mapping, source change or native operation was performed. Resume on coordinator publication/nudge or that wake.

## Published-context consumption and author stage

Coordinator nudge announced publication at 2026-10-18T01:28:13.036637+00:00. I rediscovered the managed identity and owned row, independently verified `workspace/scene-context-v1.json` (9,576 bytes, SHA-256 `980750829642bd0dd6ebb818b61d1d03278787074d4e7b5284feddf3c80ac8fe`), resolved the publication blocker and claimed the row at 2026-10-18T01:28:36.639Z. I read its named saved map and linked notes, and verified map hash, full object equality and byte-for-byte note equality with that snapshot. This is saved-state/context evidence only; no native visual use was claimed. The frozen proposal and exact review request are in my owned mapping-proposal and atlas-handoff artifacts.

## Managed project discovery verification

At 2026-10-18T01:42:08Z, `rig whoami --json` again resolved this actual seat. `rig context work-install --json`, run without a project override in the managed environment, returned:

| Field | Actual value |
| --- | --- |
| position.workspaceRoot | /Users/farieds/Project/openrig-foundation-workspace |
| position.projectId | atlas-integration |
| position.projectRoot | /Users/farieds/Project/atlas-openrig-integration-workspace |
| position.selectedBy | rig |
| position.frontier | project |
| Entry address | project:workspace/ENTRY.md |
| Entry path | /Users/farieds/Project/atlas-openrig-integration-workspace/workspace/ENTRY.md |
| Entry exists/source | true / manifest |
| Culture path | /Users/farieds/Project/atlas-openrig-integration-workspace/team/CULTURE.md |
| Culture exists/source | true / manifest |
| Warnings | [] |

The command also returned the default `openrig-default` system world and no selected mission or slice. The existing workspace root and the selected project's separate working area are distinct fields.

The coordinator reported central native verification of scene movement, annotations, duplicate/delete undo and save/close/reopen. This is attributed coordinator reporting; this seat performed no native interaction. The reviewer row remains in-progress and its verdict remains with the counterpart. Escalation `qitem-20261018013738-eb69fd2e` remains held on that live review row for reconciliation when its blocker closes. No duplicate review was started.

## Explicit authored context v2 consumed

At 2026-10-18T01:44:03Z, on the coordinator's explicit update, I read ENTRY's update and `workspace/scene-context-v2.json`: 11,511 bytes, SHA-256 `4a829750bbbf0b43e353adc9f25e45cf86c109cfec4d915b5d16581f0a8db88a`. Supplier: External Codex coordinator; captured 2026-10-18T01:43:58.389201+00:00. Mediation: native Atlas tools operated by the coordinator, followed by explicit file supply to agents; no automatic subscription.

Consumed native scene asset identity: `scene-1792286764203-ykkw4w`. Vault: `/Users/farieds/Project/atlas-agent-workspace-review`. Vault-relative scene path: `atlas-vtt/collections/Default/scenes/Atlas OpenRig integration workspace.atlasmap`. V2 records saved scene digest `f914f0dc8670602d0511c4e10544677a0ac89a4c159a46f62762a14deb2e9ae6` and seed recording marker `atlas-openrig-integration-m1` / `integration-milestone-1`.

Authored positions and annotation actually consumed from v2:

| Object | Supplied authored state |
| --- | --- |
| tok_recording_0 | Moved from v1 (350, 280) to (525, 315); retains Atlas seat reference `01M569M8QKR9085ZDEG6CFHVVN` |
| tok_recording_1 | Moved from v1 (1050, 280) to (1155, 385); retains OpenRig seat reference `01M569MJ4HHP75EEKF6AEWWM98` |
| text_1792287071598_1zr4pfdh3 | New ordinary annotation at (665.0793650793648, 604.7619047619046): "Integration desk\nPlacement is authored context.\nOwned work changes through OpenRig." |

The independent seat labels, context/work/artifact texts and three note pins remain present. The annotation has no external resource reference. Both tokens' full recording references are unchanged from v1, verified by read-only comparison. Full note paths and their embedded content digests were read and verified from the snapshot.

Consumed recording edition: `atlas-openrig-integration-m1`, source revision `integration-milestone-1`, immutable orientation edition. I read `/Users/farieds/Project/atlas-recorded-agent-scene/src/app/agent-workspace/integrationOrientationRecording.json`, verified SHA-256 `89772119e7e6180d830a5712dc7965ecac74b0186b04cb03d4e52cbdcc16ab9f`, and checked its ID/revision against v2. Its checkpoint is `orientation`; completed-work evidence is to be a distinct edition. V2 supplies the original author and actual review obligation IDs without changing the historical recording's meaning.

The snapshot attributes token moves, annotation edits/undo/redo, duplicate/delete undo/redo, note opening and exact save/close/reopen preservation to the coordinator's native observation. This seat consumed that evidence and authored state through files; it did not independently operate or visually verify Atlas. Read-only checks also confirmed v1 and the frozen proposal retain their earlier hashes. No proposal/source/native edits or new obligation were created. Wait for the counterpart's verdict and the existing escalation's blocker transition.

## Illustrated integration studio fit assessment

Coordinator request, 2026-10-18 01:51Z: assess an illustrated studio with an Atlas cartography bench, OpenRig systems bench, shared review table and evidence library. This fits the existing mapping as authored visual places in the same scene. It requires no new schema. The proposed image has not been supplied or inspected by this seat; application remains coordinator-mediated.

| Identity | Fit in the existing model |
| --- | --- |
| Background image asset | Artwork providing visual landmarks. Its asset identity/path and exact image revision identify the visual resource; they do not identify the scene, seats or work. Reusing/copying the image creates no operational entity. |
| Place | A human-authored meaning such as "Atlas cartography bench". Put its name, responsibility and orientation link in native editable text/pins and ordinary notes. The painted bench is a visual cue, not a machine-defined region or authority boundary. |
| Seat representation | Existing plain tokens keep their own scene-local IDs and stable external seat references. Moving a token beside a bench communicates authored context only. It does not change the seat, owner, session, generation or permissions. |
| Work and evidence | Existing cards retain actual queue IDs or artifact slots and hash-bound evidence. A card near the review table does not become assigned, reviewed or accepted; the evidence library's imagery establishes no acceptance status. |

The four visual places can help orientation: Atlas bench for scene/editing responsibilities, OpenRig bench for seats/work continuity, shared table for the attributed handoff/review, and library for source and evidence links. Native labels and linked notes should carry these definitions so they remain readable, editable and present in explicit context exports; scene position alone is insufficient to tell an agent what a place means.

Concrete risks: detailed art can obscure tokens, small labels and pins, so preserve clear working surfaces, contrast and room for editable content. Words or status badges baked into the image become stale and cannot be selected or edited through Atlas; keep operational names, instructions and status in native objects. A background crop, scale change or replacement can misalign visual places with existing objects; the coordinator should verify composition and retained object/reference positions after native application and publish a new explicit snapshot with the background asset/revision and authored definitions. Treat a new layout as supplied context only after that snapshot is published. Duplicate/undo operations remain local Atlas edits; the accepted mapping is unchanged.
