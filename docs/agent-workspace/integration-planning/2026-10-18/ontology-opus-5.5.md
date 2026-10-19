# Shared ontology for Atlas and OpenRig: Opus 5.5 revised attempt

Independent design review, written 2026-10-19 UTC, after native compaction. This seat is a native fork of the conversation that wrote [the original attempt](opus-5.5.md), which is unchanged. It is not an exact resume and not a reconstruction from artifacts. Documentation only: nothing here is implemented or authorized. I did not read the other planner's work or any synthesis. The external coordinator owns comparison and delivery.

Evidence classes: **[A]** Atlas source and docs at `f5dfe51` (source identical to `54e43d5`), **[S]** OpenRig checkout `63db5917`, **[I]** installed OpenRig 0.6.10 build `3001cc43` (CLI and packaged skills), **[L]** live read-only observation on 2026-10-19 between 01:30Z and 02:10Z, **[P]** proposal. A **metaphor** is named as one; it is not a feature claim.

## Recommendation

Treat an Atlas board as the table's shared account of a campaign. It is not a dashboard of OpenRig objects. Seats, conversations, tokens and maps all change. What stays the same, in a tabletop game and in agent work alike, is a short list of continuing things: **who** (colleagues, with their callings), **what for** (undertakings), **what came of it** (artifacts) and **where** (domains and places). It also includes the **relations** between them, and **who knows what about them, and how**.

Native tools decide what exists and what happened. The owner, playing the game master, decides what it means. Atlas depicts both and makes every mark say which of the two it is.

Three rules carry the design:

1. **Attach every label to the most durable layer it is true of.** A name the owner chose belongs to the colleague. A model name belongs to the current occupant. "Blocked" belongs to the queue row. A label on the wrong layer is how a board starts to lie after the first handover.
2. **Every mark carries its source and standing.** Each one is observed, declared, reported, inferred or judged, and is current, stale, contested or settled. OpenRig already records much of this (`evidenceSource`, `sampledAt`, `fresh`, `claimed:v1`, two-outcome continuity). Atlas must not flatten it into a coloured badge.
3. **Each relation has exactly one authority, and spatial arrangement acts on nothing.** Placement, grouping and regions mean what a legend the owner wrote says they mean. They never dispatch, assign or authorize. Actions run native verbs against native identities, never against display labels.

The tabletop/RPG system is the right vocabulary because it already solves this problem every game night. Characters outlive tokens and players. Summoned creatures come and go. Parties split across scenes. The map is partial and differs for each viewer. The game master's notes, the players' journals and rumours carry different weight. Atlas already has most of the forms: character tokens linked to notes, statblocks, encounters, player groups, conditions, clocks, initiative, fog, GM-only state, player view, scene links and snapshots. What is missing is small. Each mark needs to know whose account it is. A colleague needs to survive a change of seat. Observed state needs a channel that is never saved into the scene.

## 1. What my first attempt got wrong

