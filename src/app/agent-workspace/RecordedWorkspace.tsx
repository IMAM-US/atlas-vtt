import React, { useEffect, useState } from 'react';
import { Button } from '../packages/components/primitives/button';
import { CloseButton } from '../packages/components/primitives/CloseButton';
import { RecordedWorkspaceDetails } from './RecordedWorkspaceDetails';
import type { WorkspaceRecording, WorkspaceSelection } from './recordingTypes';
import { workspaceItemSummary } from './workspacePresentation';
import './workspace.scss';

/** Evidence over the normal editable Atlas scene. Checkpoints change this inspector only. */
export function RecordedWorkspace({ recording, selection, availableSelections, onSelect, authoredLabel }: {
  recording: WorkspaceRecording;
  authoredLabel?: string;
  selection: WorkspaceSelection | null;
  availableSelections: readonly WorkspaceSelection[];
  onSelect: (selection: WorkspaceSelection) => void;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(Boolean(selection));
  useEffect(() => {
    if (selection) setExpanded(true);
  }, [selection?.kind, selection?.id]);
  const [checkpointId, setCheckpointId] = useState(recording.checkpoints.at(-1)?.id ?? '');
  const checkpoint = recording.checkpoints.find(item => item.id === checkpointId) ?? recording.checkpoints.at(-1);
  if (!checkpoint) return <p>No checkpoints were recorded.</p>;
  const unique = availableSelections.filter((item, index, entries) => entries.findIndex(other => other.kind === item.kind && other.id === item.id) === index);
  const checkpointControls = <div className="recorded-workspace__history-controls"><label className="recorded-workspace__checkpoint">Checkpoint<select value={checkpoint.id} onChange={event => setCheckpointId(event.target.value)}>
        {recording.checkpoints.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select></label>
      <div className="recorded-workspace__record-meta"><span>{checkpoint.at}</span><a href={checkpoint.evidenceUrl} target="_blank" rel="noopener noreferrer">Open checkpoint evidence</a></div></div>;
  return <section className={`recorded-workspace recorded-workspace--panel${expanded ? '' : ' is-collapsed'}`} aria-label="Recorded evidence" onKeyDown={event => event.stopPropagation()}>
    <header className="recorded-workspace__header atlas-close-header">
      <Button variant="ghost" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>Recorded evidence</Button>
      {expanded && <CloseButton aria-label="Collapse recorded evidence" onClick={() => setExpanded(false)} />}
    </header>
    {expanded && <div className="recorded-workspace__panel-content">
      {selection?.kind === 'seat' && <RecordedWorkspaceDetails recording={recording} checkpoint={checkpoint} selection={selection} />}
      <p className="recorded-workspace__muted">OpenRig recording · Not live</p>
      <p className="recorded-workspace__muted">Authored scene; recorded operations. Shape this Atlas workspace with editable objects and annotations. This inspector preserves the recorded OpenRig facts.</p>
      {selection?.kind !== 'seat' && checkpointControls}
      <details className="recorded-workspace__records"><summary>Recorded references in this scene</summary>
        <div className="recorded-workspace__list">{unique.map(item => {
          const { title, status } = workspaceItemSummary(recording, checkpoint, item);
          return <Button variant="secondary" key={`${item.kind}:${item.id}`} className="recorded-workspace__item" aria-pressed={selection?.kind === item.kind && selection.id === item.id} onClick={() => onSelect(item)}>
            <span>{title}</span><span className="recorded-workspace__muted">{status}</span>
          </Button>;
        })}</div>
      </details>
      {selection && authoredLabel !== undefined && <p className="recorded-workspace__authored-label"><span className="recorded-workspace__muted">Authored Atlas label</span><br />{authoredLabel || "(empty label)"}</p>}
      {selection?.kind === 'seat' ? <details className="recorded-workspace__history"><summary>Historical checkpoints</summary>{checkpointControls}</details> : selection ? <RecordedWorkspaceDetails recording={recording} checkpoint={checkpoint} selection={selection} />
        : <p>Select a referenced Atlas object to inspect its recorded facts.</p>}
      <details className="recorded-workspace__source"><summary>Recording provenance</summary><p>Source revision <code>{recording.sourceRevision}</code></p><p>{recording.runtimeVersion}</p>
        {recording.openRigScope && <dl><dt>Recorded rig</dt><dd>{recording.openRigScope.rigName} ({recording.openRigScope.rigId})</dd>
          <dt>Recorded instance locator</dt><dd>{recording.openRigScope.instanceLocator}</dd><dt>Recorded state home</dt><dd>{recording.openRigScope.stateHome}</dd></dl>}
      </details>
    </div>}
  </section>;
}
