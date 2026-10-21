import type { ViewAtlasState } from '../../storeFactory';
import { computeTokenPixelSize } from '../../pixi/token-renderer/tokenSizing';
import type { AccountDocument, SeatSubject } from '../account/accountSchema';
import type { AppearanceReference } from '../overlay/appearanceBindings';
import type { AccountLoads } from '../overlay/AccountLoads';
import type { Footprint, PlacementRequest } from './placement';
import type { AccountState, BoundAppearance, InventoryState, NotOnMap } from './proposals';
import { inventoryNode, seatMatches, type InventoryNode } from './seatIdentity';

const DEFAULT_CELL = 70;
/** Line height and average glyph width of map text, relative to its font size; texts keep no measured size in the store. */
const TEXT_LINE = 1.2, TEXT_GLYPH = 0.6;

export interface RigScope { sourceKey: string; rigId: string; name: string }

export const cellSize = (state: ViewAtlasState): number => (state.grid?.size && state.grid.size > 0 ? state.grid.size : DEFAULT_CELL);

export function boundAppearances(references: readonly AppearanceReference[]): BoundAppearance[] {
  return references.map((reference) => ({ objectId: reference.id, accountPath: reference.path, subjectId: reference.subjectId }));
}

/** Each referenced account as AccountLoads holds it; `override` replaces one with the exact text a write returned. */
export function accountStates(paths: ReadonlySet<string>, loads: AccountLoads, override?: { path: string; account: AccountDocument }): Map<string, AccountState> {
  return new Map([...paths].map((path) => {
    if (override?.path === path) return [path, { account: override.account, error: null }];
    const entry = loads.get(path);
    return [path, { account: entry?.value?.account ?? null, error: entry?.error ?? null }];
  }));
}

/** The rigs new seats may come from: those the write target lists. */
export function rigsInScope(target: AccountDocument): RigScope[] {
  const rigs = new Map<string, RigScope>();
  for (const subject of target.subjects) {
    if (subject.kind !== 'seat') continue;
    const key = JSON.stringify([subject.sourceKey, subject.seat.rigId]);
    if (!rigs.has(key) || subject.seat.rigName) rigs.set(key, { sourceKey: subject.sourceKey, rigId: subject.seat.rigId, name: subject.seat.rigName ?? subject.seat.rigId });
  }
  return [...rigs.values()];
}

/** Everything on the map a new token must not cover: tokens by their drawn size, texts by an estimate from their font. */
export function footprints(state: ViewAtlasState): Footprint[] {
  const cell = cellSize(state);
  const tokens = Object.values(state.objects.tokens).map((token) => {
    const size = computeTokenPixelSize(cell, token.size ?? 1);
    return { x: token.x, y: token.y, width: size, height: size, round: true };
  });
  const texts = Object.values(state.objects.texts).map((text) => {
    const lines = text.text.split('\n'), scale = text.scale ?? 1, padding = 2 * (text.padding ?? 0);
    const width = text.width ?? Math.max(...lines.map((line) => line.length)) * text.fontSize * TEXT_GLYPH * scale + padding;
    const height = text.height ?? lines.length * text.fontSize * TEXT_LINE * scale + padding;
    return { x: text.x, y: text.y, width, height };
  });
  return [...tokens, ...texts];
}

/** The drawn diameter of a new size-1 token, which placement and the Apply guard keep clear. */
export const newTokenDiameter = (state: ViewAtlasState): number => computeTokenPixelSize(cellSize(state), 1);

/** The validated nodes of every qualifying inventory, which place a proposal beside its pod and give group pods. */
export function qualifiedNodes(inventories: readonly InventoryState[], qualifies: (state: InventoryState) => boolean): InventoryNode[] {
  return inventories.filter(qualifies).flatMap((state) => (state.observation.value?.nodes ?? []).flatMap((raw) => inventoryNode(state.sourceKey, raw) ?? []));
}

function boundSeat(reference: AppearanceReference, accounts: ReadonlyMap<string, AccountState>): SeatSubject | null {
  const subject = accounts.get(reference.path)?.account?.subjects.find((entry) => entry.id === reference.subjectId);
  return subject?.kind === 'seat' ? subject : null;
}

/** A proposal is anchored on the tokens bound to seats whose node is in its pod, in the same source, host and rig. */
export function placementRequests(rows: readonly NotOnMap[], state: ViewAtlasState, references: readonly AppearanceReference[],
  accounts: ReadonlyMap<string, AccountState>, nodes: readonly InventoryNode[]): PlacementRequest[] {
  const bound = references.flatMap((reference) => {
    const token = reference.token ? state.objects.tokens[reference.id] : undefined;
    const seat = token ? boundSeat(reference, accounts) : null;
    const node = seat ? nodes.find((entry) => seatMatches(seat, entry)) : undefined;
    return token && node ? [{ point: { x: token.x, y: token.y }, node }] : [];
  });
  return rows.map((row) => ({
    key: row.key, logicalId: row.node.logicalId,
    anchors: row.node.podId ? bound.filter(({ node }) => node.podId === row.node.podId && node.sourceKey === row.node.sourceKey
      && node.hostId === row.node.hostId && node.rigId === row.node.rigId).map(({ point }) => point) : [],
  }));
}

/** How many proposed seats share a pod with a bound group's members: the group card's "N seats not on this map". */
export function groupProposals(rows: readonly NotOnMap[], account: AccountDocument, groupId: string, nodes: readonly InventoryNode[]): number {
  const group = account.subjects.find((subject) => subject.id === groupId);
  if (group?.kind !== 'group') return 0;
  const pods = new Set(group.members.flatMap((member) => {
    const seat = account.subjects.find((subject) => subject.id === member.subjectId);
    const node = seat?.kind === 'seat' ? nodes.find((entry) => seatMatches(seat, entry)) : undefined;
    return node?.podId ? [JSON.stringify([node.sourceKey, node.hostId, node.rigId, node.podId])] : [];
  }));
  return rows.filter((row) => row.node.podId && pods.has(JSON.stringify([row.node.sourceKey, row.node.hostId, row.node.rigId, row.node.podId]))).length;
}
