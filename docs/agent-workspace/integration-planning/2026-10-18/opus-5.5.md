# Atlas and OpenRig integration plan: Opus 5.5 attempt

Independent planning attempt, 2026-10-18 (America/Guayaquil; seat clock 2026-10-19 UTC). Documentation only: nothing here is implemented or authorized. The external coordinator owns comparison and synthesis.

Evidence classes: **[A]** Atlas source at `54e43d5`, **[S]** OpenRig checkout source, **[I]** installed 0.6.10 package or CLI help, **[L]** live read-only observation, **[D]** first-party web docs, **[P]** proposal.

## Observed identity and baselines

| Fact | Value and how it was observed |
| --- | --- |
| Seat | `planning.opus`, node `01M58RZHEH0Y8MRPHNXPSGRFQJ`, session `planning-opus@atlas-integration-repos`, spec `atlas-openrig-integration-planner` 1.0 (`rig whoami --full --json`) [L] |
| Runtime and model | `claude-code`, configured `claude-opus-5-5` (pod spec and `rig ps --nodes`); harness reports Opus 5.5 [L] |
| cwd and Git root | Both `/Users/farieds/Project/atlas-openrig-integration-plan`, branch `codex/openrig-atlas-integration-plan`, HEAD `54e43d5` = `origin/main` [L] |
| Obligation | `atlas-integration-plan-opus-20261018`, claimed 00:30:24Z. Its create-path nudge failed because this seat sat at a selection prompt; I found it by queue read [L] |
| Installed OpenRig | 0.6.10 build `3001cc43`, `dirty:false`, built 2026-10-11, port 18764, `OPENRIG_HOME=~/.openrig-foundation`, generated self-host id (`/healthz`, `rig --version`) [L] |
| OpenRig checkout | `/Users/farieds/Project/openrig` at `63db5917`, package 0.6.10. Installed and checkout both mount 69 routes and 18 MCP tools [S][I] |

Limits: no browser UI, MCP client exchange, OpenRig write route or Atlas runtime was exercised. Web pages were read through a summarizing fetch, so their wording here is paraphrase. The context doc page is labeled 0.6.6; edge types is validated at 0.6.6. The other planning attempt and any synthesis were not read.

## 1. Recommendation

**Atlas should be a spatial client of OpenRig's existing state and verbs, and the place where the owner's authored meaning is attached to them.** It should not schedule, route, approve or hold task state. Three additions carry nearly all the value:

1. **A live reference on any authored object.** Generalize today's `RecordingReference` so a token, text, pin or image can point at a stable OpenRig resource (seat node, queue item, artifact, rig, host) under a named authority. The map stores only the reference; everything live is resolved.
2. **One read model per vault.** A plugin-level service subscribes to the daemon's global event stream, treats events as invalidations and refreshes OpenRig's own projections. Live state is held outside the scene store, so it never enters `.atlasmap` files or undo history.
3. **Actions by delegation.** Every operational action runs an existing `rig` verb with `--json`, and the inspector shows the verb's own result literally. The first actions are Open agent, Send, and Assign work; lifecycle verbs come later behind their existing plan or dry-run modes.

No new agent primitive is warranted. Seats, queue items, context packs, rosters and vault notes already cover the needs; the gaps are a handful of adapter seams plus four small upstream items (section 6).

### User journey

The owner opens their illustrated map. Three tokens they painted and placed are bound to seats; a fourth seat that a teammate added from a terminal with `rig grow` appears in an **Unplaced** tray, because Atlas reconciles to whatever exists. The owner drags it onto a desk and links it to a new home note, or leaves it in the tray. Nothing requires every seat, and certainly not every native subagent, to have a representation.

Selecting a token shows a card: purpose and remit from its home note; harness, model and actual cwd, plus activity and needs-input from the live node; owned work from the queue; recent evidence references. **Open agent** opens the native terminal conversation. **Send** types a signed message through `rig send` and reports delivered, verified, held or refused. **Assign work** creates a queue row for that seat with a body, links and optional note context. The claim appears later because an event arrives, not because Atlas assumed it.

After a handover the same token shows the new occupant; a removed seat leaves the token in place, marked removed; with the daemon down the card says stale while editing and undo keep working. Agents never need Atlas: they keep their native harness, CLI and TUI, and read the map's meaning through notes or an addressed context pack.

## 2. Identities Atlas must keep apart

