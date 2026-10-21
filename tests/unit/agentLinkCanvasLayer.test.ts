import { afterEach, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import type { ViewAtlasStore } from '../../src/app/storeFactory';
import type { AccountDocument, SeatSubject } from '../../src/app/agent-links/account/accountSchema';
import type { InventoryRead } from '../../src/app/agent-links/live/OpenRigLive';
import type { ConnectionState, Observation, ObservationHandle } from '../../src/app/agent-links/live/types';
import type { NativeSources } from '../../src/app/agent-links/NativeSources';
import type { LiveSources } from '../../src/app/agent-links/live/LiveSources';
import type { OwnedWork } from '../../src/app/agent-links/reads';
import { LiveLayer } from '../../src/app/agent-links/overlay/LiveLayer';
import { createInMemoryApp } from '../mocks/inMemoryVault';

function observed<T>(value: T): Observation<T> { return { sourceKey: 'a', epoch: 1, revision: 1, value, observedAt: '2026-01-01T12:00:00Z', freshness: 'live', message: null }; }
function controlled<T>(initial: Observation<T>, ready: () => boolean): { watch: () => ObservationHandle<T>; put: (value: Observation<T>) => void; refs: () => number } {
  let value = initial, refs = 0; const listeners = new Set<() => void>();
  return { refs: () => refs, put: (next): void => { value = next; listeners.forEach((listener) => listener()); }, watch: (): ObservationHandle<T> => {
    refs++; let released = false;
    return { getSnapshot: () => value, isReady: ready, whenReady: async () => {}, refresh: () => {},
      subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
      release: () => { if (!released) { refs--; released = true; } } };
  } };
}
const seat = (id = 'node-a'): SeatSubject => ({ id, kind: 'seat', caption: id, sourceKey: 'a', seat: { nodeId: id, rigId: 'rig-a', logicalId: id },
  policy: 'captured-conversation', participant: { runtime: 'codex', conversationId: 'captured', observedAt: '2026-01-01T10:00:00Z' }, workIds: [], observedAt: '2026-01-01T10:00:00Z' });
const appearance = (id: string, subjectId: string): Record<string, unknown> => ({ id, kind: 'token', name: id, x: 100, y: 100, size: 1, sourceReference: { accountPath: 'account.json', subjectId } });
const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); vi.useRealTimers(); });

