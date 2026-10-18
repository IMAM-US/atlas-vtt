# Continue the integration team

Working area: `/Users/farieds/Project/atlas-openrig-integration-workspace`. Start at `workspace/ENTRY.md`, then the latest explicitly supplied snapshot and the owned queue. Published artifacts here are evidence copies; runtime artifacts and native conversations stay in their original locations.

Use the existing `~/.local/bin/rig-foundation` wrapper. The name identifies the installed instance, not which rig to operate. Always target `atlas-integration`; do not operate the completed `foundation` team by accident.

```sh
rig-foundation ps --nodes --rig atlas-integration --json
rig-foundation seat status atlas-representative@atlas-integration --json
rig-foundation seat status openrig-representative@atlas-integration --json
rig-foundation queue list -a -A --json
rig-foundation terminal open atlas-integration --window --json
```

Inspect current state before lifecycle operations. To stop recoverably, use `rig-foundation down atlas-integration --snapshot --json`. To reopen an existing stopped team, use `rig-foundation up atlas-integration --existing --json`; inspect its plan/snapshot selection if native conversation continuity matters. Explicit pre-stop snapshots are preferable when a specific conversation must be resumed. A seat, native conversation, OpenRig session and occupant generation are different identities.

Both mapping obligations and delivery-recovery rows were closed at publication. A terminal message is not a new owned task. Future work needs an explicit bounded obligation and owner. Ordinary approval prompts require inspection and one-time approval; do not select auto mode or persistent permission expansion.

The project catalog has its original `default` entry plus `atlas-integration`, root `/Users/farieds/Project/atlas-openrig-integration-workspace`, `rigs: [atlas-integration]`. The shipped [project manifest](../team/project.yaml) is installed at that working area's root. Its relative paths assume the accompanying working-area layout, not this documentation directory.

Open the isolated vault `/Users/farieds/Project/atlas-agent-workspace-review`, then run **Atlas VTT: Open Atlas OpenRig integration workspace**. This opens the editable scene. The plugin reads bundled historical evidence only. It does not read the daemon, subscribe agents or send scene changes to OpenRig. Supply any new authored context explicitly, with its timestamp, scene/object identities, image/recording digests and next owner.
