import { ensureIntegrationStudioArtwork } from './integrationStudioArtwork';
import { AtlasView } from '../atlas-view';
import { attachIntegrationEvidence, attachRepositoryTeamEvidence } from './attachIntegrationEvidence';
import { ensureIntegrationNotes } from './integrationNotes';
import { buildIntegrationScene } from './buildIntegrationScene';
import { integrationRecording, integrationOrientationRecording, repositoryTeamRecording, integrationSceneName } from './integrationRecording';
import { Notice, type Plugin } from 'obsidian';
import { createOrOpenRecordedScene, openExistingRecordedScene } from './createRecordedScene';
import type { ViewAtlasStore } from '../storeFactory';
import type { WorkspaceRecording } from './recordingTypes';

function activeIntegrationScene(plugin: Plugin, editions: readonly WorkspaceRecording[] = [integrationOrientationRecording, integrationRecording, repositoryTeamRecording]): { view: AtlasView; store: ViewAtlasStore; mapPath: string } | null {
  const view = plugin.app.workspace.getActiveViewOfType(AtlasView);
  if (!view) return null;
  const store = view.getStore();
  const state = store.getState();
  if (state.isPlayerView || state.isMapLoading || !state.mapPath) return null;
  const belongs = [...Object.values(state.objects.tokens), ...Object.values(state.objects.texts)].some(object => {
    const reference = object.recordingReference;
    if (!reference) return false;
    return editions.some(edition => {
      if (reference.recordingId !== edition.id || reference.sourceRevision !== edition.sourceRevision) return false;
      const records = reference.kind === 'seat' ? edition.seats : reference.kind === 'work' ? edition.work : reference.kind === 'artifact' ? edition.artifacts : [];
      return records.some(record => record.id === reference.id);
    });
  });
  if (!belongs) return null;
  return { view, store, mapPath: state.mapPath };
}

/** Opens a real Atlas scene; its normal view owns editing, history and persistence. */
export function registerRecordedWorkspace(plugin: Plugin): void {
  plugin.addCommand({
    id: 'attach-repository-team-evidence',
    name: 'Attach repository team evidence',
    checkCallback: checking => {
      const active = activeIntegrationScene(plugin, [integrationOrientationRecording, integrationRecording]);
      if (!active) return false;
      if (!checking) {
        const result = attachRepositoryTeamEvidence(active.store, [integrationOrientationRecording, integrationRecording], repositoryTeamRecording, integrationSceneName, {
          '01M569M8QKR9085ZDEG6CFHVVN': '01M56CGCH9NACF766XDX1TF92N',
          '01M569MJ4HHP75EEKF6AEWWM98': '01M56CGNJD6YPXS5STC2QHWVVB',
        });
        new Notice(result.updatedReferences || result.addedWorkCards ? 'Repository team evidence attached' : 'Repository team evidence already attached');
      }
      return true;
    },
  });
  plugin.addCommand({
    id: 'add-integration-studio-artwork',
    name: 'Add integration studio artwork',
    checkCallback: checking => {
      const active = activeIntegrationScene(plugin);
      if (!active) return false;
      if (!checking) {
        void ensureIntegrationStudioArtwork(plugin.app, active.mapPath).then(path => {
          const current = activeIntegrationScene(plugin);
          if (!current || current.view !== active.view || current.store !== active.store || current.mapPath !== active.mapPath) return;
          current.store.getState().setBackground(path);
          new Notice('Integration studio artwork added');
        }).catch((error: unknown) => {
          console.error('[Atlas] Could not add integration studio artwork:', error);
          new Notice('Unable to add integration studio artwork');
        });
      }
      return true;
    },
  });
  plugin.addCommand({
    id: 'attach-completed-integration-evidence',
    name: 'Attach completed integration evidence',
    checkCallback: checking => {
      const active = activeIntegrationScene(plugin, [integrationOrientationRecording]);
      if (!active) return false;
      const { store } = active;
      if (!checking) {
        const result = attachIntegrationEvidence(store, integrationOrientationRecording, integrationRecording, integrationSceneName);
        new Notice(result.updatedReferences || result.addedWorkCards ? 'Completed integration evidence attached' : 'Completed integration evidence already attached');
      }
      return true;
    },
  });
  plugin.addCommand({
    id: 'open-integration-workspace',
    name: 'Open Atlas OpenRig integration workspace',
    callback: () => {
      void (async () => {
        if (await openExistingRecordedScene(plugin.app, repositoryTeamRecording, [integrationRecording.id])) return;
        await ensureIntegrationNotes(plugin.app);
        const background = await ensureIntegrationStudioArtwork(plugin.app);
        await createOrOpenRecordedScene(plugin.app, repositoryTeamRecording, integrationSceneName, (settings, recording, name) => {
          const scene = buildIntegrationScene(settings, recording, name);
          scene.state.background = background;
          return scene;
        }, [integrationRecording.id]);
      })().catch((error: unknown) => {
        console.error('[Atlas] Could not open integration workspace:', error);
        new Notice('Unable to open the integration workspace');
      });
    },
  });
  plugin.addCommand({
    id: 'open-recorded-agent-workspace',
    name: 'Open recorded agent workspace',
    callback: () => {
      void createOrOpenRecordedScene(plugin.app).catch((error: unknown) => {
        console.error('[Atlas] Could not open recorded agent workspace:', error);
        new Notice('Unable to open the recorded agent workspace');
      });
    },
  });
}
