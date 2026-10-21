import { expect, it } from 'vitest';
import type { SeatSubject } from '../../src/app/agent-links/account/accountSchema';
import { inventoryAbsence, InventoryAbsenceProof } from '../../src/app/agent-links/live/inventoryFacts';
import type { InventoryRead } from '../../src/app/agent-links/live/OpenRigLive';
import type { Observation } from '../../src/app/agent-links/live/types';
import { activityHalo, workPip } from '../../src/app/agent-links/overlay/markSelectors';
import { blockerReference } from '../../src/app/agent-links/overlay/blockerReference';
import type { OwnedWork } from '../../src/app/agent-links/reads';

const subject: SeatSubject = { id: 'seat-a', caption: 'Builder', kind: 'seat', sourceKey: 'source-a', seat: { rigId: 'rig-a', nodeId: 'node-a', logicalId: 'team.builder' },
  policy: 'captured-conversation', participant: { runtime: 'codex', conversationId: 'captured-a', observedAt: '2026-01-01T10:00:00Z' }, workIds: [], observedAt: '2026-01-01T10:00:00Z' };
function fact<T>(value: T): Observation<T> {
  return { value, sourceKey: 'source-a', epoch: 1, revision: 0, freshness: 'live', observedAt: '2026-01-01T12:00:00Z', message: null };
}
function inventory(display: unknown): Observation<InventoryRead> {
  return fact({ nodes: [{ rigId: 'rig-a', nodeId: 'node-a', activityState: { display, needsInput: { count: display === 'needs-input' ? 1 : 0, reason: null } } }], complete: true, observedAt: '2026-01-01T12:00:00Z' });
}
it.each(['working', 'idle', 'needs-input', 'unknown'] as const)('renders the native %s oracle on a captured appearance as current-seat scope', (display) => {
  const halo = activityHalo(subject, inventory(display), true);
  expect(halo.activity).toBe(display);
  expect(halo.label).toContain('Seat activity now');
  expect(halo.label).not.toContain('captured-a');
});
it('does not infer idle or absence from a missing or malformed oracle', () => {
  for (const malformed of [{ activity: 'idle' }, ['working'], ['needs-input'], null, 0]) expect(activityHalo(subject, inventory(malformed), true).activity).toBe('unknown');
  expect(inventoryAbsence(subject, inventory(undefined), true)).toBeNull();
});
it('requires complete current qualified ready inventory for the shared absence phrase', () => {
  const absent = fact<InventoryRead>({ nodes: [], complete: true, observedAt: '2026-01-01T12:00:00Z' });
  expect(inventoryAbsence(subject, absent, true)).toBe('Not in OpenRig now (inventory 12:00Z)');
  for (const freshness of ['read', 'refreshing', 'last-known', 'refused', 'unavailable'] as const) expect(inventoryAbsence(subject, { ...absent, freshness }, true)).toBeNull();
  expect(inventoryAbsence(subject, absent, false)).toBeNull();
  expect(inventoryAbsence(subject, { ...absent, sourceKey: 'source-b' }, true)).toBeNull();
  expect(inventoryAbsence(subject, { ...absent, value: null }, true)).toBeNull();
  expect(inventoryAbsence(subject, fact({ ...absent.value!, nodes: [{ rigId: 'rig-b', nodeId: 'node-b' }] }), true)).toBeNull();
});
it('keeps zero, unavailable, retained zero and a truncated lower bound distinct', () => {
  const owned: OwnedWork = { state: 'current', items: [], truncated: false, sessionName: 'builder@example', observedAt: '2026-01-01T12:00:00Z' };
  expect(workPip(fact(owned))).toBeNull();
  expect(workPip({ ...fact(owned), freshness: 'last-known' })).toMatchObject({ count: 0, freshness: 'last-known' });
  expect(workPip({ ...fact<OwnedWork>(owned), value: null, freshness: 'unavailable', message: 'Native list refused' })).toMatchObject({ count: null, label: expect.stringContaining('Native list refused') });
  const items = Array.from({ length: 50 }, (_, i) => ({ qitemId: `qitem-${i}`, state: 'pending', blockedOn: 'old-ref' }));
  expect(workPip(fact({ ...owned, items, truncated: true }))).toMatchObject({ count: 51, blocked: 0, truncated: true, label: expect.stringContaining('51+') });
  expect(workPip(fact({ ...owned, items: [{ ...items[0]!, state: 'blocked' }], truncated: true }))).toMatchObject({ blocked: 1 });
});
it('retains only a previously proven frozen absence through an order hold and discards it on recovery', () => {
  const absent = fact<InventoryRead>({ nodes: [], complete: true, observedAt: '2026-01-01T12:00:00Z' });
  const proof = new InventoryAbsenceProof(subject);
  expect(proof.read(absent, false)).toBeNull();
  expect(proof.read(absent, true)).toContain('inventory 12:00Z');
  expect(proof.read(absent, false)).toContain('inventory 12:00Z');
  expect(proof.read({ ...absent, revision: 2 }, false)).toBeNull();
  expect(proof.read({ ...absent, freshness: 'last-known', epoch: 2 }, false)).toBeNull();
  expect(proof.read(absent, false)).toBeNull();
});
it.each([
  ['qitem-example@external', 'human'], ['human@kernel', 'human'], ['human-owner@host', 'human'],
  ['external:qitem-example', 'gate'], ['fold: gate with spaces', 'gate'], ['auth:', 'unresolved'],
  ['qitem-example', 'qitem'], ['qitem-example@rig', 'qitem'], ['seat@rig@other', 'seat'],
  ['legacy blocker prose', 'unresolved'], ['', 'unresolved'], ['seat\n@rig', 'unresolved'],
])('classifies %s using native precedence as %s', (value, kind) => expect(blockerReference(value).kind).toBe(kind));
