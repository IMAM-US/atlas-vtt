import { expect, it, vi } from 'vitest';
import { createViewAtlasStore, type ViewAtlasStore } from '../../src/app/storeFactory';
import type { CounterWidget } from '../../src/app/types/widgetTypes';
import type { WidgetSettings } from '../../src/app/types/widgetTypes';
import { getDataFilePath } from '../../src/app/utils/dataFileMigration';
import { createInMemoryApp, type InMemoryApp } from '../mocks/inMemoryVault';

const { scheduled } = vi.hoisted(() => ({ scheduled: vi.fn() }));
vi.mock('../../src/app/services/MapPersistence', async (original) => {
  const actual = await original<typeof import('../../src/app/services/MapPersistence')>();
  return { ...actual, createAtlasStorage: (...args: Parameters<typeof actual.createAtlasStorage>): ReturnType<typeof actual.createAtlasStorage> => {
    const storage = actual.createAtlasStorage(...args), setItem = storage.setItem;
    storage.setItem = (...writes): ReturnType<typeof setItem> => { scheduled(...writes); return setItem(...writes); };
    return storage;
  } };
});

const counter: CounterWidget = { id: 'counter', type: 'counter', label: 'Torches', icon: 'skull', scope: 'scene', visible: true, visibleToPlayers: true, value: 0, order: 0 };
const path = 'maps/example.atlasmap';
async function fixture(id: string): Promise<InMemoryApp & { store: ViewAtlasStore; tokenId: string }> {
  const memory = createInMemoryApp(), store = createViewAtlasStore(memory.app, id);
  await store.persist.rehydrate(); store.getState().setMapPath(path);
  store.getState().setGrid({ enabled: true, size: 70, type: 'square', offsetX: 0, offsetY: 0, opacity: 1 });
  store.getState().setWidgetSettings({ widgets: { counter, shared: { ...counter, id: 'shared', scope: 'collection' } }, globalVisible: true, position: 'top', scale: 1 });
  store.getState().setWidgetValue('counter', 3); store.getState().setWidgetValue('shared', 7);
  const tokenId = store.getState().addToken({ imagePath: 'art/example.webp', x: 100, y: 100, size: 1 });
  await store.flushStorage();
  expect(memory.files.get(getDataFilePath(path))).toBeDefined();
  return { ...memory, store, tokenId };
}

it('GM preview and transient UI updates schedule zero writes and leave saved bytes and history unchanged', async () => {
  const f = await fixture('preview-reference-stability');
  expect(scheduled).toHaveBeenCalled();
  const before = f.files.get(getDataFilePath(path)), state = f.store.getState();
  const historyLength = f.store.temporal.getState().pastStates.length;
  scheduled.mockClear(); vi.mocked(f.app.vault.process).mockClear(); vi.mocked(f.app.vault.create).mockClear();
  f.store.getState().setGMView(false); f.store.getState().setGMView(true);
  f.store.getState().setSelection([f.tokenId]); f.store.getState().setSelection([]);
  f.store.setState({ isPlayerView: true }); f.store.setState({ isPlayerView: false });
  await f.store.flushStorage();
  expect(scheduled).not.toHaveBeenCalled(); expect(f.app.vault.process).not.toHaveBeenCalled(); expect(f.app.vault.create).not.toHaveBeenCalled();
  expect(f.files.get(getDataFilePath(path))).toBe(before);
  expect(f.store.getState().objects).toBe(state.objects); expect(f.store.getState().widgetValues).toBe(state.widgetValues);
  expect(f.store.temporal.getState().pastStates).toHaveLength(historyLength);
});

it('real grid, widget definition, widget value and object changes still schedule and write their new state', async () => {
  const f = await fixture('persisted-change-positive-controls');
  interface SavedState { grid: { size: number }; widgetSettings: WidgetSettings; widgetValues: Record<string, number>; objects: { tokens: Record<string, { x: number }> } }
  const saved = (): SavedState => JSON.parse(f.files.get(getDataFilePath(path))!).state as SavedState;
  expect(saved().widgetSettings.widgets.shared).toBeUndefined(); expect(saved().widgetValues.shared).toBeUndefined();
  const controls = [
    { change: () => f.store.getState().setGrid({ ...f.store.getState().grid!, size: 90 }), check: () => expect(saved().grid.size).toBe(90) },
    { change: () => f.store.getState().updateWidget('counter', { label: 'Lanterns' }), check: () => expect(saved().widgetSettings.widgets.counter?.label).toBe('Lanterns') },
    { change: () => f.store.getState().setWidgetValue('counter', 4), check: () => expect(saved().widgetValues.counter).toBe(4) },
    { change: () => f.store.getState().updateToken(f.tokenId, { x: 240 }), check: () => expect(saved().objects.tokens[f.tokenId]?.x).toBe(240) },
  ];
  for (const control of controls) {
    const before = f.files.get(getDataFilePath(path)); scheduled.mockClear();
    control.change(); expect(scheduled).toHaveBeenCalled(); await f.store.flushStorage();
    expect(f.files.get(getDataFilePath(path))).not.toBe(before); control.check();
  }
});
