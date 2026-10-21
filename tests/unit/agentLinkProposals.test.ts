import { describe, expect, it } from 'vitest';
import type { AccountDocument, SeatSubject } from '../../src/app/agent-links/account/accountSchema';
import type { InventoryRead } from '../../src/app/agent-links/live/OpenRigLive';
import type { ConnectionState, Observation } from '../../src/app/agent-links/live/types';
import { proposalsFor, type AccountState, type BoundAppearance, type InventoryState } from '../../src/app/agent-links/mapmaking/proposals';
import { exampleAccount } from '../fixtures/exampleAccount';

const TARGET = 'atlas-vtt/collections/Example/accounts/team.json';
const OTHER = 'atlas-vtt/collections/Example/accounts/other.json';
const node = (nodeId: string, logicalId: string, podId: string | null = 'pod-team', extra: Record<string, unknown> = {}): Record<string, unknown> =>
  ({ nodeId, logicalId, podId, rigId: 'rig-one', hostSelfId: 'host-one', rigName: 'example', ...extra });
const baseNodes = (): Record<string, unknown>[] => [node('node-builder', 'code.builder'), node('node-a', 'panel.a', 'pod-panel'), node('node-b', 'panel.b', 'pod-panel'), node('node-lead', 'orch.lead')];

const connection: ConnectionState = { status: 'connected', since: '2026-01-01T10:00:00Z', message: null, epoch: 3 };
function inventory(nodes: Record<string, unknown>[], change: Partial<Observation<InventoryRead>> = {}, state: Partial<InventoryState> = {}): InventoryState {
  const observation: Observation<InventoryRead> = { sourceKey: 'local', epoch: 3, revision: 5, freshness: 'live', value: { nodes, complete: true, observedAt: '2026-01-01T10:05:00Z' }, observedAt: '2026-01-01T10:05:00Z', message: null, ...change };
  return { sourceKey: 'local', rigId: 'rig-one', observation, connection, ready: true, settingsCurrent: true, ...state };
}
const appearances: BoundAppearance[] = [{ objectId: 'tok-builder', accountPath: TARGET, subjectId: 'seat:builder' }, { objectId: 'tok-panel', accountPath: TARGET, subjectId: 'group:panel' }];
const accounts = (target: AccountDocument = exampleAccount(), more: Array<[string, AccountState]> = []): Map<string, AccountState> =>
  new Map<string, AccountState>([[TARGET, { account: target, error: null }], ...more]);
const run = (overrides: Partial<Parameters<typeof proposalsFor>[0]> = {}): ReturnType<typeof proposalsFor> =>
  proposalsFor({ appearances, accounts: accounts(), targetPath: TARGET, inventories: [inventory([...baseNodes(), node('node-new', 'code.new')])], dismissed: new Set(), ...overrides });
const seat = (id: string, nodeId: string, policy: SeatSubject['policy'] = 'current-seat', extra: Partial<SeatSubject> = {}): SeatSubject =>
  ({ id, kind: 'seat', caption: id, sourceKey: 'local', seat: { rigId: 'rig-one', nodeId, logicalId: id }, policy, workIds: [], observedAt: '2026-01-01T10:00:00Z', ...extra });

