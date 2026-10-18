# Atlas/OpenRig integration mapping proposal

Author: atlas.representative, node `01M569M8QKR9085ZDEG6CFHVVN`, address `atlas-representative@atlas-integration`. Obligation: `atlas-integration-mapping-20261018`, claimed at 2026-10-18T01:28:36.639Z. Status: frozen author proposal for independent OpenRig review; no acceptance claimed.

## Recommendation

Keep this project as one normal editable Atlas scene. Use plain tokens for seat representations, ordinary text for authored context and work/artifact cards, and note pins for orientation. Keep the existing `RecordingReference` as the milestone's evidence reference. No general resource, domain, relationship or dispatch schema is required for this scene. Complete the evidence edition and native editing journey before extending semantics.

## Evidence consumed

Consumed [workspace/ENTRY.md](../workspace/ENTRY.md) and the coordinator's [scene-context-v1.json](../workspace/scene-context-v1.json), captured 2026-10-18T01:28:13.036637+00:00. Snapshot: **9,576 bytes**, SHA-256 **980750829642bd0dd6ebb818b61d1d03278787074d4e7b5284feddf3c80ac8fe**.

I independently read its named saved `.atlasmap`: SHA-256 **0d65fdedd1a5d4cc2cb714df77cbae174583308f59f66456e1a56033ab2758d2**. A read-only Node assertion compared all saved `state.objects` against the snapshot and compared all three linked-note files byte-for-byte with `snapshot.notes`: all matched. There are 2 tokens, 8 texts and 3 pins; all other object collections are empty. Linked-note hashes:

| Note under review vault `Integration workspace/` | Bytes | SHA-256 |
| --- | ---: | --- |
| Start here.md | 1236 | 9f071092fc8c25a3455b00a54ce6032f4e5ed6f03bbe02e560c80c0b912440ef |
| Atlas repository.md | 496 | 3c9bdd3e3cb4fbbe8680d8b1242d568782eb8937ebc0b02225531b50c4fee34b |
| OpenRig repository.md | 405 | d1111e5e1ff6736d027bff942845ded2dd0286b71237ea44bcb236f25d458735 |

Live managed identity confirms my stable node and counterpart address. Installed runtime is OpenRig `0.6.10 (3001cc43)`. Source observations below are from the coordinator's current implementation worktree, whose HEAD is `1ed8f2e295d611c99a0a2f41add398adb2d7c6f0` with uncommitted changes. They are not claims about a released plugin. Native compositor, visual use and interactive save/reopen remain unverified by this author.

## Concrete mapping

All referenced tokens/texts below carry `recordingId=atlas-openrig-integration-m1`, `sourceRevision=integration-milestone-1`; `kind` and `id` resolve into that recording. Geometry, labels and ring colors are authored Atlas state.

| Actual scene object | Meaning and reference |
| --- | --- |
| `Atlas OpenRig integration workspace.atlasmap` | A local view of this integration project. Its Atlas scene asset owns scene identity and location. The file path is a locator; its digest identifies one saved revision. Neither identifies an OpenRig rig or repository by itself. |
| `tok_recording_0`, `text_recording_seat_0` | Two independent representations of Atlas seat `01M569M8QKR9085ZDEG6CFHVVN`; recorded address `atlas-representative@atlas-integration`. |
| `tok_recording_1`, `text_recording_seat_1` | Two independent representations of OpenRig seat `01M569MJ4HHP75EEKF6AEWWM98`; recorded address `openrig-representative@atlas-integration`. |
| `text_recording_work_0` | Reference kind `work`, ID `atlas-integration-mapping-20261018`: the actual author queue row. The joint collaboration also needs its real successor review row after handoff. |
| `text_recording_artifact_0`, `text_recording_artifact_1` | Kind `artifact`, IDs `mapping-proposal` and `mapping-review`: reserved logical slots. A path/title identifies the slot; exact candidate bytes require SHA-256. Neither card establishes delivery or acceptance. |
| `text_integration_context_0`, `pin_integration_atlas` | Authored Atlas repository context and its ordinary note link. The note distinguishes canonical repository from assigned implementation worktree. |
| `text_integration_context_1`, `pin_integration_openrig` | Authored OpenRig repository context and its note link; source/runtime distinction remains explicit. |
| `text_recording_intro`, `pin_integration_entry` | Human orientation and linked `Start here.md`. Its entry/role briefs/notes plus the eventual reviewed mapping supply definitions. Positions imply no containment, ownership transfer or permissions. |

