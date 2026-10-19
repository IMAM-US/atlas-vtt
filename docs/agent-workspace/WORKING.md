# Atlas agent workspace working document

Updated: 2026-10-18 America/Guayaquil. Status: live integration remains incomplete. The owner requested a concrete integration plan and independent Astra / Opus 5.5 assessments through OpenRig. This change is documentation only; implementation is not authorized.

Start here for direction and sequencing. The [integration plan](integration-plan.md) contains the capability map, gaps, architecture, comparison of both assessments, and acceptance criteria.

## Confirmed direction

Accepted owner direction, 2026-10-18: make OpenRig's core capabilities useful through Atlas while preserving the freedom and dynamic behavior of OpenRig, Codex and Claude Code. Atlas should support understanding and operating the real environment, including work begun or changed outside Atlas. Earlier read-only and no-dispatch exclusions scoped the recorded experiments; they are not permanent product limits. The present authorization is to plan, not implement.

The owner crafts maps, imagery, names and arrangement. Integration attaches useful entrances to selected existing objects and preserves ordinary human editing. Coordinator-generated studios and layouts are experiments, not project conventions. A project can choose its own roster, repositories, context and spatial expression. Scenes, collections, rigs, pods, roles and projects need not map one-to-one.

Atlas owns spatial authoring, navigation and representation. OpenRig owns persistent seats, supported coordination/lifecycle, owned work and operational transitions. Codex and Claude Code retain native conversations, repository instructions, discovered skills, tools, approvals and temporary subagents. Vault notes organize shared meaning, role/resource homes, institutional knowledge and decisions; canonical code and specifications remain at their actual sources. Atlas adds no competing queue, execution engine or mandatory workflow.

The guiding idea remains orientation before search: a person or arriving agent can discover what exists, who understands it, where relevant knowledge lives and how to go deeper. People navigate the authored space; agents follow the same meaningful identities and reading routes through addressed sources. Spatial context should become useful to agents without requiring them to interpret a screenshot or ingest every map edit.

## What exists

