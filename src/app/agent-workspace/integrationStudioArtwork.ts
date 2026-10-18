import type { App } from 'obsidian';
import studio from './assets/integration-studio-v1.png?inline';
import { renderFramedImage } from '../imageProcessing/imageProcessing';
import { AssetService } from '../services/AssetService';
import { writeAssetImage } from '../services/assetImageFiles';

export const integrationStudioAssetName = 'Atlas OpenRig integration studio v1';
const marker = 'Atlas integration studio v1';

/** Install the bundled illustration as an ordinary map asset without replacing authored assets. */
export async function ensureIntegrationStudioArtwork(app: App, mapPath?: string): Promise<string> {
  const assets = AssetService.getInstance(app);
  await assets.initialize();
  return assets.runExclusive(async () => {
    const scene = mapPath ? (await assets.getAssets(undefined, 'scene')).find(asset => asset.data?.mapPath === mapPath) : undefined;
    const collection = scene?.collection ?? assets.getDefaultCollectionId();
    const existing = (await assets.getAssets(collection, 'map')).find(asset => asset.name === integrationStudioAssetName && asset.tags.includes(marker));
    if (existing) {
      if (!app.vault.getAbstractFileByPath(existing.mapFilePath)) throw new Error('The integration studio image is missing. Restore its asset file.');
      return existing.mapFilePath;
    }
    const comma = studio.indexOf(',');
    const bytes = Uint8Array.from(atob(studio.slice(comma + 1)), character => character.charCodeAt(0));
    const rendered = await renderFramedImage(new Blob([bytes], { type: 'image/png' }),
      { centerX: 0.5, centerY: 0.5, width: 1 }, { minSize: 1400, maxSize: 1400, quality: 0.85 });
    const path = await writeAssetImage(app, integrationStudioAssetName, await rendered.image.arrayBuffer());
    const tag = await assets.createTag(collection, 'maps', marker);
    await assets.addAsset({ type: 'map', name: integrationStudioAssetName, mapFilePath: path, collection, tags: [tag.name] });
    return path;
  });
}