An Atlas representation is identified by its scene asset plus object ID. The external resource is separately identified by kind, stable ID and OpenRig scope; address, native conversation, session and generation are distinct observations. The recording tuple identifies the evidence edition about that resource. Token `imagePath` is artwork, not seat identity; both current tokens intentionally have empty artwork paths and are not separate token assets. Do not derive identity from index `0`/`1`, text, proximity or ring color.

## Native fit and complete object journey

- [types.ts:5](/Users/farieds/Project/atlas-recorded-agent-scene/src/app/types.ts:5) defines the evidence reference; plain token and text already carry it. [buildIntegrationScene.ts:6](/Users/farieds/Project/atlas-recorded-agent-scene/src/app/agent-workspace/buildIntegrationScene.ts:6) adds the actual context texts and note pins to the normal seed. Pins already own `notePath`; no reference field is needed on them for ordinary notes.
- [createRecordedScene.ts:11](/Users/farieds/Project/atlas-recorded-agent-scene/src/app/agent-workspace/createRecordedScene.ts:11) registers a scene through `AssetService.runExclusive`, creates once, and finds an existing recording-marked scene after rename/move. [atlasLeaves.ts:18](/Users/farieds/Project/atlas-recorded-agent-scene/src/app/plugin/atlasLeaves.ts:18) opens it through the existing leaf and scene tabs. Reopening must preserve authors' changes.
- [recordedSceneBindings.ts:13](/Users/farieds/Project/atlas-recorded-agent-scene/src/app/agent-workspace/recordedSceneBindings.ts:13) resolves the full recording tuple and known entity ID. [RecordedWorkspaceOverlay.tsx:8](/Users/farieds/Project/atlas-recorded-agent-scene/src/app/agent-workspace/RecordedWorkspaceOverlay.tsx:8) observes native selection and resolves tokens/texts; duplicate representations are allowed. A mismatched or unavailable edition currently produces no binding, not a live lookup.
- [mapObjectsSlice.ts:35](/Users/farieds/Project/atlas-recorded-agent-scene/src/app/stores/mapObjectsSlice.ts:35) gives copies fresh IDs while retaining object properties, including references. Duplication of a seat token creates another representation of the same seat. Its label is a separate text object; select both to copy/move together. No automatic grouping is implied.
- [mapObjectsSlice.ts:85](/Users/farieds/Project/atlas-recorded-agent-scene/src/app/stores/mapObjectsSlice.ts:85) deletes selected local objects only. Deleting a token leaves its independent label, note and external seat intact. Deleting a pin leaves its linked note intact. Undo restores local objects and their references, not queue events. If all referenced tokens/texts are deleted, the current overlay disappears until a reference is restored. Deleting a scene/asset is a separate native operation and earns no OpenRig effect.
- [storeFactory.ts:1423](/Users/farieds/Project/atlas-recorded-agent-scene/src/app/storeFactory.ts:1423) persists full objects through [MapPersistence.ts:162](/Users/farieds/Project/atlas-recorded-agent-scene/src/app/services/MapPersistence.ts:162); [atlas-view.ts:439](/Users/farieds/Project/atlas-recorded-agent-scene/src/app/atlas-view.ts:439) flushes before tab close. [history.ts:40](/Users/farieds/Project/atlas-recorded-agent-scene/src/app/stores/history.ts:40) tracks objects/grid/background/widget values with explicit gesture transactions. Selection, camera and inspector checkpoint are outside undo. Saved objects survive reopening; closed-tab undo history is discarded. [renamedPaths.ts:73](/Users/farieds/Project/atlas-recorded-agent-scene/src/app/services/renamedPaths.ts:73) follows native note-file moves for pins.

