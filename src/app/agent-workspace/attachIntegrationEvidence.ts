import type { ViewAtlasStore } from '../storeFactory';
import type { RecordingReference } from '../types';
import { runHistoryTransaction } from '../stores/history';
import type { WorkspaceRecording } from './recordingTypes';

/** Explicitly attach an immutable evidence edition without changing authored representations. */
export function attachIntegrationEvidence(store: ViewAtlasStore, from: WorkspaceRecording, to: WorkspaceRecording, sceneName: string): {
  sceneName: string; updatedReferences: number; addedWorkCards: number;
} {
  let updatedReferences = 0;
  let addedWorkCards = 0;
  const valid = (reference: RecordingReference): boolean => {
    const records = reference.kind === 'seat' ? to.seats : reference.kind === 'work' ? to.work : reference.kind === 'artifact' ? to.artifacts : [];
    return records.some(record => record.id === reference.id);
  };
  const migrate = (reference: RecordingReference | undefined): RecordingReference | undefined => {
    if (!reference || reference.recordingId !== from.id || reference.sourceRevision !== from.sourceRevision || !valid(reference)) return;
    if (reference.recordingId === to.id && reference.sourceRevision === to.sourceRevision) return;
    updatedReferences++;
    return { ...reference, recordingId: to.id, sourceRevision: to.sourceRevision };
  };
  runHistoryTransaction(store, () => {
    const state = store.getState();
    for (const token of Object.values(state.objects.tokens)) {
      const recordingReference = migrate(token.recordingReference);
      if (recordingReference) state.updateToken(token.id, { recordingReference });
    }
    for (const text of Object.values(state.objects.texts)) {
      const recordingReference = migrate(text.recordingReference);
      if (recordingReference) state.updateText(text.id, { recordingReference });
    }
    const objects = store.getState().objects;
    const represented = new Set([...Object.values(objects.tokens), ...Object.values(objects.texts)].flatMap(object => {
      const ref = object.recordingReference;
      return ref?.recordingId === to.id && ref.sourceRevision === to.sourceRevision && ref.kind === 'work' ? [ref.id] : [];
    }));
    to.work.forEach((work, index) => {
      if (represented.has(work.id)) return;
      state.addText({ text: work.title, x: 350 + (index % 2) * 700, y: 490 + Math.floor(index / 2) * 210,
        width: 540, fontSize: 21, fontFamily: 'sans-serif', color: '#e8edf6', backgroundColor: '#202b40', padding: 20, borderRadius: 12,
        recordingReference: { recordingId: to.id, sourceRevision: to.sourceRevision, kind: 'work', id: work.id } });
      represented.add(work.id);
      addedWorkCards++;
    });
  });
  return { sceneName, updatedReferences, addedWorkCards };
}

/** Explicit roster replacement: historical work and artifact references retain their original evidence. */
export function attachRepositoryTeamEvidence(store: ViewAtlasStore, from: readonly WorkspaceRecording[], to: WorkspaceRecording,
  sceneName: string, seatIdMap: Readonly<Record<string, string>>): { sceneName: string; updatedReferences: number; addedWorkCards: number } {
  let updatedReferences = 0;
  let addedWorkCards = 0;
  runHistoryTransaction(store, () => {
    const state = store.getState();
    const replace = (reference: RecordingReference | undefined): RecordingReference | undefined => {
      if (!reference || reference.kind !== 'seat') return;
      const source = from.find(recording => recording.id === reference.recordingId && recording.sourceRevision === reference.sourceRevision);
      if (!source?.seats.some(seat => seat.id === reference.id)) return;
      const id = seatIdMap[reference.id];
      if (!id || !to.seats.some(seat => seat.id === id)) return;
      if (reference.recordingId === to.id && reference.sourceRevision === to.sourceRevision && reference.id === id) return;
      updatedReferences++;
      return { recordingId: to.id, sourceRevision: to.sourceRevision, kind: 'seat', id };
    };
    for (const token of Object.values(state.objects.tokens)) {
      const recordingReference = replace(token.recordingReference);
      if (recordingReference) state.updateToken(token.id, { recordingReference });
    }
    for (const text of Object.values(state.objects.texts)) {
      const recordingReference = replace(text.recordingReference);
      if (recordingReference) state.updateText(text.id, { recordingReference });
    }
    const objects = store.getState().objects;
    const represented = new Set([...Object.values(objects.tokens), ...Object.values(objects.texts)].flatMap(object => {
      const ref = object.recordingReference;
      return ref?.recordingId === to.id && ref.sourceRevision === to.sourceRevision && ref.kind === 'work' ? [ref.id] : [];
    }));
    const bottom = Math.max(980, ...[...Object.values(objects.tokens), ...Object.values(objects.texts), ...Object.values(objects.pins)].map(object => object.y));
    let position = 0;
    for (const work of to.work) {
      if (represented.has(work.id)) continue;
      state.addText({ text: work.title, x: 350 + (position % 2) * 700, y: bottom + 420 + Math.floor(position / 2) * 210,
        width: 540, fontSize: 21, fontFamily: 'sans-serif', color: '#e8edf6', backgroundColor: '#202b40', padding: 20, borderRadius: 12,
        recordingReference: { recordingId: to.id, sourceRevision: to.sourceRevision, kind: 'work', id: work.id } });
      represented.add(work.id);
      position++;
      addedWorkCards++;
    }
  });
  return { sceneName, updatedReferences, addedWorkCards };
}
