import { beforeEach, expect, it, vi } from 'vitest';
import { ensureIntegrationStudioArtwork, integrationStudioAssetName } from '../../src/app/agent-workspace/integrationStudioArtwork';
import { AssetService } from '../../src/app/services/AssetService';
import { createInMemoryApp } from '../mocks/inMemoryVault';
const renderImage = vi.hoisted(() => vi.fn().mockResolvedValue({ image: { arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer } }));
vi.mock('../../src/app/imageProcessing/imageProcessing', () => ({ renderFramedImage: renderImage }));
beforeEach(() => {
  (AssetService as unknown as { instance: AssetService | null }).instance = null;
  vi.clearAllMocks();
});
it('decodes bundled artwork without network, renders exactly 1400 square and reuses its native map asset', async () => {
  const memory = createInMemoryApp();
  const assets = AssetService.getInstance(memory.app);
  const path = await ensureIntegrationStudioArtwork(memory.app);
  expect(renderImage).toHaveBeenCalledExactlyOnceWith(expect.any(Blob), { centerX: 0.5, centerY: 0.5, width: 1 }, { minSize: 1400, maxSize: 1400, quality: 0.85 });
  expect(renderImage.mock.calls[0]![0].type).toBe('image/png');
  expect(path).toMatch(/\.webp$/);
  expect(memory.files.has(path)).toBe(true);
  const registered = await assets.getAssets(undefined, 'map');
  expect(registered).toHaveLength(1);
  expect(registered[0]).toMatchObject({ name: integrationStudioAssetName, mapFilePath: path });
  expect(await ensureIntegrationStudioArtwork(memory.app)).toBe(path);
  expect(renderImage).toHaveBeenCalledTimes(1);
  expect(await assets.getAssets(undefined, 'map')).toHaveLength(1);
});
it('does not adopt or overwrite an unmarked owner asset with the same name', async () => {
  const memory = createInMemoryApp();
  const assets = AssetService.getInstance(memory.app);
  await assets.initialize();
  await assets.addAsset({ type: 'map', name: integrationStudioAssetName, mapFilePath: 'owner.png', collection: assets.getDefaultCollectionId(), tags: [] });
  const path = await ensureIntegrationStudioArtwork(memory.app);
  expect(path).not.toBe('owner.png');
  expect((await assets.getAssets(undefined, 'map')).find(asset => asset.mapFilePath === 'owner.png')).toBeTruthy();
});
it('fails rather than replacing a registered but missing studio image', async () => {
  const memory = createInMemoryApp();
  const path = await ensureIntegrationStudioArtwork(memory.app);
  memory.files.delete(path);
  await expect(ensureIntegrationStudioArtwork(memory.app)).rejects.toThrow('Restore its asset file');
  expect(renderImage).toHaveBeenCalledTimes(1);
});
