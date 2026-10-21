import type { AccountDocument, GroupSubject, SeatSubject } from '../account/accountSchema';
import type { InventoryRead } from '../live/OpenRigLive';
import type { ConnectionState, Observation } from '../live/types';
import { atlasAdded, inventoryNode, seatMatches, type InventoryNode, type SeatTuple } from './seatIdentity';

/** A token or text in the scene bound to an account subject. */
export interface BoundAppearance { objectId: string; accountPath: string; subjectId: string }
export interface AccountState { account: AccountDocument | null; error: string | null }
/** One rig's inventory as the live model holds it, with what decides whether it may prove anything. */
export interface InventoryState { sourceKey: string; rigId: string; observation: Observation<InventoryRead>; connection: ConnectionState; ready: boolean; settingsCurrent: boolean }

export interface ProposalInputs {
  appearances: readonly BoundAppearance[];
  /** Every account the appearances reference, by path. */
  accounts: ReadonlyMap<string, AccountState>;
  /** Where new seats are written and existing ones reused; never narrows what counts as on the map. */
  targetPath: string;
  inventories: readonly InventoryState[];
  dismissed: ReadonlySet<string>;
}

export interface NotOnMap { key: string; node: InventoryNode; reuse: SeatSubject | null; pinnedEarlier: SeatSubject | null }
export interface SeatRow { key: string; subject: SeatSubject; node: InventoryNode | null; observedAt: string | null }
export interface GroupPodRow { key: string; group: GroupSubject; node: InventoryNode }
export interface CantPropose { key: string; reason: string }
export interface UnusedSeat { subject: SeatSubject; reason: string }

export type ProposalStatus = { kind: 'ready' } | { kind: 'blocked'; reason: string };
export interface ProposalSet {
  status: ProposalStatus;
  notOnMap: NotOnMap[];
  notInOpenRig: SeatRow[];
  differentSeatNow: SeatRow[];
  newInGroupPod: GroupPodRow[];
  cantPropose: CantPropose[];
  unused: UnusedSeat[];
  /** Rigs in scope whose inventory can't prove anything yet, with the reason. */
  waiting: Array<{ sourceKey: string; rigId: string; reason: string }>;
  /** Every row key before dismissal, so a dismissal lapses once its basis no longer holds. */
  candidateKeys: Set<string>;
}

const rowKey = (kind: string, tuple: SeatTuple, ...basis: unknown[]): string => JSON.stringify([kind, tuple.sourceKey, tuple.hostId, tuple.rigId, tuple.nodeId, ...basis]);

/** An inventory may prove absence or support a proposal only while it is live, current, ready and unheld. */
export function qualifyingInventory(state: InventoryState): string | null {
  const { observation, connection } = state;
  if (!observation.value?.complete) return observation.message ?? 'No complete inventory yet.';
  if (observation.freshness !== 'live') return `The inventory is ${observation.freshness}.`;
  if (connection.status !== 'connected' || observation.epoch !== connection.epoch) return 'The inventory belongs to an earlier connection.';
  if (connection.checkingOrder) return 'Native events are being reordered.';
  if (!state.ready) return 'The inventory is not covered yet.';
  if (!state.settingsCurrent) return 'The source settings changed.';
  return null;
}

export const emptyProposals = (status: ProposalStatus): ProposalSet => ({
  status, notOnMap: [], notInOpenRig: [], differentSeatNow: [], newInGroupPod: [], cantPropose: [], unused: [], waiting: [], candidateKeys: new Set(),
});

/**
 * The difference between the rigs' inventories and the scene's bindings. Representation counts
 * every account the scene references; nothing is claimed absent unless every account, group and
 * member resolved and the rig's inventory qualifies.
 */
