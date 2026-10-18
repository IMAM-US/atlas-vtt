---
role_id: atlas-integration.openrig-representative
openrig_seat_id: 01M56CGNJD6YPXS5STC2QHWVVB
openrig_address: openrig-representative@atlas-integration-repos
native_conversation: 4d56e238-74ec-4351-8872-46f96f05ea0b
openrig_generation: 9e681dc2-823a-4e91-ad0a-52fd4e6da790
obligation: atlas-vault-discovery-20261018
---
# OpenRig discovery 2026-10-18

Author: openrig-representative@atlas-integration-repos, Claude Code with claude-opus-5-5, native conversation 4d56e238-74ec-4351-8872-46f96f05ea0b. Written 2026-10-18T17:58Z under owned obligation atlas-vault-discovery-20261018, claimed 17:53:45.584Z (transition 79, provenance transport:v1). Role home: [[Integration workspace/OpenRig representative]].

## Identity as observed

| Identity | Value | Source |
| --- | --- | --- |
| Rig | atlas-integration-repos, 01M56CGCH5VW2XDPN1P1KBNANR | rig whoami --full --json |
| Stable seat | node 01M56CGNJD6YPXS5STC2QHWVVB, openrig.representative, pod openrig 01M56CGCH65DHQ6DZW1RAFGBMX | rig whoami --full --json |
| OpenRig session address | openrig-representative@atlas-integration-repos, tmux pane %2, identity verdict verified from pane process 51099 | rig ps --nodes --full |
| OpenRig occupant generation | 9e681dc2-823a-4e91-ad0a-52fd4e6da790, swapped 17:48:55.409Z; continuity fresh, handover 17:48:57.826Z | rig seat status (lastLaunchArguments.generationUuid) and rig ps activityState.lastSwap, which agree |
| Native conversation | Claude Code 4d56e238-74ec-4351-8872-46f96f05ea0b, launched with that --session-id, model claude-opus-5-5, acceptEdits | rig ps resumeToken and observed launch command; matches this conversation's own transcript ID |
| Repository | cwd and git toplevel /Users/farieds/Project/openrig, HEAD 63db5917 | pwd, git rev-parse |
| Installed runtime | rig 0.6.10 (3001cc43) through the managed seat-bin | rig --version |
| Spec | integration-representative 1.0, agent local:agents/integration, profile openrig | rig whoami --full --json |

The home note's prior conversation c252b956-929e-477f-bb09-636c5fe3d758 belongs to a predecessor occupant, not this one. The OpenRig session record ID, which evidence.md treats as separate from the address, is not exposed by whoami, ps or seat status, so it is not established here.

Counterpart: atlas-representative@atlas-integration-repos, seat 01M56CGCH9NACF766XDX1TF92N, Codex gpt-6.1-sol, running and idle at 17:58Z. whoami shows its incoming collaborates_with edge.

## Supplied versus discovered

- Startup overlay and role brief supplied: identity hint, shared workspace and repository paths, the ENTRY.md pointer, and an instruction to write artifacts/openrig-repository-orientation.md and review/handoff artifacts.
- Queue body supplied: the project entry path, that a new session record is the only author output, and the handoff-and-complete shape.
- Notes supplied: the reading route, this note's path, canonical sources, the harness and skill route, existing representation, the bounded governor request and its owner authorization.
- Live sources established: every identity above, project selection and scene references.

The startup instruction to write artifacts/openrig-repository-orientation.md is stale. That file already holds completed predecessor work, and the obligation and home note supersede it. It was not overwritten, and no workspace artifact was written.

## Harness and skills

- Read AGENTS.md and CLAUDE.md, which loads @AGENTS.md.
- Repository skills: .agents/skills/developing-openrig and .claude/skills/developing-openrig, byte-identical. Loaded developing-openrig for the installed-versus-checkout boundary.
- Installed: listed the 0.6.10 catalog with rig context list and loaded skills/queue-handoff for claim and handoff semantics. Nothing else was needed.
- rig context work-install --json selected project atlas-integration by rig, with projectRoot /Users/farieds/Project/atlas-openrig-integration-workspace and the foundation workspace as daemon root. This matches the startup expectation.

## Context read (SHA-256)

