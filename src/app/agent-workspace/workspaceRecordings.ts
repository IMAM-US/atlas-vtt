import { integrationRecording, integrationOrientationRecording, repositoryTeamRecording } from './integrationRecording';
import { foundationRecording } from './foundationRecording';
import type { WorkspaceRecording } from './recordingTypes';

/** Immutable, bundled evidence captures available to the recorded scene inspector. */
export const workspaceRecordings: readonly WorkspaceRecording[] = [foundationRecording, repositoryTeamRecording, integrationRecording, integrationOrientationRecording];
