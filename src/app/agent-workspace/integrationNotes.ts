import { normalizePath, type App } from 'obsidian';
import { ensureFolder } from '../plugin/vaultFolders';

const notes: Record<string, string> = {
  'Start here': `# Atlas OpenRig integration workspace

This editable scene represents the project building the Atlas/OpenRig integration. It is authored spatial context, not a live operational console.

- [[Atlas repository]]: objects, editing, persistence and undo.
- [[OpenRig repository]]: seats, sessions and owned work.
- Two plain tokens refer to the persistent repository representatives. Duplicating a token creates another representation of the same seat.
- Select a referenced token or text card to inspect recorded identity, work and evidence. Checkpoints change only the inspector.
- Move objects, edit text and add annotations with normal Atlas tools. Save/reopen preserves spatial state; undo affects supported local edits only.

Definitions and orientation: ~/Project/atlas-openrig-integration-workspace/workspace/ENTRY.md
Repository-harness requalification: atlas-repository-requalification-20261018
Historical mapping obligation: atlas-integration-mapping-20261018
Agent-authored proposal and review: ~/Project/atlas-openrig-integration-workspace/artifacts/

Agents receive an explicit, timestamped snapshot exported by the coordinator. They do not subscribe to this scene. Placement and relationships may become useful context later, but have no execution or authorization effect in this milestone.

## Studio places

- Atlas cartography bench: the Atlas repository work area. The nearby seat token refers to atlas-representative@atlas-integration-repos, not to the painted furniture.
- OpenRig repository bench: the OpenRig repository work area, not a live systems-status display. Its nearby token refers to openrig-representative@atlas-integration-repos.
- Shared review table: a place to arrange proposed work and evidence. Each OpenRig work item still has one owner; placement does not assign, submit or accept it.
- Evidence library: a place for linked knowledge and decisions. Putting an artifact here does not verify or accept it.

The image is one reusable map asset. Native scene objects have independent identities; notes and editable labels define places. The earlier mapping review is qitem-20261018013108-c98ecda5. It belongs to the stopped predecessor roster; the current repository team requalifies that work separately. Recorded evidence is explicitly attached, with no live feed or automatic dispatch.
`,
  'Atlas repository': `# Atlas repository

Repository: ~/Project/atlas-vtt
Assigned implementation worktree: ~/Project/atlas-recorded-agent-scene
Representative: atlas-representative@atlas-integration-repos
Stable OpenRig seat: 01M56CGCH9NACF766XDX1TF92N

Owns the fit with existing scene objects, asset-versus-placement identity, linked notes, selection, view lifecycle, persistence and undo. The coordinator owns shared code, scene mediation, native verification and delivery. See [[Start here]].
`,
  'OpenRig repository': `# OpenRig repository

Repository: ~/Project/openrig
Representative: openrig-representative@atlas-integration-repos
Stable OpenRig seat: 01M56CGNJD6YPXS5STC2QHWVVB

Owns accurate seat, native conversation, session, generation, queue, handoff and acceptance semantics. The source checkout and installed 0.6.10 runtime are distinct. Topology and placement do not grant permission. See [[Start here]].
`,
};

/** Create ordinary editable notes once; subsequent opens preserve all authored changes. */
export async function ensureIntegrationNotes(app: App): Promise<void> {
  const directory = 'Integration workspace';
  await ensureFolder(app, directory);
  for (const [name, content] of Object.entries(notes)) {
    const path = normalizePath(`${directory}/${name}.md`);
    if (!app.vault.getAbstractFileByPath(path)) await app.vault.create(path, content);
  }
}
