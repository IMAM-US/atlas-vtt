import type { AccountArtifact } from './account/accountSchema';
import type { AgentLinkSourceSettings } from './sourceSettings';
import { confinedRoot } from './sourceSettings';
import { readCheckoutFacts, readGitFile, readWorkingGitFile, type CheckoutFacts } from './native/gitFiles';
import { readLocalFile, readPreservedFile } from './native/localFiles';
import { failure, now, type ReadFailure } from './reads';

/** One of an artifact's three sources, read and hashed; `checkout` is present when the file sits in a Git worktree. */
export interface ArtifactFile {
  state: 'current';
  source: 'working' | 'captured' | 'reviewed';
  path: string;
  sha256: string;
  sizeBytes: number;
  text: string | null;
  checkout: CheckoutFacts | null;
  /** The reviewed revision for `reviewed`; the capture time for `captured`. */
  label: string;
  observedAt: string;
}
export type ArtifactSource = ArtifactFile | ReadFailure;

export interface ArtifactRead {
  artifact: AccountArtifact;
  working: ArtifactSource | null;
  captured: ArtifactSource | null;
  reviewed: ArtifactSource | null;
  observedAt: string;
}

const TEXT_LIMIT = 256 * 1024;

function textOf(bytes: Buffer): string | null {
  if (bytes.length > TEXT_LIMIT) return null;
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return null; }
}

const outsideRoots = (): ReadFailure => ({ state: 'unavailable', message: 'This path is outside the allowed roots in Atlas settings.', observedAt: now() });

async function working(source: AgentLinkSourceSettings, artifact: AccountArtifact, reviewedRevision: string | undefined): Promise<ArtifactSource | null> {
  const locator = artifact.working;
  if (!locator) return null;
  const root = await confinedRoot(source, locator.root);
  if (!root) return outsideRoots();
  try {
    let checkout: CheckoutFacts | null = null;
    try { checkout = await readCheckoutFacts(root, reviewedRevision); } catch { checkout = null; }
    const file = checkout ? await readWorkingGitFile(root, locator.path) : await readLocalFile(root, locator.path);
    return { state: 'current', source: 'working', path: file.path, sha256: file.sha256, sizeBytes: file.sizeBytes, text: textOf(file.bytes),
      checkout, label: 'Working file', observedAt: file.observedAt };
  } catch (error) {
    return failure(error, 'Working file not found.');
  }
}

async function captured(source: AgentLinkSourceSettings, artifact: AccountArtifact): Promise<ArtifactSource | null> {
  const locator = artifact.captured;
  if (!locator) return null;
  const root = await confinedRoot(source, locator.root);
  if (!root) return outsideRoots();
  try {
    const file = await readPreservedFile(root, locator.path, locator.sha256);
    return { state: 'current', source: 'captured', path: file.path, sha256: file.sha256, sizeBytes: file.sizeBytes, text: textOf(file.bytes),
      checkout: null, label: `As captured ${locator.capturedAt}`, observedAt: file.observedAt };
  } catch (error) {
    return failure(error, 'Captured copy not found.');
  }
}

async function reviewed(source: AgentLinkSourceSettings, artifact: AccountArtifact): Promise<ArtifactSource | null> {
  const revision = artifact.reviewed;
  if (!revision) return null;
  const named = revision.root ?? artifact.working?.root;
  const path = revision.path ?? artifact.working?.path;
  if (!named || !path) return { state: 'unavailable', message: 'The reviewed revision has no repository to read from.', observedAt: now() };
  const root = await confinedRoot(source, named);
  if (!root) return outsideRoots();
  try {
    const file = await readGitFile(root, path, revision.revision);
    if (revision.sha256 && file.sha256 !== revision.sha256) {
      return { state: 'unavailable', message: 'The reviewed revision does not match the hash the account recorded.', observedAt: now() };
    }
    return { state: 'current', source: 'reviewed', path: `${file.revision}:${file.relativePath}`, sha256: file.sha256, sizeBytes: file.sizeBytes,
      text: textOf(file.bytes), checkout: file.checkout, label: `At review ${file.revision.slice(0, 8)}`, observedAt: file.checkout.observedAt };
  } catch (error) {
    return failure(error, 'The reviewed revision could not be read.');
  }
}

/** Reads each source independently; one missing source never falls back to another. A cancelled read throws. */
export async function inspectArtifact(source: AgentLinkSourceSettings, artifact: AccountArtifact, signal?: AbortSignal): Promise<ArtifactRead> {
  signal?.throwIfAborted();
  const [workingRead, capturedRead, reviewedRead] = await Promise.all([
    working(source, artifact, artifact.reviewed?.revision), captured(source, artifact), reviewed(source, artifact),
  ]);
  signal?.throwIfAborted();
  return { artifact, working: workingRead, captured: capturedRead, reviewed: reviewedRead, observedAt: now() };
}

export type ArtifactComparison =
  | { kind: 'equal'; sources: ArtifactFile['source'][]; sha256: string; checkoutNote: string | null }
  | { kind: 'split'; sources: ArtifactFile['source'][]; checkoutNote: string | null }
  | { kind: 'none' };

function checkoutNote(read: ArtifactRead): string | null {
  const checkout = read.working?.state === 'current' ? read.working.checkout : null;
  if (!checkout) return null;
  const where = checkout.branch ? `branch ${checkout.branch}` : `detached at ${checkout.headCommit.slice(0, 8)}`;
  if (checkout.comparedRevisionIsAncestor === false) return `Checkout is now ${where}; the reviewed revision is not in its history.`;
  if (checkout.comparedRevisionIsAncestor === true && read.reviewed?.state === 'current' && checkout.headCommit !== read.reviewed.checkout?.headCommit) {
    return `Checkout has moved on to ${where}.`;
  }
  return null;
}

/** Equal bytes collapse into one row with their provenance kept; any difference splits the rows. */
export function compareArtifact(read: ArtifactRead): ArtifactComparison {
  const files = [read.working, read.captured, read.reviewed].filter((entry): entry is ArtifactFile => entry?.state === 'current');
  if (files.length === 0) return { kind: 'none' };
  const sources = files.map((file) => file.source);
  const note = checkoutNote(read);
  const first = files[0]!.sha256;
  if (files.every((file) => file.sha256 === first)) return { kind: 'equal', sources, sha256: first, checkoutNote: note };
  return { kind: 'split', sources, checkoutNote: note };
}
