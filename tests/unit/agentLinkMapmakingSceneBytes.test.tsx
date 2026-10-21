import React from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createViewAtlasStore } from '../../src/app/storeFactory';
import { ViewStoreProvider } from '../../src/app/react/ViewStoreContext';
import { AtlasUIContext } from '../../src/app/react/root/AtlasUIContext';
import { InitiativeTracker } from '../../src/app/react/components/InitiativeTracker';
import type { NativeSources } from '../../src/app/agent-links/NativeSources';
import { validateAccount } from '../../src/app/agent-links/account/accountValidation';
import { textSha256 } from '../../src/app/agent-links/account/accountWriter';
import type { InventoryRead } from '../../src/app/agent-links/live/OpenRigLive';
import type { Observation, ObservationHandle } from '../../src/app/agent-links/live/types';
import { MapmakingSession } from '../../src/app/agent-links/mapmaking/MapmakingSession';
import type { ProposalGhostRenderer } from '../../src/app/agent-links/mapmaking/ProposalGhostRenderer';
import { getDataFilePath } from '../../src/app/utils/dataFileMigration';
import { createInMemoryApp } from '../mocks/inMemoryVault';
import { exampleAccount } from '../fixtures/exampleAccount';

vi.mock('../../src/app/react/components/InitiativeCard', () => ({ InitiativeCard: () => <div data-testid="initiative-card" /> }));
vi.mock('../../src/app/react/components/StatblockHoverPreview', () => ({
  StatblockHoverPreview: () => null,
  useStatblockHoverPreview: () => [{ hoveredEntry: null, statblockData: null, statblockFile: null, isVisible: false, isClosing: false, position: null, anchorRect: null },
    { showPreview: vi.fn(), closePreview: vi.fn(), clearPreview: vi.fn() }],
}));
afterEach(() => vi.useRealTimers());

const PATH = 'atlas-vtt/collections/Example/accounts/team.json';
const SCENE = 'atlas-vtt/collections/Example/scenes/Example.atlasmap';
const nodes = [{ nodeId: 'node-builder', logicalId: 'team.builder', podId: 'pod-team', rigId: 'rig-one', hostSelfId: 'host-one' },
  { nodeId: 'node-new', logicalId: 'team.new', podId: 'pod-team', rigId: 'rig-one', hostSelfId: 'host-one' }];

it('Apply then undo, each saved by the real map saver with the initiative tracker syncing, returns the saved baseline bytes', async () => {
  const memory = createInMemoryApp({ files: { [PATH]: `${JSON.stringify(validateAccount(exampleAccount()), null, 2)}\n` } });
  const store = createViewAtlasStore(memory.app, 'mapmaking-bytes');
  await store.persist.rehydrate();
  store.getState().setMapPath(SCENE);
  store.getState().setGrid({ enabled: true, size: 70, type: 'square', offsetX: 0, offsetY: 0, opacity: 1 });
  const builder = store.getState().addToken({ imagePath: 'art/example.webp', x: 105, y: 105, size: 1 });
  store.getState().updateToken(builder, { sourceReference: { accountPath: PATH, subjectId: 'seat:builder' } });
  store.setState({ initiativeTrackerOpen: true });
  render(<ViewStoreProvider store={store}><AtlasUIContext.Provider value={{ app: memory.app, view: null, pixiApp: null, renderer: null }}><InitiativeTracker /></AtlasUIContext.Provider></ViewStoreProvider>);
  // The tracker is live: it adds the map's own token on its own.
  expect(store.getState().initiative.entries.map((entry) => entry.tokenId)).toEqual([builder]);
  await store.flushStorage();
  const data = getDataFilePath(SCENE), baseline = memory.files.get(data);
  expect(baseline).toBeDefined();

  let snapshot: Observation<InventoryRead> = { sourceKey: 'local', epoch: 1, revision: 1, freshness: 'live', observedAt: '2026-01-01T12:00:00Z', message: null, value: { nodes, complete: true, observedAt: '2026-01-01T12:00:00Z' } };
  const listeners = new Set<() => void>();
  const handle = (): ObservationHandle<InventoryRead> => ({ getSnapshot: () => snapshot, isReady: () => true, whenReady: async () => {}, release: () => {},
    refresh: () => { snapshot = { ...snapshot, freshness: 'refreshing', revision: snapshot.revision + 1 }; listeners.forEach((listener) => listener()); },
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); } });
  const publish = (): void => { snapshot = { ...snapshot, freshness: 'live', revision: snapshot.revision + 1, value: { nodes, complete: true, observedAt: '2026-01-01T12:06:00Z' } }; listeners.forEach((listener) => listener()); };
  const sources = {
    live: { openRig: () => ({ watchInventory: handle, getConnection: () => ({ status: 'connected', since: null, message: null, epoch: 1 }), subscribeConnection: () => () => {} }), subscribe: () => () => {}, getRevision: () => 0 },
    loadAccount: async (path: string) => { const text = memory.files.get(path)!; return { account: validateAccount(JSON.parse(text)), path, sha256: textSha256(text), loadedAt: '2026-01-01T12:00:00Z' }; },
  } as unknown as NativeSources;
  vi.useFakeTimers();
  const session = new MapmakingSession(memory.app, store, sources, { setGhosts: vi.fn() } as unknown as ProposalGhostRenderer, () => ({ x: 0, y: 0, width: 700, height: 700 }));
  session.open(); await vi.advanceTimersByTimeAsync(200);
  const key = session.getSnapshot().set.notOnMap[0]!.key;
  await act(async () => { const applying = session.apply([{ key, caption: 'team.new' }]); await Promise.resolve(); publish(); await applying; });
  await act(async () => { await vi.advanceTimersByTimeAsync(600); });
  await store.flushStorage();
  expect(Object.keys(store.getState().objects.tokens)).toHaveLength(2);
  expect(memory.files.get(data)).not.toBe(baseline);
  expect(store.getState().initiative.entries.map((entry) => entry.tokenId)).toEqual([builder]);
  act(() => store.temporal.getState().undo());
  await act(async () => { await vi.advanceTimersByTimeAsync(600); });
  await store.flushStorage();
  expect(memory.files.get(data)).toBe(baseline);
  session.dispose();
});