| Identity | Owner | Atlas handling [P] |
| --- | --- | --- |
| Representation (token, text, pin, image region) | Atlas scene | Authored; moves, copies and deletes are undoable edits that never change OpenRig |
| Meaning (role, remit, vocabulary) | Vault home note | Opened from the object; several representations may share one note |
| Resource (rig, pod, seat node) | OpenRig instance | Referenced by stable `nodeId` under an instance or host authority, never by session name or label |
| Occupant, session, native conversation | OpenRig plus native harness | Resolved live; shown with generation; never persisted in the scene |
| Task | OpenRig queue row | Referenced by `qitemId`; claim, closure and handoff stay with the row's owner |
| Artifact | Repository or vault file | Path or URL plus hash; proof verdicts read, not stored |
| Project | Vault and OpenRig project catalog | An Atlas collection may correspond to one; no universal layout |

## 3. Capability matrix

"Control" means a first-class Atlas action; "native" means Atlas shows state and routes the user to the native CLI, TUI or terminal.

| OpenRig capability | Verified surface | Atlas seam and present support | Missing bridge | Authority | Control or native |
| --- | --- | --- | --- | --- | --- |
| Dynamic roster: grow, remove, shrink, expand, discover, adopt, bind, attach | CLI verbs [I]; `node.added`, `node.removed`, `node.claimed`, `pod.*`, `rig.expanded` events [S]; `/api/ps` [S][L] | Plain tokens with bundled-only references [A] | Unplaced tray, binding UI, removed-seat marker | OpenRig | Native first; later an Add seat form wrapping `rig grow` |
| Stable seat, changing sessions | `ps --full` gives `nodeId`, `canonicalSessionName`, occupant lifecycle, handover, resume type and token, identity verdict [L]; `seat.handover_completed`, `seat.fresh_launched`, `session.*` events [S] | Recording types already separate seat, generation, conversation and session [A] | Live resolution by `nodeId`; exclude resume tokens from fetches and storage | OpenRig | Display |
| Mixed harnesses, models, native tools and subagents | Per-node `runtime`, `model`, `set-model`; agent spec `uses.skills/subagents/plugins`; per-role MCP merge [I][D] | Card shows recorded harness and model [A] | Live values only. Native subagents are not represented on any OpenRig surface checked | Native harness; OpenRig spec | Native |
| Messaging | `rig send --verify` with prompt guard, `broadcast`, `chatroom`, `capture` [I]; `/api/transport/*` [S]. `rig ask` is transcript search, not a peer question [I][D] | None | Send action with literal outcome; optional chatroom panel | OpenRig transport | Control (Send) |
| Owned queue and handoff | `queue create/claim/update/handoff/block`, transitions, `--id` retry identity, `/api/queue/sse` [I][S] | Recorded work cards [A] | Live work cards by `qitemId`; Assign work = `queue create` | OpenRig queue | Control for create and inspect; claim and close native |
| Workflows (optional) | `rig workflow`, missions, slices, scope [I] | None | Read-only overlay where an instance exists; never a prerequisite | OpenRig | Native |
| Context, skills, plugins, role homes | `rig context get` with heading anchors, `work-install`, chain trace, `/api/skills`, `/api/plugins`, rosters [I][D] | Vault home notes reached through note pins; `Character.notePath`; no note field on plain `Token` [A] | Note link on any object; optional scene context pack | Vault for meaning, repo for instructions, OpenRig for delivery | Control (open note); delivery native |
| Continuity, fork, recovery | `snapshot`, `restore-check`, `handover`, `fork`, `agent-image`, `seat launch/stop/clean/continue`, `parked`, `crash-cart`; `recoveryGuidance` per node [I][L] | Recorded continuity text [A] | Show state and the exact supported next command | OpenRig | Native first; later plan-previewed forms |
| Live events, reconciliation, history | `/api/events` SSE, numeric seq, `Last-Event-ID` replay, subscribe-before-replay [S]; queue transitions [I] | Bundled checkpoints only [A] | Connection service, ephemeral cache, history panel | OpenRig | Internal |
| Artifacts and provenance | Queue `evidence-ref`, `rig proof`, files allowlist routes [I][S] | Artifact cards with SHA-256 and published URL [A] | Artifact reference kind resolving to file plus hash | Repo or vault files; proof policy | Display and open |
| Multi-host and project reuse | `rig host`, `--host`, self-host id, cross-host queue fetch, project catalog, bundles [I][S][L] | Collections; cross-collection copy keeps the reference with a new object id (verified earlier) [A] | Authority on every reference; unreachable authority shown, not guessed | OpenRig per host; Atlas collections | Native |
| Permissions and attention | Activity `needs_input` with reason (`permission_request`, `selection_prompt`) [L]; seat permissions for future launches; attention route; one human in gateway [I][S] | None | Needs-input badge; Open agent to resolve natively | Native harness and OpenRig | Native only |

