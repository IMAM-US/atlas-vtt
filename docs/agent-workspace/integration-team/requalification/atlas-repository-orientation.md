# Atlas repository orientation

Recorded: 2026-10-18 UTC. Author: the managed Atlas representative in the corrected `atlas-integration-repos` rig.

Repository launch evidence matches the assigned implementation worktree. No owned obligation was present at startup or the orientation checks before initial publication. A new obligation arrived during publication and was subsequently claimed, as recorded below. This document qualifies this seat's orientation only. The separate repository-mapping-requalification document assesses the earlier mapping; neither document establishes current native scene acceptance.

## Actual managed identity and launch

Commands ran through the existing managed environment, using `rig`, without an external coordinator wrapper or invented identity variables.

| Evidence | Observed value |
| --- | --- |
| `pwd` | `/Users/farieds/Project/atlas-recorded-agent-scene` |
| `git rev-parse --show-toplevel` | `/Users/farieds/Project/atlas-recorded-agent-scene` |
| Managed identity cwd | `/Users/farieds/Project/atlas-recorded-agent-scene` |
| Native launch cwd | Process evidence contains `codex ... -C /Users/farieds/Project/atlas-recorded-agent-scene` |
| Rig | `atlas-integration-repos` |
| Rig ID | `01M56CGCH5VW2XDPN1P1KBNANR` |
| Stable seat/node ID | `01M56CGCH9NACF766XDX1TF92N` |
| Logical ID | `atlas.representative` |
| Pod | `atlas`, label `Atlas repository`, ID `01M56CGCH6Y8RR22D1FBHX3KN4` |
| Address | `atlas-representative@atlas-integration-repos` |
| Runtime | `codex` |
| Native session ID | `01a14cc8-3c67-7e71-9328-47ff75568a7c` |
| Launch generation UUID | `0f8f3068-2dc5-432b-bcb0-18896f16a834` |
| Spec/profile | `integration-representative` v1.0, profile `atlas` |
| Counterpart | `openrig-representative@atlas-integration-repos`, logical ID `openrig.representative` |
| Installed runtime | `rig --version`: `0.6.10 (3001cc43)` |
| Git HEAD | `27a4e72ec492cd989e57f86d5f44623b0819169f` |

Sources: `rig whoami --full --json`; `rig ps --nodes --rig atlas-integration-repos --session atlas-representative@atlas-integration-repos --full --json`; `rig seat status atlas-representative@atlas-integration-repos --json`. The full node record reports `identityVerdict.verdict=verified`, source `pane_process`, observed PID 48979, and the native launch command. Its `agentActivity.generation` agrees with `permissions.lastLaunchArguments.generationUuid` in seat status. Generation and native conversation ID are separate observations.

OpenRig transcript: `/Users/farieds/.openrig-foundation/transcripts/atlas-integration-repos/atlas-representative@atlas-integration-repos.log`. Native Codex transcript: `/Users/farieds/.codex/sessions/2026/10/17/rollout-2026-10-17T21-12-33-01a14cc8-3c67-7e71-9328-47ff75568a7c.jsonl`.

## Repository harness and skills actually consumed

Read the implementation root `AGENTS.md` and native `CLAUDE.md` entry. The latter contains `@AGENTS.md` and directs both runtimes to the shared rules. Read the current repository role brief and startup context in `docs/agent-workspace/team/agents/integration/`. The observed native launch root and the session's initial environment context both name this worktree, beyond merely reading source from another cwd.

Repository skill discovery used `rg --files --hidden` under `.agents` and `.claude`. `.claude` does not exist in this worktree. `.agents/skills` offers nine skills:

- `atlas-vtt-game-master`
- `atlas-vtt-map-forge`
- `atlas-vtt-token-forge`
- `atlas-vtt-portrait-forge`
- `atlas-vtt-scene-illustration-forge`
- `atlas-vtt-props-terrain-forge`
- `atlas-vtt-item-treasure-forge`
- `atlas-vtt-heraldry-symbol-forge`
- `atlas-vtt-handout-forge`

Loaded the full local Game Master and Map Forge bodies. Game Master governs native Atlas operation and representation while keeping plugin development separate. Its `references/atlas-operations.md` was read for identity checks, one native operator, recovery, and the prohibition on persistence-file mutation. Map Forge governs authoring specifications and setup plans; it neither implements plugin code nor exports native scenes. Its `references/atlas-vtt.md` was read for asset, pin, scene and persistence boundaries. The dated guidance was treated as orientation, with current source reads for actual seams. The other seven bodies were not loaded because this startup needs no new visual assets.

Also loaded global `rigs` and `openrig-skills` bodies from `/Users/farieds/.agents/skills/`. Used installed `rig context list --json`, then loaded only `skills/core/agent-startup-and-context-ingestion` via `rig context get` to audit actual startup inputs. Used installed command help for identity/session inspection. No installation, topology mutation, new agent, wrapper substitution or permission-policy change occurred.

