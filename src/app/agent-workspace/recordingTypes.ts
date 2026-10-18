/** A bounded historical read model, not an OpenRig protocol or an Atlas map schema. */
export interface RecordedSeat {
  readonly id: string;
  readonly label: string;
  readonly address: string;
  readonly model: string;
  readonly purpose?: string;
  readonly nativeHarness?: string;
  readonly repositoryPath?: string;
  readonly workingDirectory?: string;
  readonly repositoryUrl?: string;
  readonly projectBriefUrl?: string;
  readonly openAgentInstructionsUrl?: string;
}

export interface RecordedWork {
  readonly id: string;
  readonly title: string;
  readonly assignedSeatId: string;
  readonly predecessorId?: string;
  readonly artifactIds: readonly string[];
}

export interface RecordedArtifact {
  readonly id: string;
  readonly title: string;
  readonly originalSha256?: string;
  readonly publishedSha256?: string;
  readonly publishedUrl?: string;
}

export interface SeatObservation {
  readonly seatId: string;
  readonly status: 'live' | 'stopped' | 'not-recorded';
  readonly recoverable?: boolean;
  readonly nativeConversationId?: string;
  readonly sessionId?: string;
  readonly generation?: string;
  readonly continuity: string;
  readonly detail: string;
}

export interface WorkObservation {
  readonly workId: string;
  readonly status: 'pending' | 'in-progress' | 'done';
  /** Null means unclaimed; an absent value means the recording does not establish it. */
  readonly claimGeneration?: string | null;
  readonly transition?: number;
  readonly detail: string;
  readonly nextAction: string;
}

export interface ArtifactObservation {
  readonly artifactId: string;
  readonly status: 'draft' | 'delivered' | 'accepted';
  readonly acceptedBy: readonly string[];
  readonly detail: string;
}

export interface RecordedCheckpoint {
  readonly id: string;
  readonly label: string;
  readonly at: string;
  readonly summary: string;
  readonly nextAction: string;
  readonly evidenceUrl: string;
  readonly seats: readonly SeatObservation[];
  readonly work: readonly WorkObservation[];
  readonly artifacts: readonly ArtifactObservation[];
}

export interface WorkspaceRecording {
  readonly id: string;
  readonly title: string;
  readonly sourceRevision: string;
  readonly runtimeVersion: string;
  /** Recorded provenance only; these locators are never used as a transport. */
  readonly openRigScope?: { readonly rigId: string; readonly rigName: string; readonly instanceLocator: string; readonly stateHome: string };
  readonly evidenceUrl: string;
  readonly reviewUrl: string;
  readonly coordinatorAcceptanceUrl: string;
  readonly manifestUrl: string;
  readonly seats: readonly RecordedSeat[];
  readonly work: readonly RecordedWork[];
  readonly artifacts: readonly RecordedArtifact[];
  readonly checkpoints: readonly RecordedCheckpoint[];
}

export interface WorkspaceSelection {
  readonly kind: 'seat' | 'work' | 'artifact';
  readonly id: string;
}
