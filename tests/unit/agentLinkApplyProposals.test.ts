import { afterEach, describe, expect, it, vi } from 'vitest';
import { TFile } from 'obsidian';
import { createViewAtlasStore } from '../../src/app/storeFactory';
import { getHistoryStore } from '../../src/app/stores/history';
import { textSha256 } from '../../src/app/agent-links/account/accountWriter';
import type { AccountDocument } from '../../src/app/agent-links/account/accountSchema';
import type { InventoryRead } from '../../src/app/agent-links/live/OpenRigLive';
import type { ConnectionState, Observation, ObservationHandle } from '../../src/app/agent-links/live/types';
import { applyProposals, type ApplyRequest, type ChosenSeat } from '../../src/app/agent-links/mapmaking/applyProposals';
import { atlasAdded, type InventoryNode } from '../../src/app/agent-links/mapmaking/seatIdentity';
import { createInMemoryApp } from '../mocks/inMemoryVault';
import { exampleAccount } from '../fixtures/exampleAccount';

const PATH = 'atlas-vtt/collections/Example/accounts/team.json';
const SCENE = 'atlas-vtt/collections/Example/scenes/Example.atlasmap';
const OTHER = 'atlas-vtt/collections/Example/accounts/other.json';
const node = (nodeId: string, logicalId: string): InventoryNode => ({ sourceKey: 'local', hostId: 'host-one', rigId: 'rig-one', nodeId, logicalId, podId: 'pod-team', rigName: 'example' });
const connection: ConnectionState = { status: 'connected', since: '2026-01-01T10:00:00Z', message: null, epoch: 3 };

/** An inventory handle whose reads the test completes, so freshness can be observed exactly. */
function inventoryHandle(): { handle: ObservationHandle<InventoryRead>; publish: (change?: Partial<Observation<InventoryRead>>) => void } {
  let snapshot: Observation<InventoryRead> = { sourceKey: 'local', epoch: 3, revision: 1, freshness: 'live', value: { nodes: [], complete: true, observedAt: '2026-01-01T10:00:00Z' }, observedAt: '2026-01-01T10:00:00Z', message: null };
  const listeners = new Set<() => void>();
  const emit = (): void => listeners.forEach((listener) => listener());
  const handle: ObservationHandle<InventoryRead> = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    refresh: () => { snapshot = { ...snapshot, revision: snapshot.revision + 1, freshness: 'refreshing' }; emit(); },
    release: () => undefined, whenReady: async () => undefined, isReady: () => true,
  };
  return { handle, publish: (change = {}) => { snapshot = { ...snapshot, freshness: 'live', value: { nodes: [], complete: true, observedAt: '2026-01-01T10:06:00Z' }, ...change }; emit(); } };
}

function setup(): { request: (seats: ChosenSeat[], extra?: Partial<ApplyRequest>) => ApplyRequest; app: ReturnType<typeof createInMemoryApp>['app']; files: Map<string, string>; store: ReturnType<typeof createViewAtlasStore>; inventory: ReturnType<typeof inventoryHandle> } {
  const text = `${JSON.stringify(exampleAccount(), null, 2)}\n`;
  const { app, files } = createInMemoryApp({ files: { [PATH]: text } });
  const store = createViewAtlasStore(app, 'apply-view');
  store.getState().setPersistenceEnabled(false);
  store.getState().setMapPath(SCENE);
  const inventory = inventoryHandle();
  const request = (seats: ChosenSeat[], extra: Partial<ApplyRequest> = {}): ApplyRequest => ({
    app, store, scenePath: SCENE, sceneName: 'Example', target: { path: PATH, sha256: textSha256(text), account: exampleAccount() }, seats,
    inventories: [{ sourceKey: 'local', rigId: 'rig-one', handle: inventory.handle, connection: () => connection }], settingsCurrent: () => true, sceneCurrent: () => true, bases: [], eventsOf: () => 0, guard: () => null,
    signal: new AbortController().signal, now: () => new Date('2026-01-01T10:06:00Z'), waitMs: 200, ...extra,
  });
  return { request, app, files, store, inventory };
}
const reuseLead = (): ChosenSeat => ({ proposal: { key: 'lead', node: node('node-lead', 'team.lead'), reuse: exampleAccount().subjects.find((subject) => subject.id === 'seat:lead') as never, pinnedEarlier: null }, caption: 'team.lead', position: { x: 150, y: 50 } });
const addNew = (): ChosenSeat => ({ proposal: { key: 'new', node: node('node-new', 'team.new'), reuse: null, pinnedEarlier: null }, caption: 'New builder', position: { x: 250, y: 50 } });
const run = async (context: ReturnType<typeof setup>, request: ApplyRequest): Promise<Awaited<ReturnType<typeof applyProposals>>> => {
  const pending = applyProposals(request);
  await Promise.resolve();
  context.inventory.publish();
  return pending;
};