Planning baseline: Atlas `54e43d5` on `origin/main`, including merged [PR #14](https://github.com/fsafey/atlas-vtt/pull/14) and [PR #15](https://github.com/fsafey/atlas-vtt/pull/15). OpenRig checkout `63db5917`; the installed instance is separately identified as 0.6.10, build `3001cc43`.

| Existing capability | Current boundary |
| --- | --- |
| Native scenes, images, plain tokens, text, note pins, selection, persistence and undo | Atlas can author and preserve the workspace. Ordinary spatial edits do not operate agents. |
| Recorded seat/work/artifact references and inspectors | Operational data comes from bundled historical editions. There is no live client or general resource resolver. |
| Vault role homes and linked reading routes | A prepared fresh-session discovery and bounded caretaker request worked through real OpenRig. There is no generic plain-token home-note field or automatic context feed. |
| Persistent OpenRig seats, changing occupants, native terminals, messaging, queue, addressed context and events | Those capabilities exist independently; they are not yet integrated into Atlas controls. Installed HTTP/CLI surfaces are broader than the current MCP adapter. |
| Collections, copying and multiple local representations | These do not establish a project registry, host binding or composition/import contract. Scene pins currently link within their collection; notes can link more broadly. |

Full mapping and source anchors: [capabilities and gaps](integration-plan.md#capability-map-and-gaps). Recorded facts, live observations, source inspection, proposed behavior and user acceptance remain distinct evidence.

## Implemented milestone and evidence

The editable recorded workspace uses ordinary Atlas objects and their native stores, persistence and history. Several representations may refer to one resource. Duplication creates a new local object; deleting or undoing one affects its representation. Historical checkpoint browsing preserves authored layout. See [recorded scene](recorded-scene.md) and [native verification](integration-team/native-verification.md).

The original representatives required a corrected repository-native launch. Historical results were preserved, then requalified by the replacement roster with separately attributed author, reviewer and coordinator evidence. See [harness correction](integration-team/harness-correction.md), [collaboration evidence](integration-team/evidence.md), and [context receipt](integration-team/workspace/context-v4-receipt.md).

The later role-home trial preserved the owner's existing map and layout, supplied note-backed entrances, and proved one prepared fresh-session reading route plus one bounded caretaker effect. See [vault and roles](vault-and-roles.md), [trial](vault-homes/README.md), and [verification](vault-homes/verification.md). The Reference Observatory supplied mechanical reuse evidence, not proof that the broader organizational experience was complete.

These experiments establish foundations. They do not establish live synchronization, general agent navigation, automatic context consumption or an autonomous governor loop.

## What we are proposing

Use existing Atlas features as entrances to authoritative resources. A selected token can reach a role home and current native agent; a work card can inspect or operate a real OpenRig obligation; a note or place can expose addressed knowledge and useful routes. Multiple objects and scenes may share those references without creating duplicate agents or work.

Add a small deterministic binding/client/action layer. Keep runtime facts in a shared live projection outside map history, retain native access for advanced or unfamiliar capabilities, and extend controls as supported operations are qualified. Do not make the recorded schema, current MCP subset, two-person studio or initial set of buttons the capability ceiling. No new agent primitive is required; an optional caretaker continues to use ordinary, explicitly delegated OpenRig work.

Recommended implementation sequence, pending authorization:

| Slice | Concrete outcome and acceptance |
| --- | --- |
| 1. Resource entrances and native access | Bind existing objects to a home/resource, resolve current identity, and reach a supported native surface. Duplicate/undo/reopen preserve references; missing or replaced occupants remain explicit. |
| 2. Live operational picture | A shared client/store reconciles inventory and work changed outside Atlas. Roster churn, reconnect and stale data do not move authored objects or silently lose work. |
| 3. Useful collaboration through Atlas | Send a question, attach context, create owned work, and follow a supported handoff to its artifact. Preserve the real actor, receipts, native approvals and uncertain outcomes. |
| 4. Evolving teams and optional workflows | Add qualified team/lifecycle/configuration controls and workflow views. Native growth, adoption, model changes and temporary helpers continue independently; a queue-only journey remains valid. |
| 5. Shared context and project/host reuse | Publish discoverable reading routes and explicit shared-reference/copy/rebinding behavior. A fresh native session finds context; unreachable hosts and missing dependencies are represented honestly. |

Dependencies, exact source seams and failure-sensitive proof are in [phased delivery](integration-plan.md#phased-delivery). Each slice must keep native access available; advanced controls can arrive later without restricting their underlying capabilities.

## Open decisions

Recommendations below are planning judgments, not recorded owner approvals of implementation details.

| Decision | Recommendation |
| --- | --- |
| Binding and role identity | Optional resource/home links on existing objects, separate from immutable recording references. Introduce a separate role identity only when it needs to outlive its occupant. |
| Transport and packaging | Start in the desktop plugin with supported daemon HTTP and a narrow native CLI/terminal adapter. Verify origin/streaming behavior; keep polling reconciliation even when SSE is available. No additional daemon by default. |
| First operational controls | Native access, messaging, owned-work creation and evidence/artifact navigation. Add lifecycle and configuration forms after their contracts are qualified. |
| Spatial gestures | Preserve normal authoring. Offer explicit operations first; projects may later bind deliberate gestures to supported operations with understandable effects. No hidden dispatch from layout edits. |
| Extensibility and configuration | Version-aware adapters, native fallback and explicit instance/host bindings. Preserve unfamiliar fields and avoid a universal workflow or project template. |
| Context and caretaker work | Compose by reference and expose reading routes. Publish meaningful context changes deliberately; recurring caretaker authority and automatic delivery remain future choices. |

## Next discussion

Review the [synthesized plan and comparison](integration-plan.md), [Astra's original attempt](integration-planning/2026-10-18/astra.md), and [Opus 5.5's original attempt](integration-planning/2026-10-18/opus-5.5.md). Choose an implementation slice only after that review. No implementation starts from this planning request.

The acceptance journey is: start work in Atlas, continue and change the team freely through OpenRig and native agents, then return to a current and useful Atlas picture. Closing Atlas must not stop the team. A person must still be able to use a capability that Atlas has not given a dedicated control.

## Delivery boundary

Prior source implementation `9679d2e` passed 59 focused tests, TypeScript, touched-source lint, changelog validation and an isolated-vault production build. Later reuse/command-scope and role-home work has its own focused/native evidence. Those receipts do not qualify future integration code. PR #14 merged at `3654974`; PR #15 merged at `54e43d5`.

This planning change preserves both independently authored outputs and supplies coordinator synthesis. Verification is document, source-reference and diff checking, plus actual OpenRig assignment/claim/completion and native model-record inspection. No application tests or build are needed for these documentation changes. No runtime integration, release, migration, CI/provider configuration or canonical-vault installation is included. The planning run's provenance and limits are recorded in the [comparison](integration-plan.md#independent-attempts-and-synthesis).

## References and upkeep

- [Complete integration plan](integration-plan.md), [recorded milestone](recorded-scene.md), and [vault/role ownership](vault-and-roles.md).
- [OpenRig foundation and connector outline](https://github.com/fsafey/openrig/tree/63db591720e7881ab1b2205d4295bc6ba516295f/docs/reference/foundation), [context](https://openrig.dev/docs/context), [edges](https://openrig.dev/specs/edge-types), and [current feature map](https://openrig.dev/features).
- [Original Atlas classification](../atlas-vtt-classification.md), [rig library](https://openrig.dev/rigs), and [Workshop](https://openrig.dev/rigs/workshop).

Keep this document concise. Date owner decisions, distinguish them from recommendations, preserve historical evidence, and refresh installed/source claims before implementation.
