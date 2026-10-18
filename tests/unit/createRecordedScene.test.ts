import { TFile } from 'obsidian';
import { beforeEach, expect, it, vi } from 'vitest';
import { AssetService } from '../../src/app/services/AssetService';
import { createOrOpenRecordedScene, openExistingRecordedScene } from '../../src/app/agent-workspace/createRecordedScene';
import { foundationRecording as recording } from '../../src/app/agent-workspace/foundationRecording';
import { ATLAS_VERSION, isPersistedMapEnvelope } from '../../src/app/services/MapPersistence';
import { createInMemoryApp } from '../mocks/inMemoryVault';

const openMap = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('../../src/app/plugin/atlasLeaves', () => ({ openMapInView: openMap }));

let memory: ReturnType<typeof createInMemoryApp>;
let assets: AssetService;
let open: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  (AssetService as unknown as { instance: AssetService | null }).instance = null;
  memory = createInMemoryApp();
  const create = vi.mocked(memory.app.vault.create).getMockImplementation()!;
  vi.mocked(memory.app.vault.create).mockImplementation(async (path, content) => {
    await create(path, content);
    return new TFile(path);
  });
  Object.assign(memory.app.vault, { delete: vi.fn(async (file: TFile) => { memory.files.delete(file.path); }) });
  openMap.mockClear();
  open = openMap;
  assets = AssetService.getInstance(memory.app);
  await assets.initialize();
});

it('creates one native scene with editable tokens/cards and source references without copying operational state', async () => {
  await createOrOpenRecordedScene(memory.app);
  const scenes = await assets.getAssets(undefined, 'scene');
  expect(scenes).toHaveLength(1);
  const path = scenes[0]!.data!.mapPath!;
  const envelope = JSON.parse(memory.files.get(path)!);
  expect(isPersistedMapEnvelope(envelope)).toBe(true);
  expect(envelope.version).toBe(ATLAS_VERSION);
  expect(envelope.state.background).toBeNull();
  expect(envelope.state.grid).toMatchObject({ type: 'square', size: 70, snapToGrid: true });
  const tokens = Object.values(envelope.state.objects.tokens) as Record<string, unknown>[];
  const texts = Object.values(envelope.state.objects.texts) as Record<string, unknown>[];
  expect(tokens).toHaveLength(2);
  expect(new Set(tokens.map(t => t.ringColor)).size).toBe(2);
  for (const token of tokens) {
    expect(token).toMatchObject({ kind: 'token', imagePath: '' });
    expect(token.id).toMatch(/^tok_/);
    expect(token).not.toHaveProperty('hp');
    expect(token).not.toHaveProperty('name');
  }
  expect(texts).toHaveLength(9);
  const refs = [...tokens, ...texts].flatMap(object => object.recordingReference ? [object.recordingReference] : []);
  expect(refs).toHaveLength(10);
  expect(refs).toEqual(expect.arrayContaining(recording.work.map(work => ({
    recordingId: recording.id, sourceRevision: recording.sourceRevision, kind: 'work', id: work.id,
  }))));
  for (const ref of refs as Record<string, unknown>[]) {
    expect(Object.keys(ref).sort()).toEqual(['id', 'kind', 'recordingId', 'sourceRevision']);
  }
  expect(memory.files.get(path)).not.toContain(recording.artifacts[0]!.originalSha256);
  expect(memory.files.get(path)).not.toContain('claimGeneration');
  expect(open).toHaveBeenCalledWith(memory.app, expect.objectContaining({ path }));
});

it('reopens renamed and moved scene without reseeding user edits', async () => {
  await createOrOpenRecordedScene(memory.app);
  const original = (await assets.getAssets(undefined, 'scene'))[0]!;
  const oldPath = original.data!.mapPath!;
  const movedPath = 'atlas-vtt/collections/Default/scenes/My edited workspace.atlasmap';
  const edited = JSON.parse(memory.files.get(oldPath)!);
  edited.state.objects.tokens.tok_recording_0.x = 777;
  edited.state.objects.texts.text_recording_work_0.text = 'My owner annotation';
  memory.files.delete(oldPath);
  memory.files.set(movedPath, JSON.stringify(edited));
  await assets.updateAsset(original.id, { name: 'My workspace', data: { ...original.data, mapPath: movedPath } });
  const preserved = memory.files.get(movedPath);
  await createOrOpenRecordedScene(memory.app);
  expect(await assets.getAssets(undefined, 'scene')).toHaveLength(1);
  expect(memory.files.get(movedPath)).toBe(preserved);
  expect(memory.files.has(oldPath)).toBe(false);
  expect(open).toHaveBeenLastCalledWith(memory.app, expect.objectContaining({ path: movedPath }));
});

it('serializes concurrent commands and avoids overwriting a filename collision', async () => {
  const path = `atlas-vtt/collections/${assets.getDefaultCollectionId()}/scenes/OpenRig foundation workspace.atlasmap`;
  memory.files.set(path, 'unrelated owner file');
  await Promise.all([createOrOpenRecordedScene(memory.app), createOrOpenRecordedScene(memory.app)]);
  expect(memory.files.get(path)).toBe('unrelated owner file');
  const scenes = await assets.getAssets(undefined, 'scene');
  expect(scenes).toHaveLength(1);
  expect(scenes[0]!.data!.mapPath).toContain('workspace (2).atlasmap');
  expect(scenes[0]!.name).toBe('OpenRig foundation workspace (2)');
  expect(open).toHaveBeenCalledTimes(2);
});

