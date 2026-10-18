import type { CollectionSettings } from '../types/collectionSettingsTypes';
import { type App, TFile, normalizePath } from 'obsidian';
import { AssetService } from '../services/AssetService';
import { ensureFolder } from '../plugin/vaultFolders';
import { openMapInView } from '../plugin/atlasLeaves';
import type { WorkspaceRecording } from './recordingTypes';
import { foundationRecording } from './foundationRecording';
import { buildRecordedScene, recordedSceneName as name } from './buildRecordedScene';

async function findRecordedScene(app: App, assets: AssetService, recording: WorkspaceRecording, priorRecordingIds: readonly string[]): Promise<TFile | null> {
  const existing = (await assets.getAssets(undefined, 'scene'))
    .filter(asset => {
      const id = asset.data?.recording?.recordingId;
      return id === recording.id || (id !== undefined && priorRecordingIds.includes(id));
    })
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))[0];
  if (existing) {
    const found = existing.data?.mapPath ? app.vault.getAbstractFileByPath(existing.data.mapPath) : null;
    if (!(found instanceof TFile)) throw new Error('The recorded workspace scene is missing. Restore its map file before opening it.');
    return found;
  }
  return null;
}

/** Reopen an authored scene before initializing optional starter content. */
export async function openExistingRecordedScene(app: App, recording: WorkspaceRecording, priorRecordingIds: readonly string[] = []): Promise<boolean> {
  const assets = AssetService.getInstance(app);
  await assets.initialize();
  const file = await findRecordedScene(app, assets, recording, priorRecordingIds);
  if (!file) return false;
  await openMapInView(app, file);
  return true;
}

/** Creates once in the default collection, then opens the marked scene wherever it lives. */
export async function createOrOpenRecordedScene(app: App, recording: WorkspaceRecording = foundationRecording, sceneName: string = name, buildScene: (settings: CollectionSettings, recording: WorkspaceRecording, name: string) => ReturnType<typeof buildRecordedScene> = buildRecordedScene, priorRecordingIds: readonly string[] = []): Promise<void> {
  const assets = AssetService.getInstance(app);
  await assets.initialize();
  const file = await assets.runExclusive(async () => {
    const existing = await findRecordedScene(app, assets, recording, priorRecordingIds);
    if (existing) return existing;
    const collection = assets.getDefaultCollectionId();
    const directory = normalizePath(`atlas-vtt/collections/${collection}/scenes`);
    await ensureFolder(app, directory);
    let path = `${directory}/${sceneName}.atlasmap`;
    for (let suffix = 2; app.vault.getAbstractFileByPath(path); suffix++) {
      path = `${directory}/${sceneName} (${suffix}).atlasmap`;
    }
    const resolvedName = path.slice(path.lastIndexOf('/') + 1, -'.atlasmap'.length);
    const seed = buildScene(assets.getCollectionSettings(collection), recording, sceneName);
    seed.state.name = resolvedName;
    const created = await app.vault.create(path, JSON.stringify(seed, null, 2));
    try {
      await assets.addAsset({ type: 'scene', name: resolvedName, collection, tags: [],
        data: { mapPath: path, recording: { recordingId: recording.id, sourceRevision: recording.sourceRevision } } });
    } catch (error) {
      // Registration can fail after the in-memory index acquired the scene. Keep its file in that case.
      const registered = (await assets.getAssets(undefined, 'scene')).some(asset => asset.data?.mapPath === path);
      if (!registered) await app.fileManager.trashFile(created);
      throw error;
    }
    return created;
  });
  await openMapInView(app, file);
}
