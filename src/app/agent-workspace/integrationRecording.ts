import repositoryTeamData from './repositoryTeamRecording.json';
import data from './integrationRecording.json';
import orientationData from './integrationOrientationRecording.json';
import type { WorkspaceRecording } from './recordingTypes';
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
/** Manually curated edition of the team's actual work. No runtime transport. */
export const integrationOrientationRecording = freeze(orientationData as WorkspaceRecording);
export const integrationRecording = freeze(data as WorkspaceRecording);
export const repositoryTeamRecording = freeze(repositoryTeamData as WorkspaceRecording);
export const integrationSceneName = 'Atlas OpenRig integration workspace';