it('does not create a replacement when a marked scene is missing', async () => {
  await createOrOpenRecordedScene(memory.app);
  const scene = (await assets.getAssets(undefined, 'scene'))[0]!;
  memory.files.delete(scene.data!.mapPath!);
  await expect(createOrOpenRecordedScene(memory.app)).rejects.toThrow('Restore its map file');
  expect(await assets.getAssets(undefined, 'scene')).toHaveLength(1);
  expect(open).toHaveBeenCalledTimes(1);
});

it('rolls back a new map when registration fails before indexing it', async () => {
  vi.spyOn(assets, 'addAsset').mockRejectedValueOnce(new Error('registration failed'));
  await expect(createOrOpenRecordedScene(memory.app)).rejects.toThrow('registration failed');
  expect([...memory.files.keys()].filter(path => path.endsWith('.atlasmap'))).toEqual([]);
  expect(open).not.toHaveBeenCalled();
});

it('preserves a registered map if registration reports a later error, then reopens it on retry', async () => {
  const add = assets.addAsset.bind(assets);
  vi.spyOn(assets, 'addAsset').mockImplementationOnce(async asset => {
    await add(asset);
    throw new Error('late registration error');
  });
  await expect(createOrOpenRecordedScene(memory.app)).rejects.toThrow('late registration error');
  const scene = (await assets.getAssets(undefined, 'scene'))[0]!;
  const saved = memory.files.get(scene.data!.mapPath!);
  expect(saved).toBeTruthy();
  await createOrOpenRecordedScene(memory.app);
  expect(await assets.getAssets(undefined, 'scene')).toHaveLength(1);
  expect(memory.files.get(scene.data!.mapPath!)).toBe(saved);
  expect(open).toHaveBeenCalledTimes(1);
});

it('creates and reopens an independent recording without replacing the foundation scene', async () => {
  const second = { ...recording, id: 'test-second-capture', sourceRevision: 'test-evidence-revision' };
  await createOrOpenRecordedScene(memory.app);
  await createOrOpenRecordedScene(memory.app, second, 'Second recorded workspace');
  await createOrOpenRecordedScene(memory.app, second, 'A later requested name');
  const scenes = await assets.getAssets(undefined, 'scene');
  expect(scenes).toHaveLength(2);
  const scene = scenes.find(item => item.data?.recording?.recordingId === second.id)!;
  const saved = JSON.parse(memory.files.get(scene.data!.mapPath!)!);
  expect(scene.name).toBe('Second recorded workspace');
  expect(saved.state.name).toBe(scene.name);
  expect(saved.state.objects.texts.text_recording_intro.text).toContain(scene.name);
  expect(saved.state.objects.tokens.tok_recording_0.recordingReference).toMatchObject({ recordingId: second.id, sourceRevision: second.sourceRevision });
  expect(open).toHaveBeenLastCalledWith(memory.app, expect.objectContaining({ path: scene.data!.mapPath }));
});


it('seeds the corrected roster for first use but reopens an explicitly accepted predecessor scene without migration', async () => {
  const current = { ...recording, id: 'corrected-repository-team', sourceRevision: 'corrected-edition', seats: recording.seats.map(seat => ({ ...seat, id: `corrected-${seat.id}` })) };
  await createOrOpenRecordedScene(memory.app, current, 'Current workspace', undefined, ['old-integration']);
  const fresh = (await assets.getAssets(undefined, 'scene'))[0]!;
  expect(fresh.data?.recording).toEqual({ recordingId: current.id, sourceRevision: current.sourceRevision });
  const freshState = JSON.parse(memory.files.get(fresh.data!.mapPath!)!).state;
  expect(freshState.objects.tokens.tok_recording_0.recordingReference.id).toBe(current.seats[0]!.id);
  await assets.updateAsset(fresh.id, { data: { ...fresh.data, recording: { recordingId: 'old-integration', sourceRevision: 'old-edition' } } });
  const path = fresh.data!.mapPath!;
  freshState.objects.tokens.tok_recording_0.x = 1234;
  freshState.objects.tokens.tok_recording_0.recordingReference = { recordingId: 'old-integration', sourceRevision: 'old-edition', kind: 'seat', id: 'old-seat' };
  const authored = JSON.stringify({ version: ATLAS_VERSION, state: freshState });
  memory.files.set(path, authored);
  await createOrOpenRecordedScene(memory.app, current, 'A requested new name', undefined, ['old-integration']);
  expect(await assets.getAssets(undefined, 'scene')).toHaveLength(1);
  expect(memory.files.get(path)).toBe(authored);
  expect((await assets.getAssets(undefined, 'scene'))[0]!.data?.recording?.recordingId).toBe('old-integration');
  expect(open).toHaveBeenLastCalledWith(memory.app, expect.objectContaining({ path }));
});


it('finds and opens an existing predecessor scene without seeding, and validates a missing map', async () => {
  expect(await openExistingRecordedScene(memory.app, recording)).toBe(false);
  await createOrOpenRecordedScene(memory.app);
  const scene = (await assets.getAssets(undefined, 'scene'))[0]!;
  const path = scene.data!.mapPath!;
  const authored = memory.files.get(path)!;
  const current = { ...recording, id: 'replacement-recording' };
  expect(await openExistingRecordedScene(memory.app, current, [recording.id])).toBe(true);
  expect(memory.files.get(path)).toBe(authored);
  expect(await assets.getAssets(undefined, 'scene')).toHaveLength(1);
  memory.files.delete(path);
  await expect(openExistingRecordedScene(memory.app, current, [recording.id])).rejects.toThrow('Restore its map file');
});
