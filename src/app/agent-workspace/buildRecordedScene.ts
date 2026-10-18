import { ATLAS_SCHEMA, ATLAS_VERSION, type MapFile } from '../services/MapPersistence';
import { tokenBarsOf, withTokenBars } from '../services/collectionTokenBars';
import type { Token, RecordingReference, TextElement } from '../types';
import type { CollectionSettings } from '../types/collectionSettingsTypes';
import type { WorkspaceRecording } from './recordingTypes';
import { foundationRecording } from './foundationRecording';

export const recordedSceneName = 'OpenRig foundation workspace';
/** Seeds editable native objects, never a copy of historical operational observations. */
export function buildRecordedScene(settings: CollectionSettings, recording: WorkspaceRecording = foundationRecording, name: string = recordedSceneName): { version: number; state: MapFile & { tokenSettings: ReturnType<typeof withTokenBars> } } {
  const reference = (kind: 'seat' | 'work' | 'artifact', id: string): RecordingReference => ({
    recordingId: recording.id, sourceRevision: recording.sourceRevision, kind, id,
  });
  const tokens: Record<string, Token> = {};
  const texts: Record<string, TextElement> = {};
  const card = (id: string, text: string, x: number, y: number, width: number): TextElement => ({
    id, kind: 'text', text, x, y, width, fontSize: 21, fontFamily: 'sans-serif',
    color: '#e8edf6', backgroundColor: '#202b40', padding: 20, borderRadius: 12,
  });
  recording.seats.forEach((seat, index) => {
    const id = `tok_recording_${index}`;
    tokens[id] = { id, kind: 'token', x: 350 + index * 700, y: 280,
      imagePath: '', showRing: true, ringColor: index === 0 ? '#60a5fa' : '#c084fc',
      size: 1.5, hasVision: false,
      recordingReference: reference('seat', seat.id) };
    const labelId = `text_recording_seat_${index}`;
    texts[labelId] = { ...card(labelId, seat.label, 350 + index * 700, 390, 540),
      recordingReference: reference('seat', seat.id) };
  });
  recording.work.forEach((work, index) => {
    const id = `text_recording_work_${index}`;
    texts[id] = { ...card(id, work.title, 350 + (index % 2) * 700, 490 + Math.floor(index / 2) * 210, 540),
      recordingReference: reference('work', work.id) };
  });
  recording.artifacts.forEach((artifact, index) => {
    const id = `text_recording_artifact_${index}`;
    texts[id] = { ...card(id, artifact.title, 350 + index * 700, 980, 540),
      recordingReference: reference('artifact', artifact.id) };
  });
  texts.text_recording_intro = card('text_recording_intro',
    `${name}\nArrange tokens and cards, edit labels, or add your own annotations.\nSelect a referenced object to inspect the historical evidence.`, 700, 100, 1160);
  const gd = settings.gridDefaults;
  const state: MapFile & { tokenSettings: ReturnType<typeof withTokenBars> } = {
    schema: ATLAS_SCHEMA, version: ATLAS_VERSION, name, background: null,
    grid: { enabled: true, visible: true, snapToGrid: true, type: 'square', size: 70,
      offsetX: 0, offsetY: 0, opacity: 0.15, lineType: 'solid', lineWidth: 1, autoDetect: false,
      ...(gd ? { unitType: gd.unitType === 'custom' ? 'units' as const : gd.unitType, unitDistance: gd.unitDistance,
        measurementType: gd.measurementMode === 'abstract' ? 'abstract' as const : 'units' as const } : {}) },
    objects: { tokens, texts, fog: {}, pins: {}, drawings: {}, walls: {}, lights: {} },
    camera: { x: 0, y: 0, scale: 1 },
    tokenSettings: { ...withTokenBars(undefined, tokenBarsOf(settings.defaultWidgets)), showInstanceBadges: false },
  };
  return { version: ATLAS_VERSION, state };
}
