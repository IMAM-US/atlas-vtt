import { afterEach, expect, it, vi } from 'vitest';
import { TFile } from 'obsidian';
import { createViewAtlasStore } from '../../src/app/storeFactory';
import type { NativeSources } from '../../src/app/agent-links/NativeSources';
import type { AccountDocument } from '../../src/app/agent-links/account/accountSchema';
import { validateAccount } from '../../src/app/agent-links/account/accountValidation';
import { textSha256 } from '../../src/app/agent-links/account/accountWriter';
import type { InventoryRead } from '../../src/app/agent-links/live/OpenRigLive';
import type { Observation, ObservationHandle } from '../../src/app/agent-links/live/types';
import { MapmakingSession } from '../../src/app/agent-links/mapmaking/MapmakingSession';
import type { ProposalGhostRenderer } from '../../src/app/agent-links/mapmaking/ProposalGhostRenderer';
import { createInMemoryApp } from '../mocks/inMemoryVault';
import { exampleAccount } from '../fixtures/exampleAccount';

const PATH = 'atlas-vtt/collections/Example/accounts/team.json';
const node = (nodeId: string, logicalId: string, podId: string): Record<string, unknown> => ({ nodeId, logicalId, podId, rigId: 'rig-one', hostSelfId: 'host-one', rigName: 'example' });
const NODES = [node('node-builder', 'code.builder', 'pod-team'), node('node-new', 'code.new', 'pod-team'), node('node-lead', 'orch.lead', 'pod-lead'),
  node('node-a', 'panel.a', 'pod-panel'), node('node-b', 'panel.b', 'pod-panel'), node('node-c', 'panel.c', 'pod-panel')];
afterEach(() => vi.useRealTimers());

/** One rig's inventory: `refresh` invalidates like the live model; `publish` completes a read with a new value. */
function inventory(): { watch: () => ObservationHandle<InventoryRead>; publish: () => void; refs: () => number } {
  let refs = 0, snapshot: Observation<InventoryRead> = { sourceKey: 'local', epoch: 1, revision: 1, freshness: 'live', observedAt: '2026-01-01T12:00:00Z', message: null,
    value: { nodes: NODES, complete: true, observedAt: '2026-01-01T12:00:00Z' } };
  const listeners = new Set<() => void>();
  const emit = (): void => listeners.forEach((listener) => listener());
  return {
    refs: () => refs,
    publish: () => { snapshot = { ...snapshot, freshness: 'live', revision: snapshot.revision + 1, value: { nodes: NODES, complete: true, observedAt: '2026-01-01T12:06:00Z' } }; emit(); },
    watch: () => { refs++; let released = false; return {
      getSnapshot: () => snapshot, isReady: () => true, whenReady: async () => {},
      refresh: () => { snapshot = { ...snapshot, freshness: 'refreshing', revision: snapshot.revision + 1 }; emit(); },
      subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
      release: () => { if (!released) { released = true; refs--; } },
    }; },
  };
}

async function setup(text = `${JSON.stringify(validateAccount(exampleAccount()), null, 2)}\n`) {
  const memory = createInMemoryApp({ files: { [PATH]: text } });
  const store = createViewAtlasStore(memory.app, 'mapmaking-session');
  store.getState().setPersistenceEnabled(false);
  store.getState().setMapPath('atlas-vtt/collections/Example/scenes/Example.atlasmap');
  store.getState().setGrid({ enabled: true, size: 70, type: 'square', offsetX: 0, offsetY: 0, opacity: 1 });
  for (const [subjectId, x, y] of [['seat:builder', 105, 105], ['group:panel', 385, 385]] as const) {
    const id = store.getState().addToken({ imagePath: 'art/example.webp', x, y, size: 1 });
    store.getState().updateToken(id, { sourceReference: { accountPath: PATH, subjectId } });
  }
  const rig = inventory();
  const sources = {
    live: { openRig: () => ({ watchInventory: rig.watch, getConnection: () => ({ status: 'connected', since: null, message: null, epoch: 1 }), subscribeConnection: () => () => {} }),
      subscribe: () => () => {}, getRevision: () => 0 },
    loadAccount: async (path: string) => {
      const current = memory.files.get(path);
      if (current === undefined) throw new Error(`${path} is missing`);
      return { account: validateAccount(JSON.parse(current)), path, sha256: textSha256(current), loadedAt: '2026-01-01T12:00:00Z' };
    },
  } as unknown as NativeSources;
  const ghosts = { setGhosts: vi.fn() };
  vi.useFakeTimers();
  const session = new MapmakingSession(memory.app, store, sources, ghosts as unknown as ProposalGhostRenderer, () => ({ x: 0, y: 0, width: 700, height: 700 }));
  const settle = (): Promise<void> => vi.advanceTimersByTimeAsync(200);
  return { memory, store, rig, session, ghosts, settle };
}
const keyOf = (session: MapmakingSession, nodeId: string): string => session.getSnapshot().set.notOnMap.find((row) => row.node.nodeId === nodeId)!.key;