export function proposalsFor(inputs: ProposalInputs): ProposalSet {
  for (const [path, state] of inputs.accounts) {
    if (!state.account) return emptyProposals({ kind: 'blocked', reason: state.error ? `Couldn't read ${path}; proposals need every account this map uses.` : 'Reading the map\'s bindings…' });
  }
  const target = inputs.accounts.get(inputs.targetPath)?.account;
  if (!target) return emptyProposals({ kind: 'blocked', reason: 'Choose the account new seats are added to.' });
  const represented: SeatSubject[] = [];
  /** Each bound group with its members resolved in its own account; IDs never join across accounts. */
  const groups: Array<{ path: string; group: GroupSubject; members: SeatSubject[] }> = [];
  const referenced = new Set<string>();
  for (const appearance of inputs.appearances) {
    const account = inputs.accounts.get(appearance.accountPath)!.account!;
    const subject = account.subjects.find((entry) => entry.id === appearance.subjectId);
    if (appearance.accountPath === inputs.targetPath) referenced.add(appearance.subjectId);
    // A binding nothing in its account resolves could be any seat, so it blocks every negative claim.
    if (!subject && !account.work.some((work) => work.id === appearance.subjectId) && !account.artifacts.some((artifact) => artifact.id === appearance.subjectId)) {
      return emptyProposals({ kind: 'blocked', reason: `${appearance.subjectId} is not in ${appearance.accountPath}; proposals need every binding on the map resolved.` });
    }
    if (subject?.kind === 'seat') represented.push(subject);
    if (subject?.kind !== 'group') continue;
    const members: SeatSubject[] = [];
    for (const member of subject.members) {
      const seat = account.subjects.find((entry) => entry.id === member.subjectId);
      if (seat?.kind !== 'seat') return emptyProposals({ kind: 'blocked', reason: `${subject.caption}: member ${member.subjectId} is not a seat in ${appearance.accountPath}.` });
      members.push(seat);
    }
    represented.push(...members);
    if (!groups.some((entry) => entry.path === appearance.accountPath && entry.group.id === subject.id)) groups.push({ path: appearance.accountPath, group: subject, members });
  }
  const result = emptyProposals({ kind: 'ready' });
  const scope = new Map<string, SeatSubject[]>();
  for (const subject of target.subjects) {
    if (subject.kind !== 'seat') continue;
    const key = JSON.stringify([subject.sourceKey, subject.seat.rigId]);
    scope.set(key, [...(scope.get(key) ?? []), subject]);
  }
  for (const state of inputs.inventories) {
    if (!scope.has(JSON.stringify([state.sourceKey, state.rigId]))) continue;
    const unqualified = qualifyingInventory(state);
    if (unqualified) {
      result.waiting.push({ sourceKey: state.sourceKey, rigId: state.rigId, reason: unqualified });
      continue;
    }
    const nodes: InventoryNode[] = [];
    const raws = state.observation.value!.nodes;
    /** A node is present when the inventory lists its ID, readable or not; only a readable one can be proposed. */
    const listed = (seat: SeatSubject): boolean => raws.some((raw) => raw.nodeId === seat.seat.nodeId && raw.rigId === seat.seat.rigId
      && (seat.seat.hostId === undefined || raw.hostSelfId === seat.seat.hostId));
    for (const raw of raws) {
      const node = inventoryNode(state.sourceKey, raw);
      if (node) nodes.push(node);
      else result.cantPropose.push({ key: JSON.stringify(['unreadable', state.sourceKey, state.rigId, raw.nodeId]), reason: `A node in ${state.rigId} has unreadable fields.` });
    }
    for (const node of nodes) {
      if (represented.some((seat) => seatMatches(seat, node))) continue;
      const matches = target.subjects.filter((subject): subject is SeatSubject => subject.kind === 'seat' && seatMatches(subject, node));
      const current = matches.filter((subject) => subject.policy === 'current-seat');
      if (current.length > 1) {
        result.cantPropose.push({ key: rowKey('ambiguous', node), reason: `${node.logicalId}: ambiguous, ${current.length} account subjects for this seat.` });
        continue;
      }
      result.notOnMap.push({ key: rowKey('not-on-map', node), node, reuse: current[0] ?? null, pinnedEarlier: current.length ? null : matches[0] ?? null });
    }
    const inRig = represented.filter((seat) => seat.sourceKey === state.sourceKey && seat.seat.rigId === state.rigId);
    for (const seat of new Set(inRig)) {
      if (listed(seat)) continue;
      const renamed = nodes.find((node) => node.logicalId === seat.seat.logicalId && (seat.seat.hostId === undefined || node.hostId === seat.seat.hostId));
      const tuple: SeatTuple = { sourceKey: seat.sourceKey, hostId: seat.seat.hostId ?? '', rigId: seat.seat.rigId, nodeId: seat.seat.nodeId };
      // An absence is dismissed for the connection whose inventory showed it.
      const key = renamed ? rowKey('different-seat', tuple) : rowKey('not-in-openrig', tuple, state.observation.epoch);
      (renamed ? result.differentSeatNow : result.notInOpenRig).push({ key, subject: seat, node: renamed ?? null, observedAt: state.observation.observedAt });
    }
    for (const { path, group, members } of groups) {
      const memberNodes = nodes.filter((node) => members.some((seat) => seatMatches(seat, node)));
      const pods = new Set(memberNodes.flatMap((node) => (node.podId ? [JSON.stringify([node.hostId, node.podId])] : [])));
      for (const node of nodes) {
        if (!node.podId || !pods.has(JSON.stringify([node.hostId, node.podId])) || members.some((seat) => seatMatches(seat, node))) continue;
        result.newInGroupPod.push({ key: JSON.stringify(['group-pod', path, group.id, node.sourceKey, node.hostId, node.rigId, node.nodeId]), group, node });
      }
    }
  }
  const members = new Set(target.subjects.flatMap((subject) => (subject.kind === 'group' ? subject.members.map((member) => member.subjectId) : [])));
  for (const subject of target.subjects) {
    if (subject.kind !== 'seat' || referenced.has(subject.id) || members.has(subject.id) || !atlasAdded(target, subject)) continue;
    result.unused.push({ subject, reason: `Not referenced by a token in this scene; remove by editing ${inputs.targetPath} if you no longer need it.` });
  }
  for (const row of [...result.notOnMap, ...result.notInOpenRig, ...result.differentSeatNow, ...result.newInGroupPod]) result.candidateKeys.add(row.key);
  const visible = <T extends { key: string }>(rows: T[]): T[] => rows.filter((row) => !inputs.dismissed.has(row.key));
  return { ...result, notOnMap: visible(result.notOnMap), notInOpenRig: visible(result.notInOpenRig), differentSeatNow: visible(result.differentSeatNow), newInGroupPod: visible(result.newInGroupPod) };
}
