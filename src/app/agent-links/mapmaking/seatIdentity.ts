import type { AccountDocument, AccountSource, SeatSubject } from '../account/accountSchema';
import type { NativeObject } from '../native/openRigRead';

/** A native seat's identity: the configured source, its verified host, the rig and the node. Names only locate and label. */
export interface SeatTuple { sourceKey: string; hostId: string; rigId: string; nodeId: string }

/** An inventory node whose identity and labels were validated; anything else is unreadable and never proposed. */
export interface InventoryNode extends SeatTuple { logicalId: string; podId: string | null; rigName: string | null }

/** The provenance Atlas records when Apply adds seats; only this typed record marks a seat as Atlas-added. */
export interface AtlasOrigin { kind: 'atlas-rig-inventory'; appliedAt: string; scenePath: string; sourceKey: string; hostId: string; rigId: string }

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value : null);

/** Reads one node of a verified inventory; null when a field the diff relies on is missing or malformed. */
export function inventoryNode(sourceKey: string, node: NativeObject): InventoryNode | null {
  const hostId = text(node.hostSelfId), rigId = text(node.rigId), nodeId = text(node.nodeId), logicalId = text(node.logicalId);
  if (!hostId || !rigId || !nodeId || !logicalId) return null;
  if (node.podId !== undefined && node.podId !== null && !text(node.podId)) return null;
  if (node.rigName !== undefined && node.rigName !== null && !text(node.rigName)) return null;
  return { sourceKey, hostId, rigId, nodeId, logicalId, podId: text(node.podId), rigName: text(node.rigName) };
}

/** Whether an account seat names this native seat: source, rig and node, and the host when the seat records one. */
export function seatMatches(subject: SeatSubject, tuple: SeatTuple): boolean {
  return subject.sourceKey === tuple.sourceKey && subject.seat.rigId === tuple.rigId && subject.seat.nodeId === tuple.nodeId
    && (subject.seat.hostId === undefined || subject.seat.hostId === tuple.hostId);
}

export function atlasOrigin(source: AccountSource): AtlasOrigin | null {
  const origin = (source as AccountSource & { origin?: unknown }).origin;
  if (typeof origin !== 'object' || origin === null) return null;
  const record = origin as Record<string, unknown>;
  if (record.kind !== 'atlas-rig-inventory') return null;
  const appliedAt = text(record.appliedAt), scenePath = text(record.scenePath), sourceKey = text(record.sourceKey), hostId = text(record.hostId), rigId = text(record.rigId);
  if (!appliedAt || !Number.isFinite(Date.parse(appliedAt)) || !scenePath || !sourceKey || !hostId || !rigId) return null;
  return { kind: 'atlas-rig-inventory', appliedAt, scenePath, sourceKey, hostId, rigId };
}

/** A seat counts as Atlas-added only when it cites a typed Atlas origin whose source, host and rig are its own. */
export function atlasAdded(account: AccountDocument, subject: SeatSubject): AtlasOrigin | null {
  for (const id of subject.sourceIds ?? []) {
    const source = account.sources.find((entry) => entry.id === id);
    const origin = source ? atlasOrigin(source) : null;
    if (origin && origin.sourceKey === subject.sourceKey && origin.rigId === subject.seat.rigId
      && subject.seat.hostId !== undefined && origin.hostId === subject.seat.hostId) return origin;
  }
  return null;
}