function fixture(mixed = false): {
  layer: LiveLayer; store: ReturnType<typeof createStore>; inventory: ReturnType<typeof controlled<InventoryRead>>;
  owned: ReturnType<typeof controlled<OwnedWork>>; hold: (held: boolean) => void; reads: ReturnType<typeof vi.fn>; exact: ReturnType<typeof vi.fn>;
  holdOnReady: () => void;
  otherInventory: ReturnType<typeof controlled<InventoryRead>>;
} {
  vi.useFakeTimers();
  let connection: ConnectionState = { status: 'connected', since: '2026-01-01T12:00:00Z', epoch: 1, message: null };
  const connectionListeners = new Set<() => void>();
  let holdOnReady = false;
  const ready = (): boolean => {
    if (holdOnReady) { holdOnReady = false; connection = { ...connection, checkingOrder: true }; connectionListeners.forEach((listener) => listener()); }
    return !connection.checkingOrder;
  };
  const inventory = controlled<InventoryRead>(observed({ complete: true, observedAt: '2026-01-01T12:00:00Z', nodes: [{ nodeId: 'node-a', rigId: 'rig-a', activityState: { display: 'working' } }] }), ready);
  const owned = controlled<OwnedWork>(observed({ state: 'current', items: [], truncated: false, sessionName: 'builder@example', observedAt: '2026-01-01T12:00:00Z' }), ready);
  const exact = vi.fn(() => { throw new Error('Overlay must never request an exact/process read'); });
  const model = { watchInventory: vi.fn(inventory.watch), watchOwned: vi.fn(owned.watch), watchSeat: exact,
    getConnection: () => connection, subscribeConnection: (listener: () => void) => { connectionListeners.add(listener); return () => connectionListeners.delete(listener); } };
  const otherInventory = controlled<InventoryRead>({ ...observed({ complete: true, observedAt: '2026-01-01T11:00:00Z', nodes: [{ nodeId: 'node-1', rigId: 'rig-a', activityState: { display: 'idle' } }] }),
    sourceKey: 'b', epoch: 2, freshness: 'last-known', observedAt: '2026-01-01T11:00:00Z', message: 'Source disconnected' }, () => false);
  const otherModel = { watchInventory: otherInventory.watch, getConnection: () => ({ status: 'reconnecting', epoch: 2 }), subscribeConnection: () => () => {} };
  const registry = { openRig: (source: string) => source === 'b' ? otherModel : model, getRevision: () => 0, subscribe: () => () => {}, peekConversation: () => null } as unknown as LiveSources;
  const members = Array.from({ length: 5 }, (_, i) => seat(i ? `node-${i}` : 'node-a'));
  if (mixed) members[1]!.sourceKey = 'b';
  const account: AccountDocument = { format: 'atlas-source-account', version: 1, capturedAt: '2026-01-01T10:00:00Z', sources: [], subjects: [...members,
    { id: 'panel', kind: 'group', caption: 'Panel', purpose: 'Review', observedAt: '2026-01-01T10:00:00Z', members: members.map((member, i) => ({ subjectId: member.id, lens: `Lens ${i}` })), membership: { basis: 'authored', observedAt: '2026-01-01T10:00:00Z' } }], work: [], artifacts: [] };
  const reads = vi.fn(async () => ({ account, path: 'account.json', sha256: 'revision-a', loadedAt: '2026-01-01T12:00:00Z' }));
  const sources = { live: registry, loadAccount: reads } as unknown as NativeSources;
  const store = createStore(() => ({ objects: { tokens: { token: appearance('token', 'node-a'), panel: appearance('panel', 'panel') }, texts: {} },
    isGMView: true, isPlayerView: false, isMapLoading: false, mapPath: 'map.atlasmap' }));
  const { app } = createInMemoryApp(); const layer = new LiveLayer(app, store as unknown as ViewAtlasStore, sources);
  cleanups.push(() => layer.dispose());
  return { layer, store: store as ReturnType<typeof createStore>, inventory, owned, otherInventory, reads, exact, holdOnReady: (): void => { holdOnReady = true; }, hold: (checkingOrder): void => {
    connection = { ...connection, checkingOrder }; connectionListeners.forEach((listener) => listener());
  } };
}

it('shares selectors across seat and five charter segments, scopes current-seat hover and never demands exact identity', async () => {
  const f = fixture(); await vi.advanceTimersByTimeAsync(120);
  expect(f.layer.getMarks()).toHaveLength(2);
  expect(f.layer.getMarks().find((mark) => mark.id === 'panel')?.halos).toHaveLength(5);
  expect(f.layer.getMarks().find((mark) => mark.id === 'panel')?.lines.map((line) => line.split(' · ')[0])).toEqual(['Lens 0', 'Lens 1', 'Lens 2', 'Lens 3', 'Lens 4']);
  expect(f.inventory.refs()).toBe(1); expect(f.owned.refs()).toBe(1); expect(f.reads).toHaveBeenCalledTimes(1); expect(f.exact).not.toHaveBeenCalled();
  f.layer.setHovered('token'); expect(f.layer.getHover()?.lines).toContain('Current seat');
  expect(f.layer.getHover()?.lines.some((line) => line.startsWith('Seat activity now: working'))).toBe(true);
});

it('keeps charter segments independent when one source is disconnected and another is held', async () => {
  const f = fixture(true); await vi.advanceTimersByTimeAsync(120);
  const group = (): ReturnType<LiveLayer['getMarks']>[number] | undefined => f.layer.getMarks().find((mark) => mark.id === 'panel');
  expect(group()?.halos).toHaveLength(5);
  expect(group()?.halos[0]).toMatchObject({ sourceKey: 'a', activity: 'working', freshness: 'live' });
  expect(group()?.halos[1]).toMatchObject({ sourceKey: 'b', activity: 'idle', freshness: 'last-known' });
  expect(group()?.lines[1]).toContain('Lens 1 · node-1 · current seat · idle · Last known 11:00Z');
  f.hold(true);
  f.otherInventory.put({ ...observed({ nodes: [{ nodeId: 'node-1', rigId: 'rig-a', activityState: { display: 'needs-input' } }], complete: true, observedAt: '2026-01-01T11:01:00Z' }),
    sourceKey: 'b', epoch: 2, freshness: 'last-known' });
  expect(group()?.halos[0]?.activity).toBe('working'); expect(group()?.halos[1]?.activity).toBe('needs-input');
  f.layer.dispose(); expect(f.otherInventory.refs()).toBe(0); expect(f.inventory.refs()).toBe(0);
});

