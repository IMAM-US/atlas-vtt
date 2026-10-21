import { Notice, TFile, type App } from 'obsidian';
import type { Point } from '../../grid/hexGeometry';
import type { MapRect } from '../../grid/hexNumbering';
import { computeTokenPixelSize } from '../../pixi/token-renderer/tokenSizing';
import type { ViewAtlasState, ViewAtlasStore } from '../../storeFactory';
import { getHistoryStore } from '../../stores/history';
import type { NativeSources } from '../NativeSources';
import type { AccountDocument } from '../account/accountSchema';
import { accountLayout, textSha256 } from '../account/accountWriter';
import { freshnessLabel } from '../card/freshnessLabels';
import { AccountLoads } from '../overlay/AccountLoads';
import { appearanceReferences, type AppearanceReference } from '../overlay/appearanceBindings';
import { NativeMarks } from '../overlay/NativeMarks';
import { applyProposals, type ChosenSeat } from './applyProposals';
import { applyLine, undoLine, type Reload } from './applyReport';
import { placeProposals } from './placement';
import type { ProposalGhostRenderer } from './ProposalGhostRenderer';
import { emptyProposals, proposalsFor, qualifyingInventory, type InventoryState, type ProposalSet } from './proposals';
import { accountStates, boundAppearances, cellSize, covered, footprints, groupProposals, placementRequests, qualifiedNodes, rigsInScope, type RigScope } from './sceneInputs';

export interface ChosenRow { key: string; caption: string }
export interface ProposalsSnapshot {
  open: boolean; set: ProposalSet; scope: readonly string[]; targets: readonly string[]; targetPath: string | null;
  reflowNeeded: boolean; placements: ReadonlyMap<string, Point | null>; busy: boolean; status: string | null;
}
interface Derived { references: AppearanceReference[]; paths: Set<string>; targetPath: string | null; rigs: RigScope[]; inventories: InventoryState[]; set: ProposalSet }

const inventoryKey = (rigId: string): string => `inventory:${JSON.stringify(rigId)}`;
const rigKey = (sourceKey: string, rigId: string): string => JSON.stringify([sourceKey, rigId]);

/**
 * The view's map-making: the Proposals panel's state, its ghosts and Apply. Memory-only; it
 * observes the scene, its accounts and the rigs' inventories only while the panel is open or a
 * group card asks for its count, and never in player view or the DM's preview.
 */
export class MapmakingSession {
  private opened = false;
  private demand = 0;
  private updating = false;
  private again = false;
  private loads: AccountLoads | null = null;
  private readonly native: NativeMarks;
  private readonly listeners = new Set<() => void>();
  private readonly cleanups: (() => void)[] = [];
  private readonly dismissed = new Map<string, string>();
  private chosenTarget: string | null = null;
  private derived: Derived | null = null;
  private nodes: ReturnType<typeof qualifiedNodes> = [];
  private reflow: { sha256: string; needed: boolean } | null = null;
  private choice: readonly ChosenRow[] = [];
  private operation: AbortController | null = null;
  private sceneEpoch = 0;
  private applied: { tokenIds: string[]; seats: number; path: string; present: boolean; removed: boolean } | null = null;
  private status: string | null = null;
  private snapshot: ProposalsSnapshot = { open: false, set: emptyProposals({ kind: 'ready' }), scope: [], targets: [], targetPath: null, reflowNeeded: false, placements: new Map(), busy: false, status: null };