My [original attempt](opus-5.5.md#1-recommendation) got the plumbing right: references, not copies; one read model outside the scene and undo history; actions only through `rig <verb> --json`. Its ontology was too thin in four ways.

| Earlier assumption | Why it fails the user's aim | Revision |
| --- | --- | --- |
| A token's reference points at a seat `nodeId`, and the seat is the anchor of identity | This seat is the counterexample. The original node `01M58RZHEH0Y8MRPHNXPSGRFQJ` was removed, and the fork now runs as node `01M58W9VEETETHXK9HSPXDZMJC` under the same address. `rig seat status` reports `continuity_outcome: null`, `previous_occupant: null`, `occupant_lifecycle: unknown` [L]. Binding by node shows the owner's planner as removed and the continuation as a stranger. Atlas already needed an explicit predecessor-to-successor ID mapping command when the Atlas representative moved rigs [A] | The colleague the owner recognizes (a **persona**) sits above the seat and holds a binding history. Usually one persona has exactly one seat, and the persona adds nothing. It earns its place only when continuity crosses seats |
| "No character mechanics"; plain tokens only | That kept the board from using the RPG system, which is what the owner wants merged | Use the mechanics as **display and play surfaces** with explicit epistemic standing. Never use them as storage for native facts |
| Labeling = stable reference + display name + live status | It had no layer, no source and no standing, so nothing stopped "Opus" or "blocked" from going stale silently | A label is an account about a referent at a layer, with source, basis and standing (section 4) |
| The map is owner-authored; agents read it through exports | That freezes the board against the very dynamism the owner described | Any actor may author representations under delegation, with provenance, and the owner can contest them. Native truth is never authored on the board |

My original attempt also left native subagents out of scope and treated drawn relationships as meaningless. Both become **summons** and **legends** below. They are optional, but they have a defined meaning.

## 2. The shared model

### 2.1 Four continuing things

| Thing | Layers (most to least durable) | Native authority [S][I] | RPG form |
| --- | --- | --- | --- |
| **Actor** (who) | *calling* (kind of contribution) → *persona* (a recognized colleague) → *seat* (OpenRig's stable position and address) → *occupant* (the agent now sitting there: runtime, model, generation) → *conversation* (native session). Plus *summons*: transient helpers owned by an actor | AgentSpec and profile for calling; seat node, occupant generation and handover ledger for seat and occupant; harness for conversation and subagents | class or statblock → character → (seat at the table) → player → (that night's play) ; summoned creature |
| **Undertaking** (what for) | owner intent → mission or slice → queue row(s), linked by handoffs | queue rows, transitions and `chainOfRecord`; workspace missions and slices | quest, with giver, holder and stages |
| **Artifact** (what came of it) | file, commit or note, identified by path plus hash; verdicts about it are accounts, not part of the artifact | repository or vault; queue closure notes | relic or recovered item |
| **Place** (where) | *native domain* (host, repository or worktree, pod as a context domain) and *board place* (region, hex, bench, scene) | OpenRig topology and `cwd`; Atlas scenes | location, region, dungeon level |

Pods are context domains, not workflow groups. Edges describe coordination shape, not hierarchy [I]. That keeps "party" and "pod" apart (section 3).

### 2.2 Representations

A representation is anything that depicts a referent in a scene: a token, nameplate, pin, text card, region, initiative entry, widget or inspector card. It may depict one referent, several (a group token) or none (decoration). It belongs to the scene's author. Copying, moving or deleting it never changes the referent. Atlas already keeps object identity separate from the referenced resource on copy and undo [A].

### 2.3 Accounts

An account is a statement about referents: a name, a kind, a state or a relation. It carries:

- **source**: who says it. That is a native authority, the owner, a named delegated seat, an agent about itself, or an Atlas rule.
- **basis**: how they know it:
  - *observed* from a native projection, with its evidence source;
  - *declared* by an author;
  - *reported* by an agent through a native channel;
  - *inferred* by a stated rule;
  - *judged* by someone with standing, citing evidence.
- **as of**: when it was true.
- **standing**: current, stale, superseded, contested or settled. A settled account keeps the losing account as history.

This is the epistemology. It is not a new store. Observed accounts are re-derived and never saved into scenes. Declared accounts live where their author keeps them: the scene for placement, the vault for meaning. Reported and judged accounts stay at their native or vault source and are referenced from the board.

### 2.4 Relations and their single authority (topology)

| Relation | Example | Authority | Basis on the board |
| --- | --- | --- | --- |
| depicts | token → persona | scene author | declared |
| is bound to | persona → seat node, with dates | owner (home note); OpenRig where it records lineage | declared, and observed where recorded |
| continues | occupant B ← occupant A (resumed, forked, rebuilt, fresh; compacted is not a new occupant) | OpenRig handover ledger and continuity outcome | observed; otherwise reported |
| spawned | summons ← actor | harness (not exposed through OpenRig) | reported |
| member of | seat → pod or rig; token → player group | OpenRig; owner for groups | observed; declared |
| holds or gave | seat ↔ queue row | OpenRig queue | observed |
| produced | row or seat → artifact | queue closure note, git | reported, then verifiable |
| judged | reviewer or owner → artifact or row | whoever holds review or acceptance | judged |
| located in | seat → cwd or host; token → board place | OpenRig; scene author plus legend | observed; declared |

```
 native authorities (OpenRig, harness, git)        owner and delegates (vault, scenes)
   seat, occupant, row, artifact, domain             persona, calling, place legend, names
              |  observed / reported                       |  declared / judged
              v                                            v
           ---------------- accounts (source, basis, as of, standing) ----------------
                                         |
                                         v
                 representations in scenes (tokens, pins, cards, regions, widgets)
                 depict referents; display accounts; never become them
```

Each kind of topology changes at its own rate and has its own owner: seat membership, queue custody, lineage, authored arrangement. The board may show them together. It must never turn one into another: adjacency on the map does not create a collaboration edge, and a delegation edge does not imply a desk.

## 3. RPG correspondences and false equivalences

Each row says where the correspondence holds and where it would mislead.

| Agent work | RPG form, and what Atlas has today [A] | Holds because | Breaks where |
| --- | --- | --- | --- |
| Calling | Class or statblock. Statblock notes are resolved by `CreatureIndex`; the asset manager filters characters by statblock fields | type versus instance; one spec, many seats | A statblock lists fixed abilities. An agent's skills and tools are discovered natively and change. A statblock must never read as the ceiling of what the agent can do |
| Persona | Character, with its sheet: home note through `Character.notePath` | identity outlives tokens and players | an RPG character is played by a human. Here the occupant is an agent acting on its own |
| Occupant | Player at the seat. No Atlas field; `Character.playerId` means a human player's character and must not be reused | replaceable controller | compaction has no tabletop analogue: the same player continues with a partial memory |
| Summons | Summoned creature or familiar: encounter spawn and `instanceNumber` | transient, belongs to its summoner | native subagents are not observable through any OpenRig surface checked |
| Team | Player group (`PlayerAsset`) | an authored grouping for a purpose | a pod is a context domain declared in a rig spec, not a party. Edges are not ranks |
| Formation | Encounter: token states plus formation, restored verbatim on spawn | reusable arrangement | spawning tokens never launches seats. A rig spec or starter is the native equivalent |
| Undertaking | Quest. Atlas has no quest object, only text cards and `RecordingReference` kind `work` | giver, holder, stages, outcome | a quest log must never become a second queue |
| Artifact | Relic. The loot roller is random generation and does not apply | the thing brought back | its acceptance is a separate judgment |
| Place | Region, linked hex, pin or scene link. Scene links never cross collections | meaning attached to space | a board place is not a native location until a legend says what it stands for, and then it is still not an action |
| Observed state | Condition badges and resource bars. Conditions are saved per token and undo-tracked | a quick visual vocabulary | native state is sampled and goes stale. Saved into a token, it would be resurrected by undo |
| Progress | Progress clock, filled by the GM by hand | the owner's own judgment of how far a quest has come | OpenRig has no progress fraction; a clock stays declared |
| Attention | Initiative tracker. Entries are keyed to tokens, with an active turn | the owner's attention is the one real turn order | agents run concurrently and do not take turns. Initiative must not imply execution order |
| Perspective | GM-only pins, hidden tokens, player view, fog and vision | what each viewer knows differs | fog hides space. An agent's knowledge is the context it actually consumed, which is separate from what was delivered [A] |
| History | Scene snapshot (named state, excludes session keys); recording checkpoints | the board at a moment | it restores representations only. "Snapshot" also names OpenRig's rig snapshot, a different thing |

Word collisions to label explicitly: *session* (game night, OpenRig session, native conversation), *snapshot* (scene versus rig), *character* (RPG persona versus Atlas's `Character` token type, which is a representation), *player* (human at the table versus occupant).

## 4. Labeling, concretely

### 4.1 Anatomy of a mark

A mark is any visible label: nameplate, badge, bar, clock, card field, region name, colour. It shows one account:

- which referent and layer it is **about**;
- what it **says**;
- **source** and **basis**;
- **as of**;
- **standing**.

Proposed visual grammar [P], to settle in design:

| Basis or standing | Shown as |
| --- | --- |
| observed | solid, with its age on hover |
| declared | the owner's plain style |
| reported | marked as a quotation |
| inferred | dashed |
| contested | a split badge showing both accounts |
| stale | faded, with "as of" |

The point is that a viewer can tell which kind a mark is at a glance, without opening an inspector.

### 4.2 Layer attachment, using this seat as the example [L]

| Mark | Attaches to | Source, basis | Survives |
| --- | --- | --- | --- |
| "Opus planner" (nameplate) | persona: home note title | owner, declared | everything except the owner renaming it |
| "planner" | calling: agent `local:agents/planner`, spec `atlas-openrig-ontology-planner` 1.0 | OpenRig, observed | occupant change, not a respec |
| `planning-opus@atlas-integration-repos` | seat address | OpenRig, observed | handover. It was reused by a new node here, so an address alone does not prove continuity |
| `01M58W9VEETETHXK9HSPXDZMJC` | seat node | OpenRig, observed | handover, not removal |
| Claude Code, `claude-opus-5-5`, cwd | occupant | `rig ps`, observed | until handover or a model change |
| needs input: selection prompt, 02:09Z | occupant activity | `agentActivity`, evidence source `pane_heuristic`, observed | minutes |
| context 17% used | occupant | `contextUsage`, Claude status line, `fresh: true`, observed | minutes; a compaction resets it |
| "Ontology review", in progress | undertaking: queue row `atlas-ontology-review-opus-20261018` | OpenRig queue, observed | until closure, then kept as history |
| "continues the original planner by native fork" | persona: link between two seat bindings | coordinator's message, reported; OpenRig recorded nothing | until the owner settles it |

The conversation id is the seat's resume token, so Atlas never displays or stores it. It refers to the conversation only through the seat.

### 4.3 One thing in many places; different things kept apart

- **Same persona, several tokens.** Two tokens in two scenes that depict one persona show identical observed marks. A nameplate may differ by scene as a declared alias, but the persona's name is the home note's. Copying a token into another collection copies the representation and shares the referent. This is the "shared reference versus copied representation" line in [product direction](../../integration-team/workspace/PRODUCT-DIRECTION.md) [A].
- **One token, several actors.** A group token can depict a pod or party. Its observed marks are aggregates, so the aggregation rule is declared ("any needs input") and the result is labelled inferred.
- **Different things with one name.** Two seats on one calling are two personas. "Snapshot" on a scene card and on a rig card is labelled with its kind. Atlas never resolves a referent by label. Recorded bindings already resolve by reference only [A].

### 4.4 Who may create, change, interpret or contest

| Actor | May | May not |
| --- | --- | --- |
| Native authorities | create identities and observed facts | be overridden from the board |
| Owner (GM) | declare personas, callings, place legends and names; settle meaning; delegate authorship | edit native facts except through native verbs |
| Delegated seat (caretaker, or a seat over its own tokens) | author representations and declared accounts within an agreed remit, attributed and revertible | redesign the owner's craft or settle the owner's meanings |
| Any agent | report about itself (closure notes, session notes, receipts) | have its report shown as observed |
| Atlas | infer by a stated, visible rule | infer silently, or act |

Contesting adds an account; it never deletes one. Who settles depends on the question. For a native fact, there is nothing to vote on: a closed row is closed, and only its meaning or acceptance can be disputed. For meaning, the owner settles. Settling is a new judged account that keeps both earlier accounts. The [vault trial](../../vault-and-roles.md#bounded-atlas-map-governor-trial) already names the risks of delegated authorship: stale context overwriting human edits, broad rearrangement from one request, and competing rewrites [A].

### 4.5 Unresolved semantics

1. **Persona criteria.** When is a new seat "the same colleague"? Cases include fork continuation (this seat), a rebuild from artifacts, and a fresh seat that reads the old home note. OpenRig records lineage only within a seat. Across seats this is the owner's call, case by case.
2. **Aggregation** for group tokens: worst-of, count or majority. It is undefined, and per-source thresholds are unmeasured.
3. **Scene alias versus persona name**: at what point a divergent nameplate becomes a contested name.
4. **Overlap**: when a seat taking on a second calling stays one persona with two callings, and when it should become two entrances.
5. **Done**: the board must show author closure, review and owner acceptance as separate marks. Today a done row can carry only a closure reason and note, and `--evidence-ref` is rejected on done [L].
6. **Staleness** per source: pane heuristic, status line, queue events. The thresholds are unknown and need measurement.
7. **Reported summons** are unverifiable through OpenRig. They stay reported.

## 5. Where native stays authoritative

| Question | Authority | Atlas |
| --- | --- | --- |
| Does the seat exist, who occupies it, is it running or waiting? | OpenRig | displays, observed |
| What the agent can do (skills, tools, subagents, permissions, completion and review) | native harness | displays what is exposed; never limits, filters or gates it |
| Who holds the work; did the author close it? | OpenRig queue | displays; creates rows only through the verb |
| Is the result accepted? | the reviewer or owner who holds acceptance | displays; links the judgment's record |
| What a persona, calling or place means, and what it is called | owner, through the vault | authors |
| What a scene shows and where | scene author | authors, with undo |

Display labels never carry command authority. An action takes the native identity from the current binding at the moment it runs, shows that target in its confirmation, and reports the verb's literal result [P]. Dragging, grouping and colouring never act. A legend may let a gesture *propose* an action, which still needs explicit confirmation [P]. Atlas never requires a token, persona or registration for anything to exist natively. Agents may ignore Atlas entirely.

## 6. Colleague journey, using this assignment

1. **Choose an agent.** The owner opens their painted studio. A character token linked to the "Opus planner" home note carries its nameplate. Selecting it opens a card in layers:
   - persona: name, callings and remit, from the note (declared);
   - seat: address and node (observed);
   - occupant: Claude Code, Opus 5.5, cwd, and a context bar with sample time (observed);
   - quests: one in progress (observed);
   - relics: `opus-5.5.md` with its hash;
   - lineage: "continues the original planner by fork", reported by the coordinator and not recorded by OpenRig.
2. **Enter the native session.** Open agent resolves persona, then binding, then node. It opens the native terminal view or gives the node's attach command. If the binding is empty or the seat is stopped, it says so and offers the native recovery command. It never starts a seat. A per-seat focus exists only for cmux bindings, so the earlier fallback still applies [S].
3. **Give work.** Give quest (the owner can rename the action; the verb underneath is fixed) runs `rig queue create` against the address resolved at that moment. It shows the result literally. This row was created at 01:33:14Z with nudge result `delivered-ack-pending`, then claimed at 01:33:21Z [L]. A quest marker appears beside the token as a representation of the row. It moves to in progress because the claim event arrived, not because Atlas assumed it.
4. **Follow progress.**
   - Observed badges show "needs input: selection prompt", source `pane_heuristic`, with its age.
   - An attention view, which is initiative used for the owner's turn order [P], lists the seats waiting on the owner, longest waiting first.
   - The queue backstop shows as a timer counting to its due time (observed).
   - If the owner wants to track their own judgment of progress, they can fill a clock by hand (declared).
5. **Inspect a result.** The author's closure (done, no follow-on, note with path and SHA-256) appears on the quest as a reported account. The relic card opens the file and shows whether the hash still matches. Acceptance is a separate judged account by the coordinator or owner. Until it exists, the quest reads "closed by author; acceptance pending".

## 7. The same model under native change

**A conversation forks and its seat is recreated (this seat).** The node changed, the address stayed, and OpenRig's continuity fields are empty [L]. The token keeps depicting the persona. The persona's binding history gains the new node. The fork link shows as reported (coordinator) until the owner settles it, or until OpenRig records it; `forked` is a native continuity outcome, but it was not recorded here [S]. Labels on the persona survive. Labels on the occupant are re-derived. The old node stays in history, marked removed. Compaction is a different case: the same occupant and the same conversation continue. OpenRig has a native `compacted` lifecycle value, but this seat reports `unknown`. The restore map is a reported journal, not a new occupant.

**The team grows, with seats and summons.** An orchestrator expands a pod by two seats, and a planner launches three native subagents. The seats are observed and appear on the bench. The owner or a delegated caretaker places them, perhaps stamping an encounter formation, which changes representations only. Subagents are invisible to OpenRig. If the parent reports them, a transient summons marker can hang off the parent token and disappear when it ends. It is never saved as a persona. If nobody reports them, nothing is missing: the board does not require them.

**Roles overlap and evolve.** The OpenRig representative starts reviewing. Its queue shows review rows (observed) while its persona's calling still says "representative" (declared). The card shows both. Nothing reconciles them automatically. The owner adds a calling, or decides that review belongs to a new persona with its own entrance (an open question in 4.5). A pod drawn as one group token shows an inferred aggregate under its declared rule.

**The map changes or a token appears elsewhere.**
- The owner repaints the studio, moves the planner token into a "Review hall" scene in another collection, and restores last week's scene snapshot.
- The token in the new collection is a copied representation of the shared persona, so its observed marks are identical.
- The restored snapshot brings back old representations and old declared marks, but no old observed state, because observed state was never saved. That is why native status must not live in conditions.
- If a quest marker from last week depicts a row closed since, it shows closed now.

**Evidence goes stale, or two perspectives disagree.** At 02:09Z three projections of one seat disagreed: `planning.astra` showed startup `failed`, lifecycle `running` and activity `idle` [L]. The OpenRig representative's context sample dated from 00:27Z with `fresh: false` [L]. The board shows three observed accounts with their sources and ages. It does not invent a single status. In a second kind of disagreement, an author closes a row as done and a reviewer disputes it. The row stays closed (native). The judgment shows as contested. The remedy is a new undertaking, created natively, not reopening the row from the board.

## 8. Mapping to existing features, and gaps

| Element | Atlas today [A] | Native today | Gap and class |
| --- | --- | --- | --- |
| Reference on any object | `RecordingReference` on tokens and text, historical bundles only; plain `Token` has no `notePath` | node, row and artifact ids [S] | A live reference on any representation: persona note or native id. **Atlas local** |
| Persona and binding history | `Character.notePath`; role home notes; one explicit predecessor mapping command | stable seat, handover ledger within a seat [I] | Binding history as a home-note section (a vault convention, not a schema). Cross-seat lineage is not recorded natively [L]; parent provenance columns are deferred in the fork skill [I]. **Owner convention; upstream** |
| Observed state | Conditions and bars are persisted and undo-tracked | `agentActivity` with `evidenceSource`, `contextUsage` with `fresh`, queue liveness [S][L] | A render-only observed channel with source and age, never saved. **Atlas local** |
| Quests | text cards | queue rows, events, `chainOfRecord` [S] | Quest marker for a row; Give quest through `queue create`. **Atlas local** |
| Attention order | initiative tracker keyed to tokens | `needs_input` per node; rows pending to the owner [L] | An attention mode for initiative. **Atlas local, later** |
| Authorship provenance | undo history, unattributed; no supported agent write path to an open scene | queue rows can carry requests [I] | Attributed, revertible delegated edits that respect open views. **Atlas local, owner decision** |
| Place legends | pins, linked hexes, scene links | pods, cwd, hosts [S] | None in code: legends are notes. **Convention** |
| Agent perspective | fog, vision, GM-only, player view | context delivery is recorded; consumption is not [A] | Defer until consumption can be evidenced. **Chosen scope** |
| Summons | encounter spawn, instance numbers | not exposed through OpenRig [I] | Reported markers only. **Upstream if ever needed** |
| Plumbing | none live | `/api/events`, `/api/ps`, CLI verbs [S][I] | As in the [original attempt](opus-5.5.md#4-minimal-architecture): one read model per vault, outside scenes and undo; actions through verbs. **Atlas local** |

Upstream issues from the original attempt still stand: per-seat open only via cmux, no attested non-seat human, no replay retention-gap signal. They matter less to the ontology than the missing cross-seat lineage.

## 9. Sequence

Each step is a proposal that needs owner authorization. Each is small enough to abandon.

| Step | What | Acceptance evidence |
| --- | --- | --- |
| 1. Write the vocabulary into the vault (no code) | Home notes gain persona name, callings, a binding history with dates and basis, and lineage notes. Place notes state their legends. Apply it to the current roster, including this fork and the Atlas representative's move across rigs | The owner and a fresh agent each answer from the notes alone, citing basis: who the Opus planner is now, how that is known, and what the review table means |
| 2. References and the observed channel | A live reference on any representation (persona note or native id); the read model; observed marks rendered with source and age and never saved | Scene diff shows only references. Undo and snapshot restore never resurrect observed state. Daemon down shows stale state. Two scenes that share a persona agree |
| 3. Layered card and Open agent | Persona, seat, occupant, quests and relics, with lineage marked by basis | The fork case shows "reported" continuity. A stopped seat is never started. A missing binding is stated |
| 4. Quests and attention | Give quest, quest markers, initiative in attention mode, owner clocks | The row appears in `rig queue list`. The claim arrives by event. Author closure, review and acceptance show as three marks |
| 5. Delegated authorship | An attributed, revertible path for a seat to place its own tokens or quest markers within a remit | A concurrent human edit is never overwritten. Every agent edit names its author and request |

Group tokens, summons markers and agent perspective wait until steps 1 to 4 show they are needed.

## 10. Owner decisions

1. **Does the persona layer exist, and does its binding history live in home notes?** Recommendation: yes, in notes, used only where continuity crosses seats. Also propose that OpenRig record cross-seat fork lineage.
2. **May agents author scene changes, and under what remit?** The options are: never; a caretaker only; or each seat for its own representations. Recommendation: the third, after step 5's evidence.
3. **Which RPG mechanics to bind first?** Recommendation: observed badges and bars, quests and attention initiative. Clocks stay declared. Fog waits.
4. **Naming authority.** Recommendation: the persona's name lives in the home note, and scene nameplates are aliases.
5. **Who records acceptance,** and where (vault decision note or queue), so that "judged" has a home.

## 11. Evidence, unknowns and sources

Unknowns:

- Live behaviour in Obsidian's renderer, event volume, and staleness thresholds were not measured.
- Whether the `startupStatus: failed` for the other planner is accurate was not investigated.
- The read prompts on this seat were resolved by the coordinator. I did not inspect them.
- No Atlas runtime, OpenRig write route or browser was exercised.
- The installed `forming-an-openrig-mental-model` skill differs from the checkout only in peer-listing text. The other cited skills match.

Atlas [A], relative to this file:
- [Original attempt](opus-5.5.md), [product direction](../../integration-team/workspace/PRODUCT-DIRECTION.md), [harness correction](../../integration-team/harness-correction.md), [recorded scene](../../recorded-scene.md#integration-and-authority), [vault and roles](../../vault-and-roles.md#note-backed-entrances), [owner-authored workspace](../../vault-homes/notes/Integration%20workspace/Decisions/Owner-authored%20workspace.md)
- [references, pins, tokens, characters](../../../../src/app/types.ts#L5), [character note and player fields](../../../../src/app/types.ts#L82), [conditions](../../../../src/app/types/collectionSettingsTypes.ts#L21), [clocks and widget scope](../../../../src/app/types/widgetTypes.ts#L41), [initiative](../../../../src/app/types/initiativeTypes.ts#L17), [fog](../../../../src/app/types/fogTypes.ts#L12), [vision](../../../../src/app/types/visionTypes.ts#L6), [encounters and player groups](../../../../src/app/services/AssetService.ts#L57), [scene snapshots](../../../../src/app/snapshots/sceneSnapshotFormat.ts#L15), [scene links](../../../../src/app/services/sceneLinks.ts#L19), [CreatureIndex](../../../../src/app/creatures/CreatureIndex.ts#L35), [bindings by reference](../../../../src/app/agent-workspace/recordedSceneBindings.ts#L13), [token context menu](../../../../src/app/pixi/token-renderer/InteractionController.ts#L518)

OpenRig [S] at `63db5917`:
- [occupant lifecycle, continuity outcome, activity evidence source](https://github.com/fsafey/openrig/blob/63db591720e7881ab1b2205d4295bc6ba516295f/packages/daemon/src/domain/types.ts#L521), [pane heuristic observation](https://github.com/fsafey/openrig/blob/63db591720e7881ab1b2205d4295bc6ba516295f/packages/daemon/src/domain/node-inventory.ts#L1433), [seat continuity and handover](https://github.com/fsafey/openrig/blob/63db591720e7881ab1b2205d4295bc6ba516295f/packages/daemon/assets/plugins/openrig-core/skills/seat-continuity-and-handover/SKILL.md), [session source fork](https://github.com/fsafey/openrig/blob/63db591720e7881ab1b2205d4295bc6ba516295f/packages/daemon/specs/agents/shared/skills/core/session-source-fork/SKILL.md), [ontology, epistemology and topology pillars; pods and edges](https://github.com/fsafey/openrig/blob/63db591720e7881ab1b2205d4295bc6ba516295f/packages/daemon/assets/plugins/openrig-core/skills/forming-an-openrig-mental-model/SKILL.md), [world claims and claim ledgers](https://github.com/fsafey/openrig/blob/63db591720e7881ab1b2205d4295bc6ba516295f/packages/daemon/context-packs-src/world-public/build-your-world.md)

Live [L], read only:
- `rig whoami --full --json`
- `rig seat status planning-opus@atlas-integration-repos --json`
- `rig ps --nodes --rig atlas-integration-repos --json` (selected fields)
- `rig queue show atlas-ontology-review-opus-20261018 --full --json`
- `/healthz`

OpenRig's own pillars name ontology, epistemology and topology [I]. Its world packs already mark authored claims and suggest a claim ledger "when authored statements can drift into consequential lies" [S]. A scene exported as context could carry declared accounts in that form. That reuses OpenRig's existing claim form rather than adding a new one.