afterEach(() => vi.restoreAllMocks());

describe('applying proposals', () => {
  it('writes the new seat with typed provenance, then adds hidden tokens in one undo step that never writes the account', async () => {
    const context = setup();
    const outcome = await run(context, context.request([reuseLead(), addNew()]));
    expect(outcome).toMatchObject({ kind: 'applied', seatsAdded: 1 });
    const written = JSON.parse(context.files.get(PATH)!) as AccountDocument;
    const added = written.subjects.find((subject) => subject.id.startsWith('seat:team.new~'));
    expect(added).toMatchObject({ kind: 'seat', caption: 'New builder', policy: 'current-seat', seat: { nodeId: 'node-new', hostId: 'host-one', rigId: 'rig-one' } });
    expect(added?.kind === 'seat' && atlasAdded(written, added)).toMatchObject({ kind: 'atlas-rig-inventory', scenePath: SCENE, rigId: 'rig-one' });
    const tokens = Object.values(context.store.getState().objects.tokens);
    expect(tokens.map((token) => [token.kind, 'name' in token ? token.name : null, token.isHidden, token.initiativeAutoAdd, token.sourceReference?.subjectId]))
      .toEqual([['character', 'team.lead', true, false, 'seat:lead'], ['character', 'New builder', true, false, added!.id]]);
    const afterApply = context.files.get(PATH);
    const history = getHistoryStore(context.store)!;
    history.getState().undo();
    expect(Object.keys(context.store.getState().objects.tokens)).toHaveLength(0);
    history.getState().redo();
    expect(Object.keys(context.store.getState().objects.tokens)).toHaveLength(2);
    expect(context.files.get(PATH)).toBe(afterApply);
  });

  it('writes nothing when every seat is reused', async () => {
    const context = setup();
    const before = context.files.get(PATH);
    expect(await run(context, context.request([reuseLead()]))).toMatchObject({ kind: 'applied', seatsAdded: 0 });
    expect(context.files.get(PATH)).toBe(before);
  });

  it('refuses without a fresh read: a refresh that keeps the old value, a refused result or a cancel', async () => {
    const stale = setup();
    const kept = applyProposals(stale.request([addNew()]));
    await Promise.resolve();
    stale.inventory.publish({ value: stale.inventory.handle.getSnapshot().value });
    expect(await kept).toEqual({ kind: 'refused', reason: 'Couldn\'t confirm the seats are current.' });
    const refused = setup();
    const pending = applyProposals(refused.request([addNew()]));
    await Promise.resolve();
    refused.inventory.publish({ freshness: 'refused', observedAt: '2026-01-01T11:00:00Z' });
    expect(await pending).toMatchObject({ kind: 'refused' });
    const cancelled = setup();
    const controller = new AbortController();
    const waiting = applyProposals(cancelled.request([addNew()], { signal: controller.signal }));
    controller.abort();
    expect(await waiting).toEqual({ kind: 'refused', reason: 'Apply was cancelled.' });
    for (const context of [stale, refused, cancelled]) expect(Object.keys(context.store.getState().objects.tokens)).toHaveLength(0);
  });

  it('refuses before writing when the account changed since it was read', async () => {
    const context = setup();
    context.files.set(PATH, `${context.files.get(PATH)!} `);
    expect(await run(context, context.request([addNew()]))).toMatchObject({ kind: 'refused', reason: expect.stringContaining('changed since it was read') });
    expect(Object.keys(context.store.getState().objects.tokens)).toHaveLength(0);
  });

  it('publishes no tokens when the write may have happened, or when a guard fails after it', async () => {
    const uncertain = setup();
    const process = uncertain.app.vault.process;
    uncertain.app.vault.process = vi.fn(async (file: TFile, fn: (data: string) => string) => { await process(file, fn); throw new Error('saved, then failed'); });
    expect(await run(uncertain, uncertain.request([addNew()]))).toEqual({ kind: 'indeterminate', reason: 'saved, then failed' });
    expect(Object.keys(uncertain.store.getState().objects.tokens)).toHaveLength(0);
    const moved = setup();
    const outcome = await run(moved, moved.request([addNew()], { guard: (account) => (account.subjects.some((subject) => subject.id.startsWith('seat:team.new~')) ? 'The cell was taken.' : null) }));
    expect(outcome).toEqual({ kind: 'stopped', seatsAdded: 1, reason: 'The cell was taken.' });
    expect(Object.keys(moved.store.getState().objects.tokens)).toHaveLength(0);
  });

  it('reports a thrown history step as partial with what actually reached the map', async () => {
    const context = setup();
    const state = context.store.getState();
    const addTokens = state.addTokens;
    vi.spyOn(state, 'addTokens').mockImplementation((entries) => {
      addTokens(entries.slice(0, 1));
      throw new Error('second token failed');
    });
    const outcome = await run(context, context.request([reuseLead(), addNew()]));
    expect(outcome).toMatchObject({ kind: 'partial', seatsAdded: 1, reason: 'second token failed' });
    expect(outcome.kind === 'partial' && outcome.tokenIds).toHaveLength(1);
  });

  it('runs two Applies on one account one after another, the second refusing on the changed text', async () => {
    const context = setup();
    const first = applyProposals(context.request([addNew()]));
    const second = applyProposals(context.request([{ ...addNew(), proposal: { ...addNew().proposal, key: 'other', node: node('node-other', 'team.other') } }]));
    await Promise.resolve();
    context.inventory.publish();
    expect(await first).toMatchObject({ kind: 'applied' });
    expect(await second).toMatchObject({ kind: 'refused', reason: expect.stringContaining('changed since it was read') });
  });

  it('checks the account as it is now before reusing a subject, and writes nothing when cancelled while the write is queued', async () => {
    const reused = setup();
    const account = JSON.parse(reused.files.get(PATH)!) as AccountDocument;
    reused.files.set(PATH, `${JSON.stringify({ ...account, subjects: account.subjects.filter((subject) => subject.id !== 'seat:lead') }, null, 2)}\n`);
    expect(await run(reused, reused.request([reuseLead()]))).toEqual({ kind: 'refused', reason: 'team.json changed since it was read.' });
    expect(Object.keys(reused.store.getState().objects.tokens)).toHaveLength(0);
    const queued = setup();
    const before = queued.files.get(PATH), controller = new AbortController();
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const process = queued.app.vault.process;
    queued.app.vault.process = vi.fn(async (file: TFile, fn: (data: string) => string) => { await gate; await process(file, fn); });
    const pending = run(queued, queued.request([addNew()], { signal: controller.signal }));
    await vi.waitFor(() => expect(queued.app.vault.process).toHaveBeenCalled());
    controller.abort(); release();
    expect(await pending).toEqual({ kind: 'refused', reason: 'Apply was cancelled.' });
    expect(queued.files.get(PATH)).toBe(before);
  });

  it('qualifies every account the scene uses before writing, so a changed one writes nothing', async () => {
    const context = setup();
    const before = context.files.get(PATH);
    context.files.set(OTHER, '{"changed": true}');
    const outcome = await run(context, context.request([addNew()], { bases: [{ path: OTHER, sha256: textSha256('{"as": "read"}') }] }));
    expect(outcome).toEqual({ kind: 'refused', reason: 'other.json changed since it was read.' });
    expect([context.files.get(PATH), vi.mocked(context.app.vault.process).mock.calls.length]).toEqual([before, 0]);
  });

  it('reads the accounts again when Atlas hears of a change during a read, and stops when they keep changing', async () => {
    const once = setup();
    let events = 0, reads = 0;
    const read = once.app.vault.read;
    once.app.vault.read = vi.fn(async (file: TFile) => { const text = await read(file); if (++reads === 2) events++; return text; });
    // The second read is the read-back after the write: its event (the write's own) only makes Atlas read again.
    expect(await run(once, once.request([addNew()], { eventsOf: () => events }))).toMatchObject({ kind: 'applied', seatsAdded: 1 });
    const churning = setup();
    let ticks = 0;
    const churn = churning.app.vault.read;
    churning.app.vault.read = vi.fn(async (file: TFile) => { const text = await churn(file); ticks++; return text; });
    expect(await run(churning, churning.request([reuseLead()], { eventsOf: () => ticks }))).toEqual({ kind: 'refused', reason: 'The accounts this map uses kept changing during Apply.' });
    expect(Object.keys(churning.store.getState().objects.tokens)).toHaveLength(0);
  });
});