describe('stage 4 proposals', () => {
  it('proposes unrepresented seats, reusing an existing current-seat subject in the target', () => {
    const result = run();
    expect(result.status).toEqual({ kind: 'ready' });
    expect(result.notOnMap.map((row) => [row.node.nodeId, row.reuse?.id ?? null])).toEqual([['node-lead', 'seat:lead'], ['node-new', null]]);
  });

  it('counts seats bound through any account the scene references, including group members', () => {
    const other: AccountDocument = { ...exampleAccount(), subjects: [seat('seat:lead-elsewhere', 'node-lead')] };
    const result = run({ appearances: [...appearances, { objectId: 'tok-lead', accountPath: OTHER, subjectId: 'seat:lead-elsewhere' }], accounts: accounts(exampleAccount(), [[OTHER, { account: other, error: null }]]) });
    expect(result.notOnMap.map((row) => row.node.nodeId)).toEqual(['node-new']);
    expect(result.notOnMap.some((row) => row.node.nodeId === 'node-a')).toBe(false);
  });

  it('claims nothing while any referenced account or group member is unresolved', () => {
    expect(run({ accounts: accounts(exampleAccount(), [[OTHER, { account: null, error: 'bad json' }]]) }).status).toEqual({ kind: 'blocked', reason: expect.stringContaining(OTHER) });
    const broken = exampleAccount();
    broken.subjects = broken.subjects.filter((subject) => subject.id !== 'seat:panel-b');
    expect(run({ accounts: accounts(broken) }).status).toMatchObject({ kind: 'blocked', reason: expect.stringContaining('seat:panel-b') });
  });

  it('shows absence, a different seat and a new pod member only from a qualifying inventory', () => {
    const nodes = [node('node-builder', 'code.builder'), node('node-a2', 'panel.a', 'pod-panel'), node('node-b', 'panel.b', 'pod-panel'), node('node-lead', 'orch.lead'), node('node-c', 'panel.c', 'pod-panel')];
    const live = run({ inventories: [inventory(nodes)] });
    expect(live.differentSeatNow.map((row) => [row.subject.id, row.node?.nodeId])).toEqual([['seat:panel-a', 'node-a2']]);
    expect(live.newInGroupPod.map((row) => row.node.nodeId)).toEqual(['node-a2', 'node-c']);
    const gone = run({ inventories: [inventory(baseNodes().filter((entry) => entry.nodeId !== 'node-b'))] });
    expect(gone.notInOpenRig.map((row) => row.subject.id)).toEqual(['seat:panel-b']);
    for (const unqualified of [
      inventory(nodes, { freshness: 'refreshing' }), inventory(nodes, { epoch: 2 }), inventory(nodes, {}, { ready: false }),
      inventory(nodes, {}, { settingsCurrent: false }), inventory(nodes, {}, { connection: { ...connection, checkingOrder: true } }), inventory(nodes, { value: null }),
    ]) {
      const result = run({ inventories: [unqualified] });
      expect(result.notInOpenRig.length + result.differentSeatNow.length + result.notOnMap.length + result.newInGroupPod.length).toBe(0);
      expect(result.waiting).toHaveLength(1);
    }
  });

  it('keeps sources and hosts apart: the same node ID elsewhere is a different seat', () => {
    const target = exampleAccount();
    target.subjects.push(seat('seat:new-other-source', 'node-new', 'current-seat', { sourceKey: 'other' }), seat('seat:new-other-host', 'node-new', 'current-seat', { seat: { rigId: 'rig-one', nodeId: 'node-new', logicalId: 'code.new', hostId: 'host-two' } }));
    expect(run({ accounts: accounts(target) }).notOnMap.find((row) => row.node.nodeId === 'node-new')?.reuse).toBeNull();
  });

  it('reports ambiguous subjects and unreadable nodes, and notes a seat only pinned to an earlier conversation', () => {
    const target = exampleAccount();
    target.subjects.push(seat('seat:x1', 'node-x'), seat('seat:x2', 'node-x'), seat('seat:y-pinned', 'node-y', 'captured-conversation'));
    const result = run({ accounts: accounts(target), inventories: [inventory([...baseNodes(), node('node-x', 'code.x'), node('node-y', 'code.y'), node('node-bad', '')])] });
    expect(result.cantPropose.map((row) => row.reason)).toEqual([expect.stringContaining('unreadable'), expect.stringContaining('ambiguous, 2')]);
    expect(result.notOnMap.find((row) => row.node.nodeId === 'node-y')).toMatchObject({ reuse: null, pinnedEarlier: { id: 'seat:y-pinned' } });
  });

  it('lists Atlas-added seats nothing uses, counting group membership as use', () => {
    const target = exampleAccount();
    target.sources.push({ id: 'atlas-apply-1', description: 'Added from rig inventory on the map Example', observedAt: '2026-01-01T10:05:00Z',
      origin: { kind: 'atlas-rig-inventory', appliedAt: '2026-01-01T10:06:00Z', scenePath: 'maps/example.atlasmap', sourceKey: 'local', hostId: 'host-one', rigId: 'rig-one' } } as AccountDocument['sources'][number]);
    const added = (id: string): SeatSubject => seat(id, `node-${id}`, 'current-seat', { seat: { rigId: 'rig-one', nodeId: `node-${id}`, logicalId: id, hostId: 'host-one' }, sourceIds: ['atlas-apply-1'] });
    target.subjects.push(added('unused'), added('member'), seat('seat:authored', 'node-authored'));
    const group = target.subjects.find((subject) => subject.id === 'group:panel');
    if (group?.kind === 'group') group.members.push({ subjectId: 'member', lens: 'Extra' });
    const result = run({ accounts: accounts(target) });
    expect(result.unused.map((row) => row.subject.id)).toEqual(['unused']);
    expect(result.unused[0]!.reason).toContain(`remove by editing ${TARGET}`);
  });

  it('hides a dismissed row but still reports it as a candidate, so the dismissal lapses with its basis', () => {
    const first = run();
    const key = first.notOnMap.find((row) => row.node.nodeId === 'node-new')!.key;
    const dismissed = run({ dismissed: new Set([key]) });
    expect(dismissed.notOnMap.map((row) => row.node.nodeId)).toEqual(['node-lead']);
    expect(dismissed.candidateKeys.has(key)).toBe(true);
    expect(run({ dismissed: new Set([key]), inventories: [inventory(baseNodes())] }).candidateKeys.has(key)).toBe(false);
  });
});
