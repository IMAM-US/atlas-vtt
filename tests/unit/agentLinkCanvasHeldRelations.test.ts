import { afterEach, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { LiveLayer } from '../../src/app/agent-links/overlay/LiveLayer';
import type { NativeSources } from '../../src/app/agent-links/NativeSources';
import type { ViewAtlasStore } from '../../src/app/storeFactory';
import type { AccountDocument, SeatSubject } from '../../src/app/agent-links/account/accountSchema';
import type { ConnectionState, Observation, ObservationHandle } from '../../src/app/agent-links/live/types';
import { createInMemoryApp } from '../mocks/inMemoryVault';

const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); vi.useRealTimers(); });
const seat = (id: string): SeatSubject => ({ id, kind: 'seat', caption: id, sourceKey: 'a', policy: 'current-seat', workIds: [],
  observedAt: '2026-01-01T10:00:00Z', seat: { nodeId: id, rigId: 'rig-a', logicalId: id } });
const token = (id: string, subjectId: string, accountPath: string): Record<string, unknown> => ({ id, kind: 'token', name: id, x: 100, y: 100, size: 1,
  sourceReference: { accountPath, subjectId } });

function fixture(workEndpoint = false): { layer: LiveLayer; store: ReturnType<typeof createStore>; hold: (checkingOrder: boolean) => void; reloadTarget: () => void } {
  vi.useFakeTimers();
  let connection: ConnectionState = { status: 'connected', since: '2026-01-01T12:00:00Z', epoch: 1, message: null }, targetRevision = 0;
  const listeners = new Set<() => void>();
  const handle = <T>(value: T, freshness: 'live' | 'read' = 'live'): ObservationHandle<T> => {
    const fact: Observation<T> = { value, freshness, sourceKey: 'a', epoch: 1, revision: 1, observedAt: '2026-01-01T12:00:00Z', message: null };
    return { getSnapshot: () => fact, isReady: () => !connection.checkingOrder, whenReady: async () => {}, refresh: () => {}, release: () => {}, subscribe: () => () => {} };
  };
  const model = { getConnection: () => connection, subscribeConnection: (listener: () => void): (() => void) => { listeners.add(listener); return () => listeners.delete(listener); },
    watchInventory: () => handle({ complete: true, observedAt: '2026-01-01T12:00:00Z', nodes: ['builder', 'owner', 'replacement'].map((nodeId) =>
      ({ nodeId, rigId: 'rig-a', canonicalSessionName: `${nodeId}@example`, activityState: { display: 'working' } })) }),
    watchOwned: (subject: SeatSubject) => handle({ state: 'current', sessionName: `${subject.id}@example`, truncated: false, observedAt: '2026-01-01T12:00:00Z',
      items: subject.id === 'builder' ? [{ qitemId: 'qitem-owned', state: 'blocked', blockedOn: 'qitem-review' }] : [] }),
    watchWork: (id: string) => handle({ state: 'current', observedAt: '2026-01-01T12:00:00Z', transitions: [], item: id === 'qitem-owned'
      ? { qitemId: id, state: 'blocked', blockedOn: 'qitem-review', destinationSession: 'builder@example' }
      : { qitemId: id, state: 'pending', destinationSession: 'owner@example', title: 'Review' } }, 'read'),
  };
  const account: AccountDocument = { format: 'atlas-source-account', version: 1, capturedAt: '2026-01-01T10:00:00Z',
    sources: [], subjects: ['builder', 'owner', 'replacement'].map(seat), work: [], artifacts: [] };
  if (workEndpoint) account.work.push({ id: 'mapped-review', caption: 'Review', sourceKey: 'a', qitemId: 'qitem-review', artifactIds: [],
    captured: { state: 'pending', sourceSession: 'builder@example', destinationSession: 'owner@example', observedAt: account.capturedAt } });
  const sources = { loadAccount: async (path: string) => ({ path, account, sha256: path === 'target.json' ? `target-${targetRevision}` : 'origin', loadedAt: '2026-01-01T12:00:00Z' }),
    live: { openRig: () => model, getRevision: () => 0, subscribe: () => () => {}, peekConversation: () => null } } as unknown as NativeSources;
  const store = createStore(() => ({ objects: { tokens: { origin: token('origin', 'builder', 'origin.json'), target: token('target', 'owner', 'target.json'),
    ...(workEndpoint ? { work: token('work', 'mapped-review', 'work.json') } : {}) }, texts: {} },
    mapPath: 'map.atlasmap', isGMView: true, isPlayerView: false, isMapLoading: false }));
  const { app } = createInMemoryApp(), layer = new LiveLayer(app, store as unknown as ViewAtlasStore, sources);
  cleanups.push(() => layer.dispose());
  return { layer, store: store as ReturnType<typeof createStore>, hold: (checkingOrder): void => { connection = { ...connection, checkingOrder }; listeners.forEach((listener) => listener()); },
    reloadTarget: (): void => { targetRevision++; const callback = vi.mocked(app.vault.on).mock.calls.find(([event]) => event === 'modify')![1] as (file: { path: string }) => void; callback({ path: 'target.json' }); } };
}

