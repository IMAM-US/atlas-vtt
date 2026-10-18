import type { RecordedCheckpoint, WorkspaceRecording, WorkspaceSelection } from './recordingTypes';

/** The same historical labels drive both spatial markers and keyboard lists. */
export function workspaceItemSummary(recording: WorkspaceRecording, checkpoint: RecordedCheckpoint, selection: WorkspaceSelection): { title: string; status: string } {
  if (selection.kind === 'seat') {
    const seat = recording.seats.find(item => item.id === selection.id);
    const observation = checkpoint.seats.find(item => item.seatId === selection.id);
    const lifecycle = observation?.status === 'live' ? 'Live' : observation?.status === 'stopped' ? 'Stopped' : 'Not recorded';
    return { title: seat?.label ?? selection.id, status: lifecycle + (observation?.recoverable ? ' · Recoverable' : '') };
  }
  if (selection.kind === 'work') {
    const work = recording.work.find(item => item.id === selection.id);
    const index = recording.work.findIndex(item => item.id === selection.id);
    const status = checkpoint.work.find(item => item.workId === selection.id)?.status;
    return { title: `${index + 1}. ${work?.title ?? selection.id}`, status: status === 'in-progress' ? 'In progress' : status === 'done' ? 'Done' : status === 'pending' ? 'Pending' : 'Not recorded' };
  }
  const artifact = recording.artifacts.find(item => item.id === selection.id);
  const status = checkpoint.artifacts.find(item => item.artifactId === selection.id)?.status;
  return { title: artifact?.title ?? selection.id, status: status ? status[0]!.toUpperCase() + status.slice(1) : 'Not recorded' };
}
