import type { App } from 'obsidian';
import type { Point } from '../../grid/hexGeometry';
import type { ViewAtlasStore } from '../../storeFactory';
import type { TokenInput } from '../../storeFactory';
import { runHistoryTransaction } from '../../stores/history';
import type { AccountDocument, SeatSubject } from '../account/accountSchema';
import { validateAccount } from '../account/accountValidation';
import { withAccountExclusion, writeAccount } from '../account/accountWriter';
import { AccountReceipts, type AccountBasis } from './accountReceipts';
import type { InventoryRead } from '../live/OpenRigLive';
import type { ConnectionState, Observation, ObservationHandle } from '../live/types';
import { newSeatId, newSeatSubject, provenanceSource, withNewSeats } from './newSeats';
import type { NotOnMap } from './proposals';
import { seatMatches } from './seatIdentity';

/** One chosen proposal: the seat, the caption the owner settled on and the cell its ghost showed. */
export interface ChosenSeat { proposal: NotOnMap; caption: string; position: Point }
export interface ApplyInventory { sourceKey: string; rigId: string; handle: ObservationHandle<InventoryRead>; connection: () => ConnectionState }

export interface ApplyRequest {
  app: App;
  store: ViewAtlasStore;
  scenePath: string;
  sceneName: string;
  target: { path: string; sha256: string; account: AccountDocument };
  seats: readonly ChosenSeat[];
  /** One per rig the chosen seats come from. */
  inventories: readonly ApplyInventory[];
  settingsCurrent: () => boolean;
  /** False once the scene was switched or reloaded since the panel showed these proposals. */
  sceneCurrent: () => boolean;
  /** Every other account the scene references, as the proposals read it. */
  bases: readonly AccountBasis[];
  /** How many vault events Atlas has seen for a path; any change since an account was qualified means it must be read again. */
  eventsOf: (path: string) => number;
  /**
   * Re-derives, from the current scene, every referenced account and the live inventory, whether
   * each chosen seat is still unrepresented, still resolves to `expected(seat)` in the target
   * (its reused subject, or the one this Apply wrote) and its cell is still free.
   */
  guard: (target: AccountDocument, expected: (seat: ChosenSeat) => string | null) => string | null;
  signal: AbortSignal;
  now?: () => Date;
  waitMs?: number;
}

export type ApplyOutcome =
  | { kind: 'applied'; tokenIds: string[]; seatsAdded: number }
  | { kind: 'partial'; tokenIds: string[]; seatsAdded: number; reason: string }
  | { kind: 'refused'; reason: string }
  /**
   * The account write happened, then a guard stopped before any token was published. With
   * `accountChanged` the target itself no longer holds what was written, so what it lists now is unknown.
   */
  | { kind: 'stopped'; seatsAdded: number; reason: string; accountChanged?: boolean; seatIds?: readonly string[] }
  | { kind: 'indeterminate'; reason: string };

const WAIT_MS = 10_000;

/** A fresh inventory: a Live observation whose value is a new read since `refresh`, current and ready; value identity is the receipt. */
export function waitForFreshInventory(inventory: ApplyInventory, settingsCurrent: () => boolean, signal: AbortSignal, waitMs = WAIT_MS): Promise<Observation<InventoryRead> | string> {
  const { handle, connection } = inventory;
  const before = handle.getSnapshot();
  handle.refresh();
  return new Promise((resolve) => {
    let done = false;
    const finish = (result: Observation<InventoryRead> | string): void => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      unsubscribe();
      signal.removeEventListener('abort', aborted);
      resolve(result);
    };
    const check = (): void => {
      const now = handle.getSnapshot(), link = connection();
      if (now.freshness === 'live' && now.value && now.value !== before.value && now.revision > before.revision && now.epoch === link.epoch
        && link.status === 'connected' && !link.checkingOrder && handle.isReady() && settingsCurrent()) finish(now);
    };
    const aborted = (): void => finish('Apply was cancelled.');
    const timer = window.setTimeout(() => finish('Couldn\'t confirm the seats are current.'), waitMs);
    const unsubscribe = handle.subscribe(check);
    signal.addEventListener('abort', aborted);
    if (signal.aborted) aborted();
    else check();
  });
}