  constructor(private readonly app: App, private readonly store: ViewAtlasStore, private readonly sources: Pick<NativeSources, 'live' | 'loadAccount'>,
    private readonly ghosts: ProposalGhostRenderer, private readonly mapRect: () => MapRect | null) {
    this.native = new NativeMarks(sources.live, this.changed);
    this.cleanups.push(store.subscribe((state, previous) => {
      if (state.mapPath !== previous.mapPath || (state.isMapLoading && !previous.isMapLoading)) this.sceneChanged();
      if (this.applied && state.objects.tokens !== previous.objects.tokens) {
        const present = this.applied.tokenIds.some((id) => state.objects.tokens[id]);
        this.applied.removed = this.applied.present && !present;
        this.applied.present = present;
      }
      if (state.objects !== previous.objects || state.grid !== previous.grid || state.mapPath !== previous.mapPath || state.isGMView !== previous.isGMView
        || state.isPlayerView !== previous.isPlayerView || state.isMapLoading !== previous.isMapLoading) this.changed();
    }), sources.live.subscribe(this.changed));
    const history = getHistoryStore(store);
    // Undo sets the scene before its history, so a removal just seen plus a grown redo stack is that undo.
    if (history) this.cleanups.push(history.subscribe((now, before) => {
      const applied = this.applied;
      if (applied?.removed && now.futureStates.length > before.futureStates.length) this.say(undoLine(applied.tokenIds.length, applied.seats, applied.path));
      if (applied) applied.removed = false;
    }));
    // AccountLoads acts only on the accounts this scene uses and reports its own change.
    const invalidate = (path: string): void => this.loads?.invalidate(path);
    const refs = [
      app.vault.on('modify', (file) => invalidate(file.path)),
      app.vault.on('create', (file) => invalidate(file.path)),
      app.vault.on('delete', (file) => invalidate(file.path)),
      app.vault.on('rename', (file, oldPath) => { invalidate(oldPath); invalidate(file.path); }),
    ];
    this.cleanups.push(() => refs.forEach((ref) => app.vault.offref(ref)));
  }

  getSnapshot = (): ProposalsSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  open = (): void => { this.opened = true; this.changed(); };
  close = (): void => { this.opened = false; this.operation?.abort(); this.status = null; this.choice = []; this.changed(); };
  toggle = (): void => (this.opened ? this.close() : this.open());
  chooseTarget = (path: string): void => { this.chosenTarget = path; this.changed(); };

  /** A group card's interest in its count; the returned function ends it. */
  retain = (): (() => void) => {
    this.demand++; this.changed();
    let released = false;
    return () => { if (!released) { released = true; this.demand--; this.changed(); } };
  };

  groupCount(accountPath: string, groupId: string): number {
    const account = this.loads?.get(accountPath)?.value?.account;
    return account && this.derived?.set.status.kind === 'ready' ? groupProposals(this.derived.set.notOnMap, account, groupId, this.nodes) : 0;
  }

  dismiss(key: string): void {
    const set = this.derived?.set;
    const row = set && [...set.notOnMap, ...set.notInOpenRig, ...set.differentSeatNow, ...set.newInGroupPod].find((entry) => entry.key === key);
    const tuple = row && ('subject' in row && row.subject.kind === 'seat' ? { sourceKey: row.subject.sourceKey, rigId: row.subject.seat.rigId } : 'node' in row && row.node ? row.node : null);
    if (tuple) { this.dismissed.set(key, rigKey(tuple.sourceKey, tuple.rigId)); this.changed(); }
  }

  /** The panel's current selection, drawn as ghosts at the cells Apply will use. */
  preview(choice: readonly ChosenRow[]): void { this.choice = choice; this.drawGhosts(); }

  private changed = (): void => {
    if (this.updating) { this.again = true; return; }
    this.updating = true;
    const before = this.snapshot;
    do { this.again = false; this.rebuild(); } while (this.again);
    this.updating = false;
    if (this.snapshot !== before) this.emit();
  };

  private visible(state: ViewAtlasState): boolean { return !state.isPlayerView && state.isGMView && !state.isMapLoading; }

