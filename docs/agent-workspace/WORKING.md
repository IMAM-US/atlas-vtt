# Atlas agent workspace working document

Updated: 2026-10-18 UTC. Status: editable illustrated milestone implemented and natively verified in the isolated review vault. Repository-native representatives completed attributed requalification and review. [PR #14](https://github.com/fsafey/atlas-vtt/pull/14) is open; remote qualification is unavailable, so it is not merged. A live connector and Atlas execution controls remain out of scope.

## Confirmed direction

The owner selected a **general agent workspace, with Atlas as the spatial language**. OpenRig is a core part of this direction. Domain agents coordinate with one another and with people through the LLM connector space.

The supplied transcript's guiding idea is orientation before search: an arriving agent discovers what already exists, where knowledge lives, and whom to ask.

Accepted owner correction, 2026-10-17: Atlas is an editable spatial workspace where humans shape the environment agents inhabit. “Read-only” applies to the recorded OpenRig connection and operational facts, not to Atlas authoring. Deliver a real editable scene using existing objects, persistence and undo. Movement, annotations and other authored spatial content must preserve stable references and recorded facts. Live integration, execution controls and permission changes remain excluded.

Accepted owner clarification, 2026-10-18: the first working team is the team building this integration. Persistent Atlas and OpenRig representatives use actual owned work, explicit workspace context and attributed handoff/review, with this Codex session coordinating. Preserve foundation evidence. Atlas editing remains local; no automatic dispatch, permission changes or general live connector. See [team configuration](team/rig.yaml) and [original collaboration evidence](integration-team/evidence.md).

Accepted product direction, 2026-10-18: Atlas is an editable spatial dashboard for a specific project. It owns the authored environment, representations, navigation and shared context. OpenRig owns persistent seats and supported coordination/lifecycle; Codex and Claude Code remain each agent's native working harness. Repository/workspace files own instructions, knowledge, artifacts and decisions. Atlas adds no competing task states, approvals or governance system.

The intended agent card leads with purpose, harness/model, repository and actual working directory. Its primary future action is **Open agent**, resolving the stable identity to its current native conversation through supported mechanisms, with stopped/recovery states explicit. Technical IDs and provenance are secondary. The recorded milestone can present verified metadata and opening instructions; direct native-agent opening from Atlas is not implemented. Agent creation/import, live status and automatic context delivery remain future decisions.

Accepted owner clarification, 2026-10-18: each Atlas project can explore its own roster, repository harnesses, context, configuration and spatial expression. A new Codex session may help configure a project; project, scene, seat and conversation identities remain distinct. This integration studio is one concrete configuration, not a universal project template. Explicit reuse across projects should preserve provenance and distinguish a shared reference from a copied representation, artifact or configuration. Versioned files and small experiments are the intended development approach; a project manifest, composition/import mechanism and compatibility rules remain proposals. No such framework or live integration is added in this milestone.

## What exists

Initial source findings: Atlas `043df3d`, OpenRig `0915430b`. OpenRig foundation stages 1-3 subsequently completed on published 0.6.10 (`3001cc43`), documented at [foundation source `63db5917`](https://github.com/fsafey/openrig/tree/63db591720e7881ab1b2205d4295bc6ba516295f/docs/reference/foundation). Live Atlas integration remains untested.

| Component | Existing capability | Boundary |
| --- | --- | --- |
| Atlas | Scenes, positioned tokens, note links, view stores, persistence, and undo | No agent connector or domain ownership semantics were found. Token movement changes scene state. |
| OpenRig | Persistent seats, changing sessions, addressed context, owned work, handoffs, and events | Its HTTP interfaces expose more coordination capabilities than its current MCP tools. |
| Visibility and relationships | Atlas filters player presentation; OpenRig declares topology edges | Neither establishes per-agent information access through those visual or relational features. |
| Workshop | A bundled team with roles, skills, culture, and startup orientation | A reference for packaging teams; no Atlas integration was established. |

The foundation demonstrated owned work, attributed review, native conversation resume, fresh-session reconstruction and a cold handoff. Discovery followed authored orientation and durable work references; spatial navigation and general domain discovery remain hypotheses. See the [experiment evidence](https://github.com/fsafey/openrig/blob/63db591720e7881ab1b2205d4295bc6ba516295f/docs/reference/foundation/evidence.md).

## Implemented milestone and evidence

Owner-detected correction, 2026-10-18 UTC: the coordinator launched the original representatives in the shared artifacts directory, missing repository-native instruction/skill discovery. That roster is stopped and preserved. Corrected `atlas-integration-repos` seats launch in the Atlas implementation worktree and OpenRig repository; their new identities are explicit replacements. Following the owner's Standalone Search convention, Atlas now owns shared rules in `AGENTS.md`, with `CLAUDE.md` importing it. The fresh Atlas assessment and independent OpenRig review are complete, accepted with coordinator corrections. Those corrections are resolved. See [correction and qualification](integration-team/harness-correction.md).

The original team completed a hash-bound mapping and independent review, using explicit v1/v2 scene context. The corrected roster requalified that work and the implemented slice against repository-native harnesses, using frozen v3 context. The final authored scene and latest product direction were supplied separately as v4; both representatives independently verified its hash and acknowledged their own representation, counterpart and current work references. See [context receipt](integration-team/workspace/context-v4-receipt.md). This is explicit context delivery, not an automatic subscription. Original verdicts remain historical; runtime identity, owned claim, author completion, reviewer acceptance and coordinator/native verification are separate evidence.

Atlas now uses an ordinary editable `.atlasmap`, plain tokens, text and linked-note pins. Object identity and authored fields are separate from their immutable evidence references. The inspector shows historical facts; checkpoint selection does not replace layout. Normal creation, selection, move, duplication, deletion, undo and persistence remain owned by Atlas. See [opening and authoring](recorded-scene.md).

Observed in the isolated review vault: both representations moved, annotation added/edited, undo/redo, duplication preserving external reference, delete/restore, note-pin navigation, illustrated background and original evidence attachment undo/redo, historical checkpoint isolation and exact background/object equality after close/reopen. An ordinary scene passed an annotation/undo smoke check without an evidence inspector. See [native verification](integration-team/native-verification.md). Corrected-roster attachment preserved authored IDs/fields, with exact native undo/redo and close/reopen equality. Compact agent cards expose purpose, harness/model, repository/cwd and supported opening instructions; accepted work cards link to the real artifacts and acceptance evidence. The canonical campaign vault is untouched.

Accepted owner clarification, 2026-10-17: start from Atlas's spatial grammar. A token, scene object or image asset has its own identity, separate from what it refers to. Multiple representations may refer to one agent or resource. Candidate meanings include agents, artifacts, knowledge collections and databases; this milestone does not invent a general domain schema.

Accepted owner addition, 2026-10-17: actual images represent sections of the work. The [illustrated studio](integration-team/studio.md) has an Atlas cartography bench, OpenRig systems bench, shared review table and evidence library. One map image supplies visual places; editable labels and notes supply definitions. The image creates no seats, work or authorization. Native application and explicit agent context consumption are recorded separately from mapping review.

## What we are proposing

**One shared model, read two ways:** people navigate Atlas; agents read the same identities and relationships as structured context and addresses.

| Element | Proposed meaning |
| --- | --- |
| Map or scene | A view into a workspace, project, or knowledge area |
| Place | A named domain with responsibilities, entry context, and routes outward |
| Participant and resident token | A human or persistent agent seat, with its current session and activity shown separately |
| Landmark | An addressed source, decision, example, or lesson with provenance and maturity |
| Route | A named relationship such as ask here, depends on, or hand work here |
| Work marker | An owned question or task, with status and artifact links |
| History | Events and decisions with their rationale |

Prefer stable homes for specialists and travelling work markers. Rigs, maps, pods, and domains need not map one-to-one.

Atlas owns spatial authoring and navigation; OpenRig owns seats, execution and work status; repository/workspace files hold authoritative instructions and knowledge. A future connector could resolve references and deliver explicit context without adding a second governance system. Develop that capability through real scenarios and the smallest demonstrated missing feature.

Ask, Assign, and Handoff have distinct effects; owned work uses OpenRig's durable queue. Board movement and undo do not imply execution or reversal of external work. Knowledge maturity reflects attributed, revisable judgments.

## Open decisions

| Decision | Current leaning |
| --- | --- |
| What defines a domain, and where are places, responsibilities, and routes authored? | Vault-owned structured records referenced by both Atlas and OpenRig |
| Does a gesture arrange the view, change focus, propose work, or assign it? | Explicit action meanings first; spatial gestures can adopt them later |
| Who can act, see each source, and promote knowledge to accepted status? | Domain-specific policy, enforced outside rendering and recorded with attribution |
| How does the connector fit the Atlas fork and existing LLM tooling? | Reuse Atlas's view/store and OpenRig's HTTP/events; packaging remains open |
| How are different project configurations versioned and composed? | Explore a second concrete project, then define the smallest explicit sharing/copying contract. Do not generalize this studio into a mandatory template. |

## Next discussion

Review the editable scene and its evidence inspector. Assess whether authors can shape useful spatial context while understanding the recorded operational facts. A live read-only feed, broader domains, agent consumption of spatial meaning and execution semantics remain separate decisions.

Next recommended scenario: a bounded **Open agent** navigation bridge that resolves a stable seat against current OpenRig state and opens its existing native conversation, or routes to supported recovery without implicitly starting it. Installed 0.6.10 supports opening the team's live terminal view; no verified per-seat Atlas URI exists. See [opening assessment](integration-team/operations.md#open-agent-boundary). Do not build a general agent manager first.

## Delivery boundary

Source implementation `9679d2e114ef4342a639856efbc1cef4c78ee208` passed 59 focused tests, TypeScript, touched-source lint, changelog validation and an isolated-vault production build. Native editing/inspection/reopen and both agents' explicit context consumption are recorded above. Both corrected seats are running idle with no outstanding owned work; their repository roots remain intact.

At PR creation the fork reported no rulesets, no branch protection, no check runs and no Actions runs. Its existing CI provider operator reports **inventory-only**, qualification pending. The PR remains open: auto-merge would bypass the intended missing gate. No CI/provider settings, releases or canonical-vault installation changed. Remote qualification or an explicit owner merge decision remains outstanding.

## References and upkeep

- [Atlas source snapshot](https://github.com/fsafey/atlas-vtt/tree/043df3dccd112093cef0f30a3d1c47f1abd3c348) and [initial feature classification](../atlas-vtt-classification.md).
- [OpenRig source snapshot](https://github.com/mvschwarz/openrig/tree/0915430b0d3f60d5d5d0bf590f3bb57edbcbc954), [context](https://openrig.dev/docs/context), and [edge semantics](https://openrig.dev/specs/edge-types).
- [Rig library](https://openrig.dev/rigs) and [Workshop](https://openrig.dev/rigs/workshop).

Update proposals and the next discussion in place. Date owner decisions under Confirmed direction. Link detailed evidence outward; refresh source claims before implementation.
