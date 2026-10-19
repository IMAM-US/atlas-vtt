# Atlas and OpenRig: independent integration plan

Owner request, 2026-10-18 America/Guayaquil: map OpenRig's core capabilities to existing Atlas features, identify the gaps, and prepare a concrete integration plan that preserves the freedom of OpenRig, Codex and Claude Code. Do not implement yet. Produce independent Astra and Opus 5.5 attempts through OpenRig, then let the external coordinator compare and synthesize them. The owner must be able to read both attempts.

## Outcome

Atlas should make OpenRig's utility accessible through its existing editable spatial features. OpenRig and the native Codex/Claude Code harnesses are dynamic. The earlier recorded demonstration's exclusions are milestone boundaries, not permanent product limitations. The final integration must support native work and evolving teams outside Atlas, with Atlas able to discover/reconcile that state. Atlas can contribute navigable shared context and real supported operations, without introducing a competing execution engine, task ledger, mandatory workflow, or universal project layout.

The owner crafts maps, imagery, names and arrangement. Preserve that authorship. Existing role homes and note-backed routes matter. Distinguish representation, resource, persistent seat, occupant/session, task, artifact and project identity. Multiple representations and scenes can refer to the same resource. Preserve native subagent freedom without requiring every temporary helper to become an OpenRig seat.

## Sources and evidence boundaries

- Atlas source and planning worktree: /Users/farieds/Project/atlas-openrig-integration-plan, baseline origin/main 54e43d5. Read AGENTS.md, docs/agent-workspace/WORKING.md, vault-and-roles.md, recorded-scene.md, and relevant implementation seams. Inspect actual code; do not infer an API from a desired UX.
- OpenRig checkout: /Users/farieds/Project/openrig. Read its AGENTS.md and relevant source/reference docs read-only.
- Installed instance: OpenRig 0.6.10 build 3001cc43 on port 18764, managed by ~/.local/bin/rig-foundation outside managed seats. Inside your seat, use rig with its existing environment. The checkout is distinct from the installed package at /Users/farieds/.local/share/openrig/0.6.10/lib/node_modules/@openrig/cli. Source findings, installed-route inspection, live observations and documented proposals are separate evidence classes.
- Current first-party docs: https://openrig.dev/features, https://openrig.dev/docs/context, https://openrig.dev/specs/edge-types, https://openrig.dev/blog/how-my-agent-teams-find-their-way. Use current official references if helpful, label version limitations. Do not operate a browser UI.
- Existing canonical integration team and private artifacts: /Users/farieds/Project/atlas-openrig-integration-workspace. Historical snapshots are not live feeds. Do not read or modify unrelated teams or obligations. Do not modify native Atlas vault/scene persistence.

## Deliverable

Write your owned Markdown document as a complete proposal. Target roughly 1500-2500 words, using tables where they clarify the capability mapping. Include:

1. A clear recommended product and architecture fit, with a realistic user journey through Atlas and native agents.
2. A capability matrix: core OpenRig capability, existing Atlas feature/seam, present support, actual missing bridge, authoritative owner, and whether it needs a first-class Atlas control or native access. Cover at least dynamic roster/grow/adopt/remove, stable seats and changing sessions, mixed harness/model configurations and native tools/subagents, messaging/ask/broadcast, owned queue/handoff, workflows and their optionality, addressed context/skills/plugins/role homes, continuity/fork/recovery, live events/reconciliation/history, artifacts/provenance, multi-host/project reuse, and permissions/attention. Cover Atlas selection/inspectors, tokens, notes/pins, scenes/collections, authored maps, stores/persistence/undo, and existing command scope.
3. A minimal integration architecture that stays extensible without inventing complete machine-readable capability discovery or making MCP's current subset the ceiling. State what is verified vs proposed. Cover transport, capability/version detection, unknown extensions, current-state reconciliation, command results, identity resolution, offline/stale behavior and preserving native paths. State whether a new agent primitive is warranted.
4. A concrete phased plan with deliverables, dependencies, source seams, and behavior-based acceptance evidence. Include positive use cases and failures likely to create unwanted limitations. Phases are implementation proposals, not authorization to implement them now.
5. The consequential open decisions and recommendations. Separate actual upstream gaps from local adapter/UI gaps and from chosen scope. Avoid a speculative giant framework or a hard-coded two-person studio. Treat safety semantics such as board undo not reversing an external action as clarity, not justification for permanent read-only status.
6. Explicit assumptions, source paths/anchors or URLs, and remaining uncertainties. No em dashes or en dashes.

Only your designated attempt file is writable in the repository. Keep it independent; do not inspect the other attempt. The external coordinator will inspect both, record agreements/disagreements, and update the concise WORKING.md with links to the complete synthesis and both untouched attempts. Do not update WORKING.md yourself.