  private rebuild(): void {
    const state = this.store.getState();
    if (!this.visible(state) || (!this.opened && this.demand === 0)) {
      if (this.loads) this.deactivate();
      if (this.snapshot.open !== this.opened || this.snapshot.status !== this.status || this.snapshot.busy !== (this.operation !== null)) {
        this.snapshot = { ...this.snapshot, open: this.opened, busy: this.operation !== null, status: this.status };
      }
      return;
    }
    this.loads ??= new AccountLoads((path, signal) => this.sources.loadAccount(path, { signal }), this.changed);
    this.native.begin();
    const derived = this.derive(state);
    this.native.finish();
    const qualifying = new Set(derived.inventories.filter((entry) => !qualifyingInventory(entry)).map((entry) => rigKey(entry.sourceKey, entry.rigId)));
    if (derived.set.status.kind === 'ready') for (const [key, rig] of this.dismissed) if (qualifying.has(rig) && !derived.set.candidateKeys.has(key)) this.dismissed.delete(key);
    this.derived = derived;
    this.nodes = qualifiedNodes(derived.inventories, (entry) => !qualifyingInventory(entry));
    const bounds = this.mapRect();
    const requests = placementRequests(derived.set.notOnMap, state, derived.references, accountStates(derived.paths, this.loads), this.nodes);
    const placements = bounds ? placeProposals(requests, footprints(state), state.grid, bounds) : new Map(requests.map((request) => [request.key, null]));
    const loaded = derived.targetPath ? this.loads.get(derived.targetPath)?.value : null;
    if (loaded && this.reflow?.sha256 !== loaded.sha256) this.checkReflow(loaded.path, loaded.sha256);
    const scope = derived.rigs.map((rig) => `${rig.name} · inventory ${freshnessLabel(derived.inventories.find((entry) => entry.sourceKey === rig.sourceKey && entry.rigId === rig.rigId)?.observation)}`);
    this.snapshot = { open: this.opened, set: derived.set, scope, targets: [...derived.paths].sort(), targetPath: derived.targetPath,
      reflowNeeded: loaded ? this.reflow?.sha256 === loaded.sha256 && this.reflow.needed : false, placements, busy: this.operation !== null, status: this.status };
    this.drawGhosts();
  }

  /** The diff from the current scene, accounts and inventories; `override` puts the text a write returned in place of the target's load. */
  private derive(state: ViewAtlasState, override?: { path: string; account: AccountDocument }): Derived {
    const references = appearanceReferences(state);
    const paths = new Set(references.map((reference) => reference.path));
    this.loads!.setPaths(paths);
    const targetPath = paths.size === 1 ? [...paths][0]! : this.chosenTarget && paths.has(this.chosenTarget) ? this.chosenTarget : null;
    const accounts = accountStates(paths, this.loads!, override);
    const target = targetPath ? accounts.get(targetPath)?.account : null;
    const rigs = target ? rigsInScope(target) : [];
    const inventories = rigs.map((rig): InventoryState => ({
      sourceKey: rig.sourceKey, rigId: rig.rigId, connection: this.native.model(rig.sourceKey).getConnection(), settingsCurrent: true,
      observation: this.native.read(rig.sourceKey, inventoryKey(rig.rigId), (model) => model.watchInventory(rig.rigId)), ready: this.native.ready(rig.sourceKey),
    }));
    const set = !paths.size ? emptyProposals({ kind: 'blocked', reason: 'Bind a token to an account first.' })
      : !targetPath ? emptyProposals({ kind: 'blocked', reason: 'Choose the account new seats are added to.' })
        : proposalsFor({ appearances: boundAppearances(references), accounts, targetPath, inventories, dismissed: new Set(this.dismissed.keys()) });
    return { references, paths, targetPath, rigs, inventories, set };
  }

  private checkReflow(path: string, sha256: string): void {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return;
    void this.app.vault.read(file).then((text) => {
      if (textSha256(text) !== sha256) return;
      this.reflow = { sha256, needed: !accountLayout(text).canonical };
      this.changed();
    }, () => undefined);
  }

  private drawGhosts(): void {
    const state = this.store.getState(), placements = this.snapshot.placements;
    const radius = computeTokenPixelSize(cellSize(state), 1) / 2;
    this.ghosts.setGhosts(this.opened && this.visible(state) ? this.choice.flatMap((row) => {
      const position = placements.get(row.key);
      return position ? [{ key: row.key, position, radius, caption: row.caption }] : [];
    }) : []);
  }

