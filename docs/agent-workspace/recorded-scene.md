# Editable recorded agent workspace

Milestone 1 provides a normal editable Atlas scene for the actual Atlas/OpenRig integration team. The earlier foundation and predecessor integration roster remain historical evidence. The scene is authored locally; operational evidence is explicitly captured, not live. The [repository-harness correction](integration-team/harness-correction.md) records why the current roster has new identities.

## Open and author

Run **Atlas VTT: Open Atlas OpenRig integration workspace** to create or reopen the integration team scene and its three ordinary linked orientation notes. The two seat tokens reference the real persistent roster. An existing scene is never reseeded. For the earlier foundation, run **Atlas VTT: Open recorded agent workspace** from Obsidian's command palette. It creates **OpenRig foundation workspace** in the default Atlas collection on first use. Later calls reopen that scene, including after native rename or move, without reseeding authored content.

- Use Atlas's Move/Select tool to arrange the two plain seat tokens, their text labels, and work/artifact text cards.
- Use Text Tool to add annotations. Right-click a text object and choose **Edit Text** to revise it.
- Use normal Atlas Undo and Redo for spatial/content edits. Atlas automatically saves the scene and flushes pending changes on close; reopen it with the same command or scene browser.
- Select an agent token for a compact card with purpose, harness/model, repository and actual working directory. Source, project brief and **Open agent instructions** are links; direct native-agent opening is not connected. Expand recorded operations for identity and continuity.
- Select a work or artifact card to inspect recorded ownership, continuity and acceptance. Accepted work artifacts link to their real, pinned files. The collapsible **Recorded evidence** panel also lists the references remaining in this scene.
- Browse historical checkpoints in the inspector. Checkpoint changes preserve authored placement, text and native selection. A selected object absent from that historical checkpoint explicitly says it was not recorded then.

Each recording opens at its latest captured checkpoint. Checkpoint browsing is temporary view state and resets on reopen. Undo history is local to the open scene; saved object changes survive reopening. The [illustrated studio](integration-team/studio.md) is a normal reusable map image; existing scenes can apply it with **Add integration studio artwork**, preserving objects and native background undo.

## Integration and authority

`createOrOpenRecordedScene` uses the native AssetService collection/index transaction and `.atlasmap` format. The normal `AtlasView`, per-view store, renderer, object actions, persistence and undo own the scene. There is no second canvas or alternate command-routing identity.

The seats use plain `Token` objects, not character mechanics. Their labels are normal independent text objects; select both to move token and label together. Tactical instance badges are disabled in this starter scene.

Seat tokens and referenced text objects carry a small `recordingReference`: recording ID, pinned source revision, entity kind and stable entity ID. These references persist with the normal objects and survive moves, label edits, copy and undo. Duplication assigns a new Atlas object ID while preserving the resource reference; deleting a representation removes only that scene object, and undo restores it. They contain no sessions, claims, transitions or acceptance decisions. The bundled recording editions own those immutable historical facts; the inspector resolves references into it rather than reading authored names as operational truth.

The scene asset's seed marker finds the starter workspace after rename/move, including explicitly recognized predecessor editions. New scenes seed the repository-grounded roster. Existing scenes reopen unchanged. Deleting every referenced object removes the inspector until a referenced object is restored through undo. Ordinary object duplication produces another local representation; it does not create seats or work. No complete domain or relationship schema is established here.

A human may change placement, labels, annotations and other supported Atlas content. These are authored spatial state with room for future meaning. They do not currently assign work, move an agent operationally, authorize access, or reverse execution. Checkpoint browsing only changes evidence shown by the inspector.

There is no OpenRig client, endpoint, credential, polling, event subscription, launch command or operational action control in this implementation. Evidence links open pinned public source documents only when followed. Those documents cover the full experiment and may discuss later events than the selected checkpoint.

The explicit **Attach completed integration evidence** command upgrades references from the initial integration capture to the completed immutable edition in the active integration scene. It preserves object IDs and authored fields, adds the missing review work card, and is one normal undo transaction. It performs no network operation. The initial edition remains available when that edit is undone. The asset marker records the seed edition; each object reference identifies its currently attached evidence edition.

The separate **Attach repository team evidence** command deliberately replaces known predecessor seat references with the corrected repository-roster identities. It uses an explicit ID mapping, preserves duplicate representations and authored fields, retains historical work/artifact references and adds current owned-work cards. This is one native undo transaction. It does not create or operate an agent. The coordinator arranges new cards with normal Atlas controls and explicitly updates existing orientation notes; reopening does neither automatically.

## Provenance

The real-team record and exact collaboration artifacts are documented in [integration-team/evidence.md](integration-team/evidence.md). Context was supplied explicitly as versioned snapshots and native edits were coordinator-mediated. The foundation recording is curated from [foundation evidence at `63db5917`](https://github.com/fsafey/openrig/blob/63db591720e7881ab1b2205d4295bc6ba516295f/docs/reference/foundation/evidence.md). The experiments ran OpenRig 0.6.10, installed build `3001cc43`; the documentation commit is a separate identity.

Stable seat/node, native conversation, OpenRig session, occupant generation and claim generation remain distinct. Unknown lifecycle or transitions remain unknown. The [publication manifest](https://github.com/fsafey/openrig/blob/63db591720e7881ab1b2205d4295bc6ba516295f/docs/reference/foundation/artifacts/manifest.json) separates accepted private originals from sanitized published copies. Original and publication digests are labeled separately; reviewer and coordinator acceptance link to separate records.

The exact initially supplied integration JSON remains archived in `integration-team/workspace/integration-orientation-supplied.json`. Its public orientation edition clarifies declared-model wording and points to published evidence; historical checkpoint facts are unchanged. The supplied byte digest and public edition digest must not be conflated.

## Verification boundary

Focused tests exercise native object movement, annotation editing, undo/redo, disk serialization and fresh-store hydration, retaining all references and immutable recording facts. Creation tests cover reuse, renamed/moved files, collisions, concurrent commands and registration failure. Inspector tests cover provenance resolution, checkpoint isolation and historical evidence/acceptance boundaries.

TypeScript, touched-source lint and `build:ci` qualify the bundle without automatically installing into the canonical campaign vault. Native editing and inspection are verified in the isolated `atlas-agent-workspace-review` vault. Current results and remaining owner decisions belong in [WORKING.md](WORKING.md).

## Project configuration boundary

This named integration studio is one project-specific fixture. Its convenience command creates or reopens that fixture once per vault; it is not a global Atlas project registry. Ordinary Atlas scenes and objects remain available for different arrangements. A new project can use different repositories, agents, notes and experiments. A new Codex session may configure it without becoming its durable identity.

Versioned, reusable project pieces are the accepted direction. Cross-project reuse must explicitly distinguish another representation of a shared resource from a copied artifact or configuration. This milestone establishes stable local-object/external-reference separation; it does not implement project manifests, composition rules, import tooling or live resource resolution.
