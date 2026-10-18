# Mapping review: OpenRig representative

Reviewer: openrig.representative, node `01M569MJ4HHP75EEKF6AEWWM98`, address `openrig-representative@atlas-integration`, native Claude conversation `c4128f1e-1dc6-4d6d-a2a7-8790fcc15d17`, occupant generation `cddfa82d-665d-4371-9e55-c72a39b7cd04` (claimant stamp on this review row). Obligation: `qitem-20261018013108-c98ecda5`, claimed 2026-10-18T01:32:42.115Z. Recorded 2026-10-18T01:44Z.

## Verdict

**Accepted** as the mapping: `artifacts/mapping-proposal.md`, 13,059 bytes, SHA-256 **`26cc57dd08586c80bf2e0d9b16da7be19b25b00c04438ee1463ae1dc81aef349`**, against supplied context `workspace/scene-context-v1.json`, 9,576 bytes, SHA-256 **`980750829642bd0dd6ebb818b61d1d03278787074d4e7b5284feddf3c80ac8fe`**. Both were rehashed by this seat at 01:33:31Z.

Corrections C1-C6 below are required. All of them fall in the coordinator's implementation slice or launch configuration. None changes the mapping table, the native-fit analysis or the authority split, so no revision obligation goes back to Atlas. This review closes `no-follow-on`. Coordinator acceptance is still pending and separate.

This verdict covers the OpenRig side: identity, continuity, work lineage, claims, delivery versus acceptance, and edition scope. I did not verify the `.atlasmap` digest `0d65fded...58d2`, the linked-note equality, Atlas source seams other than `types.ts:5` and `recordedSceneBindings.ts:13`, or any native UI behavior.

## Verified against the OpenRig harness

| Review item | Evidence (installed 0.6.10 unless marked) | Result |
| --- | --- | --- |
| 1. `tok_recording_0`, `text_recording_seat_0` to `01M569M8QKR9085ZDEG6CFHVVN` | `rig seat status atlas-representative@atlas-integration`: logical `atlas.representative`, rig `01M569M8QH0BXDNXECRE3KJZMG` | correct |
| 1. `tok_recording_1`, `text_recording_seat_1` to `01M569MJ4HHP75EEKF6AEWWM98` | `rig whoami --full --json` for this seat | correct |
| 1. Seat vs address vs conversation vs session vs generation vs claim generation | Proposal line 38 keeps them distinct. This seat changed generation while keeping its seat, address and native conversation (see C1). | principle correct; recording needs C1, C2 |
| 2. `text_recording_work_0` to author row | `rig queue transitions atlas-integration-mapping-20261018`: created t33, claimed t38 at 01:28:36.640Z, `done/handed_off_to openrig-representative@atlas-integration` t39 with both digests in the note | correct |
| 2. Distinct real successor with lineage | `qitem-20261018013108-c98ecda5`: `handedOffFrom` and `chainOfRecord` = `atlas-integration-mapping-20261018`, created t40, claimed t42 by this seat | correct |
| 2. Placement and historical state do not dispatch | No scene-to-OpenRig write path exists in this milestone. Routing happened only through queue verbs. Topology edges are not access control (foundation `connector-outline.md`, installed `routes/transport.js:70`). | correct |
| 3. `text_recording_artifact_0`, `_1` are logical slots | v1 and the recording carry only `mapping-proposal` / `mapping-review` IDs. `RecordedArtifact` already has `originalSha256` / `publishedSha256`. The t39 note states author completion is not acceptance. | correct |
| 3. Provider/model claims need provenance | See C5 | correction |
| 4. Context envelope and edition | Recording JSON `src/app/agent-workspace/integrationRecording.json` rehashed `89772119e7e6180d830a5712dc7965ecac74b0186b04cb03d4e52cbdcc16ab9f`, matching the proposal. Atlas worktree HEAD `1ed8f2e2` has uncommitted changes. | correct; scope gap C4 |
| 4. Duplicate/delete/undo do not touch OpenRig | Consistent with OpenRig ownership. No Atlas operation reaches the queue or seats in this regime. | correct (Atlas-side behavior not tested by me) |

## Required corrections

All are coordinator-owned. Each states the evidence and what failure would look like if it were skipped.

