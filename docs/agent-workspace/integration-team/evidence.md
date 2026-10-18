# Integration team evidence

Captured 2026-10-18 UTC. This is a record of a real integration team, separate from the completed foundation experiment. It is not a live feed. The source checkout remains distinct from published OpenRig 0.6.10, build `3001cc436656c435e54425443e708e3e2d8c7d68`.

## Roster and scope

Rig `atlas-integration`, ID `01M569M8QH0BXDNXECRE3KJZMG`, runs through the existing loopback instance `127.0.0.1:18764`, state home `~/.openrig-foundation`. Its separate working area is `/Users/farieds/Project/atlas-openrig-integration-workspace`. The original `foundation` rig and artifacts were preserved. The coordinator is this external Codex session, not an invented third OpenRig seat.

| Seat | Stable node | Native conversation | Effective model observed |
| --- | --- | --- | --- |
| `atlas-representative@atlas-integration` | `01M569M8QKR9085ZDEG6CFHVVN` | `01a14c9a-2d0d-7cf0-a94f-6a0f5359e0ff` | `gpt-6.1-sol` |
| `openrig-representative@atlas-integration` | `01M569MJ4HHP75EEKF6AEWWM98` | `c4128f1e-1dc6-4d6d-a2a7-8790fcc15d17` | `claude-opus-5-5` |

Both bindings were verified by OpenRig against the pane process. [Curated runtime observations](runtime-observations.json) record the separate session IDs, occupant generations and native provider model fields. At 01:45:34 UTC the coordinator independently read 6 Codex turn-context model records and 96 Claude assistant model records; only the configured model was observed in each respective set. Raw provider conversations, authentication and runtime databases remain private. These observations are not a claim about every future turn or helper model.

The [team configuration](../team/rig.yaml), [culture](../team/CULTURE.md) and role briefs assign non-overlapping artifact ownership. Native Sol helpers and an Opus agent-worker supported bounded implementation/review; they are not counted as OpenRig seats. Shared source, native scene operation, acceptance and delivery remain coordinator-owned. No OpenRig repository code was changed.

## Orientation

Both seats ran managed identity and owned-queue discovery, read their repository entry points and consumed [explicit scene context v1](workspace/scene-context-v1.json). It was supplied at 01:28:13 UTC, SHA-256 `980750829642bd0dd6ebb818b61d1d03278787074d4e7b5284feddf3c80ac8fe`. Atlas compared its objects and three notes against the saved native scene; OpenRig independently hashed and reviewed the supplied context.

Both later consumed [v2](workspace/scene-context-v2.json), supplied at 01:43:58 UTC, SHA-256 `4a829750bbbf0b43e353adc9f25e45cf86c109cfec4d915b5d16581f0a8db88a`. It adds the scene asset ID, exact initial recording digest, note paths/hashes and the human-authored layout. Their orientation artifacts distinguish reading that snapshot from personally observing the UI. V1 and v2 remain separate immutable supplied contexts; neither is a subscription.

Initial project discovery selected the foundation project. The coordinator backed up the catalog and added `atlas-integration` with this team's separate project root and rig membership, leaving `default` unchanged. Both actual seats then independently observed `selectedBy: rig`, the integration project, `workspace/ENTRY.md` and `team/CULTURE.md`, with no warnings. The daemon workspace root still hosts the shared catalog; it is not this team's project root.

## Owned work, review and acceptance

[Queue history](queue-history.json) contains only this team's curated rows and attributed transitions. Claim stamps were read separately from SQLite in read-only mode because installed queue projections do not expose them.