## Small implementation slice and workspace corrections

The coordinator owns these changes. They require no new object kind or operational connector:

1. **Finish this recording's provenance and work chain.** After the real atomic handoff, add the returned successor queue ID, reviewer seat and predecessor link to a new recorded checkpoint in `src/app/agent-workspace/integrationRecording.json`. Record author delivery with this proposal's frozen digest. Later add the reviewer's exact verdict/digest and keep coordinator acceptance separate. Preserve the launch checkpoint as historical pending/unclaimed evidence; its current mismatch with the now-claimed live queue is expected. `recordingTypes.ts` already has predecessor, claim generation, transition and artifact status fields. Do not fill observations that were not collected.
2. **Publish concrete evidence targets.** The recording currently names future branch URLs under `docs/agent-workspace/integration-team/`. Create the actual evidence/review/manifest documents and pin their delivered source revision. The JSON's model-verification strings are coordinator-supplied assertions; this author did not inspect provider records. Link their actual evidence or label them unverified. Do not present placeholder URLs as reviewed evidence.
3. **Complete the explicit context envelope.** Supply a new versioned snapshot, retaining v1, with native scene asset ID, its current path, the `data.recording` marker, source revision and SHA-256 of the exact recording bytes, plus each note's full vault-relative path and digest. V1 already supplies objects, notes, timestamp, supplier and saved scene digest; it lacks the scene asset identity and recording content digest. The recording JSON read for this proposal hashes to `89772119e7e6180d830a5712dc7965ecac74b0186b04cb03d4e52cbdcc16ab9f`. Keep one published immutable edition behind a reference tuple; do not silently change past evidence under `integration-milestone-1`. Choose the committed final edition or manifest digest when integrating and migrate local references deliberately if its key changes, preserving scene/object identity and authored layout.
4. **Qualify the existing native journey.** In the isolated review vault, after the compositor is current: move `tok_recording_0`, edit `text_integration_context_0`, add an annotation, duplicate a seat representation, delete its copy, undo/redo, close and reopen. Observe the resulting objects and unchanged evidence references, inspector checkpoint isolation, and an ordinary tabletop scene. Verify the scene and notes are not reseeded. Save/reopen and undo wording in `Start here.md` describes intended behavior; the present snapshot does not prove interactive acceptance. Record concrete before/after objects and visual evidence, then publish that bounded result.

Verification for this proposal was read-only snapshot/map/note equality and source inspection. No source tests, build or native interaction ran in this seat. The coordinator should reuse targeted recording/editing/creation/overlay checks for changed behavior, add coverage only for new failure risks, and leave full qualification to the repository gate. No direct source or persistence edits are assigned here.

## Authority and undecided semantics

Atlas owns scene authoring, object/asset identity, selection, persistence and local history. OpenRig owns stable seats, runtime observations, queue ownership, claim/handoff and work status. Files contain proposed definitions and attributed evidence; the reviewer owns a hash-bound verdict, and the coordinator owns integration/native proof/final acceptance. Agents consume the supplied snapshot; later scene edits require a new explicit supply. A snapshot is context, not an access grant or command channel.

Deferred decisions: structured domain/route meaning, whether scene boundaries ever imply context scope, generic resources beyond the three recording kinds, edition migration UX, selection of a preferred scene when several assets share a recording marker (the opener currently chooses the oldest), and explicit gestures for future operational action. These do not block this milestone. Visual player filters and topology edges establish no per-agent information access. No movement, duplication, deletion, checkpoint change or undo dispatches work or reverses external execution.

## Review requested

OpenRig representative: verify both stable seat mappings, scope/address versus generation distinctions, real queue lineage and claim semantics, hash-bound delivery versus acceptance, and the proposed immutable evidence edition/context envelope. Accept or request concrete revisions against the exact proposal SHA-256 supplied in `atlas-handoff.md`, citing this same snapshot hash and actual object IDs. Return consequential changes through a revision obligation to the Atlas seat; otherwise close your review successor with no-follow-on and leave coordinator acceptance pending.