it.each(['rebind', 'unbind', 'delete', 'account reload'] as const)('withdraws the held relation and its label on target %s while retaining origin facts', async (change) => {
  const f = fixture(); await vi.advanceTimersByTimeAsync(120);
  const origin = (): ReturnType<LiveLayer['getMarks']>[number] | undefined => f.layer.getMarks().find((mark) => mark.id === 'origin');
  expect(origin()?.tethers).toHaveLength(1);
  const before = origin()!; f.hold(true);
  if (change === 'account reload') f.reloadTarget();
  else {
    const target = token('target', change === 'rebind' ? 'replacement' : 'owner', 'target.json');
    if (change === 'unbind') delete target.sourceReference;
    f.store.setState({ objects: { tokens: { origin: token('origin', 'builder', 'origin.json'), ...(change === 'delete' ? {} : { target }) }, texts: {} } });
  }
  expect(origin()?.tethers).toHaveLength(0); expect(origin()?.lines.some((line) => line.startsWith('Waiting on'))).toBe(false);
  expect(origin()?.halos[0]).toBe(before.halos[0]); expect(origin()?.pip).toBe(before.pip);
  await vi.advanceTimersByTimeAsync(120);
  expect(origin()?.tethers).toHaveLength(0); // Reload completion cannot create a new join while held.
  if (change === 'account reload') { f.hold(false); expect(origin()?.tethers).toHaveLength(1); }
});

it('retains the same relation while geometry moves without changing the target binding', async () => {
  const f = fixture(); await vi.advanceTimersByTimeAsync(120); f.hold(true);
  f.store.setState({ objects: { tokens: { origin: token('origin', 'builder', 'origin.json'), target: { ...token('target', 'owner', 'target.json'), x: 300 } }, texts: {} } });
  expect(f.layer.getMarks().find((mark) => mark.id === 'origin')?.tethers).toHaveLength(1);
});

it.each(['owner', 'work endpoint'] as const)('withdraws the work-endpoint relation when its %s binding changes during a hold', async (change) => {
  const f = fixture(true); await vi.advanceTimersByTimeAsync(120);
  const origin = (): ReturnType<LiveLayer['getMarks']>[number] | undefined => f.layer.getMarks().find((mark) => mark.id === 'origin');
  expect(origin()?.tethers[0]?.targetId).toBe('work');
  expect(origin()?.lines.some((line) => line.includes('owned by target'))).toBe(true);
  const before = origin()!; f.hold(true);
  f.store.setState({ objects: { tokens: { origin: token('origin', 'builder', 'origin.json'), target: token('target', change === 'owner' ? 'replacement' : 'owner', 'target.json'),
    work: token('work', change === 'work endpoint' ? 'different-item' : 'mapped-review', 'work.json') }, texts: {} } });
  expect(origin()?.tethers).toHaveLength(0); expect(origin()?.lines.some((line) => line.startsWith('Waiting on'))).toBe(false);
  expect(origin()?.halos[0]).toBe(before.halos[0]); expect(origin()?.pip).toBe(before.pip);
});