it('freezes published native facts during a hold while rebinding immediately withdraws the old identity', async () => {
  const f = fixture(); await vi.advanceTimersByTimeAsync(120);
  f.hold(true);
  f.inventory.put(observed({ complete: true, observedAt: '2026-01-01T12:01:00Z', nodes: [{ nodeId: 'node-a', rigId: 'rig-a', activityState: { display: 'idle' } }] }));
  expect(f.layer.getMarks().find((mark) => mark.id === 'token')?.halos[0]?.activity).toBe('working');
  f.store.setState({ objects: { tokens: { token: appearance('token', 'node-1') }, texts: {} } });
  const halo = f.layer.getMarks()[0]?.halos[0];
  expect(halo?.activity).toBe('unknown'); expect(halo?.label).not.toContain('Not in OpenRig now');
  expect(f.layer.getMarks()[0]?.pip?.count).toBeNull();
  f.hold(false);
  expect(f.layer.getMarks()[0]?.halos[0]?.activity).toBe('absent');
});

it('rejects new publication when readiness synchronously discovers an order hole', async () => {
  const f = fixture(); await vi.advanceTimersByTimeAsync(120);
  const published: string[] = [];
  const unsubscribe = f.layer.subscribe(() => published.push(f.layer.getMarks().find((mark) => mark.id === 'token')?.halos[0]?.activity ?? 'none'));
  f.holdOnReady();
  f.inventory.put(observed({ complete: true, observedAt: '2026-01-01T12:01:00Z', nodes: [{ nodeId: 'node-a', rigId: 'rig-a', activityState: { display: 'idle' } }] }));
  expect(published).toEqual(['working']);
  f.hold(false); expect(f.layer.getMarks().find((mark) => mark.id === 'token')?.halos[0]?.activity).toBe('idle');
  unsubscribe();
});

it.each(['isPlayerView', 'isGMView'] as const)('privacy transition %s during a hold clears marks/hover and all owned handles', async (flag) => {
  const f = fixture(); await vi.advanceTimersByTimeAsync(120); f.layer.setHovered('token'); f.hold(true);
  f.store.setState({ [flag]: flag === 'isPlayerView' });
  expect(f.layer.getMarks()).toHaveLength(0); expect(f.layer.getHover()).toBeNull();
  expect(f.inventory.refs()).toBe(0); expect(f.owned.refs()).toBe(0); expect(vi.getTimerCount()).toBe(0);
});

it('off cancels a queued account read and does not start it later', async () => {
  const f = fixture(); f.layer.toggle(); await vi.advanceTimersByTimeAsync(1000);
  expect(f.reads).not.toHaveBeenCalled(); expect(f.layer.getMarks()).toHaveLength(0); expect(vi.getTimerCount()).toBe(0);
});

it('keeps a broken authored reference visibly unavailable instead of silently dropping its mark', async () => {
  const f = fixture();
  f.store.setState({ objects: { tokens: { token: appearance('token', 'missing-subject') }, texts: {} } });
  await vi.advanceTimersByTimeAsync(120);
  expect(f.layer.getMarks()).toHaveLength(1);
  expect(f.layer.getMarks()[0]?.halos[0]).toMatchObject({ activity: 'unknown', freshness: 'unavailable' });
  expect(f.layer.getMarks()[0]?.halos[0]?.label).toBe('Activity not confirmed · Unavailable: Subject not found in this account');
  expect(f.layer.getMarks()[0]?.lines.join()).toContain('Subject not found in this account');
  expect(f.exact).not.toHaveBeenCalled();
});
