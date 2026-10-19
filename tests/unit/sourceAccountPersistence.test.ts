// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TFile } from 'obsidian';
import { AssetService, type SceneAsset } from '../../src/app/services/AssetService';
import { accountPathOf, isAccountPath } from '../../src/app/agent-links/account/references';
import { CollectionReferenceCollector } from '../../src/app/services/collectionBundle/collectionReferences';
import { prepareCollectionExport, exportCollectionBundle } from '../../src/app/services/collectionBundle/collectionExport';
import { openCollectionImport } from '../../src/app/services/collectionBundle/collectionImport';
import { planImportPaths, remapPaths } from '../../src/app/services/collectionBundle/pathRemap';
import { selectContent } from '../../src/app/services/collectionBundle/bundleContents';
import { transferAssets } from '../../src/app/services/assetTransfer/assetTransfer';
import { FileReferenceService } from '../../src/app/services/FileReferenceService';
import { createSnapshot } from '../../src/app/snapshots/sceneSnapshotFormat';
import { createInMemoryApp, type InMemoryApp } from '../mocks/inMemoryVault';

vi.mock('../../src/app/atlas-view', () => ({ ATLAS_VIEW_TYPE: 'atlas-vtt', AtlasView: class {} }));
vi.mock('../../src/app/plugin/atlasLeaves', () => ({ getLoadedAtlasView: () => null }));

const SOURCE = 'atlas-vtt/collections/source';
const ACCOUNT = `${SOURCE}/accounts/current.json`;
const TEXT_ACCOUNT = `${SOURCE}/accounts/text.json`;
const HISTORY_ACCOUNT = `${SOURCE}/accounts/history.json`;
const SHARED = 'Shared/account.json';
const MAP = `${SOURCE}/scenes/One.atlasmap`;
const SNAPSHOT = `${SOURCE}/scenes/.snapshots/One/before.json`;
const accountBytes = '{ "version": 1, "nativeId": "' + ACCOUNT + '", "externalArtifact": "/private/example/brief.md" }\n';
const reference = (accountPath: string): { accountPath: string; subjectId: string; native: { nodeId: string } } =>
  ({ accountPath, subjectId: ACCOUNT, native: { nodeId: ACCOUNT } });
const sceneData = (textPath = TEXT_ACCOUNT): Record<string, unknown> => ({
  version: 4,
  state: {
    schema: 'atlas-vtt', version: 4, background: null, grid: null,
    objects: {
      tokens: {
        object: { id: 'object', kind: 'prop', x: 0, y: 0, imagePath: '', sourceReference: reference(ACCOUNT) },
        shared: { id: 'shared', kind: 'character', x: 0, y: 0, imagePath: '', sourceReference: reference(SHARED) },
      },
      texts: { text: { id: 'text', text: 'Colleagues', sourceReference: reference(textPath) } },
      pins: {}, fog: {}, drawings: {}, walls: {}, lights: {},
    },
  },
});

interface Vault { memory: InMemoryApp; assets: AssetService }

async function emptyVault(): Promise<Vault> {
  const memory = createInMemoryApp();
  memory.app.vault.readBinary = vi.fn(async (file: TFile): Promise<ArrayBuffer> =>
    new TextEncoder().encode(memory.files.get(file.path) ?? '').buffer as ArrayBuffer);
  AssetService.resetInstance();
  const assets = AssetService.getInstance(memory.app);
  await assets.initialize();
  return { memory, assets };
}

async function seededVault(): Promise<Vault & { scene: SceneAsset; other: SceneAsset }> {
  const vault = await emptyVault();
  await vault.assets.createCollection('source');
  for (const path of [ACCOUNT, TEXT_ACCOUNT, HISTORY_ACCOUNT, SHARED]) await vault.memory.app.vault.create(path, accountBytes);
  await vault.memory.app.vault.create(MAP, JSON.stringify(sceneData()));
  await vault.memory.app.vault.create(`${SOURCE}/scenes/Two.atlasmap`, JSON.stringify(sceneData(ACCOUNT)));
  const snapshot = createSnapshot(JSON.parse(JSON.stringify(sceneData(HISTORY_ACCOUNT))), 'before', 'Before', 1);
  await vault.memory.app.vault.adapter.write(SNAPSHOT, JSON.stringify(snapshot));
  const add = async (name: string): Promise<SceneAsset> => vault.assets.addAsset({
    type: 'scene', name, collection: 'source', tags: [], data: { mapPath: `${SOURCE}/scenes/${name}.atlasmap` },
  });
  return { ...vault, scene: await add('One'), other: await add('Two') };
}