  async apply(choice: readonly ChosenRow[]): Promise<void> {
    const derived = this.derived, targetPath = derived?.targetPath, loaded = targetPath ? this.loads?.get(targetPath)?.value : null;
    if (this.operation || !derived || !targetPath || !loaded) return;
    const seats: ChosenSeat[] = choice.flatMap((row) => {
      const proposal = derived.set.notOnMap.find((entry) => entry.key === row.key), position = this.snapshot.placements.get(row.key);
      return proposal && position ? [{ proposal, caption: row.caption, position }] : [];
    });
    if (!seats.length) return;
    const controller = new AbortController(), epoch = this.sceneEpoch;
    this.operation = controller; this.status = null; this.changed();
    const rigs = [...new Map(seats.map(({ proposal: { node } }) => [rigKey(node.sourceKey, node.rigId), node])).values()];
    const revisions = new Map(rigs.map((node) => [node.sourceKey, this.sources.live.getRevision(node.sourceKey)]));
    const inventories = rigs.map((node) => {
      const model = this.native.model(node.sourceKey);
      return { sourceKey: node.sourceKey, rigId: node.rigId, handle: model.watchInventory(node.rigId), connection: () => model.getConnection() };
    });
    try {
      const state = this.store.getState();
      const outcome = await applyProposals({
        app: this.app, store: this.store, scenePath: state.mapPath ?? '', sceneName: (state.mapPath ?? '').split('/').pop()?.replace(/\.atlasmap$/, '') ?? '',
        target: { path: targetPath, sha256: loaded.sha256, account: loaded.account }, seats, inventories, signal: controller.signal,
        settingsCurrent: () => [...revisions].every(([source, revision]) => this.sources.live.getRevision(source) === revision),
        sceneCurrent: () => this.sceneEpoch === epoch && this.opened,
        guard: (account, expected) => this.guard(seats, targetPath, account, expected),
      });
      let reload: Reload | undefined;
      if (outcome.kind === 'indeterminate') {
        reload = await this.sources.loadAccount(targetPath).then((): Reload => ({ ok: true }), (error: unknown): Reload => ({ ok: false, reason: error instanceof Error ? error.message : 'unreadable' }));
      }
      // Our own write is read back at once, without waiting for the vault's modify event.
      if (outcome.kind !== 'refused') this.loads?.invalidate(targetPath);
      if ((outcome.kind === 'applied' || outcome.kind === 'partial') && outcome.seatsAdded) this.applied = { tokenIds: outcome.tokenIds, seats: outcome.seatsAdded, path: targetPath, present: true, removed: false };
      if (outcome.kind === 'applied') this.choice = [];
      // A line about the account is shown even after the scene changed; it is the only report of that write.
      const line = applyLine(outcome, targetPath, seats.length, reload);
      const wrote = outcome.kind === 'indeterminate' || ('seatsAdded' in outcome && outcome.seatsAdded > 0);
      if (this.sceneEpoch === epoch) this.say(line);
      else if (wrote) new Notice(line);
    } finally {
      for (const inventory of inventories) inventory.handle.release();
      if (this.operation === controller) this.operation = null;
      this.changed();
    }
  }

  private guard(seats: readonly ChosenSeat[], targetPath: string, account: AccountDocument, expected: (seat: ChosenSeat) => string | null): string | null {
    if (!this.loads) return 'Proposals were closed.';
    const state = this.store.getState();
    const { set, targetPath: current } = this.derive(state, { path: targetPath, account });
    if (current !== targetPath) return 'The account new seats are added to changed.';
    if (set.status.kind === 'blocked') return set.status.reason;
    const objects = footprints(state);
    for (const seat of seats) {
      const { node } = seat.proposal, row = set.notOnMap.find((entry) => entry.key === seat.proposal.key);
      const waiting = set.waiting.find((entry) => entry.sourceKey === node.sourceKey && entry.rigId === node.rigId);
      if (!row) return waiting ? `${node.rigId}: ${waiting.reason}` : `${node.logicalId} is no longer proposed.`;
      if ((row.reuse?.id ?? null) !== expected(seat)) return `${node.logicalId}: the account's subject for this seat changed.`;
      if (covered(objects, seat.position)) return `The cell for ${seat.caption} was taken.`;
    }
    return null;
  }

  private say(line: string): void {
    if (this.opened) { this.status = line; this.changed(); } else new Notice(line);
  }

  private sceneChanged(): void {
    this.sceneEpoch++; this.operation?.abort(); this.applied = null; this.status = null; this.choice = [];
  }

  private deactivate(): void {
    this.operation?.abort();
    this.loads?.dispose(); this.loads = null; this.native.dispose(); this.derived = null; this.nodes = []; this.choice = []; this.reflow = null;
    this.ghosts.setGhosts([]);
  }

  private emit(): void { for (const listener of this.listeners) listener(); }

  dispose(): void {
    this.operation?.abort();
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    this.deactivate(); this.listeners.clear(); this.dismissed.clear();
  }
}
