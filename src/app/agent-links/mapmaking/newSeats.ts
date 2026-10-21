import { createHash } from 'crypto';
import type { AccountDocument, AccountSource, SeatSubject } from '../account/accountSchema';
import type { AtlasOrigin, InventoryNode } from './seatIdentity';

/** A seat Apply adds: the native node and the caption the owner settled on. */
export interface NewSeat { node: InventoryNode; caption: string }

const tupleHash = (node: InventoryNode): string =>
  createHash('sha256').update(JSON.stringify([node.sourceKey, node.hostId, node.rigId, node.nodeId]), 'utf8').digest('hex');

/**
 * `seat:<logicalId>~<hash>`, the hash taken over the full native identity and lengthened until
 * no subject in the account has the ID. The ID only names the subject; identity is in its fields.
 */
export function newSeatId(account: AccountDocument, node: InventoryNode, reserved: ReadonlySet<string> = new Set()): string {
  const hash = tupleHash(node);
  for (let length = 8; length <= hash.length; length += 4) {
    const id = `seat:${node.logicalId}~${hash.slice(0, length)}`;
    if (!reserved.has(id) && !account.subjects.some((subject) => subject.id === id)) return id;
  }
  throw new Error(`No free subject ID for ${node.logicalId}.`);
}

export function newSeatSubject(id: string, seat: NewSeat, sourceId: string, observedAt: string): SeatSubject {
  const { node } = seat;
  return {
    id, kind: 'seat', caption: seat.caption, sourceKey: node.sourceKey,
    seat: { rigId: node.rigId, nodeId: node.nodeId, logicalId: node.logicalId, hostId: node.hostId, ...(node.rigName ? { rigName: node.rigName } : {}) },
    policy: 'current-seat', workIds: [], observedAt, sourceIds: [sourceId],
  };
}

export function provenanceSource(id: string, sceneName: string, observedAt: string, origin: AtlasOrigin): AccountSource {
  return { id, description: `Added from rig inventory on the map ${sceneName}`, observedAt, origin } as AccountSource;
}

/** One Apply's account change: its provenance entry and its new subjects, refusing any ID now taken by other content. */
export function withNewSeats(source: AccountSource, subjects: readonly SeatSubject[]): (account: AccountDocument) => AccountDocument {
  return (account) => {
    for (const subject of subjects) {
      if (account.subjects.some((existing) => existing.id === subject.id)) throw new Error(`The subject ID ${subject.id} is already in the account.`);
    }
    if (account.sources.some((existing) => existing.id === source.id)) throw new Error(`The source ID ${source.id} is already in the account.`);
    return { ...account, sources: [...account.sources, source], subjects: [...account.subjects, ...subjects] };
  };
}
