# OpenRig representative orientation

Author: openrig.representative (this seat), recorded 2026-10-18T01:28Z.
Status (01:47Z): review obligation closed `done/no-follow-on`; v2 context consumed; no owned obligation. Waiting for coordinator direction. Sections below are appended in time order; earlier observations are preserved as recorded.

## Live identity (installed 0.6.10 runtime observations)

Read from `rig whoami --full --json`, `rig seat status --json`, `rig ps --nodes --rig atlas-integration --json` and the managed seat's environment.

| Field | Value | Source |
| --- | --- | --- |
| Rig | `atlas-integration`, ID `01M569M8QH0BXDNXECRE3KJZMG` | whoami |
| Pod | `openrig` (OpenRig repository), ID `01M569M8QJYFKMRMDGN41MJZHH` | whoami |
| Seat | `openrig.representative`, node `01M569MJ4HHP75EEKF6AEWWM98` | whoami, `OPENRIG_NODE_ID` |
| Address | `openrig-representative@atlas-integration` (tmux) | whoami |
| Spec | `integration-representative` 1.0, profile `openrig`, agent_ref `local:agents/integration` | whoami |
| Runtime | `claude-code` | whoami, ps |
| Native conversation | Claude `c4128f1e-1dc6-4d6d-a2a7-8790fcc15d17` | whoami `runtimeContext.resumeToken`; matches this harness's session directory |
| OpenRig occupant generation | `2019ddb7-2adb-4c0c-9809-101dfba658dd` | `OPENRIG_OCCUPANT_GENERATION`; seat status `lastLaunchArguments.generationUuid` |
| OpenRig session record ID | not surfaced by whoami or seat status | not read from the database |
| Occupant | active, `previous_occupant: null`, `restore_outcome: n-a` (first occupant) | seat status |
| Permission posture | `acceptEdits`, source `system_default`, native effect `unverified` | seat status |
| Model | declared `claude-opus-5-5` in `team/rig.yaml` and ps | declaration only; not native-record evidence |
| Instance | `OPENRIG_URL=http://127.0.0.1:18764`, `OPENRIG_HOME=~/.openrig-foundation`, CLI `0.6.10 (3001cc43)` via managed seat-bin | env, `rig --version` |

Counterpart: `atlas.representative` at `atlas-representative@atlas-integration`, runtime `codex`, declared model `gpt-6.1-sol`, running/ready at read time.

Edges: whoami shows one incoming `collaborates_with` from `atlas.representative`, matching the rig-level edge in `team/rig.yaml`. This cross-pod rig-level edge is projected; the foundation's empty-`whoami.edges` observation concerned an intra-pod edge, which this rig does not declare. An edge is a descriptive relationship, not authorization.

## Queue discovery

- `rig queue whoami --json`: as destination 0 pending / 0 in-progress / 0 blocked; as source 0; `currentWork: null`; role `not-declared`.
- `rig queue list --owned --full --json`: `[]`.
- Read-only rig-wide view (`rig queue list -a -A --json`, filtered to this rig): one row, `atlas-integration-mapping-20261018`, source `atlas-integration-coordinator`, destination `atlas-representative@atlas-integration`, state `blocked`, unclaimed, tag `mission:atlas-integration`. At 01:29Z `rig queue show` reported it `in-progress`, claimed 01:28:36Z. It is the counterpart's obligation; I have not read its queue body or acted on it.
- `ps` shows the counterpart with `assignedWorkCount: 1`; this seat 0.

No obligation is mine yet. I will not create one; I rediscover when nudged.

## Workspace context actually read

SHA-256 at read time:

| File | SHA-256 |
| --- | --- |
| `README.md` | `4a5c18c1fc32718538d8229d0766255c25d5570030595d87e4b761ba4386cd4a` |
| `workspace/ENTRY.md`, published revision (1,832 bytes, re-read 01:29Z) | `d5225cfe2fc1bf527a9bd7664ac5c5e66b1f37a92a1dda0d3dab9ce00a363221` |
| `workspace/first-obligation.md` (counterpart's author brief) | `49b85bf0c6269aa702b746a0bd8d433b50a8bb42d7b3a5996656d8d390f5ce85` |
| `team/rig.yaml` | `08ce1694d7dc6a1d3d55dfceb3e02b6196d01032ac1894b7f9e7fee0f952409a` |
| `team/CULTURE.md` | `45ac1890f6ddcb0a7262445cb03229ffa7e4961f5f95b54362cd58a341dbea14` |
| `team/agents/integration/agent.yaml` | `ba6fcb2751448e9e15405a9f8fe441f2ea59704f5b2e9543f8d49e857bed3dcf` |
| `team/agents/integration/guidance/openrig.md` | `6b1cda6c317f3f2ee739e9b3be910b8ab29f3cef0ec9a7cafecacb5230ecade8` |
| `team/agents/integration/guidance/atlas.md` | `97912e84688816f8cd7faad901f58445e0fe54e58853fa705235c0531f088e48` |
| `team/agents/integration/startup/context.md` | `c4280bd49f0866cc5a0e6869262895d135b36d5b7c1d6098ba4da283e4616160` |
| `CLAUDE.md` (byte-identical to `AGENTS.md`) | `c14cc9feb92008d73cc4c713010541b5bf619f026493718c9336b29c07d076b8` |

Correction to my first draft: my initial Read of `ENTRY.md` returned the earlier "preparing the native editable scene" revision, which I did not hash. The `d5225cfe...` hash above was computed at 01:28:14Z, one second after the coordinator's 01:28:13Z publication, and belongs to the published revision I re-read afterwards.

## Authored scene snapshot consumed

`workspace/scene-context-v1.json`, 9,576 bytes, SHA-256 `980750829642bd0dd6ebb818b61d1d03278787074d4e7b5284feddf3c80ac8fe`, read in full at 01:29Z. The hash matches both `ENTRY.md` and the coordinator notice. That notice reached this pane with transport sender `<unknown sender>`; I attribute it to the coordinator only because its claims match `ENTRY.md` and the file bytes.

Snapshot claims as supplied: `capturedAt` 2026-10-18T01:28:13.036637+00:00, supplied by the external Codex coordinator, read-only file snapshot without subscription, scene `.../Atlas OpenRig integration workspace.atlasmap` at scene SHA-256 `0d65fdedd1a5d4cc2cb714df77cbae174583308f59f66456e1a56033ab2758d2`, native visual verification **pending**. I did not read the `.atlasmap` or the review vault, so the scene hash and the claim that the map is active in Atlas are the coordinator's, not verified by me.

External references checked against live OpenRig:

| Scene object | Reference in snapshot | Live result |
| --- | --- | --- |
| `tok_recording_0`, `text_recording_seat_0` | seat `01M569M8QKR9085ZDEG6CFHVVN` | node of `atlas.representative`, rig `01M569M8QH0BXDNXECRE3KJZMG`, running (seat status) |
| `tok_recording_1`, `text_recording_seat_1` | seat `01M569MJ4HHP75EEKF6AEWWM98` | this seat's node (whoami) |
| `text_recording_work_0` | work `atlas-integration-mapping-20261018` | qitem exists; `in-progress` for the counterpart since 01:28:36Z |
| `text_recording_artifact_0` / `_1` | artifact `mapping-proposal` / `mapping-review` | slugs only, no path, revision or hash; matches ENTRY's "not established yet" |

Other objects consumed: context cards `text_recording_intro`, `text_integration_context_0`/`_1`; pins `pin_integration_entry`, `pin_integration_atlas`, `pin_integration_openrig` and their three embedded notes (`Start here.md`, `Atlas repository.md`, `OpenRig repository.md`); `authority` block; `jointObligation`. `fog`, `drawings`, `walls`, `lights` are empty.

Noted for review, not acted on: every `recordingReference` carries `recordingId`/`sourceRevision` labels but no instance or rig identity, so a seat reference is unambiguous only within this instance; references name the stable node, not a native conversation, OpenRig session or generation, which is the right default for a seat token but means the scene cannot by itself say which occupant did the work; intro text says "historical evidence" while the seat references are to live seats.

## OpenRig repository context (source, commit `63db5917`, newer than installed 0.6.10)

| File | SHA-256 |
| --- | --- |
| `AGENTS.md` | `8e85c75d826eefd76397dffbf1b9f478ed71aab3203c6f4d46c104c0be7bfb61` |
| `docs/reference/foundation/WORKING.md` | `dcbe8dc3cb107028a28a225b23a04939d3ed7e3030db95d54e2412bf2d1c35f6` |
| `docs/reference/foundation/operations.md` | `eb54a5e6b522fbfdb23d0d98ed38567eb77789b33228ba71ac3a16618d0f91f7` |
| `docs/reference/foundation/evidence.md` | `2831b9d28d1afa63b3b3641345b9232333866b33673bf18609d3ec088af4ea03` |
| `docs/reference/foundation/connector-outline.md` | `0e0b3e4d39b864087a5c30387e7442bced1cb8b92cc55ed25feefd17dbfefd4a` |

Carried forward as review criteria for any mapping: seat, native conversation, OpenRig session and occupant generation are distinct identities; assignment, claim, claimant generation and current generation are shown separately (native resume kept an old claim stamp, fresh replacement released it); work projection needs global event replay plus reconciliation (rig-filtered SSE dropped NULL-`rig_id` queue events); queue handoff closure is not acceptance; spatial position or relationship grants nothing.

Installed help read: `rig queue list --help`, `rig context list`, `rig context work-install --json`, and `$OPENRIG_HOME/reference/project-workspace.md` "Work-install project selection".

## Startup configuration observations (for the later review)

1. **Work-install resolves to the foundation project.** `rig context work-install --json` reports `workspaceRoot`/`projectRoot` `/Users/farieds/Project/openrig-foundation-workspace`, project `default`, piece `project:SPEC.md`, `selectedBy: single`. The seat env carries `OPENRIG_WORKSPACE_ROOT=/Users/farieds/Project/openrig-foundation-workspace`; whoami `workspace: null`. A seat following the installed onboarding (`work-install`) would load the completed foundation's project context, not this integration workspace. Candidate correction, coordinator-owned: declare this workspace as a project in the instance's workspace catalog with `rigs: [atlas-integration]` (selection step 3), leaving the foundation project intact; or state in `startup/context.md` that `work-install` is not this team's context source. I did not read the foundation `SPEC.md`.
2. **Role is undeclared to the queue** (`role.state: not-declared`, `files: []`). Not blocking; noted so nobody reads it as a missing startup delivery.
3. **Activity reading at sample time** showed this seat `needs_input / selection_prompt` while it was executing a turn. Treat activity as a sampled heuristic, consistent with the foundation's stale-telemetry note.
4. The obligation's source `atlas-integration-coordinator` is not a managed seat in `ps`; source attribution on rows is a label set by the creator, not verified seat identity.

No files outside `artifacts/openrig-orientation.md` were changed.

## Continuity update, 01:32Z

The coordinator reported restoring this seat's native conversation from explicit snapshot `01M56A2TD7BFT28R1STGFNE066` after the terminal entered auto mode. That notice also arrived as `<unknown sender>`, and I did not inspect the snapshot. Re-read live:
- `rig seat status`: `continuity_outcome: resumed`, `restore_outcome: resumed`, permission `acceptEdits` observed 01:30:20, `nativeEffect: unverified`.
- Occupant generation is now **`cddfa82d-665d-4371-9e55-c72a39b7cd04`** (env and `lastLaunchArguments`), replacing `2019ddb7-...` recorded above.
- Native conversation is unchanged (`resumeToken` `c4128f1e-1dc6-4d6d-a2a7-8790fcc15d17`), as are node and address.

## Review obligation, 01:32Z-01:45Z

- `qitem-20261018013108-c98ecda5` (from `atlas-integration-mapping-20261018`). Its wake failed at 01:31:08Z because a native prompt held input. I claimed it at 01:32:42.115Z; claim stamp `cddfa82d-...`, read from SQLite read-only. Closed `done/no-follow-on` at 01:45:45.847Z, `transport:v1`.
- Verdict: accepted proposal `26cc57dd08586c80bf2e0d9b16da7be19b25b00c04438ee1463ae1dc81aef349` against v1 `980750...8fe`, with coordinator-owned corrections C1-C6.
- `artifacts/mapping-review.md` SHA-256 `2ef05cdc3a6a04f28ec58c4afba8a37374af61e2ab327369e6b1cb4d22880abc`; `artifacts/openrig-handoff.md` SHA-256 `402ce5c9c8a539c3d4bb8d7c566bdbdef77020ec940d21ee885e9d272be01f22`.
- Work-install verified at 01:43:26Z: `selectedBy: rig`, project `atlas-integration`, this workspace. `project.yaml` SHA-256 `bb5e6988...4714`.

Post-closure observation, adding to review C3. `qitem-recovery-2486e3d88769d288` was closed by the stuck sweep at 01:42:38.615Z (t52, `stuck-sweep resolved: ... no longer detected`, `done/no-follow-on`). That daemon action is recorded with `actorSession: atlas-representative@atlas-integration` and `identityProvenance: null`, as is its creation (t41). Between them, the watchdog's wake to this seat was refused at 01:36:14Z (t44). So `actorSession` alone can name a seat for an action the seat never took. Only `transport:v1` establishes that a managed seat acted. The handoff's "still pending at 01:33Z" was true when written.

## Explicit context v2 consumed, 01:46Z

`workspace/scene-context-v2.json`, 11,511 bytes, SHA-256 **`4a829750bbbf0b43e353adc9f25e45cf86c109cfec4d915b5d16581f0a8db88a`**. It matches the coordinator's notice and `workspace/ENTRY.md`, whose current revision has SHA-256 `5f1ff11b2e5f56d21ebf056614511734e8b5c67c69b3b188583e843618c9d110`. Schema `atlas.explicit-context/v1`, `capturedAt` 2026-10-18T01:43:58.389201+00:00. v1 is unchanged (`980750...8fe`). Consumed after review closure; the verdict rests on v1 only.

- **Scene asset**: `scene-1792286764203-ykkw4w`, vault-relative path `atlas-vtt/collections/Default/scenes/Atlas OpenRig integration workspace.atlasmap`, seed marker `atlas-openrig-integration-m1` / `integration-milestone-1`. Scene SHA-256 `f914f0dc8670602d0511c4e10544677a0ac89a4c159a46f62762a14deb2e9ae6`, a new saved revision after v1's `0d65fded...58d2`. Coordinator-supplied; I did not read the `.atlasmap`.
- **Recording edition**: `atlas-openrig-integration-m1` / `integration-milestone-1`, SHA-256 `89772119e7e6180d830a5712dc7965ecac74b0186b04cb03d4e52cbdcc16ab9f`, "Immutable orientation edition". Its `sourcePath` is `src/app/agent-workspace/integrationOrientationRecording.json`. I rehashed both that file and the `integrationRecording.json` I reviewed: identical bytes, same digest. Under v2's split, review corrections C1-C5 belong in the separate completed-work edition, and this orientation edition stays as it is.
- **Authored positions consumed**:
  - Moved: `tok_recording_0` (350,280) to **(525,315)**; `tok_recording_1` (1050,280) to **(1155,385)**. Their `recordingReference` values are unchanged: seat `01M569M8QKR9085ZDEG6CFHVVN` and `01M569MJ4HHP75EEKF6AEWWM98`.
  - Unchanged from v1: texts `text_recording_seat_0` (350,390), `text_recording_seat_1` (1050,390), `text_recording_work_0` (350,490), `text_recording_artifact_0` (350,980), `text_recording_artifact_1` (1050,980), `text_recording_intro` (700,100), `text_integration_context_0` (350,720), `text_integration_context_1` (1050,720); pins `pin_integration_entry` (700,1200), `pin_integration_atlas` (350,830), `pin_integration_openrig` (1050,830).
- **Annotation consumed**: new text `text_1792287071598_1zr4pfdh3` at (665.08, 604.76), "Integration desk / Placement is authored context. / Owned work changes through OpenRig.", no `recordingReference`. Counts: 2 tokens, 9 texts, 3 pins, other collections empty.
- **Notes**: `Integration workspace/Atlas repository.md` (496 B, `3c9bdd3e...`), `OpenRig repository.md` (405 B, `d1111e5e...`), `Start here.md` (1,236 B, `9f071092...`). I recomputed each digest from the supplied content and all match. Content is byte-identical to v1.
- **Obligations named**: `jointObligation` `atlas-integration-mapping-20261018`, `reviewObligation` `qitem-20261018013108-c98ecda5`. Both are live-verified above.
- **Coordinator claims, not observed by me**: the `nativeObserved` list (tokens moved; annotation add/edit/undo/redo; Atlas token duplicated with the same reference, deleted, undone, redone; pin opened its note; leaf closed and reopened with objects preserved) and `mediation`.
- v2 still carries no OpenRig rig or instance scope. That is expected: review C4 places scope on the edition.

## Semantic check: illustrated studio places, 01:53Z

Basis: the coordinator's 01:52Z notice only, which arrived as `<unknown sender>`. No snapshot of the background, labels or pins has been supplied. `workspace/` is unchanged (`ENTRY.md` `5f1ff11b...`, v2 `4a829750...a88a`), so I have consumed none of these objects. The hash-bound verdict on `26cc57dd...f349` / v1 is unaffected.

No operational correction is needed to the mechanism. One background image plus editable labels and pins, with seat tokens and recording references kept separate, matches the reviewed mapping. Constraints for the place labels, from OpenRig semantics:

1. **Benches are not pods or assignments.** Pod membership comes from topology (`atlas`, `openrig`). Ownership of work comes from a row's destination plus its claim. A token standing at a bench shows neither, and moving a token between benches changes neither.
2. **"Shared review table" is not shared ownership or acceptance.** Every OpenRig row has exactly one owner. For example, the review `qitem-20261018013108-c98ecda5` belonged to this seat alone. Two tokens at the table do not make a joint obligation. Reviewer verdicts and coordinator acceptance are separate, hash-bound records that a place cannot express. The coordinator has no managed seat, so don't draw a coordinator token there as if it were one.
3. **The "evidence library" does not grade evidence.** An artifact card or pin placed there is not thereby delivered, published, verified or accepted. Evidence class (native record, live CLI read, coordinator claim) and digests stay in the artifacts and the recording edition.
4. **Label the OpenRig place as the repository's work area, not "systems" status.** "OpenRig systems bench" can read as a live daemon or seat health view. This milestone has no live feed, and seat liveness and generation are point-in-time observations (see the generation change above).
5. **Painted regions carry no references.** The image is artwork. Only labels and pins define places, and only recording references identify external resources.

Waiting after this check.
