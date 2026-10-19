# Quest log

Each quest is a **representation** of one OpenRig queue row. The row is the truth: it lives in OpenRig on this host (`OPENRIG_HOME ~/.openrig-foundation`). States below were **observed** with `rig queue show <id> --json` at the times given. They do not update.

| Quest | Row id | Giver → holder | Observed states (2026-10-19 UTC) | Closure (reported by the holder) |
| --- | --- | --- | --- | --- |
| Integration plan | `atlas-integration-plan-opus-20261018` | coordinator → Opus planner (old seat) | claimed 2026-10-18 00:30:24Z; done 00:51:57Z | no follow-on; artifact `opus-5.5.md` |
| Ontology review | `atlas-ontology-review-opus-20261018` | coordinator → Opus planner | created 01:33:14Z (nudge `delivered-ack-pending`); claimed 01:33:21Z; done 02:22:05Z | no follow-on; artifact `ontology-opus-5.5.md` |
| Opus representation | `atlas-opus-representation-20261018` | coordinator → Opus planner | created 02:54:28Z; claimed 02:55:04Z; **in progress when written** | this project |
| Image request v1 | `atlas-opus-image-board-v1-20261019` | Opus planner → Image partner | created 03:01:25Z (nudge `verified`); claimed by the partner about 03:02Z | see [[Relic archive\|Relic archive]] |

## Branching work

The representation quest branched: Opus gave the image partner its own quest through the queue, not through a message. The parent stays with Opus. Opus's acceptance of the board is a **judged** account by the quest giver; it is not the owner's judgment of the project.

## Giving a quest

- **Proposed:** a *Give quest* action on a token would run `rig queue create` against the seat bound at that moment, and show the result literally (created, nudge delivered, verified or refused).
- **Today:** the same command in a terminal. A sheet pinned here by hand is a declared marker, not a queue row.

## Stale by design

When you read this, the representation row has almost certainly moved on. The slate card on the board says "in progress" and when that was true. That is the honest form of a captured observation.
