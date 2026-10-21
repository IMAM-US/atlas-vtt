import { expect, it, vi } from 'vitest';
import type { AccountDocument, SeatSubject } from '../../src/app/agent-links/account/accountSchema';
import type { InventoryRead } from '../../src/app/agent-links/live/OpenRigLive';
import type { Observation } from '../../src/app/agent-links/live/types';
import type { NativeMarks } from '../../src/app/agent-links/overlay/NativeMarks';
import { dependencyMarks, type TargetSeat } from '../../src/app/agent-links/overlay/dependencyMarks';
import type { BoundAppearance } from '../../src/app/agent-links/overlay/types';
import type { OwnedWork, Work } from '../../src/app/agent-links/reads';

function observed<T>(value: T): Observation<T> { return { sourceKey: 'a', epoch: 1, revision: 3, value, observedAt: '2026-01-01T12:00:00Z', freshness: 'live', message: null }; }
const seat = (nodeId: string): SeatSubject => ({ id: nodeId, kind: 'seat', sourceKey: 'a', caption: 'Reviewer', policy: 'current-seat', workIds: [],
  seat: { nodeId, rigId: 'rig-a', logicalId: nodeId }, observedAt: '2026-01-01T10:00:00Z' });
const account: AccountDocument = { format: 'atlas-source-account', version: 1, capturedAt: '2026-01-01T10:00:00Z', sources: [], subjects: [seat('owner-a')], work: [], artifacts: [] };
function appearance(id: string): BoundAppearance { return { id, caption: 'Map reviewer', path: 'account.json', subjectId: 'owner-a', token: true, revision: 'authored', account }; }
function fixture(): {
  run: () => ReturnType<typeof dependencyMarks>; owned: Observation<OwnedWork>; full: Observation<Work>; blocker: Observation<Work>;
  targets: TargetSeat[]; appearances: BoundAppearance[]; lookup: ReturnType<typeof vi.fn>; hold: () => void;
} {
  let ready = true;
  const owned = observed<OwnedWork>({ state: 'current', items: [{ qitemId: 'qitem-owned', state: 'blocked', blockedOn: 'qitem-review' }], sessionName: 'builder@example', truncated: false, observedAt: '2026-01-01T12:00:00Z' });
  const full = { ...observed<Work>({ state: 'current', item: { qitemId: 'qitem-owned', state: 'blocked', blockedOn: 'qitem-review', destinationSession: 'builder@example' }, transitions: [], observedAt: '2026-01-01T12:00:00Z' }), freshness: 'read' as const };
  const blocker = { ...observed<Work>({ state: 'current', item: { qitemId: 'qitem-review', state: 'in-progress', title: 'Native review', destinationSession: 'reviewer@example' }, transitions: [], observedAt: '2026-01-01T12:00:00Z' }), freshness: 'read' as const };
  const inventory = observed<InventoryRead>({ complete: true, observedAt: '2026-01-01T12:00:00Z', nodes: [{ nodeId: 'owner-a', rigId: 'rig-a', canonicalSessionName: 'reviewer@example' }] });
  const targets: TargetSeat[] = [{ appearance: appearance('target-a'), subject: seat('owner-a'), inventory }];
  const appearances: BoundAppearance[] = targets.map((target) => target.appearance);
  const lookup = vi.fn((_source: string, key: string): Observation<Work> => key === 'work:"qitem-owned"' ? full : blocker);
  const reads = { read: lookup, ready: () => ready } as unknown as NativeMarks;
  return { owned, full, blocker, targets, appearances, lookup, hold: () => { ready = false; }, run: () => dependencyMarks(seat('builder-a'), owned, targets, appearances, reads) };
}

it('joins current source-qualified seat custody with all input stamps and keeps the relation Read', () => {
  const f = fixture(), result = f.run();
  expect(result.tethers).toHaveLength(1);
  expect(result.tethers[0]).toMatchObject({ targetId: 'target-a', freshness: 'read', label: 'Waiting on Native review (owned by Map reviewer · reviewer@example) · Read 12:00Z' });
  expect(result.tethers[0]?.evidence).toHaveLength(4);
  expect(result.tethers[0]?.evidence.every((stamp) => stamp.sourceKey === 'a' && stamp.epoch === 1 && stamp.revision === 3)).toBe(true);
  expect(result.lines.join()).not.toContain('Live');
});

