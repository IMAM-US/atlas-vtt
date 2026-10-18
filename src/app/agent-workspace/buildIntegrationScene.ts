import { buildRecordedScene } from './buildRecordedScene';
import type { CollectionSettings } from '../types/collectionSettingsTypes';
import type { WorkspaceRecording } from './recordingTypes';

/** A small authored starting arrangement using native text and linked-note pins. */
export function buildIntegrationScene(settings: CollectionSettings, recording: WorkspaceRecording, name: string): ReturnType<typeof buildRecordedScene> {
  const scene = buildRecordedScene(settings, recording, name);
  const texts = scene.state.objects.texts;
  for (const [index, label] of ['Atlas repository\nScene objects, editing and history', 'OpenRig repository\nSeats, owned work and continuity'].entries()) {
    const id = `text_integration_context_${index}`;
    texts[id] = { id, kind: 'text', text: label, x: 350 + index * 700, y: 720, width: 540,
      fontSize: 21, fontFamily: 'sans-serif', color: '#e8edf6', backgroundColor: '#202b40', padding: 20, borderRadius: 12 };
  }
  scene.state.objects.pins = {
    pin_integration_entry: { id: 'pin_integration_entry', kind: 'pin', x: 700, y: 1200, notePath: 'Integration workspace/Start here.md', icon: 'book-open' },
    pin_integration_atlas: { id: 'pin_integration_atlas', kind: 'pin', x: 350, y: 830, notePath: 'Integration workspace/Atlas repository.md', icon: 'file-text' },
    pin_integration_openrig: { id: 'pin_integration_openrig', kind: 'pin', x: 1050, y: 830, notePath: 'Integration workspace/OpenRig repository.md', icon: 'file-text' },
  };
  return scene;
}
