import { EventEmitter } from 'events';
import { describe, expect, it, vi } from 'vitest';
import { createInMemoryApp } from '../mocks/inMemoryVault';

vi.mock('../../src/app/MapController', () => ({
  MapController: { loadAndDisplay: vi.fn(async () => ({ mapData: { background: null }, backgroundUrl: null })) },
}));

import { DEFAULT_TOKEN_SETTINGS, createViewAtlasStore } from '../../src/app/storeFactory';
import { MapService } from '../../src/app/services/MapService';
import type { RendererService } from '../../src/app/services/RendererService';
import { createDefaultInitiativeState } from '../../src/app/types/initiativeTypes';
import { getDataFilePath } from '../../src/app/utils/dataFileMigration';

const BATTLE = 'maps/battle.atlasmap';
const LIBRARY = 'maps/library.atlasmap';
const NEW_SCENE = 'maps/new.atlasmap';

/** A scene saved before maps kept their own initiative, dice log and token settings. */
const olderScene = (mapPath: string): string => JSON.stringify({
  state: {
    schema: 'atlas-vtt', version: 4, mapPath, background: null, grid: null, camera: { x: 0, y: 0, scale: 1 },
    objects: { tokens: {}, fog: {}, pins: {}, texts: {}, drawings: {}, walls: {}, lights: {}, audios: {} },
  },
  version: 4,
});

interface SavedScene {
  initiative: unknown;
  initiativeTrackerOpen: unknown;
  diceLog: unknown;
  tokenSettings: unknown;
}

function setup(): { service: MapService; store: ReturnType<typeof createViewAtlasStore>; files: Map<string, string>; open: (path: string) => Promise<void> } {
  const { app, files } = createInMemoryApp({ files: { [getDataFilePath(BATTLE)]: olderScene(BATTLE), [getDataFilePath(LIBRARY)]: olderScene(LIBRARY) } });
  app.vault.getFileByPath = app.vault.getAbstractFileByPath;
  app.vault.getFolderByPath = app.vault.getAbstractFileByPath;
  const store = createViewAtlasStore(app, 'scene-switch-test');
  const service = new MapService(app, new EventEmitter(), store);
  const rendererService = { getRenderer: () => ({}) } as unknown as RendererService;
  const open = async (path: string): Promise<void> => {
    await service.loadMap(rendererService, path);
    await store.flushStorage();
  };
  return { service, store, files, open };
}

/** Plays a round in the open scene: initiative, the tracker, a roll and changed token display. */
function playARound(store: ReturnType<typeof createViewAtlasStore>): void {
  const state = store.getState();
  state.addToInitiative({
    tokenId: 'token-1', name: 'Scout', initiative: 14, initiativeModifier: 2, hp: { current: 9, max: 9 },
    imagePath: 'art/scout.webp', isDefeated: false, isNPC: true,
  });
  state.startCombat();
  state.setInitiativeTrackerOpen(true);
  state.addDiceLogEntry({ id: 'roll-1', timestamp: 1, formula: '1d20', rolls: [{ die: 'd20', value: 14, max: 20 }], modifiers: 0, total: 14 });
  state.setTokenSettings({ ...DEFAULT_TOKEN_SETTINGS, showNameplates: true, tokenRingSize: 2 });
}

const savedScene = (files: Map<string, string>, path: string): SavedScene => (JSON.parse(files.get(getDataFilePath(path))!) as { state: SavedScene }).state;

const DEFAULTS: SavedScene = {
  initiative: createDefaultInitiativeState(),
  initiativeTrackerOpen: false,
  diceLog: [],
  tokenSettings: DEFAULT_TOKEN_SETTINGS,
};

describe('MapService.loadMap scene switch', () => {
  it('opens an older scene without the previous scene\'s initiative, dice log or token settings', async () => {
    const { store, files, open } = setup();
    await open(BATTLE);
    playARound(store);
    await store.flushStorage();
    expect(savedScene(files, BATTLE).diceLog).toHaveLength(1);

    await open(LIBRARY);

    const { initiative, initiativeTrackerOpen, diceLog, tokenSettings } = store.getState();
    expect({ initiative, initiativeTrackerOpen, diceLog, tokenSettings }).toEqual(DEFAULTS);
    const saved = savedScene(files, LIBRARY);
    expect({ initiative: saved.initiative, initiativeTrackerOpen: saved.initiativeTrackerOpen, diceLog: saved.diceLog, tokenSettings: saved.tokenSettings }).toEqual(DEFAULTS);
  });

  it('starts a scene that has no file yet from the defaults', async () => {
    const { store, open } = setup();
    await open(BATTLE);
    playARound(store);

    await open(NEW_SCENE);

    const { initiative, initiativeTrackerOpen, diceLog, tokenSettings } = store.getState();
    expect({ initiative, initiativeTrackerOpen, diceLog, tokenSettings }).toEqual(DEFAULTS);
  });

  it('keeps a scene\'s own initiative, dice log and token settings when it is opened again', async () => {
    const { store, files, open } = setup();
    await open(BATTLE);
    playARound(store);
    await store.flushStorage();
    const battle = savedScene(files, BATTLE);

    await open(LIBRARY);
    await open(BATTLE);

    const { initiative, initiativeTrackerOpen, diceLog, tokenSettings } = store.getState();
    expect({ initiative, initiativeTrackerOpen, diceLog, tokenSettings }).toEqual({
      initiative: battle.initiative, initiativeTrackerOpen: true, diceLog: battle.diceLog, tokenSettings: battle.tokenSettings,
    });
  });
});

describe('clearMapState', () => {
  it('returns every saved per-scene field to what a new view starts with', async () => {
    const { app } = createInMemoryApp();
    app.vault.getFolderByPath = app.vault.getAbstractFileByPath;
    const store = createViewAtlasStore(app, 'clear-map-state-test');
    const fresh = store.persist.getOptions().partialize!(store.getState()) as Record<string, unknown>;
    const state = store.getState();
    state.setMapPath(BATTLE);
    playARound(store);
    state.setDMNotePath('notes/battle.md');
    state.setLootRollerOpen(true);
    state.addToken({ imagePath: 'art/scout.webp', x: 35, y: 35, size: 1 });

    state.clearMapState();
    await store.flushStorage();

    // The map path stays bound for the save; the new scene sets its own background.
    const cleared = store.persist.getOptions().partialize!(store.getState()) as Record<string, unknown>;
    const { mapPath: _clearedPath, background: _clearedBackground, ...clearedScene } = cleared;
    const { mapPath: _freshPath, background: _freshBackground, ...freshScene } = fresh;
    expect(clearedScene).toEqual(freshScene);
  });
});