const tokenId = (): string => `tok_seat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

/**
 * Apply: a fresh inventory, then, under the target account's exclusion, guards, one guarded
 * account write, guards against the exact written text, and one history step adding the tokens.
 * Undo and redo of that step never write the account.
 */
export async function applyProposals(request: ApplyRequest): Promise<ApplyOutcome> {
  const { store, target, signal } = request;
  /** When each rig's fresh inventory was read: the time new seats were observed. */
  const observed = new Map<string, string>();
  for (const inventory of request.inventories) {
    const fresh = await waitForFreshInventory(inventory, request.settingsCurrent, signal, request.waitMs);
    if (typeof fresh === 'string') return { kind: 'refused', reason: fresh };
    const readAt = fresh.value?.observedAt ?? fresh.observedAt;
    if (readAt) observed.set(JSON.stringify([inventory.sourceKey, inventory.rigId]), readAt);
  }
  return withAccountExclusion(target.path, async (): Promise<ApplyOutcome> => {
    const sceneReason = (): string | null => {
      if (signal.aborted) return 'Apply was cancelled.';
      const state = store.getState();
      if (state.mapPath !== request.scenePath || state.isMapLoading || !request.sceneCurrent()) return 'The scene changed.';
      return request.settingsCurrent() ? null : 'The source settings changed.';
    };
    // Every account, the target too, is qualified before anything is written and held through every later step.
    const receipts = new AccountReceipts(request.app, [...request.bases.filter((basis) => basis.path !== target.path), { path: target.path, sha256: target.sha256 }], request.eventsOf);
    const qualified = await receipts.qualify();
    if (qualified) return { kind: 'refused', reason: qualified.reason };
    const asRead = (seat: ChosenSeat): string | null => seat.proposal.reuse?.id ?? null;
    const unchanged = (): string | null => sceneReason() ?? receipts.held()?.reason ?? request.guard(target.account, asRead);
    const first = unchanged();
    if (first) return { kind: 'refused', reason: first };
    const appliedAt = (request.now?.() ?? new Date()).toISOString();
    const reserved = new Set<string>();
    const created = new Map<ChosenSeat, SeatSubject>();
    const sources = new Map<string, ReturnType<typeof provenanceSource>>();
    for (const seat of request.seats) {
      if (seat.proposal.reuse) continue;
      const { node } = seat.proposal;
      const scope = JSON.stringify([node.sourceKey, node.hostId, node.rigId]);
      const observedAt = observed.get(JSON.stringify([node.sourceKey, node.rigId])) ?? appliedAt;
      const source = sources.get(scope) ?? provenanceSource(`atlas-rig-inventory-${appliedAt}-${sources.size + 1}`, request.sceneName, observedAt,
        { kind: 'atlas-rig-inventory', appliedAt, scenePath: request.scenePath, sourceKey: node.sourceKey, hostId: node.hostId, rigId: node.rigId });
      sources.set(scope, source);
      const id = newSeatId(target.account, node, reserved);
      reserved.add(id);
      created.set(seat, newSeatSubject(id, { node, caption: seat.caption }, source.id, observedAt));
    }
    let account = target.account;
    if (created.size) {
      const groups = [...sources.values()].map((source) => ({ source, subjects: [...created.values()].filter((subject) => subject.sourceIds?.includes(source.id)) }));
      // The guards run again inside the write's synchronous callback: a cancel or change while it was queued writes nothing.
      const outcome = await writeAccount(request.app, target.path, target.sha256, (current) => groups.reduce((next, group) => withNewSeats(group.source, group.subjects)(next), current), unchanged);
      if (outcome.kind === 'refused') return { kind: 'refused', reason: outcome.reason };
      if (outcome.kind === 'indeterminate') return { kind: 'indeterminate', reason: outcome.reason };
      receipts.wrote(target.path, outcome.sha256);
      account = validateAccount(JSON.parse(outcome.text) as unknown);
      const missing = [...created.values()].find((subject) => {
        const written = account.subjects.find((entry) => entry.id === subject.id);
        return written?.kind !== 'seat' || !seatMatches(written, { sourceKey: subject.sourceKey, hostId: subject.seat.hostId!, rigId: subject.seat.rigId, nodeId: subject.seat.nodeId });
      });
      if (missing) return { kind: 'stopped', seatsAdded: created.size, reason: `${missing.id} is not in the written account.` };
    }
    // Read back again, the target as written or as first read, then publish with no await in between.
    const lapse = (await receipts.qualify()) ?? receipts.held();
    if (lapse) {
      if (!created.size) return { kind: 'refused', reason: lapse.reason };
      return { kind: 'stopped', seatsAdded: created.size, reason: lapse.reason, accountChanged: lapse.path === null || lapse.path === target.path, seatIds: [...created.values()].map((subject) => subject.id) };
    }
    const again = sceneReason() ?? request.guard(account, (seat) => created.get(seat)?.id ?? seat.proposal.reuse?.id ?? null);
    if (again) return created.size ? { kind: 'stopped', seatsAdded: created.size, reason: again } : { kind: 'refused', reason: again };
    const tokens: TokenInput[] = request.seats.map((seat) => ({
      id: tokenId(), kind: 'character', name: seat.caption, x: seat.position.x, y: seat.position.y, imagePath: '', size: 1,
      showRing: true, showNameplate: true, isHidden: true, hasVision: false, initiativeAutoAdd: false,
      sourceReference: { accountPath: target.path, subjectId: (seat.proposal.reuse ?? created.get(seat)!).id },
    }));
    try {
      runHistoryTransaction(store, () => store.getState().addTokens(tokens));
    } catch (error) {
      // History doesn't roll back a thrown transaction: report what is actually on the map.
      const present = tokens.flatMap((token) => (store.getState().objects.tokens[token.id!] ? [token.id!] : []));
      return { kind: 'partial', tokenIds: present, seatsAdded: created.size, reason: error instanceof Error ? error.message : 'Adding the tokens failed.' };
    }
    return { kind: 'applied', tokenIds: tokens.map((token) => token.id!), seatsAdded: created.size };
  });
}
