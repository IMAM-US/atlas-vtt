# Reference Observatory

Second project experiment, 2026-10-18 UTC. A human-led reference research space asks: **what can a project reuse without inheriting another project's configuration?** It uses an ordinary Atlas collection and scene with no game system. The integration studio remains the engineering team's workspace.

## Project choices

| Choice | Integration studio | Reference Observatory |
| --- | --- | --- |
| Purpose | Repository collaboration and review | Compare source evidence and explore reuse |
| Arrangement | Two repository benches, shared table, evidence library | Source landing, comparison terrace, observation platform, possible-routes garden |
| Representations | Two real specialist seats and their recorded work | One shared completed review resource plus locally authored questions and note pins |
| Roster | Existing OpenRig integration team | No new seats; coordinator authors this bounded research project |
| Configuration | Existing Default collection and named studio fixture | Separate Reference Observatory collection, no game system, independent background and notes |
| Operational state | Recorded historical evidence | The same historical source, without adopting its work as a new obligation |

The painted places have editable native definitions. Paths are navigation cues. An annotation is a question or authored interpretation, never a new OpenRig work state.

## Shared reference

The coordinator copied the studio's **Repository-grounded independent review** text card through Atlas's normal clipboard and pasted it into the Observatory. It receives a fresh local object ID and retains this exact resource reference:

```json
{
  "recordingId": "atlas-openrig-repository-team-m1",
  "sourceRevision": "28e9fb5f504205e7135a5db4e2f0ced6b768b051",
  "kind": "work",
  "id": "qitem-20261018022035-997c3976"
}
```

This is a shared review-work resource, not a newly assigned task or a copied review document. Its inspector links the accepted [repository mapping review](https://github.com/fsafey/atlas-vtt/blob/28e9fb5f504205e7135a5db4e2f0ced6b768b051/docs/agent-workspace/integration-team/requalification/repository-mapping-review.md), SHA-256 `1bef1e3b8473e5edeb47e8a0d00f36f2533d8050bf8a425aa579925c0b0eec61`. The original acceptance concerns that exact integration assessment; it does not approve this second project's conclusions.

Source placement: `text_1792291563001_v1udjtwcl`. Destination placement: `text_1792294476224_r22zs3n0z`. Source/destination IDs, labels, geometry, scene and collection remain local. No native conversation, seat or work item was created by copying.

## Observations and boundaries

Native copy/paste into a different collection resolved the same recorded review and artifact links without any scene recording seed marker. Independent placement/label edits, undo/redo, note navigation, historical inspection and reopen passed. See [verification](verification.md), [native scene](native-scene.png) and [native inspector](native-inspector.png).

The experiment exposed a concrete coupling defect: the pasted current-review reference enabled the studio artwork command in an unrelated scene. Focused tests also cover predecessor-edition references that previously enabled evidence-replacement commands. The bounded fix requires the native scene asset's recognized integration seed marker as well as matching object references. A resource reference alone does not identify a studio-derived scene.

Copying one representation differs from copying a whole scene. Existing scene-copy and collection-import mechanisms retain seed metadata, so a studio-derived scene copy can still offer studio commands. The seed records fixture ancestry, not a universal project identity. Explicitly forking or removing that ancestry is outside this reference-only experiment; the named studio-opening command also currently chooses the oldest matching seed. Whole-scene composition needs a separate concrete scenario.

The native [v1 collection bundle](Reference%20Observatory%20v1.atlas-collection.zip) preserves the exact reference, independent collection settings, scene, map and two directly linked notes. Its nine file hashes were checked against the export manifest. It contains no recording JSON or source review document. Source inspection explains this boundary: bundles collect linked pin notes and image assets, but do not package the plugin's recording registry or recursively collect every Markdown link. Same-vault reuse and self-contained cross-vault portability are separate capabilities. No general manifest, import framework, agent launcher or live connector is introduced.

## Open and reuse

In the isolated `atlas-agent-workspace-review` vault, open Atlas's scene library, select the **Reference Observatory** collection, then open the **Reference Observatory** scene. Its native path is `atlas-vtt/collections/Reference Observatory/scenes/Reference Observatory.atlasmap`. Open the central note pin for the brief and the upper-right pin for definitions.

The v1 bundle is the existing Atlas collection release format. Import through the native **Import collection** flow when a separate installation is wanted. This export was inspected, not installed into a second vault. The destination build must contain recording `atlas-openrig-repository-team-m1` at `28e9fb5f504205e7135a5db4e2f0ced6b768b051` for the recorded inspector to resolve it. No daemon, runtime database or live agent is included. The unpacked [scene snapshot](Reference-Observatory.atlasmap), note sources and [provenance](provenance.json) are preserved for review; a raw scene file alone does not carry its image/notes dependencies.

## Rules earned by this experiment

1. Configure each project through its own collection, scene, orientation and authored content. A new coordination conversation may set it up; the conversation is not the project identity.
2. Copying a representation creates local identity and layout, preserving the pinned resource reference. Sharing a resource does not copy its bytes or its original operational ownership into the new project.
3. Reusing one reference does not inherit the source project's roster, settings, artwork or commands.
4. Keep source revision and acceptance scope visible. Referencing a source is not accepting a new interpretation of it.
5. Describe dependencies explicitly when exporting. A reference alone does not make its source available in another vault or plugin build.

These are findings from two examples, not a universal project schema. Next owner decision: whether the next useful scenario requires portable evidence dependencies, a reusable starting configuration, or agent navigation. Choose a concrete scenario before adding a general framework.