### Atlas seams

| Atlas feature | Seam [A] | Integration use [P] |
| --- | --- | --- |
| Selection and inspectors | `selectedIds`, `RecordedWorkspaceOverlay` mounted in `UIRoot` for non-player views; bindings resolve by reference, never label | Same overlay pattern for a live card; keeps selection native |
| Tokens | `Token` vs `Character`; context menu built in `InteractionController.showContextMenu` | "Link to OpenRig seat", "Open agent", "Open home note" entries; no character mechanics |
| Notes and pins | `NotePin.notePath`; note preview window; statblock links | Home-note entrance on any object; pins stay as they are |
| Scenes and collections | `AssetService` index; scene `data.recording` seed marker gates commands | Optional collection-level default authority; no project registry |
| Authored maps | Background image plus editable objects; owner arranges | Never generated layouts; tray instead of auto-placement |
| Stores, persistence, undo | Per-view store; history tracks `objects`, `grid`, `background`, `widgetValues`; `.atlasmap` schema v4 | Reference edits are undoable; live cache sits outside the store; `CreatureIndex` with `useSyncExternalStore` is the precedent |
| Command scope | `checkCallback` commands enabled only for scenes carrying the recognized seed marker | Live commands enabled by an available connection plus a selected bound object, not by studio ancestry |

## 4. Minimal architecture

```
 authored scene (.atlasmap)          vault notes           OpenRig daemon (loopback)
   object.reference ----------\        ^                    /healthz, /api/ps, /api/queue/*
                               v       | open               /api/events (SSE, seq)
 RigConnection (per vault) --- RigStateCache (ephemeral) <---'
        |                          ^ useSyncExternalStore
        v                          |
 RigActions -> `rig <verb> --json` -> literal result -> inspector action log
```

**Transport.** Reads use loopback HTTP: `/healthz`, `/api/ps`, queue list, item and transitions, and the global `/api/events` stream. These exist in source and the installed build; `/healthz` and `ps` were read live. Whether Obsidian's renderer can hold the SSE stream (Node `http` or streaming `fetch`, loopback CORS) is unverified and is the first spike. Writes go through the installed CLI, spawned from the desktop-only plugin: it is the supported surface, owns the prompt guard and identity stamping, and offers `--json`. Atlas never fakes `X-OpenRig-Session`; it is not a seat. [S][I][P]

**Version and capability detection.** Read `semver`, `commit`, `dirty` and `selfHostId` from `/healthz`. Keep a small table of only the features Atlas uses, each with a probe (JSON 404 for an absent route; verb absent from `--help`). A missing feature disappears with a reason and never blocks native paths. Do not build complete capability discovery, and do not take MCP's 18 tools as the ceiling: they omit queue, context and whoami. [L][S][P]

**Unknown extensions.** Unknown event types still advance the cursor and mark the cache dirty. Unknown fields are ignored on read, and unknown reference kinds or authorities on objects are preserved byte for byte, as Atlas already does for newer preset data. Unknown runtimes or node kinds render raw. [P]

**Reconciliation.** Subscribe first, then take snapshot reads, mirroring the daemon's own subscribe-before-replay order. Consume the global stream: the foundation observed queue events with NULL rig ID that a rig filter drops. Events trigger debounced refreshes of current projections, and the projections are truth. On reconnect, resume with `Last-Event-ID`, deduplicate by seq, and then re-snapshot anyway, because no retention-gap signal exists. The cursor stays in memory; a restart re-snapshots. [S][P]

**Command results.** Show the verb's outcome literally: verified, delivered with acknowledgment pending, held by the typing guard, refused at an interactive prompt, failed. A queue create shows the row pending with its nudge result; this attempt's own row was created while its nudge failed. Never update authoritative state optimistically; use `queue create --id` to retry after an unknown outcome. Log actions in the inspector; undo does not reverse them, and the notice says so. [L][I][P]