function referencesIn(memory: InMemoryApp, path: string): { token: unknown; text: unknown; shared: unknown } {
  const { objects } = JSON.parse(memory.files.get(path)!).state;
  return { token: objects.tokens.object.sourceReference, text: objects.texts.text.sourceReference, shared: objects.tokens.shared.sourceReference };
}

beforeEach(() => AssetService.resetInstance());

describe('source account path boundary', () => {
  it.each(['', '/private/example.json', 'C:/example.json', '../outside.json', 'accounts/../outside.json', '.obsidian/native.json',
    'atlas-vtt/.atlas-data/settings.json', 'accounts//team.json', 'accounts/team.json#subject', 'https://host/team.json', 'accounts\\team.json', 'accounts/team.md', 'accounts/\nteam.json'])('does not accept %s', (path) => {
    expect(isAccountPath(path)).toBe(false);
    expect(accountPathOf({ sourceReference: reference(path) })).toBeNull();
  });

  it('requires an explicit subject and permits visible vault-local accounts', () => {
    expect(accountPathOf({ sourceReference: reference(ACCOUNT) })).toBe(ACCOUNT);
    for (const value of [null, [], { sourceReference: ACCOUNT }, { sourceReference: { accountPath: ACCOUNT } }, { sourceReference: { accountPath: ACCOUNT, subjectId: ' ' } }]) {
      expect(accountPathOf(value)).toBeNull();
    }
  });
});

it('collects every token kind, texts and snapshots once, with all owners, without following native or settings paths', async () => {
  const { memory, assets, scene, other } = await seededVault();
  const map = JSON.parse(memory.files.get(MAP)!);
  map.state.objects.texts.settings = { sourceReference: reference('.obsidian/native.json') };
  map.state.objects.texts.external = { sourceReference: reference('/private/example/native.json') };
  map.state.objects.texts.missing = { sourceReference: reference('accounts/missing.json') };
  memory.files.set(MAP, JSON.stringify(map));
  const lookup = vi.mocked(memory.app.vault.getAbstractFileByPath);
  lookup.mockClear();
  const { files, missing } = await new CollectionReferenceCollector(memory.app, assets).collect([scene, other]);
  const accounts = files.filter((file) => file.role === 'source-account');
  expect(accounts.map((file) => file.vaultPath).sort()).toEqual([ACCOUNT, TEXT_ACCOUNT, HISTORY_ACCOUNT, SHARED].sort());
  expect(accounts.find((file) => file.vaultPath === ACCOUNT)?.owners?.sort()).toEqual([scene.id, other.id].sort());
  expect(accounts.find((file) => file.vaultPath === HISTORY_ACCOUNT)?.owners).toEqual([scene.id]);
  expect(missing).toContainEqual({ path: 'accounts/missing.json', role: 'source-account', assetName: 'One' });
  expect(lookup).not.toHaveBeenCalledWith('.obsidian/native.json');
  expect(lookup).not.toHaveBeenCalledWith('/private/example/native.json');
  expect(lookup).not.toHaveBeenCalledWith('/private/example/brief.md');
  const selected = selectContent([scene, other], files, new Set([`asset:${scene.id}`]));
  expect(selected.files.some((file) => file.vaultPath === ACCOUNT)).toBe(true);
  expect(selected.files.some((file) => file.vaultPath === TEXT_ACCOUNT || file.vaultPath === HISTORY_ACCOUNT)).toBe(false);
});

it('rejects a source account that is also referenced as background data', async () => {
  const { memory, assets, scene } = await seededVault();
  const map = JSON.parse(memory.files.get(MAP)!);
  map.state.background = ACCOUNT;
  memory.files.set(MAP, JSON.stringify(map));
  await expect(new CollectionReferenceCollector(memory.app, assets).collect([scene])).rejects.toThrow('Source account conflicts');
});

