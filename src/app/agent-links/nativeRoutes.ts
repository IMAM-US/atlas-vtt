import type { AccountArtifact, SeatSubject } from './account/accountSchema';
import type { AgentLinkSourceSettings } from './sourceSettings';

/**
 * The native route behind each card row, for *Copy native route*: a typed request against
 * the source's configured endpoint or socket, so the copied text names where it goes. A
 * bare `rig` command is never offered: nothing qualifies which daemon the CLI on this
 * machine reaches, and the account's source may be another. Pane focus is a socket request,
 * never an invented CLI command.
 */
export interface NativeRoute { label: string; text: string }

/** The source a route belongs to; its endpoint is part of the copied text. */
export type RouteSource = Pick<AgentLinkSourceSettings, 'key' | 'openRigEndpoint'>;
const sourced = (label: string, source: RouteSource): string => `${label} · source ${source.key}`;
const endpoint = (source: RouteSource): string => source.openRigEndpoint.replace(/\/$/, '') || `<endpoint of source ${source.key}>`;
const get = (source: RouteSource, route: string): string => `GET ${endpoint(source)}${route}  # source ${source.key}`;
const nodePath = (seat: SeatSubject['seat']): string => `/api/rigs/${encodeURIComponent(seat.rigId)}/nodes/${encodeURIComponent(seat.logicalId)}`;

export function screenRoute(source: RouteSource, seat: SeatSubject['seat']): NativeRoute {
  return { label: sourced('OpenRig screen read', source), text: get(source, `${nodePath(seat)}/preview?lines=40`) };
}

export function workRoute(source: RouteSource, qitemId: string): NativeRoute {
  return { label: sourced('OpenRig work read', source), text: get(source, `/api/queue/${encodeURIComponent(qitemId)}`) };
}

export function transitionsRoute(source: RouteSource, qitemId: string): NativeRoute {
  return { label: sourced('OpenRig transitions read', source), text: get(source, `/api/queue/${encodeURIComponent(qitemId)}/transitions`) };
}

export function ownedWorkRoute(source: RouteSource, sessionAddress: string): NativeRoute {
  const query = new URLSearchParams({ destinationSession: sessionAddress, state: 'pending,in-progress,blocked' });
  return { label: sourced('OpenRig work list', source), text: get(source, `/api/queue/list?${query}`) };
}

export function nodeRoute(source: RouteSource, seat: SeatSubject['seat']): NativeRoute {
  return { label: sourced('OpenRig node read', source), text: get(source, nodePath(seat)) };
}

export function paneFocusRoute(source: RouteSource, socketPath: string, paneId: string): NativeRoute {
  return { label: sourced('Herdr socket request', source), text: `${socketPath} ← ${JSON.stringify({ id: 'atlas', method: 'pane.focus', params: { pane_id: paneId } })}  # source ${source.key}` };
}

export function shellQuote(value: string): string {
  return /^[A-Za-z0-9_./:@%=+-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`;
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
