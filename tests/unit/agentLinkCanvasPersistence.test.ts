import { afterEach, expect, it, vi } from 'vitest';
import { createViewAtlasStore } from '../../src/app/storeFactory';
import { LiveLayer } from '../../src/app/agent-links/overlay/LiveLayer';
import type { NativeSources } from '../../src/app/agent-links/NativeSources';
import type { AccountDocument, SeatSubject } from '../../src/app/agent-links/account/accountSchema';
import type { Observation, ObservationHandle } from '../../src/app/agent-links/live/types';
import type { InventoryRead } from '../../src/app/agent-links/live/OpenRigLive';
import type { OwnedWork } from '../../src/app/agent-links/reads';
import { createInMemoryApp } from '../mocks/inMemoryVault';
import { getDataFilePath } from '../../src/app/utils/dataFileMigration';

const { scheduled } = vi.hoisted(() => ({ scheduled: vi.fn() }));
vi.mock('../../src/app/services/MapPersistence', async (original) => {
  const actual = await original<typeof import('../../src/app/services/MapPersistence')>();
  return { ...actual, createAtlasStorage: (...args: Parameters<typeof actual.createAtlasStorage>): ReturnType<typeof actual.createAtlasStorage> => {
    const storage = actual.createAtlasStorage(...args), setItem = storage.setItem;
    storage.setItem = (...writes): ReturnType<typeof setItem> => { scheduled(...writes); return setItem(...writes); };
    return storage;
  } };
});
afterEach(() => vi.useRealTimers());

function controlled<T>(initial: T): { watch: () => ObservationHandle<T>; put: (value: T) => void; refs: () => number } {
  let refs = 0, value: Observation<T> = { value: initial, sourceKey: 'a', epoch: 1, revision: 1, observedAt: '2026-01-01T12:00:00Z', freshness: 'live', message: null };
  const listeners = new Set<() => void>();
  return { put: (next): void => { value = { ...value, value: next, revision: value.revision + 1 }; listeners.forEach((listener) => listener()); }, refs: () => refs,
    watch: (): ObservationHandle<T> => { refs++; let released = false; return {
      getSnapshot: () => value, isReady: () => true, whenReady: async () => {}, refresh: () => {},
      subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
      release: () => { if (!released) { released = true; refs--; } },
    }; } };
}

it('passive canvas facts, layer toggle and privacy reactions preserve scene/account bytes, values and history with zero scheduled writes', async () => {
  const subject: SeatSubject = { id: 'builder', kind: 'seat', sourceKey: 'a', caption: 'Builder', policy: 'current-seat', workIds: [],
    seat: { rigId: 'rig-a', nodeId: 'node-a', logicalId: 'builder' }, observedAt: '2026-01-01T10:00:00Z' };
  const account: AccountDocument = { format: 'atlas-source-account', version: 1, capturedAt: subject.observedAt, subjects: [subject], sources: [], work: [], artifacts: [] };
  const memory = createInMemoryApp({ files: { 'account.json': JSON.stringify(account) } });
  const store = createViewAtlasStore(memory.app, 'canvas-persistence');
  await store.persist.rehydrate(); store.getState().setMapPath('maps/example.atlasmap');
  store.getState().setGrid({ enabled: true, size: 70, type: 'square', offsetX: 0, offsetY: 0, opacity: 1 });
  const id = store.getState().addToken({ imagePath: 'art/example.webp', x: 100, y: 100, size: 1 });
  store.getState().updateToken(id, { sourceReference: { accountPath: 'account.json', subjectId: subject.id } });
  await store.flushStorage(); expect(scheduled).toHaveBeenCalled();
  const saved = new Map(memory.files), before = store.getState(), history = store.temporal.getState().pastStates;
  scheduled.mockClear(); vi.mocked(memory.app.vault.process).mockClear(); vi.mocked(memory.app.vault.create).mockClear(); vi.mocked(memory.app.vault.adapter.write).mockClear();
  const inventory = controlled<InventoryRead>({ nodes: [{ nodeId: 'node-a', rigId: 'rig-a', activityState: { display: 'working' } }], complete: true, observedAt: '2026-01-01T12:00:00Z' });
  const owned = controlled<OwnedWork>({ state: 'current', sessionName: 'builder@example', items: [], truncated: false, observedAt: '2026-01-01T12:00:00Z' });
  const neverExact = vi.fn(() => { throw new Error('Canvas cannot demand identity'); });
  const sources = { live: { openRig: () => ({ watchInventory: inventory.watch, watchOwned: owned.watch, watchSeat: neverExact,
    getConnection: () => ({ status: 'connected', epoch: 1 }), subscribeConnection: () => () => {} }), subscribe: () => () => {}, getRevision: () => 0, peekConversation: () => null },
  loadAccount: async (path: string) => ({ account, path, sha256: 'authored', loadedAt: '2026-01-01T12:00:00Z' }) } as unknown as NativeSources;
  vi.useFakeTimers(); const layer = new LiveLayer(memory.app, store, sources);
  try {
    await vi.advanceTimersByTimeAsync(120);
    expect(layer.getMarks()[0]?.halos[0]?.activity).toBe('working');
    inventory.put({ nodes: [{ nodeId: 'node-a', rigId: 'rig-a', activityState: { display: 'idle' } }], complete: true, observedAt: '2026-01-01T12:01:00Z' });
    expect(layer.getMarks()[0]?.halos[0]?.activity).toBe('idle');
    layer.toggle(); expect(inventory.refs()).toBe(0); layer.toggle(); await vi.advanceTimersByTimeAsync(120);
    expect(layer.getMarks()).toHaveLength(1);
    await store.flushStorage(); expect(scheduled).not.toHaveBeenCalled(); // Passive work alone.
    store.getState().setGMView(false); expect(layer.getMarks()).toHaveLength(0); expect(inventory.refs()).toBe(0);
    store.getState().setGMView(true); await vi.advanceTimersByTimeAsync(120);
    store.setState({ isPlayerView: true }); expect(layer.getMarks()).toHaveLength(0);
    store.setState({ isPlayerView: false }); await vi.advanceTimersByTimeAsync(120);
    await store.flushStorage();
    expect(scheduled).not.toHaveBeenCalled(); expect(memory.app.vault.process).not.toHaveBeenCalled(); expect(memory.app.vault.create).not.toHaveBeenCalled(); expect(memory.app.vault.adapter.write).not.toHaveBeenCalled();
    expect(memory.files.get(getDataFilePath('maps/example.atlasmap'))).toBeDefined(); expect(memory.files).toEqual(saved);
    expect(store.getState().objects).toBe(before.objects); expect(store.getState().widgetValues).toBe(before.widgetValues); expect(store.temporal.getState().pastStates).toBe(history);
    expect(neverExact).not.toHaveBeenCalled();
  } finally { layer.dispose(); }
  expect(inventory.refs()).toBe(0); expect(owned.refs()).toBe(0); expect(vi.getTimerCount()).toBe(0);
});
