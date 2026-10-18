# Repository mapping review

Reviewer: `openrig.representative`, node `01M56CGNJD6YPXS5STC2QHWVVB`, `openrig-representative@atlas-integration-repos`, session `01M56CGNKM2Z4XY4CMP3ETZY62`, claim generation `af902801-91e8-42cb-a802-0464a4d76099`. Owned row `qitem-20261018022035-997c3976`, claimed 2026-10-18T02:23:02.509Z (transition 60). Written 2026-10-18T02:40Z. Orientation: `artifacts/openrig-repository-orientation.md`.

## Verdict

**Accepted by the OpenRig review, with coordinator corrections. No Atlas revision obligation.**

Bound to:
- Author assessment `artifacts/repository-mapping-requalification.md`: `da819b230fdf9d1e9f3716b701e6805f0aadfeb337cbec623e47771219c5382e` (re-hashed, matches the row).
- Original proposal `artifacts/mapping-proposal.md`: `26cc57dd08586c80bf2e0d9b16da7be19b25b00c04438ee1463ae1dc81aef349`, unchanged.
- Context `workspace/scene-context-v3.json`: `5a51fc299281c7fb77e577e590c9b0d9806d5fd624c790839319a2c276d51f99`.

The assessment is accurate about the mapping, the identity replacement and the authority boundaries. Nothing in it needs rewriting. C1 sharpens its correction 2. C2 is a gap in its command-boundary row, and the fix is coordinator-owned source. The coordinator must resolve C1 and C2 before native roster attachment, and C3 and C4 before the final edition is published. C5 was resolved during this review, and I verified the fix. This verdict is neither coordinator acceptance nor native replacement acceptance. The original predecessor verdict in `mapping-review.md` stands unchanged as historical evidence.

## Identity and lineage, independently verified (observed)

| Claim | Result |
| --- | --- |
| Current vs historical seats | Current `01M56CGCH9NACF766XDX1TF92N` (Atlas) and `01M56CGNJD6YPXS5STC2QHWVVB` (OpenRig) are in rig `01M56CGCH5VW2XDPN1P1KBNANR`, both running, `previousOccupant` null. Historical `01M569M8QKR9085ZDEG6CFHVVN` and `01M569MJ4HHP75EEKF6AEWWM98` are in rig `01M569M8QH0BXDNXECRE3KJZMG`, `exited`, `recoverable`. They are replacements, not continuations. |
| Session records | Atlas `01M56CGCJNTQ3VX336VQM1ZHWV`, OpenRig `01M56CGNKM2Z4XY4CMP3ETZY62`. Read-only `sessions` rows match the pending recording. |
| Native conversations | Atlas codex `01a14cc8-3c67-7e71-9328-47ff75568a7c`, OpenRig claude `c252b956-929e-477f-bb09-636c5fe3d758`. Both match. |
| Claim generations | Atlas claimed the requalification row with `0f8f3068-...6a834` and minted my row with it. I claimed with `af902801-...76099`. Both match. |
| Chain | Created by `atlas-integration-coordinator` (55, `claimed:v1`). Claimed by Atlas (56, `transport:v1`). Handed off atomically with the frozen digest in the note (57/58). Claimed by me (60, `transport:v1`). |

## Source slice (source-derived)

Re-hashed in `/Users/farieds/Project/atlas-recorded-agent-scene` (HEAD `27a4e72e`, coordinator-owned uncommitted work). Eight of the nine listed files match the assessment. The exception is `repositoryTeamRecording.json`, which is now `99173c79a0d14f2932ae5ea6d411aeef2d2feabe500ffbabca787c28f3a36766` (assessed: `7e376463...4106`). The historical `integrationRecording.json` still equals v3's recording digest, `fc56fcd1...3dae`.

I agree with the assessment on these points:
- **Replacement** (`attachIntegrationEvidence.ts:50-92`) rewrites a reference only when it is a `seat` reference, its tuple is in an enumerated `from` edition, its ID is in the explicit map and the target exists in `to.seats`. It leaves work, artifact, foreign and unknown-edition references and all authored properties untouched. The whole change is one `runHistoryTransaction`. A rerun is a no-op because migrated tuples are no longer in `from`.
- **Duplicate and delete** keep each placement independent. A duplicate carries the same reference, so it represents the same seat again and creates no new resource. Deleting a placement removes nothing external.
- **Reopen** (`createRecordedScene.ts:15-24`) matches by recording ID. Both historical editions share `atlas-openrig-integration-m1` (revisions `integration-milestone-1` and `27a4e72e...`), so `[integrationRecording.id]` covers both. The oldest scene wins. A missing file throws instead of reseeding.
- **Authority**: bundled editions are deep-frozen at import. No command launches seats, writes queue state or changes permissions. Placement and pins carry no authority.