| Observation | Evidence |
| --- | --- |
| Assignment | `atlas-integration-mapping-20261018`, created 01:23:31 UTC, transition 33. Coordinator source is `claimed:v1`, an external declared label. |
| Claim | Atlas claimed at 01:28:36 UTC, transition 38, managed `transport:v1`, generation `1711b9dd-f487-49eb-a8f8-e462fe635f0a`. |
| Author delivery and handoff | At 01:31:08 UTC, transition 39 closed the author row and transition 40 created `qitem-20261018013108-c98ecda5` with its predecessor. The proposal digest is `26cc57dd08586c80bf2e0d9b16da7be19b25b00c04438ee1463ae1dc81aef349`. |
| Wake versus discovery | The original successor nudge was refused at a native approval prompt. The reviewer discovered the durable row through a queue read prompted by the coordinator. A separate sweep finding later had a verified nudge; it was not the author's review message. |
| Review claim | OpenRig claimed at 01:32:42 UTC, transition 42, managed `transport:v1`, generation `cddfa82d-665d-4371-9e55-c72a39b7cd04`. |
| Reviewer verdict and closure | [Review](artifacts/mapping-review.md) accepts the exact proposal with coordinator-owned corrections C1-C6. Transition 54 closed the review `done/no-follow-on` at 01:45:45 UTC. Review digest `2ef05cdc3a6a04f28ec58c4afba8a37374af61e2ab327369e6b1cb4d22880abc`. |
| Coordinator acceptance | [Separate mapping acceptance](acceptance.md) names exact bytes and resolves the corrections. It does not turn reviewer acceptance into native UI verification. |

The sweep recovery and escalation rows are both closed. Their source labels copied the underlying actor, but they were daemon-generated recovery work; they are excluded from the two-item joint mapping chain. Use transition provenance, not a source label or terminal message header, to interpret attribution.

## Continuity and ordinary approvals

The reviewer briefly displayed native auto mode despite an OpenRig launch record of `acceptEdits`. The cause was not established. The coordinator detected this through terminal capture, took explicit snapshot `01M56A2TD7BFT28R1STGFNE066`, stopped only that seat and resumed it from that snapshot. Subsequent capture showed `accept edits on` and ordinary one-time approval prompts. No persistent permission settings were edited and no blanket bypass was configured. The posture field alone did not prove the effective native mode.

The stable node and native conversation survived. The OpenRig session changed from `01M569MJ5H8FBXWBPKDKX8TBHJ` to `01M56A350J860NM9D9SVNCGZBQ`; generation changed from `2019ddb7-2adb-4c0c-9809-101dfba658dd` to `cddfa82d-665d-4371-9e55-c72a39b7cd04`. Actual provider turns after resume and the review claim establish continued work. The Atlas seat retained session `01M569M8SE0RM5TBTW44EW6NSX` and its initial generation. Session record IDs and claim stamps came from read-only database queries, not inference from addresses.

## Native scene observations

The coordinator operated only `atlas-agent-workspace-review`. Native Atlas created scene asset `scene-1792286764203-ykkw4w` at `atlas-vtt/collections/Default/scenes/Atlas OpenRig integration workspace.atlasmap` and three ordinary orientation notes.

Observed before final evidence publication: Atlas token moved to `(525,315)`, OpenRig token to `(1155,385)`; move undo/redo restored the expected coordinates. A text annotation was added, edited and undone/redone. Duplicating the Atlas token created a new object ID with the same external reference; delete, undo and redo affected only that copy. A repository pin opened its ordinary note. Closing the Atlas leaf and reopening preserved every object exactly (comparison digest `5c0f4721a0a2e8270628201d5991e4060702054d8eae6316e82f78732db147fc`). The v2 snapshot records those authored objects.

Final local evidence attachment, illustrated background, checkpoint inspection and current delivery checks are recorded separately in [WORKING.md](../WORKING.md) and the native verification record. The studio is an owner-requested addition after the mapping verdict; see [visual meaning and generation provenance](studio.md). It does not enlarge the verdict's scope.

No scene movement, duplication, annotation, undo or checkpoint action has an OpenRig transport path. Focused tests exercise native store/history/persistence and fail if the feature attempts network transport. Provider operations above were explicit coordinator/seat CLI operations, outside Atlas. The canonical campaign vault was not used for this milestone.

## Limits

This establishes a real attributed collaboration using explicitly supplied spatial context, plus a locally editable scene. It does not establish automatic scene consumption, relationship semantics, live synchronization, agent navigation, multi-user authorization, host-reboot recovery or a human usability study. Native permission prompts remain an operator responsibility. See [operations](operations.md) before continuing either seat.
