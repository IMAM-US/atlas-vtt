# OpenRig repository orientation

Author: `openrig.representative`, written 2026-10-18T02:36Z. Replaces nothing; the original `openrig-orientation.md` (SHA-256 `a0fb18b42ae1710ebe0c5815ff565d35f6af8ee70c835ab6cd615e47c798730e`) belongs to the stopped predecessor seat and is preserved unchanged.

## Identity (observed, managed `rig` 0.6.10 `3001cc43`)

| Fact | Value | Source |
| --- | --- | --- |
| Rig | `atlas-integration-repos` / `01M56CGCH5VW2XDPN1P1KBNANR` | `rig whoami --full --json` |
| Seat (stable node) | `01M56CGNJD6YPXS5STC2QHWVVB`, logical `openrig.representative`, pod `openrig` | same |
| Address | `openrig-representative@atlas-integration-repos` | same |
| OpenRig session record | `01M56CGNKM2Z4XY4CMP3ETZY62`, created 2026-10-18 02:12:40 | read-only `sessions` row for this node |
| Native conversation | Claude Code `c252b956-929e-477f-bb09-636c5fe3d758` (`claude_id`) | whoami `resumeToken`, `rig ps` `resumeCommand` |
| Claim generation | `af902801-91e8-42cb-a802-0464a4d76099` | `queue_items.claimed_by_generation_uuid` on my claimed row |
| Runtime / model | claude-code, `claude-opus-5-5` | `rig ps --nodes` record; identity verdict `verified` via `pane_process` (pane `%1`) |
| Predecessor seat | `01M569MJ4HHP75EEKF6AEWWM98`, `openrig-representative@atlas-integration`, rig `01M569M8QH0BXDNXECRE3KJZMG` | `rig ps --nodes --rig atlas-integration`: `exited`, `recoverable` |
| Counterpart | `atlas-representative@atlas-integration-repos`, node `01M56CGCH9NACF766XDX1TF92N`, session `01M56CGCJNTQ3VX336VQM1ZHWV`; edge `collaborates_with` incoming from Atlas | whoami, `sessions` row |

`previousOccupant` is null and `occupantLifecycle` is `active`: this is a fresh replacement seat, not a resumed predecessor. No native continuity with the predecessor exists or is implied.

## Repository harness

- `pwd`, `git rev-parse --show-toplevel` and managed `cwd` are all `/Users/farieds/Project/openrig`; HEAD `63db5917`, clean tree.
- Instructions: `AGENTS.md` `8e85c75d826eefd76397dffbf1b9f478ed71aab3203c6f4d46c104c0be7bfb61` and `CLAUDE.md` `56a49df6f2ae9ff928df4b52a490473076902d36c4591458cd30ca973ac1d3f0` both equal HEAD. At native launch, `CLAUDE.md` additionally carried generated OpenRig blocks (culture, team culture, OpenRig Start, onboarding 01/02); those were in my launch context and are no longer on disk. Native launch context and current files are therefore distinct.
- Repository skills: `developing-openrig` only, at `.agents/skills/` and `.claude/skills/` (identical, `fba6335a...e00`). Loaded natively via Claude skill projection for architecture and installed-versus-checkout boundaries.
- Installed `skills/queue-handoff` (0.6.10, `d4d7e3e8...7f7b`) read from the path `rig context list` reports, for closure semantics. No other skill bodies loaded; none were needed for this review.
- `docs/reference/foundation/WORKING.md` (`dcbe8dc3...35f6`): its documented limitation that a resumed writer keeps an old claim stamp under a new generation applies to this review.

## Workspace context read

- `README.md` `0ec3181b...19fc` (current; points at `team-repository/`), `workspace/ENTRY.md` `c62c076b...b147`, `workspace/HARNESS-CORRECTION.md` `f956361b...17da`, `workspace/requalification-task.md`.
- `workspace/scene-context-v3.json`, 13468 bytes, `5a51fc299281c7fb77e577e590c9b0d9806d5fd624c790839319a2c276d51f99`. v1 `98075082...8fe` and v2 `4a829750...a88a` hashed to match ENTRY. Supplied context only; no scene subscription.
- `team-repository/` briefs, compared against historical `team/` (differences are the rig name, absolute cwds and the harness-qualification sections).
- `rig context work-install --json` selected `atlas-integration` by rig at `/Users/farieds/Project/atlas-openrig-integration-workspace`; the daemon workspace root `openrig-foundation-workspace` is only the catalog host. No discrepancy.

## Queue discovery

Startup: no owned rows. Successor `qitem-20261018022035-997c3976` arrived at 02:20:35Z (transition 58); both wakes were refused because my pane was at a `selection_prompt` approval. I discovered it, confirmed its source, destination and frozen hash, and claimed it at 02:23:02.509Z (transition 60, `transport:v1`). The daemon also created stuck-sweep row `qitem-recovery-4916a334a60f2a5a` for the undelivered wake. I close it with the review.