**Identity resolution.** A reference's `nodeId` resolves to its `ps` entry, then current session, occupant generation, model and cwd. A missing node reads "removed or not on this authority", never another seat with the same label; a session name alone does not survive handovers. Outside a seat, CLI `--source` is recorded as `claimed:v1`, and OpenRig supports one configured gateway human, so the owner's attested identity as an Atlas actor is an open decision. [I][S][P]

**Offline and stale.** Daemon unreachable: cards show stale since a given time and actions are disabled with the reason; notes and all map editing keep working. A version mismatch disables only the affected features. [P]

**Native paths preserved.** Atlas writes nothing into OpenRig except messages and queue rows the human chose to create. Agents and humans keep full CLI, TUI and native-harness freedom; Atlas only reconciles. [P]

## 5. Phased plan

Each phase is a proposal requiring owner authorization.

| Phase | Deliverables | Source seams | Acceptance evidence (behavior) |
| --- | --- | --- | --- |
| 0. Contract spike | Transport probe from Obsidian; recorded fixtures from a real daemon; decision on human actor and reference shape | New `src/app/openrig/` service; `main.ts` lifecycle | In an isolated vault, a dev build reads `/healthz` and `ps`, receives a live event from a scratch rig, survives a disconnect via `Last-Event-ID` without duplicates, and re-snapshots |
| 1. Live read model and binding | Generalized reference (backward-compatible union with recording references); `RigConnection`, `RigStateCache`; Link to seat; live card; Unplaced tray | `types.ts` reference; `recordedSceneBindings.ts`; overlay; `InteractionController` menu | Natively grown seat appears in the tray without reload; handover shows a new generation on the same token; removed seat leaves the token marked; daemon stop shows stale state while edit and undo still work; the scene file diff shows only the reference, with no session IDs or resume tokens; two scenes bound to one seat show identical state; copy to another collection keeps the reference |
| 2. Home note and Open agent | Note link on any object; Open agent through `rig terminal open` (rig or pod view) and the node's attach command; stopped seats show `recoveryGuidance` | `NotePin`/`Character.notePath` precedent; card | The opened conversation matches the bound `nodeId`; a stopped seat is never started by opening; a missing per-seat view says so instead of opening the wrong agent |
| 3. Narrow actions | Send, Assign work, optional pod broadcast; action log | CLI spawn; card | Send to a seat at a permission prompt reports refused or held; assignment shows pending, then the claim from an event; the same row appears in `rig queue list`; undo after Send leaves the message and says so |
| 4. Map as context for agents | Export a scene or selection as an addressed Markdown note or context pack (who is represented where, home notes, references); governor requests stay ordinary queue rows | Vault notes; `rig context add/compose` | A fresh agent answers where a role's home note is and who owns a task through `rig context get`; consumption is recorded separately from delivery |
| 5. Lifecycle forms (later) | Grow from fragment, launch, stop, handover, fork; all previewed with the verb's plan or dry-run first; multi-host authority display; workflow overlay | CLI; card | Every action shows its plan, needs one explicit confirmation, and appears natively; a failed verb leaves the map untouched |

Failures likely to create unwanted limits: binding by session name or label; persisting live fields in scenes; filtering events by rig; auto-placing seats onto authored maps; requiring a map entry for every seat or subagent; treating MCP or the current verb list as the ceiling; read-only forever because undo cannot reverse an external action.

## 6. Decisions and gap classes

| Gap | Class | Recommendation |
| --- | --- | --- |
| No attested identity for a non-seat human client; `--source` is `claimed:v1` | Upstream | Accept the claimed label for Phase 3 if the owner agrees; propose attested human-client identity upstream |
| Per-seat open: node focus exists only for cmux surface bindings; terminal open takes rig, pod, mission, slice or saved views | Upstream (local fallback) | Ship view-level open plus attach command; propose a per-seat view or focus for tmux and Herdr |
| Queue events with NULL rig ID (foundation observation, not re-verified) | Upstream | Global stream now; report upstream |
| No retention-gap signal on replay | Upstream | Always re-snapshot after reconnect |
| MCP lacks queue, context, whoami | Upstream, not blocking | Do not depend on MCP |
| Reference union, connection, cache, tray, card, note link on plain tokens | Local adapter and UI | Phases 1 and 2 |
| Native subagent representation | Chosen scope | Not required; owner may annotate freely |
| Drawn relationships becoming edges | Chosen scope | No; edges stay in rig specs, displayed only when declared |
| Workflow overlay and lifecycle forms | Chosen scope, later | Phase 5 on demand |