it.each(['done', 'cancelled', 'handed-off'])('does not draw a newly resolved line for terminal blocker %s', (state) => {
  const f = fixture(); if (f.blocker.value?.state === 'current') f.blocker.value.item.state = state;
  expect(f.run().tethers).toHaveLength(0);
});

it('rejects changed custody, reference, mismatched ID and inconsistent intermediate waiting projection', () => {
  for (const change of [
    { destinationSession: 'other@example' }, { blockedOn: 'qitem-other' }, { qitemId: 'qitem-other' },
    { waiting: { blocker: { ref: 'qitem-review', owner: 'other@example', state: 'in-progress' } } },
  ]) {
    const f = fixture(); if (f.full.value?.state === 'current') Object.assign(f.full.value.item, change);
    expect(f.run().tethers).toHaveLength(0);
  }
});

it('rejects reused addresses, ambiguous matches, foreign sources/epochs, stale or held inputs', () => {
  const reused = fixture(); reused.targets[0]!.inventory.value!.nodes[0]!.nodeId = 'replacement-node'; expect(reused.run().tethers).toHaveLength(0);
  const ambiguous = fixture(); ambiguous.targets[0]!.inventory.value!.nodes.push({ nodeId: 'other-node', rigId: 'rig-a', canonicalSessionName: 'reviewer@example' }); expect(ambiguous.run().tethers).toHaveLength(0);
  for (const change of [{ sourceKey: 'b' }, { epoch: 2 }, { freshness: 'last-known' as const }]) {
    const f = fixture(); Object.assign(f.blocker, change); expect(f.run().tethers).toHaveLength(0);
  }
  const foreign = fixture(); foreign.targets[0]!.subject.sourceKey = 'b'; expect(foreign.run().tethers).toHaveLength(0);
  const foreignInventory = fixture(); foreignInventory.targets[0]!.inventory.sourceKey = 'b'; expect(foreignInventory.run().tethers).toHaveLength(0);
  const held = fixture(); held.hold(); expect(held.run().tethers).toHaveLength(0);
});

it.each(['qitem-review@external', 'external:qitem-review', 'auth:decision', 'unknown legacy gate'])('keeps %s textual without accidental full-item lookup', (ref) => {
  const f = fixture(); if (f.owned.value?.state === 'current') f.owned.value.items[0]!.blockedOn = ref;
  expect(f.run().tethers).toHaveLength(0); expect(f.lookup).not.toHaveBeenCalled();
});

it('does not normalize or truncate an invalid native queue ID into another item', () => {
  for (const id of ['qitem-owned\n', 'qitem-owned' + 'x'.repeat(600)]) {
    const f = fixture(); if (f.owned.value?.state === 'current') f.owned.value.items[0]!.qitemId = id;
    expect(f.run().tethers).toHaveLength(0); expect(f.lookup).not.toHaveBeenCalled();
  }
});

it('keeps every matching appearance and uses an authored work caption before the native title', () => {
  const f = fixture(); f.targets.push({ ...f.targets[0]!, appearance: appearance('target-b') });
  expect(f.run().tethers.map((tether) => tether.targetId)).toEqual(['target-a', 'target-b']);
  const workAppearance = { ...appearance('work-a'), caption: 'Map review', subjectId: 'work-a', account: { ...account, work: [{ id: 'work-a', sourceKey: 'a', qitemId: 'qitem-review' }] } } as BoundAppearance;
  f.appearances.push(workAppearance);
  expect(f.run().tethers[0]).toMatchObject({ targetId: 'work-a', label: 'Waiting on Map review (owned by Map reviewer · reviewer@example) · Read 12:00Z' });
  if (f.blocker.value?.state === 'current') delete f.blocker.value.item.destinationSession;
  expect(f.run().tethers).toHaveLength(0);
  expect(f.run().lines.join()).toContain('current owner not verified');
});

it('preserves the weaker refusal label instead of calling an unresolved relation Live', () => {
  const f = fixture(); Object.assign(f.blocker, { value: null, freshness: 'refused', message: 'Native refused dependency verification' });
  expect(f.run().tethers).toHaveLength(0); expect(f.run().lines.join()).toContain('Refused: Native refused dependency verification');
});
