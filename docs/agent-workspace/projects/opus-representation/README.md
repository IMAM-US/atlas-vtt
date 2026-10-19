# Opus Representation

Opus 5.5's own model, from [ontology-opus-5.5.md](../../integration-planning/2026-10-18/ontology-opus-5.5.md), expressed as a native Atlas collection. It is independent of the other planner's project and of any synthesis.

- **Bundle:** `Opus Representation v3.atlas-collection.zip` (bundle format 4, collection version 3). Superseded v1 and v2 bundles are not delivered; their hashes and history are in `provenance.json`.
- **Entry scene:** *The Table's Account*
- **Entry note:** `atlas-vtt/collections/Opus Representation/notes/Start here.md`, behind the game-master screen pin. All 13 notes sit in that one folder and link to each other as siblings, so links resolve wherever the importer places the collection.

## What to inspect

1. **The table edge.**
   - The game-master screen holds the thesis.
   - The journal is the [ledger](bundle/files/atlas-vtt/collections/Opus%20Representation/notes/Ledger.md) of every numbered mark.
   - The bench is where seats OpenRig reports but nobody has placed would wait.
   - The legend column shows the plate for each basis: declared, observed, reported, proposed, judged, stale, contested.
2. **A colleague.** Select a token, such as the indigo Opus planner at the Planning Pavilion. Its note is a persona sheet that separates calling, persona, seat, occupant and conversation, with a binding history.
3. **Work.** The quest board has three quest cards for real queue rows, each with the state observed when it was written. One is a branch: the image request that Opus gave its Codex partner through the queue.
4. **A result.** The relic archive holds the report and the artwork with their hashes. The Hall of Judgment keeps the owner's seat empty: author closure is not acceptance.
5. **The change.** At the abandoned camp, the persona outlived its seat:
   - The old node is history.
   - The lilac line to the pavilion is the *reported* fork.
   - Next to it, OpenRig's *observed* absence of any recorded continuity contests that report.

   Then use the scene's two named snapshots:
   - Restoring a snapshot replaces the scene, and Atlas says this cannot be undone. Save the board as a named snapshot first if you have changed anything.
   - Restore **Before the fork (reconstructed 00:51Z)**. The planner stands at the camp and the atelier is empty, because the image partner did not exist yet.
   - To return, restore **Current table account**, the board as delivered, or your own snapshot if you saved one.

## Model decisions this demonstrates

- **A persona above the seat.** Both tokens depict one colleague who survived a seat being recreated under the same address. OpenRig recorded no continuity for that. The Atlas and OpenRig representatives show the same pattern across rigs.
- **Labels attach to layers.**
  - Nameplates are persona names (declared).
  - Model and node appear only on dated observed cards.
  - "Done" belongs to a quest card, never to a token.
- **Epistemic standing is visible.** Observations are captures with a time and a command, and some are already stale on purpose. The disagreements are left visible rather than resolved: Astra's three projections, and the reported fork against observed absence.
- **No status in conditions.** The tokens carry no condition badges. Saved native state would come back with undo or a snapshot restore. A live observed channel stays proposed.
- **Placement never acts.** Places are legends (`Places.md`). The two teal cards name actions Atlas does not have, *Open agent* and *Give quest*, along with the native command that works today. They are not drawn as working controls.
- **Native freedom.** The board neither lists nor limits anyone's skills, tools or subagents. The image partner's helpers, if any, would appear only if reported.

## Files

| Path | What |
| --- | --- |
| `bundle/manifest.json`, `bundle/files/…` | Unpacked, editable bundle content. Notes, scene, snapshot and asset JSON are identical to the zip. Images are packed from `artwork/` (mapping in `provenance.json`) |
| `image-requests/board-v1.md` | Opus's image brief |
| `artwork/` | Owned by the Codex image partner: board, tokens, prompts and its own `provenance-v1.json` |
| `provenance.json` | Identities, queue rows, artwork-to-bundle mapping, hashes |
| `validation.md` | What was checked here, and what remains for native import |

Nothing here creates agents, reads live state or changes plugin code. The coordinator owns native import, visual verification and delivery.