Read Atlas `docs/agent-workspace/WORKING.md`, the relevant token/text/pin definitions in `src/app/types.ts`, `src/app/services/MapPersistence.ts`, `src/app/stores/history.ts`, and `src/app/plugin/atlasLeaves.ts`. Inspected the current agent-workspace file inventory and the source bodies for `recordedSceneBindings.ts`, `createRecordedScene.ts`, `attachIntegrationEvidence.ts`, `RecordedWorkspaceOverlay.tsx`, and `workspaceRecordings.ts` as bounded orientation. These establish the seams to revisit under an assigned review, not a completed implementation assessment.

Read OpenRig's root `AGENTS.md`, the native `CLAUDE.md` entry and integration culture/startup section, and `docs/reference/foundation/WORKING.md`. Its foundation recommendation and separate wrapper are historical context. Current task scope comes from the repository's Atlas working document, corrected role brief and live managed identity. Newer OpenRig source is not evidence that installed 0.6.10 implements a behavior. No OpenRig implementation verdict is made here.

The implementation checkout already contains coordinator edits and untracked agent-workspace files. They were preserved. Canonical Atlas `/Users/farieds/Project/atlas-vtt` has `.agents` and a legacy `CLAUDE.md`, but no root `AGENTS.md` or `.claude`; it is not this seat's launch root. The assigned implementation root has the shared native harness entry described above.

## Project, queue and workspace discovery

Read `/Users/farieds/Project/atlas-openrig-integration-workspace/README.md`, `workspace/ENTRY.md`, `team/CULTURE.md`, and the shared Atlas role brief through absolute paths.

`rig context work-install --json` selected project ID `atlas-integration`, `selectedBy=rig`, project root `/Users/farieds/Project/atlas-openrig-integration-workspace`, and declared `project:workspace/ENTRY.md` plus `project:team/CULTURE.md`, both existing. The daemon workspace root `/Users/farieds/Project/openrig-foundation-workspace` is a catalog host, not this team's project root. Discovery matches the startup requirement.

`rig queue whoami --json` reports this corrected address, zero pending/in-progress/blocked destination work, `currentWork=null`, and no source work. `rig queue list --owned --full --json` returned `[]` at startup and again before preparing this record. Its startup-role projection is `not-declared` with empty `files`; that record is not claimed as successful launch or current-byte proof. Process evidence and actual reads above supply the specific orientation evidence. No queue claim, completion, handoff or reviewer acceptance occurred. The historical obligation named by ENTRY does not authorize this new seat to invent an assignment.

## Explicit supplied scene context

Read v2 and v3 JSON bodies and checked their raw file hashes with `shasum -a 256` and byte counts with `wc -c`.

| Supplied file | Bytes | SHA-256 |
| --- | --- | --- |
| `workspace/scene-context-v2.json` | 11511 | `4a829750bbbf0b43e353adc9f25e45cf86c109cfec4d915b5d16581f0a8db88a` |
| `workspace/scene-context-v3.json` | 13468 | `5a51fc299281c7fb77e577e590c9b0d9806d5fd624c790839319a2c276d51f99` |

Both match ENTRY. V3 is supplied by the external Codex coordinator, captured `2026-10-18T02:01:53.669491+00:00`. V1 was not separately read. V3 names:

- Review vault `/Users/farieds/Project/atlas-agent-workspace-review`.
- Scene asset `scene-1792286764203-ykkw4w`, path `atlas-vtt/collections/Default/scenes/Atlas OpenRig integration workspace.atlasmap`, reported saved-scene digest `32a6219c0cfd1bc2b67d714175603a984fe998be50688b9951e1d13a44d38124`.
- Background map asset `map-1792288529229-ab8gxv`, 1400 by 1400, reported image digest `d7ee685beea1e3cb205ddbce96f2af4714f495f4f8eb23acdf84c2c9750dfad5`.
- Two ordinary seat tokens, `tok_recording_0` and `tok_recording_1`; editable seat, work, artifact and repository text; and three ordinary linked-note pins.
- Notes `Integration workspace/Start here.md`, `Integration workspace/Atlas repository.md`, and `Integration workspace/OpenRig repository.md`, with supplied note contents and digests.
- Places defined by notes and labels: Atlas cartography bench, OpenRig repository bench, shared review table, evidence library. Painted regions have no operational identity or permission effect.
- Historical recording `atlas-openrig-integration-m1`, source revision `27a4e72ec492cd989e57f86d5f44623b0819169f`, reported recording digest `fc56fcd199e3b6fc9296fc3139cdacfac7f323bacd07007b48c72a1992623dae`.

These are explicit supplied context bytes, not an automatic scene subscription. Scene/image/note digests above are reported by that snapshot; only the v2/v3 context-file digests were independently calculated in this orientation. ENTRY attributes attachment undo/redo, historical checkpoint isolation and close/reopen object/background equality to the coordinator. This seat did not operate Obsidian, inspect its compositor or independently repeat native acceptance.

## Discrepancies and next boundary

The shared `team/agents/integration/guidance/atlas.md` still names `atlas-representative@atlas-integration` and its historical counterpart. The current repository role brief and managed identity name `atlas-integration-repos`; those current identities govern this seat. Coordinator should update the shared role pointer or mark it historical. This seat does not rewrite it.

