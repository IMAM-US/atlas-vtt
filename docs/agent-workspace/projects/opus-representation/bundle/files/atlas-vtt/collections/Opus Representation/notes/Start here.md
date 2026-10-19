# Opus Representation

This project represents the revised model of the Opus 5.5 planner (`planning-opus@atlas-integration-repos`), from `docs/agent-workspace/integration-planning/2026-10-18/ontology-opus-5.5.md` in the integration repository. It is one of two independent representations. It is not a synthesis.

## The idea

**The board is the table's account of the campaign; the truth lives elsewhere.**
- Native tools (OpenRig, Codex, Claude Code, git) decide what exists and what happened.
- The owner, as game master, decides what it means.
- The board shows both, and every mark says which of the two it is.

Three rules:
1. A label attaches to the most durable layer it is true of: calling, persona, seat, occupant, conversation, quest or relic.
2. Every mark carries its source and standing.
3. Every relation has one authority. Moving a token changes this scene and nothing else.

Opus authored the declarations in this project for the owner to keep, rename or overrule. Nothing here assigns work, launches an agent or reads live state.

## How to read the marks

| Plate | Basis |
| --- | --- |
| Parchment | **Declared**: meaning an author chose (here, Opus on the owner's behalf) |
| Slate, with a time and a command | **Observed**: captured from a native source at that time. It is not live, so treat it as stale once the time has passed |
| Plum, in quotation marks | **Reported**: what someone said about themselves or their work |
| Teal | **Proposed**: an interaction Atlas does not have today; the card names the native route that works now |
| Faded | **Stale or history** |
| Two plates side by side | **Contested**: accounts that disagree, kept until someone with authority settles them |

Every card carries a number. [[Ledger|The ledger]] (the open journal on the table) lists each number with what it is about, who says it, on what basis and as of when.

## The journey

1. **Choose a colleague.** Select a token. Its nameplate is the persona's name, which is declared. Open the token's note for its sheet.
2. **See its native identity.** The sheet separates calling, persona, seat, occupant and conversation, with a binding history.
3. **Give or follow work.** The [[Quest log|quest board]] holds markers for real queue rows, with the state observed when this project was written. Giving a quest from the board is proposed; today it is `rig queue create`.
4. **Inspect a result.** The [[Relic archive|relic archive]] holds artifacts with hashes. The [[Judgment|Hall of Judgment]] keeps acceptance separate from the author's closure.
5. **Watch the change.** At the abandoned camp, [[The fork|the fork]] shows a colleague surviving the removal of its seat. To see the board as it stood then, use the scene's snapshots:
   - Restoring a snapshot replaces the scene, and Atlas warns that this cannot be undone. If you have changed anything, save the board as a named snapshot first.
   - Restore *Before the fork (reconstructed 00:51Z)*.
   - To return, restore *Current table account*, which ships with this project and holds the board as delivered. Restore your own snapshot instead if you saved one.

[[Places|Places]] says what each part of the map stands for.

## Why the tokens carry no status badges

Atlas conditions are saved in the scene and undone with it. Native state saved there would go stale and come back with undo or a snapshot restore. In the proposed design, observed state is drawn live from OpenRig and never saved. Here, it appears only as dated slate cards.
