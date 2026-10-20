/**
 * The source account: an optional, versioned, vault-local JSON document that an Atlas scene
 * authors for the colleagues, work and artifacts it chooses to represent. It records referents,
 * captured observations and provenance; it is not a registry and never holds endpoints,
 * sockets, credentials or shell commands (those live in local source settings).
 *
 * Native ids (rig, node, conversation, queue item, revision, hash) are opaque values that
 * rename and bundle machinery must never rewrite. Unknown fields on every record are preserved.
 */

export const ACCOUNT_FORMAT = 'atlas-source-account';
export const ACCOUNT_VERSION = 1;

/** Where a captured fact came from; `command` is shown as provenance, never executed. */
export interface AccountSource {
  id: string;
  description: string;
  observedAt: string;
  command?: string;
}

/** Exact native seat identity: rig and node identify, logical and session names only locate. */
export interface NativeSeatIdentity {
  rigId: string;
  nodeId: string;
  logicalId: string;
  rigName?: string;
  sessionAddress?: string;
}

export type ParticipantRuntime = 'claude-code' | 'codex';

/** The participant the map captured in the seat: pinned by conversation id, not by name. */
export interface CapturedParticipant {
  runtime: ParticipantRuntime;
  conversationId: string;
  generation?: string;
  /** The participant's working directory, which locates a Claude Code conversation record. */
  cwd?: string;
  observedAt: string;
  /** How the conversation was bound to the seat, for the Sources section. */
  evidence?: string;
}

/** `current-seat` follows the seat's current participant; `captured-conversation` pins the captured one. */
export type SeatPolicy = 'current-seat' | 'captured-conversation';

export interface SeatSubject {
  id: string;
  kind: 'seat';
  caption: string;
  /** Selects a local source in plugin settings; an account cannot name an endpoint. */
  sourceKey: string;
  seat: NativeSeatIdentity;
  participant?: CapturedParticipant;
  policy: SeatPolicy;
  /** Work this map represents for the seat (`AccountWork.id`), distinct from its current work. */
  workIds: string[];
  /** Vault note of the appearance, part of the account's sources. */
  notePath?: string;
  observedAt: string;
  sourceIds?: string[];
}

export interface GroupMember {
  subjectId: string;
  /** What the member contributes, listed before the seat ("Source", "Dissent"). */
  lens: string;
  summary?: string;
}

/** Earlier positions stay attributed to the participants that held them. */
export interface EarlierParticipation {
  caption: string;
  lenses: string[];
  attribution: string;
  sourceIds?: string[];
}

export interface GroupSubject {
  id: string;
  kind: 'group';
  caption: string;
  purpose: string;
  /** Explicit, ordered membership; never inferred from a tab, profile or proximity. */
  members: GroupMember[];
  convenerId?: string;
  membership: { basis: string; observedAt: string };
  /** Charter, convenings and other records of the group (`AccountArtifact.id`). */
  artifactIds?: string[];
  earlierParticipation?: EarlierParticipation[];
  notePath?: string;
  observedAt: string;
  sourceIds?: string[];
}

export type AccountSubject = SeatSubject | GroupSubject;

export interface CapturedWorkState {
  state: string;
  sourceSession: string;
  destinationSession: string;
  claimedAt?: string;
  blockedOn?: string;
  handedOffTo?: string;
  closureReason?: string;
  observedAt: string;
}

/** An attributed sign-off: who said it, at which revision, from which record. Never a badge. */
export interface WorkReview {
  reviewerSubjectId?: string;
  revision: string;
  qitemId?: string;
  summary: string;
  observedAt: string;
  reportArtifactId?: string;
}

export interface AccountWork {
  id: string;
  caption: string;
  sourceKey: string;
  qitemId: string;
  captured: CapturedWorkState;
  /** The subject a closed row handed its work to, navigable from the card. */
  handedOffToSubjectId?: string;
  review?: WorkReview;
  artifactIds: string[];
  sourceIds?: string[];
}

/** A file under an absolute local root; the root must lie within a configured allowed root. */
export interface ArtifactLocator {
  root: string;
  path: string;
}

export interface CapturedArtifact extends ArtifactLocator {
  sha256: string;
  capturedAt: string;
}

/** The reviewed revision of the working file; `root` and `path` default to the working locator. */
export interface ReviewedArtifact {
  revision: string;
  root?: string;
  path?: string;
  sha256?: string;
}

export interface AccountArtifact {
  id: string;
  caption: string;
  working?: ArtifactLocator;
  captured?: CapturedArtifact;
  reviewed?: ReviewedArtifact;
  sourceIds?: string[];
}

export interface AccountDocument {
  format: typeof ACCOUNT_FORMAT;
  version: typeof ACCOUNT_VERSION;
  title?: string;
  /** The observation the map shows ("On map · 20:31"). */
  capturedAt: string;
  author?: string;
  sources: AccountSource[];
  subjects: AccountSubject[];
  work: AccountWork[];
  artifacts: AccountArtifact[];
  [unknown: string]: unknown;
}