The scene's seat references remain historical by explicit design. `tok_recording_0` refers to old node `01M569M8QKR9085ZDEG6CFHVVN`; `tok_recording_1` refers to old node `01M569MJ4HHP75EEKF6AEWWM98`. The recording scope is old rig `01M569M8QH0BXDNXECRE3KJZMG` / `atlas-integration`, while the corrected rig and this node have the new IDs above. Linked notes also retain historical addresses. Treat these as historical representations until the coordinator explicitly attaches a new edition. Do not silently relabel an immutable recording or claim the scene already represents the corrected roster.

Await an explicit owned obligation and nudge. The assigned requalification will assess the mapping and implemented object journey through current source and this repository harness, then hand a frozen, hashed artifact to the actual counterpart through the installed atomic queue handoff. Prior proposal, verdict and orientation artifacts remain untouched. The coordinator retains source integration, scene edits, native acceptance and delivery ownership. No source, scene persistence, asset index, daemon, provider or authentication changes were made. No implementation tests were run for this orientation-only artifact.

## Launch-time input hashes

| Input | SHA-256 |
| --- | --- |
| Implementation `AGENTS.md` | `1e1b12e70c996fa462c4956e6ce5c4037eea2cffa6e9c2868969c64f7618d9dc` |
| Implementation `CLAUDE.md` | `da7c169f77df89de203b7ce164bb7c077d0ab39285f46b34b3aa2f260177350c` |
| Atlas `docs/agent-workspace/WORKING.md` | `10e01c5afbad5ebee402adb7422d372ff72822815ce7129c91c128d391417779` |
| Repository role `docs/agent-workspace/team/agents/integration/guidance/atlas.md` | `0cf2aa32c83eeb7cdadf03b90b4f0329a57c8092efdd7c4ca637d4e58ec08dd1` |
| Local Game Master `SKILL.md` | `382717aabe5c0f0cfab7a36ff87f90831e93fb03b266537f036883593f1e0830` |
| Local Map Forge `SKILL.md` | `322be658f2d43479c498542acc2f052bf3e2bd2cda26cb03c4df3d19955d027b` |
| Shared `README.md` | `4a5c18c1fc32718538d8229d0766255c25d5570030595d87e4b761ba4386cd4a` |
| Shared `workspace/ENTRY.md` | `bf78ddbbf5659afa1fdc5197b36c395c4118110e88b5d2e8d49938bc06d7dc6a` |

## Assigned requalification and current instruction refresh

After initial publication, an owned discovery returned `atlas-repository-requalification-20261018`, source `atlas-integration-coordinator`, destination this corrected seat. Claimed through managed `rig queue claim` at `2026-10-18T02:16:00.092Z`; transition 56 reports `in-progress`. The predecessor scene and mapping remain historical. A real queue obligation now authorizes the bounded review and subsequent atomic handoff.

Read `workspace/HARNESS-CORRECTION.md`, SHA-256 `f956361bf8493eea314fcfd9f78e8168666420ab2d3cd45ee24bcd3440f817da`. It attributes the original launch defect and explains explicit seat replacement, the stopped historical rig, coordinator ownership and pending repository-team recording. The current shared README points to `team-repository/` and marks `team/` historical. Read the current shared Atlas brief from `team-repository/agents/integration/guidance/atlas.md`, SHA-256 `0cf2aa32c83eeb7cdadf03b90b4f0329a57c8092efdd7c4ca637d4e58ec08dd1`. The earlier shared-role discrepancy is thereby resolved as a preserved historical path, not a current routing instruction.

The coordinator removed generated managed launch blocks after startup. Current `AGENTS.md` is 157 lines, SHA-256 `636a0246b87f207266719463f8600f2b4276cc3e2730b6ff74ee07d9569c95fa`; hashing `git show HEAD:CLAUDE.md` yields that same digest. Current `CLAUDE.md` is seven lines, SHA-256 `56a49df6f2ae9ff928df4b52a490473076902d36c4591458cd30ca973ac1d3f0`; the actual Standalone Search loader independently hashes identically. Read the current loader and canonical body, including the sections previously hidden by combined-output truncation. Current shared README digest is `0ec3181b1ac67216b2f918aa78248565c13e6389ba06475ca860dd53f83219fc`. Launch-time hashes above remain evidence of the bytes observed then; they are not represented as the current on-disk instructions.

Additionally loaded installed `skills/queue-handoff` via `rig context get` for the required atomic transition, plus `/Users/farieds/.codex/skills/verification-epistemology/SKILL.md` to assess the focused checks without enlarging the test gate. The managed OpenRig session-record ID was not exposed by the inspected CLI projections and remains unestablished here; the managed address, native Codex conversation ID and launch generation above are independently labeled and are not substitutes for that record ID.

Inspected the bundled studio raster with the local image viewer: upper-left map desk, upper-right instrument desk, central lower review table and lower-wall bookcases agree with the supplied place definitions. This raster inspection is separate from native compositor acceptance. Additional object-lifecycle source and test reads are recorded in the requalification artifact. No source or vault state was changed by this seat.