## Corrections

**C1. The pending edition is mutable under a single tuple. Coordinator, consequential for final data.**
`atlas-openrig-repository-team-m1` @ `repository-harness-requalification-pending` has already changed bytes since the author froze it. Both `attach-repository-team-evidence` and first-use `open-integration-workspace` (`registerRecordedWorkspace.ts:40,89`) persist references to that tuple today. Bindings require an exact tuple (`recordedSceneBindings.ts:16`), and neither helper's `from` contains the pending tuple. That leaves two outcomes for any scene that is seeded or attached before the freeze:
- If the revision string stays the same, its references silently resolve to different facts.
- If the revision changes, its references dangle and no command can migrate them.

Required:
1. Set the final immutable `sourceRevision` before any native attach or first-use seed, and never change the bytes under it afterwards.
2. If any vault already holds pending references, migrate them once by explicitly adding the pending tuple to `from`.

Proposed guard (owner `registerRecordedWorkspace.ts`): disable both commands while the target edition is pending or its `evidenceUrl` is empty.

**C2. The legacy command is available on a fresh new-roster scene. Coordinator, bounded source defect.**
`activeIntegrationScene` (`registerRecordedWorkspace.ts:17-27`) accepts a reference to any of the three editions. A first-use scene seeded only from `repositoryTeamRecording` therefore enables **Attach completed integration evidence** (`:69-82`). Running it adds the predecessor cards `atlas-integration-mapping-20261018` and `qitem-20261018013108-c98ecda5` at (350,490) and (1050,490), exactly on top of that scene's seeded `text_recording_work_0/1` (`buildRecordedScene.ts:32`). The references stay correctly historical and undo reverts the change, but it mixes predecessor work into a current-roster scene and hides the current cards. `registerRecordedWorkspace.test.ts:59` covers only orientation-edition scenes.

Fix: scope each command's availability to its own `from` editions, and add one test with a scene that holds only repository-team references.

**C3. Generation semantics in the pending recording. Coordinator, data labelling.**
The `SeatObservation.generation` values come from queue claim and mint stamps. 0.6.10 `sessions` rows have no generation field. `docs/reference/foundation/WORKING.md:61-62` records that a resumed writer keeps an old claim stamp under a new generation. A claim stamp therefore identifies the occupant at that transition, not the seat's current generation. State that source in the observation detail, or keep the value only on `WorkObservation.claimGeneration`.

Separately, checkpoint `repository-launch` (02:17:08Z) gives the next action "then claim requalification", although the same checkpoint records that claim as transition 56 at 02:16:00Z.

**C4. Provenance of rows the seats did not author. Coordinator, for the final edition.**
- `qitem-recovery-4916a334a60f2a5a` is a daemon stuck-sweep finding, yet 0.6.10 stores it with source `atlas-representative@...` and Atlas's minting generation `0f8f3068`. It must not be recorded as Atlas-authored work.
- The coordinator's creation of the requalification row is `claimed:v1`, which is self-asserted. Present it as such, not as transport-verified.

These are observations of installed behavior. No OpenRig source change is proposed here.

**C5. Reusable team configuration. Resolved during review.**
- Found: line 7 of both role briefs named the historical unprefixed artifacts as owned, contradicting the assigned `repository-*` paths. Separately, `project.yaml` listed the historical `team/CULTURE.md`.
- The coordinator reported correcting both independently at 02:38Z, and I verified the current bytes:
  - `team-repository/.../guidance/openrig.md` is `779add855656a21196909897e61f5829a22d9a4de502d4bbce0c2cf0e55e0a06`.
  - `atlas.md` is `88806fa66b104fcf6bfe9c25c9f26f89139c226b9971ad1926b11a4c4cfe7a12`.
  - Both now name the `repository-*` artifacts and mark the originals as frozen predecessor evidence.
  - `project.yaml` (`f942f007...1d33`) now lists `team-repository/CULTURE.md`.
  - The Atlas worktree's `docs/agent-workspace/team/` briefs have identical hashes.
- This was a startup-brief correction only. The original artifacts are untouched.

The author's presentation note also stands: the first new work card lands at y=1620 below the 1400-high image.

## Not established by this review

- I did not rerun the coordinator-reported tests (46 focused, 11 helper, and 14 after the first-use fix, plus typecheck and lint). They remain attributed reports.
- No native Atlas operation, compositor check, replacement, undo/redo or save-reopen was performed or observed.
- My only daemon reads were read-only `sessions` and `queue_items` rows for the two current nodes and the three assigned rows.
