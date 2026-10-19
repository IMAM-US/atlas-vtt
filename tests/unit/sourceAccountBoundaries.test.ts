// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
import { TFile } from 'obsidian';
import JSZip from 'jszip';
import { AssetService, type Asset, type SceneAsset } from '../../src/app/services/AssetService';
import { CollectionReferenceCollector } from '../../src/app/services/collectionBundle/collectionReferences';
import { prepareCollectionExport, exportCollectionBundle } from '../../src/app/services/collectionBundle/collectionExport';
import { openCollectionImport } from '../../src/app/services/collectionBundle/collectionImport';
import type { CollectionBundleManifest } from '../../src/app/services/collectionBundle/bundleFormat';
import { transferAssets } from '../../src/app/services/assetTransfer/assetTransfer';
import { createInMemoryApp, type InMemoryApp } from '../mocks/inMemoryVault';

vi.mock('../../src/app/atlas-view', () => ({ ATLAS_VIEW_TYPE: 'atlas-vtt', AtlasView: class {} }));
vi.mock('../../src/app/plugin/atlasLeaves', () => ({ getLoadedAtlasView: () => null }));

const MAP = 'atlas-vtt/collections/source/scenes/Scene.atlasmap';
const accountBytes = '{"version":1,"nativeId":"account.json"}\n';
interface Vault { memory: InMemoryApp; assets: AssetService }

async function vault(): Promise<Vault> {
  const memory = createInMemoryApp();
  memory.app.vault.readBinary = vi.fn(async (file: TFile): Promise<ArrayBuffer> =>
    new TextEncoder().encode(memory.files.get(file.path) ?? '').buffer as ArrayBuffer);
  AssetService.resetInstance();
  const assets = AssetService.getInstance(memory.app);
  await assets.initialize();
  return { memory, assets };
}

async function scene(v: Vault, accountPath: string): Promise<SceneAsset> {
  if (!await v.assets.getCollection('source')) await v.assets.createCollection('source');
  const sourceReference = { accountPath, subjectId: 'account.json', native: { nodeId: 'account.json' } };
  await v.memory.app.vault.create(MAP, JSON.stringify({ version: 4, state: {
    schema: 'atlas-vtt', version: 4, objects: { tokens: {
      a: { id: 'a', kind: 'prop', imagePath: '', sourceReference },
    }, texts: {}, pins: {} },
  } }));
  return v.assets.addAsset({ type: 'scene', name: 'Scene', collection: 'source', tags: [], data: { mapPath: MAP } });
}

async function exportZip(v: Vault): Promise<JSZip> {
  const preview = await prepareCollectionExport(v.memory.app, v.assets, 'source');
  const bundle = await exportCollectionBundle(v.memory.app, v.assets, preview, { kind: 'release', version: 1 });
  return JSZip.loadAsync(await bundle.blob.arrayBuffer());
}

beforeEach(() => AssetService.resetInstance());

it.each(['asset-first', 'account-first', 'unselected-asset'])('refuses account/owned-record conflicts before a copy or export (%s)', async (order) => {
  const v = await vault();
  await v.assets.createCollection('source');
  const record = await v.assets.addAsset({ type: 'encounter', name: 'Encounter', collection: 'source', tags: [], tokens: [], data: { tokens: [] } });
  const appearance = await scene(v, v.assets.getAssetFilePath(record));
  const selected = order === 'asset-first' ? [record, appearance] : order === 'account-first' ? [appearance, record] : [appearance];
  await expect(new CollectionReferenceCollector(v.memory.app, v.assets).collect(selected)).rejects.toThrow('Source account conflicts with an existing asset file');
  await expect(prepareCollectionExport(v.memory.app, v.assets, 'source')).rejects.toThrow('Source account conflicts');
  await v.assets.createCollection('target');
  const before = new Map(v.memory.files);
  await expect(transferAssets(v.memory.app, v.assets, { mode: 'copy', assetIds: selected.map((a) => a.id), targetCollectionId: 'target' })).rejects.toThrow('Source account conflicts');
  expect(v.memory.files).toEqual(before);
  expect(await v.assets.getAssets('target')).toEqual([]);
});

it('refuses an imported source-account role that disguises an owned JSON record', async () => {
  const creator = await vault();
  await creator.memory.app.vault.create('account.json', accountBytes);
  await scene(creator, 'account.json');
  const zip = await exportZip(creator);
  const manifest = JSON.parse(await zip.file('manifest.json')!.async('string')) as CollectionBundleManifest;
  const record = manifest.files.find((file) => file.role === 'asset-file')!;
  expect(record).toBeDefined();
  record.role = 'source-account';
  zip.file('manifest.json', JSON.stringify(manifest));
  const fan = await vault();
  const before = new Map(fan.memory.files);
  await expect(openCollectionImport(fan.memory.app, fan.assets, new Blob([await zip.generateAsync({ type: 'arraybuffer' })]))).rejects.toThrow('Source account conflicts');
  expect(fan.memory.files).toEqual(before);
});

it('keeps root account paths separate from colliding asset IDs through ZIP import and share', async () => {
  const creator = await vault();
  await creator.memory.app.vault.create('account.json', accountBytes);
  const original = await scene(creator, 'account.json');
  const zip = await exportZip(creator);
  const manifest = JSON.parse(await zip.file('manifest.json')!.async('string')) as CollectionBundleManifest;
  manifest.assets.find((asset) => asset.id === original.id)!.id = 'account.json';
  for (const file of manifest.files) if (file.owners) file.owners = file.owners.map((id) => id === original.id ? 'account.json' : id);
  zip.file('manifest.json', JSON.stringify(manifest));
  const fan = await vault();
  await fan.assets.createCollection('mine');
  await fan.assets.createCollection('source');
  const occupied: Asset = { id: 'account.json', type: 'encounter', name: 'Existing', collection: 'mine', tags: [], createdAt: 1, modifiedAt: 1, tokens: [], data: { tokens: [] } };
  await fan.assets.registerAsset(occupied);
  const imported = await (await openCollectionImport(fan.memory.app, fan.assets, new Blob([await zip.generateAsync({ type: 'arraybuffer' })]))).apply({ name: 'source (2)' });
  const mapPath = MAP.replace('/source/', `/${imported.collectionId}/`);
  const accountPath = `atlas-vtt/collections/${imported.collectionId}/accounts/account.json`;
  const sourceReference = JSON.parse(fan.memory.files.get(mapPath)!).state.objects.tokens.a.sourceReference;
  expect(sourceReference).toEqual({ accountPath, subjectId: 'account.json', native: { nodeId: 'account.json' } });
  expect(fan.memory.files.get(accountPath)).toBe(accountBytes);
  const [arrived] = await fan.assets.getAssets(imported.collectionId, 'scene');
  expect(arrived!.id).not.toBe('account.json');
  expect((await fan.assets.getAssetById('account.json'))!.collection).toBe('mine');
  const preview = await prepareCollectionExport(fan.memory.app, fan.assets, imported.collectionId);
  const shared = await exportCollectionBundle(fan.memory.app, fan.assets, preview, { kind: 'share' });
  const sharedZip = await JSZip.loadAsync(await shared.blob.arrayBuffer());
  expect(await sharedZip.file('files/account.json')!.async('string')).toBe(accountBytes);
  const sharedMap = JSON.parse(await sharedZip.file(`files/${MAP}`)!.async('string'));
  expect(sharedMap.state.objects.tokens.a.sourceReference).toEqual({ accountPath: 'account.json', subjectId: 'account.json', native: { nodeId: 'account.json' } });
});