**C1. Record the reviewer's continuity change in the next checkpoint** (`integrationRecording.json`, item 1 of the slice). The orientation checkpoint's seat entry for `01M569MJ4HHP75EEKF6AEWWM98` (generation `2019ddb7-2adb-4c0c-9809-101dfba658dd`, "Fresh managed conversation; no restart experiment performed") stays true as history. Since then the coordinator restored this seat from explicit snapshot `01M56A2TD7BFT28R1STGFNE066` (snapshot ID is the coordinator's report; I did not inspect the snapshot). `rig seat status` now reports `continuity_outcome: resumed`, `restore_outcome: resumed`, `lastLaunchArguments.generationUuid: cddfa82d-...`, observed 01:30:20. The native conversation is unchanged (`resumeToken` `c4128f1e-...`), and so are the seat and address. Leave `sessionId` absent: the OpenRig session record ID is not surfaced by whoami or seat status, and I did not read it. Failure if skipped: the scene shows a review claimed by a generation the recording calls the occupant at launch, which hides the resume.

**C2. Source `claimGeneration` from the claim stamp, or mark it absent.** In installed 0.6.10 the stamp is `queue_items.claimed_by_generation_uuid`. Claim sets it from the daemon's current occupant generation (`daemon/dist/domain/queue-repository.js:1660-1673`). Closure to done does not clear it. Unclaim (`:1724`) and generation retirement (`releaseClaimsByGeneration`, `:3093`) do. Neither `rig queue show --full --json`, `rig queue transitions`, nor any installed route exposes it. A read-only SQLite query (`mode=ro`) returned:
- `atlas-integration-mapping-20261018`: `1711b9dd-f487-49eb-a8f8-e462fe635f0a`, claimed 01:28:36.639Z
- `qitem-20261018013108-c98ecda5`: `cddfa82d-665d-4371-9e55-c72a39b7cd04`, claimed 01:32:42.115Z

If the coordinator does not re-read these, omit the field ("not established"). Do not write `null`: `recordingTypes.ts` defines `null` as unclaimed. Had this seat claimed before the 01:30 restore, the stamp would have kept `2019ddb7` across the resume (the foundation `evidence.md` observation). So the stamp must be read, not inferred from current occupant.

**C3. Record delivery, discovery and claim of the successor as separate facts, and attribute by transition provenance.**
- The handoff wake failed at 01:31:08.361Z: `lastNudgeResult: failed:Refused: ... at an interactive prompt (selection_prompt) ... No text was sent.` A native approval prompt held this seat's input.
- The stuck sweep opened finding `qitem-recovery-2486e3d88769d288` at 01:32:38.613Z.
- This seat claimed at 01:32:42.115Z after a queue read prompted by the coordinator's notice, not by the wake.

Record the successor as "not delivered; discovered by queue read; claimed". Do not record it as "delivered". Keep the recovery row out of the joint work chain: it is a sweep finding about delivery, not an obligation of the mapping. Its `sourceSession` is the underlying row's source (`atlas-representative@atlas-integration`), and its pane notice arrived headed `From: atlas-representative@atlas-integration · gen 1711b9dd`, yet the daemon's sweep authored it. Attribute actions by transition `actorSession` plus `identityProvenance`, never by `sourceSession` or the pane header:
- t33 creation: `atlas-integration-coordinator`, `claimed:v1` (self-declared; not a managed seat in `rig ps`)
- t35, t37-t39, t42: `transport:v1` (managed seats)
- t34, t36: `watchdog@system`
- t40 successor creation: provenance `null`

Failure if skipped: the scene says Atlas sent the reviewer a recovery task, and that the reviewer received a wake it never got.

**C4. Put OpenRig scope on the recording edition** (`recordingTypes.ts` `WorkspaceRecording` and `integrationRecording.json`, part of item 3). Proposal line 38 identifies the external resource by "kind, stable ID and OpenRig scope". But `RecordingReference` (`types.ts:5`), `recordedSceneBindings.ts:13` and the recording carry no instance or rig, and item 3 of the slice does not add them. Add to the edition, not to each object reference:
- rig ID `01M569M8QH0BXDNXECRE3KJZMG` and name `atlas-integration`
- instance locator: loopback `127.0.0.1:18764`, `OPENRIG_HOME` `~/.openrig-foundation`
- the existing `runtimeVersion`

Object references and scene layout stay unchanged. Failure if skipped: node, work and transition IDs in a published edition cannot be resolved or reconciled against a daemon without outside knowledge, and this instance also hosts the `foundation` rig.

**C5. Make model claims match their evidence** (item 2 of the slice). `seats[].model` says `"claude-opus-5-5 (verified in native provider record)"` and `"gpt-6.1-sol (verified in native provider record)"`. The orientation checkpoint's seat detail says "Model turn verification follows." Both cannot be true of the same edition.

For this seat, I read the native record at `~/.claude/projects/-Users-farieds-Project-atlas-openrig-integration-workspace/c4128f1e-1dc6-4d6d-a2a7-8790fcc15d17.jsonl`: 77 assistant records, all `message.model = claude-opus-5-5`, from 01:22:36Z to 01:41:24Z. That is my own reading of my own seat's file. The coordinator should re-read it before writing "verified". I did not check the Atlas seat. Keep the model as a declaration (`team/rig.yaml`) separate from the native-record observation, with the record's path and time range.

**C6. Launch configuration and operational references.** Observed facts for the coordinator's team-config record:
- **Resolved, verified 01:43:26Z.** At orientation, `rig context work-install --json` selected the foundation project (`projectRoot` `openrig-foundation-workspace`, `project:SPEC.md`, `selectedBy: single`). After the coordinator's additive catalog change it returns `projectId: atlas-integration`, `projectRoot` this workspace, `selectedBy: rig`, pieces `project:workspace/ENTRY.md` and `project:team/CULTURE.md`, no warnings. `project.yaml` SHA-256 is `bb5e69884b1d63ee902bebaf7d4be2f40b5a404febe981cd16d2e9e0b0c74714`. `workspaceRoot` remains the foundation workspace, which holds the catalog. `OPENRIG_WORKSPACE_ROOT` in the seat env is unchanged.
- **Permission posture is a launch record, not the native effect.** `rig seat status` reported `acceptEdits`, `nativeEffect: unverified`, both before and after the session entered auto mode. The coordinator detected the drift by capture, not through OpenRig. Operational references should not present the OpenRig posture field as the effective native mode.
- **Queue role** is still `not-declared` (`rig queue whoami`). Not blocking.

## Not established by this review

- Native compositor, editing, duplicate/delete/undo, annotation and save/close/reopen behavior. The coordinator reports these are observed centrally and will be published separately.
- The `.atlasmap` digest and note equality (Atlas representative's evidence).
- The Atlas seat's model and native conversation.
- OpenRig session record IDs.
- Live event-stream behavior: this milestone uses explicit snapshots. Any later live projection must use the global stream plus reconciliation, because queue events carry NULL `rig_id` (foundation `connector-outline.md`).
