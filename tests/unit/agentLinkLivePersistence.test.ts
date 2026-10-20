import { expect, it, vi } from 'vitest';
import { createViewAtlasStore } from '../../src/app/storeFactory';
import { createInMemoryApp } from '../mocks/inMemoryVault';
import { OpenRigLive } from '../../src/app/agent-links/live/OpenRigLive';
import { defaultSourceSettings } from '../../src/app/agent-links/sourceSettings';
import type { NativeEvent } from '../../src/app/agent-links/live/types';
import type { SeatSubject } from '../../src/app/agent-links/account/accountSchema';

const { scheduled } = vi.hoisted(() => ({ scheduled: vi.fn() }));
vi.mock('../../src/app/services/MapPersistence', async (original) => {
  const actual = await original<typeof import('../../src/app/services/MapPersistence')>();
  return { ...actual, createAtlasStorage: (...args: Parameters<typeof actual.createAtlasStorage>): ReturnType<typeof actual.createAtlasStorage> => {
    const storage = actual.createAtlasStorage(...args);
    const setItem = storage.setItem;
    storage.setItem = (...writes): ReturnType<typeof setItem> => { scheduled(...writes); return setItem(...writes); };
    return storage;
  } };
});

it('model updates schedule no map write, with a positive control on the real persistence seam', async () => {
  const { app } = createInMemoryApp();
  const store = createViewAtlasStore(app, 'native-live-persistence');
  await store.persist.rehydrate();
  store.setState({ mapPath: 'maps/example.atlasmap' });
  store.getState().setGrid({ enabled: true, size: 70, type: 'square', offsetX: 0, offsetY: 0, opacity: 1 });
  await vi.waitFor(() => expect(scheduled).toHaveBeenCalled());
  scheduled.mockClear();
  const viewChanged = vi.fn();
  const unsubscribe = store.subscribe(viewChanged);
  let incoming: ((event: NativeEvent) => void) | undefined;
  let revision = 1;
  const model = new OpenRigLive({ settings: { ...defaultSourceSettings('source-a'), openRigEndpoint: 'http://127.0.0.1:1', openRigHostId: 'host-a' }, backend: {
    readSeat: async () => ({ state: 'unavailable', message: 'Not used', observedAt: new Date().toISOString() }),
    readWork: async () => ({ state: 'unavailable', message: 'Not used', observedAt: new Date().toISOString() }),
    readOwned: async () => ({ state: 'current', sessionName: 'builder@example', items: [{ qitemId: `work-${revision}` }], truncated: false, observedAt: new Date().toISOString() }),
  } }, { frontier: async () => ({ hostId: 'host-a', bootEpoch: 'boot-a', seq: '0' }),
    subscribe: async (_source, _frontier, _signal, onEvent) => { incoming = onEvent; return { close: (): void => {} }; } }, 1);
  const subject: SeatSubject = { id: 'a', kind: 'seat', sourceKey: 'source-a', caption: 'Builder', policy: 'current-seat', workIds: [], observedAt: '', seat: { rigId: 'rig-a', nodeId: 'node-a', logicalId: 'builder' } };
  const handle = model.watchOwned(subject);
  try {
    await vi.waitFor(() => expect(handle.getSnapshot().freshness).toBe('live'));
    revision = 2; incoming?.({ type: 'queue.updated', seq: 1 });
    await vi.waitFor(() => expect(handle.getSnapshot().value).toMatchObject({ items: [{ qitemId: 'work-2' }] }));
    expect(viewChanged).not.toHaveBeenCalled();
    expect(scheduled).not.toHaveBeenCalled();
  } finally { handle.release(); model.dispose(); unsubscribe(); }
});
