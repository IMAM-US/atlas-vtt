import React, { useMemo } from 'react';
import { useAtlasStore, useViewStoreHook } from '../react/ViewStoreContext';
import { RecordedWorkspace } from './RecordedWorkspace';
import { workspaceRecordings } from './workspaceRecordings';
import { preferredRecordedObjectId, recordedSceneBindings, selectedRecordedReference } from './recordedSceneBindings';

/** Keep rapidly changing scene subscriptions out of Atlas's root chrome. */
export function RecordedWorkspaceOverlay(): React.ReactElement | null {
  const store = useViewStoreHook();
  const tokens = useAtlasStore(state => state.objects.tokens);
  const texts = useAtlasStore(state => state.objects.texts);
  const selectedIds = useAtlasStore(state => state.selectedIds);
  const objects = useMemo(() => [...Object.values(tokens), ...Object.values(texts)], [tokens, texts]);
  const represented = useMemo(() => workspaceRecordings.map(recording => ({
    recording, bindings: recordedSceneBindings(recording, objects),
  })).filter(entry => entry.bindings.length), [objects]);
  const active = selectedIds.flatMap(id => represented.filter(entry => entry.bindings.some(binding => binding.objectId === id)))[0]
    ?? represented[0];
  const bindings = active?.bindings ?? [];
  const selection = selectedRecordedReference(bindings, selectedIds);
  const selectedObjectId = selection ? preferredRecordedObjectId(bindings, selectedIds, selection) : undefined;
  const object = objects.find(item => item.id === selectedObjectId);
  const authoredLabel = object && ('text' in object ? object.text : 'name' in object && typeof object.name === 'string' ? object.name : undefined);
  if (!active) return null;
  return <RecordedWorkspace key={`${active.recording.id}:${active.recording.sourceRevision}`} recording={active.recording} selection={selection} availableSelections={bindings.map(binding => binding.selection)}
    {...(authoredLabel !== undefined ? { authoredLabel } : {})}
    onSelect={reference => {
      const objectId = preferredRecordedObjectId(bindings, selectedIds, reference);
      if (objectId) store.getState().setSelection([objectId]);
    }} />;
}