Owner decisions, in order of consequence: (1) the reference shape and authority naming, because scene files persist it; (2) whether Atlas actions may run under the claimed human label; (3) whether Phase 3 Assign work is in scope for the first live release or Send alone; (4) whether to propose the per-seat open upstream before Phase 2.

## 7. Assumptions, uncertainties and sources

Assumptions: one trusted local user per daemon; the plugin stays desktop-only; the CLI path is configurable. Optional bearer tokens guard transport, terminal, compaction, mission-control, host and rig-mode routes; this instance's token configuration was not inspected, which is one more reason to write through the CLI. Uncertain: SSE in Obsidian's renderer; event volume on large fleets; route stability across upgrades (detected, not assumed); one vault facing several hosts.

Atlas [A], relative to this file:
- [WORKING.md](../../WORKING.md), [recorded scene](../../recorded-scene.md), [vault and roles](../../vault-and-roles.md), [Open agent boundary](../../integration-team/operations.md#open-agent-boundary), [role-home trial](../../vault-homes/README.md), [trial verification](../../vault-homes/verification.md)
- [`types.ts` references, pins, tokens](../../../../src/app/types.ts#L5), [scene bindings](../../../../src/app/agent-workspace/recordedSceneBindings.ts#L13), [command scope](../../../../src/app/agent-workspace/registerRecordedWorkspace.ts#L13), [scene creation](../../../../src/app/agent-workspace/createRecordedScene.ts), [overlay](../../../../src/app/agent-workspace/RecordedWorkspaceOverlay.tsx), [overlay mount](../../../../src/app/react/UIRoot.tsx#L217), [token context menu](../../../../src/app/pixi/token-renderer/InteractionController.ts#L518), [history API](../../../../src/app/stores/history.ts#L127), [asset recording marker](../../../../src/app/services/AssetService.ts#L84), [map schema](../../../../src/app/services/MapPersistence.ts#L55), [CreatureIndex precedent](../../../../src/app/creatures/CreatureIndex.ts#L35)

OpenRig [S] at [`63db5917`](https://github.com/fsafey/openrig/tree/63db591720e7881ab1b2205d4295bc6ba516295f):
- [route mounts and `/healthz`](https://github.com/fsafey/openrig/blob/63db591720e7881ab1b2205d4295bc6ba516295f/packages/daemon/src/server.ts#L664), [event stream](https://github.com/fsafey/openrig/blob/63db591720e7881ab1b2205d4295bc6ba516295f/packages/daemon/src/routes/events.ts#L12), [MCP tools](https://github.com/fsafey/openrig/blob/63db591720e7881ab1b2205d4295bc6ba516295f/packages/cli/src/mcp-server.ts#L59), [sender identity](https://github.com/fsafey/openrig/blob/63db591720e7881ab1b2205d4295bc6ba516295f/packages/daemon/src/routes/require-sender-identity.ts), [node focus](https://github.com/fsafey/openrig/blob/63db591720e7881ab1b2205d4295bc6ba516295f/packages/daemon/src/routes/sessions.ts#L442), [bearer middleware](https://github.com/fsafey/openrig/blob/63db591720e7881ab1b2205d4295bc6ba516295f/packages/daemon/src/middleware/auth-bearer-token.ts), [architecture](https://github.com/fsafey/openrig/blob/63db591720e7881ab1b2205d4295bc6ba516295f/ARCHITECTURE.md#the-request-path), [edge types](https://github.com/fsafey/openrig/blob/63db591720e7881ab1b2205d4295bc6ba516295f/docs/reference/edge-types.md), [foundation connector outline](https://github.com/fsafey/openrig/blob/63db591720e7881ab1b2205d4295bc6ba516295f/docs/reference/foundation/connector-outline.md)

Installed [I]: `~/.local/share/openrig/0.6.10/lib/node_modules/@openrig/cli`, `--help` of the verbs named above.

First-party [D]: [features](https://openrig.dev/features), [context](https://openrig.dev/docs/context) (0.6.6), [edge types](https://openrig.dev/specs/edge-types) (validated 0.6.6), [how agent teams find their way](https://openrig.dev/blog/how-my-agent-teams-find-their-way) (2026-10-16).
