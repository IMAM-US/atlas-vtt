import type { RecordingReference } from '../types';
import type { WorkspaceRecording, WorkspaceSelection } from './recordingTypes';

interface ReferencedObject {
  readonly id: string;
  readonly recordingReference?: RecordingReference;
}
export interface RecordedSceneBinding {
  readonly objectId: string;
  readonly selection: WorkspaceSelection;
}
/** Resolve provenance, never authored names or positions, to immutable recording facts. */
export function recordedSceneBindings(recording: WorkspaceRecording, objects: readonly ReferencedObject[]): RecordedSceneBinding[] {
  return objects.flatMap(object => {
    const ref = object.recordingReference;
    if (!ref || ref.recordingId !== recording.id || ref.sourceRevision !== recording.sourceRevision) return [];
    const records = ref.kind === 'seat' ? recording.seats : ref.kind === 'work' ? recording.work : ref.kind === 'artifact' ? recording.artifacts : [];
    return records.some(record => record.id === ref.id) ? [{ objectId: object.id, selection: { kind: ref.kind, id: ref.id } }] : [];
  });
}
export function selectedRecordedReference(bindings: readonly RecordedSceneBinding[], selectedIds: readonly string[]): WorkspaceSelection | null {
  for (const id of selectedIds) {
    const match = bindings.find(binding => binding.objectId === id);
    if (match) return match.selection;
  }
  return null;
}

/** Keep a selected token or text representation when both point at the same fact. */
export function preferredRecordedObjectId(bindings: readonly RecordedSceneBinding[], selectedIds: readonly string[], selection: WorkspaceSelection): string | undefined {
  const matches = bindings.filter(binding => binding.selection.kind === selection.kind && binding.selection.id === selection.id);
  return selectedIds.find(id => matches.some(binding => binding.objectId === id)) ?? matches[0]?.objectId;
}
