import { beforeEach, expect, it, vi } from 'vitest';
import { AssetService } from '../../src/app/services/AssetService';
import { createInMemoryApp } from '../mocks/inMemoryVault';

beforeEach(() => { (AssetService as any).instance = null; });

it('reads scene seed ownership only from the loaded index and follows collection renames', async () => {
  const { app } = createInMemoryApp();
  const service = AssetService.getInstance(app);
  const read = vi.spyOn(app.vault, 'read');
  const oldPath = 'atlas-vtt/collections/Default/scenes/Studio.atlasmap';
  expect(service.findSceneAssetByMapPath(oldPath)).toBeNull();
  expect(read).not.toHaveBeenCalled();
  await service.initialize();
  await app.vault.create(oldPath, '{}');
  const recording = { recordingId: 'seed', sourceRevision: 'frozen' };
  const scene = await service.addAsset({ type: 'scene', name: 'Studio', collection: 'Default', tags: [], data: { mapPath: oldPath, recording } });
  expect(service.findSceneAssetByMapPath(oldPath)).toMatchObject({ id: scene.id, data: { recording } });
  expect(service.findSceneAssetByMapPath('Unknown.atlasmap')).toBeNull();
  await service.renameCollection('Default', 'Observatory');
  expect(service.findSceneAssetByMapPath(oldPath)).toBeNull();
  expect(service.findSceneAssetByMapPath('atlas-vtt/collections/Observatory/scenes/Studio.atlasmap')).toMatchObject({ id: scene.id, data: { recording } });
});
