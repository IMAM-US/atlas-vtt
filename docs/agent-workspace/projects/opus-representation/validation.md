# Validation

**Checked:** files and schema only. **Not checked:** native rendering, because Atlas was not run here. The coordinator owns native import into `atlas-agent-workspace-review` and visual checks.

## Version 3: snapshot instructions (03:32Z)

**Defect.** v2's Start here, The fork and README said "Undo returns to now" after restoring a snapshot. That was false: Atlas's native Restore confirmation says changes made since then are lost and cannot be undone. The coordinator observed this and cancelled before restoring.

**Fix in v3** (`57aedcc88cdd95a46a52cc5920a3ae5ce920d04be01744b8655d8aa44302d570`):
- A second named snapshot, **Current table account**: the delivered scene state, with the session keys left out as the snapshot format does.
- **Before the fork (reconstructed 00:51Z)** is kept.
- The instructions now say: save the board as a named snapshot first if you changed anything; restore Before the fork; restore Current table account, or your own snapshot, to return.
- The Ledger's intro names the new snapshot.
- Collection version is 3.
- Authored timestamps were re-measured: 1792380754000 = 03:32:34Z. Before the fork is one second earlier, so the list shows Current table account first.

**Checked on v3:**
- 26 hashes;
- both snapshots sit in the scene's `.snapshots` folder;
- the Current table account state equals the scene state minus session keys;
- no "undo returns" wording remains;
- 59 references and 19 sibling wikilinks resolve;
- no future timestamps, no dashes.

**Payload changes from v2:**
- *Text:* `Start here.md`, `The fork.md`, and the intro sentence of `Ledger.md`.
- *Timestamps only:* the scene, the map JSON and the Before the fork snapshot. Each is identical to v2 once timestamps are masked.
- *Added:* the new snapshot.
- Nothing else changed. Ontology, layout, labels, art and past evidence are unchanged.

**Not exercised here:** native snapshot listing and restore. The coordinator verifies them.

## Version 2: note link portability (03:24Z)

**Defect.** Native import of v1 (`23395ef4…`) showed that the importer relocates notes bundled outside the collection folder to `atlas-vtt/collections/<collection>/notes/`, flattened, and does not rewrite Markdown. So 19 wikilinks of the form `[[Opus Representation/…]]` to 7 notes were unresolved. Token and pin `notePath`s were fine, because the importer rewrites JSON.

**Fix in v2** (`3d02b1946b898c6e5444a2bd747f8ddd36f9197d72a0256c985e755aadfdfaf0`):
- All 13 notes are bundled at `atlas-vtt/collections/Opus Representation/notes/<name>.md`. Under `planImportPaths` (`pathRemap.ts`), files inside the source collection folder keep their relative path.
- Every wikilink is a sibling basename (`[[Ledger]]`), so it still resolves if the collection gets another folder name on import.
- Collection version is 2, so an existing v1 install sees a newer release.
- Authored timestamps were re-measured: 1792380266000 = 03:24:26Z.
- Ontology, layout, cards, observations and art are unchanged.

**Checked on v2:**
- all 25 hashes;
- every `.md` lies under the collection's `notes/`;
- every bundled path is either inside the collection folder or under `atlas-vtt/assets/`, so the importer will not relocate it;
- the 19 wikilinks all resolve to a sibling;
- the 13 note basenames are unique;
- 38 token and pin references resolve;
- no future timestamps, no dashes, no estimated overlaps.

**Unverified expectation for updating v1 to v2 (from reading `importPlan.ts`, not exercised).** v1's notes were installed at the same `notes/` paths under different bundle keys. The update may therefore list those 13 notes as conflicts with unknown origin. Taking the update's version writes v2's text. A fresh import into a vault without v1 has no such conflicts.

## Metadata repair (03:18Z)

The first frozen bundle (`a4a84d7a…`, never imported) carried authored timestamps about 52 minutes in the future: Opus had estimated the epoch base instead of measuring it. All 24 authored timestamps are now one measured time, 1792379899000 (2026-10-19T03:18:19Z). Those timestamps are manifest `exportedAt`, collection `createdAt`/`modifiedAt`/`releasedAt`, asset times, snapshot `createdAt` and drawing timestamps. A re-check found none later than the clock at verification. Asset ids, which embed the old base, filenames, UID, version, observation dates, layout and model are unchanged. Every check below was re-run on the repaired bundle.

## What was checked (2026-10-19, 03:14Z, re-run 03:19Z), against bundle SHA-256 `23395ef4e3607e28663464aabfd78efa7f53f1fa348958c663999d711f014765`

| Check | Result |
| --- | --- |
| The manifest passes the rules of `manifestProblem` (`src/app/services/collectionBundle/bundleFormat.ts`), re-implemented independently: format 4, uid pattern, name, id, version, tags, settings, safe asset ids, known roles, cover listed | pass |
| Every one of the 25 files exists in the zip under `files/` with the manifest's SHA-256, re-read from the zip as `openBundle` does | pass |
| Paths are safe; the snapshot's `.snapshots` segment sits at the only allowed position | pass |
| The unpacked `bundle/manifest.json` is identical to the zip's | pass |
| Scene and snapshot are `{state, version: 4}` with record-shaped `objects` and `tokens` (`isPersistedMapEnvelope`). The snapshot omits the session keys `mapPath`, `camera`, `diceLog` and `lootRoller` | pass |
| 57 references resolve to packed files: every token image and note, every pin note, and every wikilink between the 13 notes | pass |
| No em or en dashes in notes, scene or JSON | pass |
| Estimated text-card and token boxes, using character-width approximations, do not overlap and stay inside 1536x1024, in both the scene and the snapshot | pass (an estimate, not a render) |
| Board hash equals the partner's report (`37a74f9a…`). Dimensions were read from the PNG headers: board 1536x1024, tokens 1254x1254 | pass |

## Known limits

- **Text sizes and fonts** (Georgia and Menlo at 11 to 14 px on a 1536 px board) were chosen by estimate. Legibility at normal zoom needs the native view.
- **Tokens** are `character` tokens with a `notePath` and no HP. Nameplates are on; instance badges are off so the second Opus token shows no "2".
- **The clock widget** is scene-scoped and also listed in the collection's widget library. Its value is 1 of 4 in the scene and 0 in the snapshot.
- **The bundle is about 26 MB,** because the board and tokens are the partner's full-size PNGs, unconverted.
- **Observed cards are captures.** The representation quest card says "in progress at 03:11Z" and will be stale by the time anyone reads it. That is deliberate and explained in the notes.
