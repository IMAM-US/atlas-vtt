# Human-authored organizational workspace

Owner clarification, 2026-10-18. Product direction and proposed next experiment; no role, runtime, vault or scene changes are authorized by this document itself.

## Accepted direction

The owner crafts the maps, imagery, names and arrangements. Integration attaches useful identities, references and capabilities to selected existing Atlas objects. It must accommodate that authored space and preserve ordinary human editing. Generated studios and the Reference Observatory are coordinator-authored experiments, not prescribed layouts, vocabularies or evidence that the intended organizational journey is complete. Changing their labels does not resolve the missing abstraction.

Atlas makes a project's organization accessible: real colleagues with responsibilities, skills and context, canonical knowledge, shared purpose and discoverable collaboration. A desk, island, garden or another owner-chosen form can provide that entrance. The project decides which objects mean something and what they mean; every painted object does not require a software entity.

| System | Responsibility |
| --- | --- |
| Atlas | Owner-authored appearance, placement, spatial navigation and supported local edits |
| Vault | Shared project orientation, authored meanings, role/resource entrances, session notes, knowledge and decisions |
| OpenRig | Actual persistent seats, addressed communication, lifecycle, owned obligations, handoffs and operational transitions |
| Codex / Claude Code | Each occupant's actual conversation, repository-native instructions, discovered skills and working tools |
| Repositories / other sources | Canonical code, repository specifications, native session records and external resources at their actual source |

The vault supports orchestration by making responsibilities, context and routes discoverable. It does not add another queue or acceptance system. Project-specific definitions need not follow one universal note template or map arrangement.

## Proposed note-backed entrances

A selected Atlas object can lead to a durable home note for a role, agent, repository, artifact or other meaningful resource. Several local representations may refer to the same note/resource. A role in a project, the seat occupying it, a native conversation, a note and a scene object retain distinct identities. Seat replacement is explicit history, not a silent relabeling.

An agent/role home note would explain its remit and useful capability, identify the actual OpenRig seat and native harness, locate its repository and actual worktree, and link to canonical instructions, relevant skills, project orientation, session notes and work. It should point to repository-owned guidance such as AGENTS.md rather than duplicate it. Metadata should remain small and driven by the first reading journey; no new required frontmatter schema is accepted here.

Keep two session forms distinct:

- Native session records remain at their actual source, with deliberate references or selected excerpts when useful. An old transcript does not open or establish the current occupant.
- Concise authored session/handoff notes identify the role/seat and conversation, obligation, relevant context actually read, decisions, artifacts, unresolved issues and next action. A later session follows the home note to the relevant handoff instead of ingesting every transcript.

Vault project documents organize purpose, vocabulary, responsibilities, decisions and reading routes. They can be canonical for that authored meaning; source code and repository specifications retain their repository authority. Operational summaries identify their source and capture time. Linking or delivering context is separate from observed consumption. Each agent can own its session notes/proposals, with a named consolidator for shared decisions to avoid competing rewrites.

## Proposed Atlas map governor

The owner proposes an actual Atlas-native specialist to maintain the workspace as agents learn. This is an organizational responsibility using existing OpenRig work and the native Atlas harness, not a new governance subsystem. The current Atlas representative may be a suitable occupant for an initial bounded trial; no additional seat or assignment has been created for it.

The proposed initial shape is on request, reporting to the originating agent and coordinator, with authority limited to explicitly delegated maintenance. Ordinary human edits continue directly. Preserve the owner's layout, visual craft, names and intended meaning; an agent's report alone does not delegate their redesign. Ambiguous meaning or structural changes require clarification from the responsible author. Routine reference repairs or scene edits can proceed within an already agreed remit.

An agent's final report can include **workspace implications**: what changed, affected objects/notes, a proposed adjustment, supporting evidence and unresolved questions. The originating agent addresses a real request through OpenRig. The governor reads the current authored workspace and evidence, asks the originating agent for needed clarification, and proposes or applies the bounded change through supported Atlas mechanisms. Its response identifies the affected objects/notes and request, what changed and what remains unresolved.

Three concrete risks shape this proposed role: stale context overwriting human edits, one request causing broad rearrangement, and several agents rewriting the same shared definitions. Start from current content, name the bounded change and keep shared-file responsibility explicit. This document proposes no automation, event subscription, broad write permission or new approval machinery.

## Current implementation gap

Implemented: editable native scenes and objects, note pins, stable recorded references, duplicate/copy identity separation, historical evidence inspection and explicit snapshot delivery to real repository-rooted seats. These remain useful foundations.

Source observed at PR #15's implementation: `NotePin.notePath` supports note entrances; `Character.notePath` exists, while a plain `Token` has no generic home-note field. The recorded inspector's agent links and metadata come from bundled recording records, not role/resource notes. There are no dedicated agent-home/session-note abstractions, verified fresh-session note reading journey, direct Open agent adapter or working map-governor request loop. A generic plain-token note entrance is a candidate narrow extension; using current pins requires no new object model. Do not force agents through character mechanics.

## Proposed next scenario

Use an existing map chosen and arranged by the owner. Attach two actual repository representatives and the project entry point through existing objects/pins and a small number of home notes. Preserve the map's visual composition. Supply this context explicitly and keep each seat rooted in its correct repository harness.

Test whether a fresh session can find its responsibility, relevant skills and instructions, the canonical source, latest accepted decision, counterpart and actual OpenRig obligation without a long coordinator explanation. Then send one real final report with a bounded workspace implication to the delegated Atlas caretaker. Verify clarification and one agreed note/reference or native scene edit, preserving human-authored content and attribution. This is the proposed next experiment, not a completed capability or instruction to start it.

Success is a colleague finding context and moving real work forward in the owner's space. A new illustration, label scheme, collection export or historical dashboard alone does not prove that outcome.
