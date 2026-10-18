import React from 'react';
import { workspaceItemSummary } from './workspacePresentation';
import type { RecordedCheckpoint, WorkspaceRecording, WorkspaceSelection } from './recordingTypes';

const unknown = 'Not established by this recording';
export function RecordedWorkspaceDetails({ recording, checkpoint, selection }: {
  recording: WorkspaceRecording; checkpoint: RecordedCheckpoint; selection: WorkspaceSelection | null;
}): React.ReactElement {
  if (selection?.kind === 'seat') {
    const seat = recording.seats.find(item => item.id === selection.id);
    const observation = checkpoint.seats.find(item => item.seatId === selection.id);
    if (seat) {
      const prefix = observation?.status === 'live' ? 'Current recorded' : 'Last recorded';
      const primary = [
        ['Native harness', seat.nativeHarness ?? unknown], ['Model', seat.model],
        ['Repository', seat.repositoryPath ?? unknown], ['Working directory', seat.workingDirectory ?? unknown],
      ];
      const identity = [
        ['Stable seat ID', seat.id], ['Seat address', seat.address],
        [`${prefix} occupant generation`, observation?.generation ?? unknown],
        [`${prefix} native conversation`, observation?.nativeConversationId ?? unknown],
        [`${prefix} session`, observation?.sessionId ?? unknown],
      ];
      const assignments = checkpoint.work.map(item => recording.work.find(work => work.id === item.workId))
        .filter(work => work?.assignedSeatId === seat.id).map(work => work?.title);
      return <aside className="recorded-workspace__details recorded-workspace__agent" aria-label="Selection details">
        <h3>{seat.label}</h3>
        <p>{seat.purpose ?? 'Purpose not recorded.'}</p>
        <dl>{primary.map(([label, value]) => <React.Fragment key={label}><dt>{label}</dt><dd>{value}</dd></React.Fragment>)}</dl>
        <div className="recorded-workspace__agent-links">
          {seat.repositoryUrl && <a href={seat.repositoryUrl} target="_blank" rel="noopener noreferrer">Open repository source</a>}
          {seat.projectBriefUrl && <a href={seat.projectBriefUrl} target="_blank" rel="noopener noreferrer">Open project brief</a>}
          {seat.openAgentInstructionsUrl && <a href={seat.openAgentInstructionsUrl} target="_blank" rel="noopener noreferrer">Open agent instructions</a>}
        </div>
        <p className="recorded-workspace__muted">Direct opening from Atlas is not connected.</p>
        <details className="recorded-workspace__operations"><summary>Recorded operations</summary>
          {observation ? <>
            <dl><dt>Seat status</dt><dd>{workspaceItemSummary(recording, checkpoint, selection).status}</dd>
              <dt>Continuity</dt><dd>{observation.continuity}</dd>
              <dt>Historical assignments</dt><dd>{assignments.join(', ') || 'None recorded at this checkpoint'}</dd></dl>
            <h4>Recorded next action</h4><p>{checkpoint.nextAction}</p><p>{observation.detail}</p>
          </> : <p role="status">Not recorded at this checkpoint.</p>}
          <details className="recorded-workspace__identity"><summary>Identity and revision details</summary>
            <dl>{identity.map(([label, value]) => <React.Fragment key={label}><dt>{label}</dt><dd>{value}</dd></React.Fragment>)}</dl>
          </details>
          <p className="recorded-workspace__muted">Historical evidence only. This view cannot perform the recorded action.</p>
        </details>
      </aside>;
    }
  }
  const established = selection && (selection.kind === 'seat' ? checkpoint.seats.some(item => item.seatId === selection.id)
    : selection.kind === 'work' ? checkpoint.work.some(item => item.workId === selection.id)
      : checkpoint.artifacts.some(item => item.artifactId === selection.id));
  if (selection && !established) {
    const summary = workspaceItemSummary(recording, checkpoint, selection);
    return <aside className="recorded-workspace__details" aria-label="Selection details"><h3>{summary.title}</h3>
      <p role="status">Not recorded at this checkpoint.</p><p>This Atlas object remains selected. Choose another checkpoint to inspect its recorded history.</p></aside>;
  }
  const fields: [string, string][] = [];
  const identity: [string, string][] = [];
  let title = 'Select a recorded item';
  let detail = checkpoint.summary;
  let nextAction = checkpoint.nextAction;
  if (selection?.kind === 'work') {
    const work = recording.work.find(item => item.id === selection.id);
    const observation = checkpoint.work.find(item => item.workId === selection.id);
    if (work && observation) {
      title = work.title; detail = observation.detail; nextAction = observation.nextAction;
      const seat = recording.seats.find(item => item.id === work.assignedSeatId);
      const occupant = checkpoint.seats.find(item => item.seatId === work.assignedSeatId);
      const claim = observation.claimGeneration === null ? 'Unclaimed'
        : observation.claimGeneration === undefined ? unknown
          : observation.claimGeneration === occupant?.generation ? 'Claimed by the recorded seat occupant' : 'Claimed by a different recorded generation';
      const artifactIds = new Set(checkpoint.artifacts.map(item => item.artifactId));
      const artifacts = work.artifactIds.filter(id => artifactIds.has(id));
      fields.push(['Status', workspaceItemSummary(recording, checkpoint, selection).status], ['Historical assignment', seat?.label ?? unknown],
        ['Claim', claim], ['Predecessor', recording.work.find(item => item.id === work.predecessorId)?.title ?? 'None recorded'],
        ['Artifacts', artifacts.map(id => recording.artifacts.find(item => item.id === id)?.title ?? id).join(', ') || 'No artifact recorded yet']);
      identity.push(['Stable work ID', work.id],
        ['Claim generation', observation.claimGeneration === null ? 'Unclaimed' : observation.claimGeneration ?? unknown],
        [occupant?.status === 'live' ? 'Current recorded occupant generation' : 'Last recorded occupant generation', occupant?.generation ?? unknown],
        ['Transition', observation.transition === undefined ? 'Not recorded' : String(observation.transition)]);
    }
  } else if (selection?.kind === 'artifact') {
    const artifact = recording.artifacts.find(item => item.id === selection.id);
    const observation = checkpoint.artifacts.find(item => item.artifactId === selection.id);
    if (artifact && observation) {
      title = artifact.title; detail = observation.detail;
      fields.push(['Status', observation.status]);
      if (observation.status === 'draft') {
        fields.push(['Revision', 'Draft at this checkpoint. Final revision and publication details were not yet established.']);
      } else {
        identity.push(['Original revision SHA-256', artifact.originalSha256 ?? unknown]);
        if (observation.status === 'accepted') {
          fields.push(['Accepted by', observation.acceptedBy.join(', ') || unknown], ['Acceptance scope', 'The exact original revision recorded here; publication bytes may differ.']);
          identity.push(['Publication SHA-256', artifact.publishedSha256 ?? unknown]);
        } else fields.push(['Acceptance', 'Frozen candidate revision. No acceptance recorded at this checkpoint.']);
      }
    }
  }
  const selectedWork = selection?.kind === 'work' ? recording.work.find(item => item.id === selection.id) : undefined;
  const acceptedWorkArtifacts = selectedWork?.artifactIds.flatMap(id => {
    const artifact = recording.artifacts.find(item => item.id === id);
    const accepted = checkpoint.artifacts.some(item => item.artifactId === id && item.status === 'accepted');
    return accepted && artifact?.publishedUrl ? [artifact] : [];
  }) ?? [];
  const selectedArtifact = selection?.kind === 'artifact' ? recording.artifacts.find(item => item.id === selection.id) : undefined;
  const artifactStatus = checkpoint.artifacts.find(item => item.artifactId === selectedArtifact?.id)?.status;
  return <aside className="recorded-workspace__details" aria-label="Selection details">
    <span className="recorded-workspace__eyebrow">Recorded identity and facts</span><h3>{title}</h3>
    <dl>{fields.map(([label, value]) => <React.Fragment key={label}><dt>{label}</dt><dd>{value}</dd></React.Fragment>)}</dl>
    <h4>Recorded next action</h4><p>{nextAction}</p><p>{detail}</p>
    {acceptedWorkArtifacts.length > 0 && <div className="recorded-workspace__agent-links" aria-label="Accepted work artifacts">
      {acceptedWorkArtifacts.map(artifact => <a key={artifact.id} href={artifact.publishedUrl} target="_blank" rel="noopener noreferrer">Open accepted artifact: {artifact.title}</a>)}
      <a href={checkpoint.evidenceUrl} target="_blank" rel="noopener noreferrer">Open work acceptance evidence</a>
      <a href={recording.manifestUrl} target="_blank" rel="noopener noreferrer">Open work artifact digest manifest</a>
    </div>}
    {selectedArtifact?.publishedUrl && artifactStatus === 'accepted' && <p><a href={selectedArtifact.publishedUrl} target="_blank" rel="noopener noreferrer">Open published artifact</a></p>}
    {selectedArtifact && (artifactStatus === 'delivered' || artifactStatus === 'accepted') && <p><a href={recording.manifestUrl} target="_blank" rel="noopener noreferrer">Open original and publication digest manifest</a></p>}
    {selectedArtifact && artifactStatus === 'accepted' && <p><a href={recording.reviewUrl} target="_blank" rel="noopener noreferrer">Open recorded reviewer verdict</a></p>}
    {selectedArtifact && artifactStatus === 'accepted' && checkpoint.artifacts.find(item => item.artifactId === selectedArtifact.id)?.acceptedBy.includes('Coordinator') && <p><a href={recording.coordinatorAcceptanceUrl} target="_blank" rel="noopener noreferrer">Open separate coordinator acceptance</a></p>}

    {identity.length > 0 && <details className="recorded-workspace__identity"><summary>Identity and revision details</summary><dl>{identity.map(([label, value]) => <React.Fragment key={label}><dt>{label}</dt><dd>{value}</dd></React.Fragment>)}</dl></details>}
    <p className="recorded-workspace__muted">Historical evidence only. This view cannot perform the recorded action.</p>
  </aside>;
}
