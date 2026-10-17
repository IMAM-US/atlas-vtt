# Atlas agent workspace working document

Updated: 2026-10-17. Status: exploration. Documentation only; implementation has not been authorized.

## Confirmed direction

The owner selected a **general agent workspace, with Atlas as the spatial language**. OpenRig is a core part of this direction. Domain agents coordinate with one another and with people through the LLM connector space.

The supplied transcript's guiding idea is orientation before search: an arriving agent discovers what already exists, where knowledge lives, and whom to ask.

## What exists

Source findings from 2026-10-17: Atlas `043df3d`, OpenRig `0915430b`. Live integration remains untested.

| Component | Existing capability | Boundary |
| --- | --- | --- |
| Atlas | Scenes, positioned tokens, note links, view stores, persistence, and undo | No agent connector or domain ownership semantics were found. Token movement changes scene state. |
| OpenRig | Persistent seats, changing sessions, addressed context, owned work, handoffs, and events | Its HTTP interfaces expose more coordination capabilities than its current MCP tools. |
| Visibility and relationships | Atlas filters player presentation; OpenRig declares topology edges | Neither establishes per-agent information access through those visual or relational features. |
| Workshop | A bundled team with roles, skills, culture, and startup orientation | A reference for packaging teams; no Atlas integration was established. |

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

Atlas would own presentation; OpenRig would own seats, execution, and work status; vault files would hold knowledge. The connector binds references and translates actions and events. The domain map needs one authoritative representation.

Ask, Assign, and Handoff have distinct effects; owned work uses OpenRig's durable queue. Board movement and undo do not imply execution or reversal of external work. Knowledge maturity reflects attributed, revisable judgments.

## Open decisions

| Decision | Current leaning |
| --- | --- |
| What defines a domain, and where are places, responsibilities, and routes authored? | Vault-owned structured records referenced by both Atlas and OpenRig |
| Does a gesture arrange the view, change focus, propose work, or assign it? | Explicit action meanings first; spatial gestures can adopt them later |
| Who can act, see each source, and promote knowledge to accepted status? | Domain-specific policy, enforced outside rendering and recorded with attribution |
| How does the connector fit the Atlas fork and existing LLM tooling? | Reuse Atlas's view/store and OpenRig's HTTP/events; packaging remains open |

## Next discussion

Choose one journey and define its places and gestures. Candidate: research becomes a learning brief through Research, Learning Design, and Assessment.

A later experiment would test whether the map helps people identify ownership, evidence, and next action, and whether a cold or restarted agent finds an existing solution and relevant specialist without exact file pointers. Spatial orientation remains a hypothesis; no experiment is authorized yet.

## References and upkeep

- [Atlas source snapshot](https://github.com/fsafey/atlas-vtt/tree/043df3dccd112093cef0f30a3d1c47f1abd3c348) and [initial feature classification](../atlas-vtt-classification.md).
- [OpenRig source snapshot](https://github.com/mvschwarz/openrig/tree/0915430b0d3f60d5d5d0bf590f3bb57edbcbc954), [context](https://openrig.dev/docs/context), and [edge semantics](https://openrig.dev/specs/edge-types).
- [Rig library](https://openrig.dev/rigs) and [Workshop](https://openrig.dev/rigs/workshop).

Update proposals and the next discussion in place. Date owner decisions under Confirmed direction. Link detailed evidence outward; refresh source claims before implementation.