it('lists the diff with its scope, places ghosts beside the pod, and writes nothing until Apply', async () => {
  const { memory, store, session, ghosts, settle, rig } = await setup();
  session.open(); await settle();
  const snapshot = session.getSnapshot();
  expect(snapshot.scope).toEqual([expect.stringMatching(/^example · inventory Live /)]);
  expect(snapshot.reflowNeeded).toBe(false);
  expect(snapshot.set.notOnMap.map((row) => [row.node.logicalId, row.reuse?.id ?? null])).toEqual([['code.new', null], ['orch.lead', 'seat:lead'], ['panel.c', null]]);
  expect(snapshot.set.newInGroupPod.map((row) => row.node.logicalId)).toEqual(['panel.c']);
  expect(snapshot.placements.get(keyOf(session, 'node-new'))).toEqual({ x: 175, y: 105 });
  expect(snapshot.placements.get(keyOf(session, 'node-lead'))).toEqual({ x: 35, y: 35 });
  expect(session.groupCount(PATH, 'group:panel')).toBe(1);
  session.preview([{ key: keyOf(session, 'node-new'), caption: 'New builder' }]);
  expect(ghosts.setGhosts).toHaveBeenLastCalledWith([expect.objectContaining({ position: { x: 175, y: 105 }, caption: 'New builder' })]);
  session.dismiss(keyOf(session, 'node-lead'));
  expect(session.getSnapshot().set.notOnMap.map((row) => row.node.logicalId)).toEqual(['code.new', 'panel.c']);
  for (const leave of [() => store.getState().setGMView(false), () => store.setState({ isPlayerView: true })]) {
    leave();
    expect(ghosts.setGhosts).toHaveBeenLastCalledWith([]); expect(rig.refs()).toBe(0);
    store.setState({ isPlayerView: false }); store.getState().setGMView(true); await settle();
    expect(rig.refs()).toBe(1);
  }
  expect(vi.mocked(memory.app.vault.process)).not.toHaveBeenCalled();
  session.dispose(); expect(rig.refs()).toBe(0);
});

it('applies from a fresh inventory, reports the account line, and keeps the seats through undo and redo', async () => {
  const { memory, store, session, settle, rig } = await setup();
  session.open(); await settle();
  const chosen = [{ key: keyOf(session, 'node-lead'), caption: 'orch.lead' }, { key: keyOf(session, 'node-new'), caption: 'New builder' }];
  const applying = session.apply(chosen);
  await Promise.resolve(); expect(session.getSnapshot().busy).toBe(true);
  rig.publish(); await applying; await settle();
  expect(session.getSnapshot().status).toBe('Added 2 tokens (hidden). Added 1 seat to team.json.');
  const written = JSON.parse(memory.files.get(PATH)!) as AccountDocument;
  const seat = written.subjects.find((subject) => subject.id.startsWith('seat:code.new~'))!;
  const added = Object.values(store.getState().objects.tokens).filter((token) => token.initiativeAutoAdd === false);
  expect(added.map((token) => [token.isHidden, token.x, token.y, token.sourceReference?.subjectId])).toEqual([[true, 35, 35, 'seat:lead'], [true, 175, 105, seat.id]]);
  const afterApply = memory.files.get(PATH);
  store.temporal.getState().undo(); await settle();
  expect(written.sources.at(-1)).toMatchObject({ observedAt: '2026-01-01T12:06:00Z', origin: { kind: 'atlas-rig-inventory', hostId: 'host-one', rigId: 'rig-one' } });
  expect(session.getSnapshot().status).toBe('Undo removed 2 tokens; their 1 seat stay in team.json (see Unused seats in Proposals).');
  expect(session.getSnapshot().set.unused.map((row) => row.subject.id)).toEqual([seat.id]);
  store.temporal.getState().redo(); await settle();
  expect(Object.values(store.getState().objects.tokens).filter((token) => token.initiativeAutoAdd === false)).toHaveLength(2);
  expect(session.getSnapshot().set.unused).toEqual([]);
  expect(memory.files.get(PATH)).toBe(afterApply);
  expect(vi.mocked(memory.app.vault.process)).toHaveBeenCalledTimes(1);
  session.dispose();
});

it('asks once before re-serialising an account in another layout, and says when a write may have happened', async () => {
  const authored = JSON.stringify(exampleAccount());
  const { memory, session, settle, rig } = await setup(authored);
  session.open(); await settle();
  expect(session.getSnapshot().reflowNeeded).toBe(true);
  const process = memory.app.vault.process;
  memory.app.vault.process = vi.fn(async (file: TFile, fn: (data: string) => string) => { await process(file, fn); throw new Error('the save was interrupted'); });
  const applying = session.apply([{ key: keyOf(session, 'node-new'), caption: 'code.new' }]);
  await Promise.resolve(); rig.publish(); await applying;
  expect(session.getSnapshot().status).toBe('team.json may have been written (the save was interrupted); reloaded it. Nothing was added to the map.');
  expect(memory.files.get(PATH)).toContain('"seat:code.new~');
  session.dispose();
});

it('cancels a pending Apply when the panel closes or the scene changes, and refuses a stale read', async () => {
  const { memory, store, session, settle, rig } = await setup();
  session.open(); await settle();
  const closing = session.apply([{ key: keyOf(session, 'node-new'), caption: 'code.new' }]);
  session.close(); await closing;
  session.open(); await settle();
  // The cancelled Apply's refresh left the inventory refreshing: nothing is proposed until a read completes.
  expect(session.getSnapshot().set.notOnMap).toEqual([]);
  rig.publish(); await settle();
  const timedOut = session.apply([{ key: keyOf(session, 'node-new'), caption: 'code.new' }]);
  await vi.advanceTimersByTimeAsync(10_000); await timedOut;
  expect(session.getSnapshot().status).toBe('Not applied: Couldn\'t confirm the seats are current.');
  rig.publish(); await settle();
  const switching = session.apply([{ key: keyOf(session, 'node-new'), caption: 'code.new' }]);
  store.getState().setMapPath('atlas-vtt/collections/Example/scenes/Other.atlasmap'); await switching;
  expect(vi.mocked(memory.app.vault.process)).not.toHaveBeenCalled();
  expect(Object.values(store.getState().objects.tokens).some((token) => token.initiativeAutoAdd === false)).toBe(false);
  session.dispose();
});
