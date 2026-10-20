import type { AccountArtifact, SeatSubject } from './account/accountSchema';

/**
 * The native route behind each card row, for *Copy native route*: a real CLI command where
 * one exists, otherwise a labelled locator or typed API request. Values are quoted for a
 * POSIX shell. No exact-pane CLI command is invented: pane focus is a socket request.
 */
export interface NativeRoute { label: string; text: string }

export function shellQuote(value: string): string {
  return /^[A-Za-z0-9_./:@%=+-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`;
}

/** A CLI route runs against the machine's own daemon, so its label names the source it belongs to. */
const sourced = (label: string, sourceKey: string): string => `${label} · source ${sourceKey}`;

export function screenRoute(sourceKey: string, sessionAddress: string): NativeRoute {
  return { label: sourced('rig capture', sourceKey), text: `rig capture ${shellQuote(sessionAddress)} --lines 40` };
}

export function workRoute(sourceKey: string, qitemId: string): NativeRoute {
  return { label: sourced('rig queue show', sourceKey), text: `rig queue show ${shellQuote(qitemId)} --json` };
}

export function transitionsRoute(sourceKey: string, qitemId: string): NativeRoute {
  return { label: sourced('rig queue transitions', sourceKey), text: `rig queue transitions ${shellQuote(qitemId)} --json` };
}

export function ownedWorkRoute(sourceKey: string, sessionAddress: string): NativeRoute {
  return { label: sourced('rig queue list', sourceKey), text: `rig queue list -A --destination ${shellQuote(sessionAddress)} --json` };
}

export function nodeRoute(seat: SeatSubject['seat'], endpoint: string): NativeRoute {
  return { label: 'OpenRig node read', text: `GET ${endpoint.replace(/\/$/, '')}/api/rigs/${encodeURIComponent(seat.rigId)}/nodes/${encodeURIComponent(seat.logicalId)}` };
}

export function paneFocusRoute(sourceKey: string, socketPath: string, paneId: string): NativeRoute {
  return { label: sourced('Herdr socket request', sourceKey), text: `${socketPath} ← ${JSON.stringify({ id: 'atlas', method: 'pane.focus', params: { pane_id: paneId } })}` };
}

export function tabFocusRoute(tabId: string): NativeRoute {
  return { label: 'herdr tab focus', text: `herdr tab focus ${shellQuote(tabId)}` };
}

export function workingFileRoute(artifact: AccountArtifact): NativeRoute | null {
  const locator = artifact.working;
  return locator ? { label: 'Working file', text: `${locator.root.replace(/\/$/, '')}/${locator.path}` } : null;
}

export function capturedFileRoute(artifact: AccountArtifact): NativeRoute | null {
  const locator = artifact.captured;
  return locator ? { label: 'Captured copy', text: `${locator.root.replace(/\/$/, '')}/${locator.path}  sha256 ${locator.sha256}` } : null;
}

export function reviewedFileRoute(artifact: AccountArtifact): NativeRoute | null {
  const revision = artifact.reviewed;
  const root = revision?.root ?? artifact.working?.root;
  const path = revision?.path ?? artifact.working?.path;
  if (!revision || !root || !path) return null;
  return { label: 'git show', text: `git -C ${shellQuote(root)} show ${shellQuote(`${revision.revision}:${path}`)}` };
}

export function recordRoute(path: string): NativeRoute {
  return { label: 'Conversation record', text: path };
}
