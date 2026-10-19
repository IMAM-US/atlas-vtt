# The fork: a colleague outlives its seat

This is a real change, observed on the seat that wrote this project.

## What happened

| When (2026-10-19 UTC unless noted) | Event | Basis |
| --- | --- | --- |
| 2026-10-18, claimed 00:30:24Z | The Opus planner works in seat node `01M58RZHEH0Y8MRPHNXPSGRFQJ`, spec `atlas-openrig-integration-planner` 1.0, and writes the original integration plan | Observed then (`rig whoami`, `rig queue`), recorded in that plan |
| 00:51:57Z | That quest closes, done with no follow-on | Observed (queue) |
| Before about 01:27Z | The seat is removed. The conversation is forked natively and continues in a new seat | **Reported** by the coordinator: "a native fork of your original planning conversation" |
| 01:27:11Z | New seat node `01M58W9VEETETHXK9HSPXDZMJC` under the **same address** `planning-opus@atlas-integration-repos`, spec `atlas-openrig-ontology-planner` 1.0, occupant generation `65565248-7498-4c06-b47e-06a27f5d5f89` | Observed (`rig whoami`, startup record) |
| about 01:30Z | The conversation is compacted and restored from its own restore map | Reported by this seat |
| 02:09Z | OpenRig reports `continuity_outcome: null`, `previous_occupant: null`, `occupant_lifecycle: unknown` for the seat | Observed (`rig seat status`) |

## What each layer did

| Layer | Before | After | What the board does |
| --- | --- | --- | --- |
| Persona: "Opus planner" | one colleague | the same colleague | keeps the token and the nameplate |
| Calling | planner (integration spec) | planner (ontology spec) | re-derived from OpenRig |
| Seat address | `planning-opus@…` | the same address | shown, but **not proof of continuity**: the address was reused by a new node |
| Seat node | `01M58RZH…` | `01M58W9V…` | the old node stays in history at the abandoned camp |
| Occupant | Claude Code, Opus 5.5 | Claude Code, Opus 5.5, new generation | re-derived |
| Conversation | the original | a native fork of it | never displayed; it is the resume token |
| Continuity link | none | "forked from the original" | **reported** by the coordinator; OpenRig recorded nothing |

## What a naive board would have done

- **Binding the token to the node:** the board would show the owner's planner as removed and the continuation as a stranger.
- **Binding it to the address:** the board would silently merge two seats and lose the fact that one was removed.
- **Labelling it "Opus":** the label would lie after the next model change.

## The board's answer

The token depicts the **persona**. Its sheet keeps a binding history with the basis of each step. The fork stays a reported link, drawn as a line from the camp to the pavilion, until the owner settles it or OpenRig records lineage across seats.

## See it on the board

The scene has two named snapshots:
- **Before the fork (reconstructed 00:51Z):** assembled by Opus from its own records, not captured live. The token stands at the camp, with the old seat card current and the first quest closed.
- **Current table account:** the board as delivered.

Restoring a snapshot replaces the scene, and Atlas warns that this cannot be undone. So, if you have changed anything, save the board as a named snapshot first. Then restore *Before the fork*. To return, restore *Current table account*, or your own snapshot if you saved one. Either way, a restore brings back representations and declared marks only, never live native state.