Vault, /Users/farieds/Project/atlas-agent-workspace-review/Integration workspace:
- Start here.md 02993de0b048ad3e463463210f2011b8325d854f866f3e0e8b8cfbf8b0eddf4c
- OpenRig representative.md 0b751c8695b9ae13421d997446f9f6d8e0bee535097c663304f100b135480341
- OpenRig repository.md 97245735d2403cf983dcd07d342cfe7db46e650bfe650907aab188333c00b949
- Atlas representative.md 8db68e09fd5f05b1818e0118b79dff5d6ecd54ab925ad829dcdd5255dd82a28b
- Atlas repository.md f7ccc150ef7269cf2e89dd8a28d4b4f57c1263b0257831c6108cf17ef88203a5
- Decisions/Owner-authored workspace.md d2874ac536ddc7a4fc14e365b112f6e3c44300c22580d344aca2024fbe2064b7

Shared workspace, /Users/farieds/Project/atlas-openrig-integration-workspace:
- README.md 0ec3181b1ac67216b2f918aa78248565c13e6389ba06475ca860dd53f83219fc
- workspace/ENTRY.md d11da46f27af0cf795dc140d74241cf5727be45bea9a2398ca36fac3b5f503e3
- workspace/HARNESS-CORRECTION.md f956361bf8493eea314fcfd9f78e8168666420ab2d3cd45ee24bcd3440f817da
- workspace/PRODUCT-DIRECTION.md 177899c8f7a3bc8721944bd566c64ae6e42ea481c8eb2a2324b5a5c50524e332
- workspace/scene-context-v4.json a9fc52fa3c0dddc3a5d1766f8af04523444b869faa4a7bd4aab7728791eeed00, hashed and matching ENTRY.md, not read in full

OpenRig repository at 63db5917:
- AGENTS.md 8e85c75d826eefd76397dffbf1b9f478ed71aab3203c6f4d46c104c0be7bfb61
- CLAUDE.md on disk fda5fdabe1b7dc412ee5f5aa9881a928c22097fe89321feec378e5819ebf9a3d; committed 56a49df6f2ae9ff928df4b52a490473076902d36c4591458cd30ca973ac1d3f0
- .claude/skills/developing-openrig/SKILL.md fba6335a4e091adb195d90774247bf1ee0e882464bb2ebc3a5d7e77b2d354e00
- docs/reference/foundation/WORKING.md dcbe8dc3cb107028a28a225b23a04939d3ed7e3030db95d54e2412bf2d1c35f6
- docs/reference/foundation/operations.md eb54a5e6b522fbfdb23d0d98ed38567eb77789b33228ba71ac3a16618d0f91f7
- docs/reference/foundation/evidence.md 2831b9d28d1afa63b3b3641345b9232333866b33673bf18609d3ec088af4ea03
- docs/reference/foundation/connector-outline.md 0e0b3e4d39b864087a5c30387e7442bced1cb8b92cc55ed25feefd17dbfefd4a

## Representation

The scene was read only, at SHA-256 d34a95a45565e4d4c7b42a8fd8c9e6a9b895c803e49cc0535e3e5300bb7f00bf. tok_recording_1 and text_recording_seat_1 carry a seat reference to 01M56CGNJD6YPXS5STC2QHWVVB from recording atlas-openrig-repository-team-m1 at source revision 28e9fb5f. pin_integration_openrig opens Integration workspace/OpenRig repository.md, which links the role home. The token refers to the stable seat, not to this conversation or generation.

## Output and next action

This note is the obligation's only author output. The next step is an atomic handoff-and-complete of atlas-vault-discovery-20261018 to atlas-representative@atlas-integration-repos for one bounded governor request: append an attributed discovery receipt to [[Integration workspace/OpenRig representative]] that links this note and records the identities above. The governor's effect and verdict, and coordinator acceptance, are separate from this completion.

## Unresolved

1. The working-tree CLAUDE.md again carries the 271-line OpenRig managed block appended at this launch. HARNESS-CORRECTION.md says these blocks were removed after the previous startup, so relaunch re-adds them. This is coordinator-owned and was left untouched.
2. The startup overlay still names the old artifact outputs. Reusable correction: point it at the role home note's output route.
3. The OpenRig session record ID is not established through the CLI surfaces used.
4. At 17:51:35Z the watchdog's parked-owner wake was refused because this pane was at a native permission prompt (transition 77), and no text was sent. That is correct behavior; ordinary prompts still need operator attention.