it('uses a free account filename on import without applying the same rewrite to subject IDs', () => {
  const occupied = 'atlas-vtt/collections/target/accounts/account.json';
  const paths = planImportPaths([{ vaultPath: SHARED, role: 'source-account' }], {
    sourceCollectionId: 'source', targetCollectionId: 'target', existsInVault: (path) => path === occupied,
    hasSameContent: () => false, recordTargets: new Set(),
  });
  const value = { sourceReference: { accountPath: SHARED, subjectId: SHARED, unknown: { value: SHARED } } };
  expect(remapPaths(value, paths)).toEqual({ sourceReference: { ...value.sourceReference, accountPath: 'atlas-vtt/collections/target/accounts/account-2.json' } });
});

it('round-trips accounts and snapshots through an actual bundle into a renamed collection, preserving native collisions', async () => {
  const creator = await seededVault();
  const preview = await prepareCollectionExport(creator.memory.app, creator.assets, 'source');
  const bundle = await exportCollectionBundle(creator.memory.app, creator.assets, preview, { kind: 'release', version: 1 });
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(await bundle.blob.arrayBuffer());
  expect(await zip.file(`files/${ACCOUNT}`)!.async('string')).toBe(accountBytes);
  expect(Object.keys(zip.files).some((path) => path.includes('.obsidian') || path.includes('/private/'))).toBe(false);
  const fan = await emptyVault();
  await fan.assets.createCollection('source');
  const session = await openCollectionImport(fan.memory.app, fan.assets, bundle.blob);
  const imported = await session.apply({ name: 'source (2)' });
  const target = `atlas-vtt/collections/${imported.collectionId}`;
  expect(imported.collectionId).not.toBe('source');
  const moved = (path: string): string => path.replace(SOURCE, target);
  expect(referencesIn(fan.memory, moved(MAP))).toEqual({
    token: { ...reference(ACCOUNT), accountPath: moved(ACCOUNT) },
    text: { ...reference(TEXT_ACCOUNT), accountPath: moved(TEXT_ACCOUNT) },
    shared: { ...reference(SHARED), accountPath: `${target}/accounts/account.json` },
  });
  expect(referencesIn(fan.memory, moved(SNAPSHOT)).text).toEqual({ ...reference(HISTORY_ACCOUNT), accountPath: moved(HISTORY_ACCOUNT) });
  for (const path of [ACCOUNT, TEXT_ACCOUNT, HISTORY_ACCOUNT]) expect(fan.memory.files.get(moved(path))).toBe(accountBytes);
});

it.each(['move', 'copy'] as const)('%s carries local accounts, keeps shared vault accounts and preserves accounts needed by staying scenes', async (mode) => {
  const { memory, assets, scene } = await seededVault();
  await assets.createCollection('target');
  const result = await transferAssets(memory.app, assets, { mode, assetIds: [scene.id], targetCollectionId: 'target' });
  expect(result.assets).toHaveLength(1);
  const moved = (path: string): string => path.replace(SOURCE, 'atlas-vtt/collections/target');
  expect(referencesIn(memory, moved(MAP))).toEqual({
    token: { ...reference(ACCOUNT), accountPath: moved(ACCOUNT) },
    text: { ...reference(TEXT_ACCOUNT), accountPath: moved(TEXT_ACCOUNT) },
    shared: reference(SHARED),
  });
  expect(referencesIn(memory, moved(SNAPSHOT)).text).toEqual({ ...reference(HISTORY_ACCOUNT), accountPath: moved(HISTORY_ACCOUNT) });
  expect(memory.files.get(ACCOUNT)).toBe(accountBytes);
  expect(memory.files.get(SHARED)).toBe(accountBytes);
  for (const path of [ACCOUNT, TEXT_ACCOUNT, HISTORY_ACCOUNT]) expect(memory.files.get(moved(path))).toBe(accountBytes);
});

it('renames account references in a saved scene and hidden snapshot without changing subject IDs', async () => {
  const { memory } = await seededVault();
  const target = `${SOURCE}/accounts/renamed.json`;
  await memory.app.vault.rename(memory.app.vault.getFileByPath(ACCOUNT)!, target);
  await new FileReferenceService(memory.app).handleFileRenamed(ACCOUNT, target);
  for (const path of [MAP, SNAPSHOT]) expect(referencesIn(memory, path).token).toEqual({ ...reference(ACCOUNT), accountPath: target });
});
