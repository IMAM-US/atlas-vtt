# Continue the integration team

Working area: `/Users/farieds/Project/atlas-openrig-integration-workspace`. Start at `workspace/ENTRY.md`, then the latest explicitly supplied snapshot and the owned queue. Published artifacts here are evidence copies; runtime artifacts and native conversations stay in their original locations.

Use the existing `~/.local/bin/rig-foundation` wrapper. The name identifies the installed instance, not which rig to operate. The active repository-grounded team is `atlas-integration-repos`. The original `atlas-integration` is stopped and preserved after the [launch-harness correction](harness-correction.md); `foundation` is the separate completed experiment.

```sh
rig-foundation ps --nodes --rig atlas-integration-repos --json
rig-foundation seat status atlas-representative@atlas-integration-repos --json
rig-foundation seat status openrig-representative@atlas-integration-repos --json
rig-foundation queue list -a -A --json
rig-foundation terminal open atlas-integration-repos --window --json
```

Inspect current state before lifecycle operations. To stop recoverably, use `rig-foundation down atlas-integration-repos --snapshot --json`. To reopen an existing stopped team, use `rig-foundation up atlas-integration-repos --existing --json`; inspect its plan/snapshot selection if native conversation continuity matters. Explicit pre-stop snapshots are preferable when a specific conversation must be resumed. A seat, native conversation, OpenRig session and occupant generation are different identities.

Original mapping obligations and delivery-recovery rows are closed. The replacement roster has a separate repository-harness requalification chain; inspect the queue for its current status. A terminal message is not a new owned task. Future work needs an explicit bounded obligation and owner. Ordinary approval prompts require inspection and one-time approval; do not select auto mode or persistent permission expansion. Repository launch roots intentionally do not make the separate shared artifact directory a blanket writable root.

The project catalog has its original `default` entry plus project `atlas-integration`, root `/Users/farieds/Project/atlas-openrig-integration-workspace`, `rigs: [atlas-integration, atlas-integration-repos]`. The shipped [project manifest](../team/project.yaml) is installed at that working area's root. Current role briefs are installed in `team-repository/`; `team/` preserves the old roster. Repository cwd and shared context root are different.

The Atlas launch worktree `/Users/farieds/Project/atlas-recorded-agent-scene` is Git-locked because a persistent seat depends on it. Do not remove it while that seat is needed. Installed 0.6.10 cannot migrate a retained seat's cwd; a future move requires an explicit supported replacement or a separately reviewed runtime capability. OpenRig may append managed launch blocks to native guidance files; preserve repository-owned instructions and keep generated runtime additions out of source commits.

Open the isolated vault `/Users/farieds/Project/atlas-agent-workspace-review`, then run **Atlas VTT: Open Atlas OpenRig integration workspace**. This opens the editable scene. The plugin reads bundled historical evidence only. It does not read the daemon, subscribe agents or send scene changes to OpenRig. Supply any new authored context explicitly, with its timestamp, scene/object identities, image/recording digests and next owner.

## Open agent boundary

The product target is a direct agent-opening action from its token. This milestone supplies an agent card with purpose, native harness/model, repository/actual cwd, source and project-brief links, and these opening instructions. It does not implement a native launcher or claim a captured session is current.

The supported installed route is `rig-foundation terminal open atlas-integration-repos --window --json`. It resolves the rig's live members and opens their actual native terminal conversations through OpenRig's existing terminal provider. It opens the team view, not a per-seat Atlas deep link. Inspect `rig-foundation ps --nodes --rig atlas-integration-repos --full --json` first, match the card's stable node ID, and use only the current emitted attach command when targeting an individual conversation. Never construct a native resume URL from a historical conversation ID.

Installed 0.6.10 CLI help and its terminal command/composer source were inspected. `terminal views` lists this rig as openable. The open result distinguishes opened, absent and degraded seats; requesting a view is not evidence that the target agent opened. No terminal window was opened during this assessment. For stopped seats, inspect `seat status` and follow the existing recovery workflow above as a separate explicit operation. Opening a token never starts or restores a seat.

The remaining capability gap is a narrow desktop navigation adapter: resolve stable node against current OpenRig state, select the live native surface, report absence/degradation and route separately to supported recovery. Atlas currently has no such adapter or verified OpenRig/native URI handler. Do not add a fake link, embedded transcript or general connector as a substitute. Live status also requires a reliable current source; all status in this milestone is timestamped recorded evidence.
