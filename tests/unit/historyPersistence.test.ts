import { expect, it } from 'vitest';
import { createViewAtlasStore } from '../../src/app/storeFactory';
import { getDataFilePath } from '../../src/app/utils/dataFileMigration';
import { createInMemoryApp } from '../mocks/inMemoryVault';

const SCENE = 'maps/example.atlasmap';

it('saves undo and redo to the map file like any other change', async () => {
  const memory = createInMemoryApp();
  const store = createViewAtlasStore(memory.app, 'history-persistence');
  await store.persist.rehydrate();
  store.getState().setMapPath(SCENE);
  await store.flushStorage();
  const saved = (): string[] => Object.keys((JSON.parse(memory.files.get(getDataFilePath(SCENE))!) as { state: { objects: { tokens: Record<string, unknown> } } }).state.objects.tokens);
  expect(saved()).toEqual([]);
  const id = store.getState().addToken({ imagePath: 'art/example.webp', x: 35, y: 35, size: 1 });
  await store.flushStorage();
  expect(saved()).toEqual([id]);
  store.temporal.getState().undo();
  await store.flushStorage();
  expect(saved()).toEqual([]);
  store.temporal.getState().redo();
  await store.flushStorage();
  expect(saved()).toEqual([id]);
  expect(store.temporal.getState().pastStates).toHaveLength(1);
});
