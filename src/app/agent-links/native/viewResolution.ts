import { readHerdrSnapshot } from './herdrRead';
import { qualifyHerdrParticipant, readHerdrViewWitness, type HerdrViewWitness, type NativeViewUnavailable } from './herdrViews';
import { readOpenRigParticipant, readOpenRigProcess, sameOpenRigParticipant, sameOpenRigProcess, NativeIdentityError, type OpenRigConnection, type OpenRigSeat, type OpenRigParticipant, type OpenRigProcess } from './openRigRead';
import type { TmuxConnection } from './tmuxRead';
import type { SocketRequestOptions } from './jsonSocket';

export interface NativeViewConnections {
  /** Explicit local host binding. Local PIDs cannot qualify a different source host. */
  localHostId: string;
  herdrSocketPaths: readonly string[];
  tmux: readonly TmuxConnection[];
}
/** `exact` qualifies the displayed pane within the resolution's scope, never a stronger identity. */
export interface ResolvedNativeView { witness: HerdrViewWitness; exact: boolean; reason: string | null }
interface NativeViewDiscovery { views: ResolvedNativeView[]; unavailable: NativeViewUnavailable[] }
export type NativeViewScope = 'conversation' | 'seat-process';
export interface NativeViewResolution<Scope extends NativeViewScope = NativeViewScope> extends NativeViewDiscovery { scope: Scope }

/** Returns all current views of one participant. Multiple views remain a choice. */
export async function resolveNativeViews(
  source: OpenRigConnection, seat: OpenRigSeat, intended: OpenRigParticipant,
  connections: NativeViewConnections, options?: SocketRequestOptions,
): Promise<NativeViewResolution<'conversation'>> {
  validateLocalSource(source, connections, options);
  const before = await readOpenRigParticipant(source, seat, options);
  if (!sameOpenRigParticipant(before.participant, intended)) {
    throw new NativeIdentityError('participant', 'The participant changed. Choose the current conversation first.');
  }
  const result = await discoverNativeViews(intended, connections, options);
  const after = await readOpenRigParticipant(source, seat, options);
  if (!sameOpenRigParticipant(after.participant, intended)) {
    throw new NativeIdentityError('participant', 'The participant changed while resolving native views.');
  }
  return { scope: 'conversation', ...result };
}

/** Explicit seat entrance. It proves the bound process, not its provider conversation or generation. */
export async function resolveNativeSeatViews(
  source: OpenRigConnection, seat: OpenRigSeat, intended: OpenRigProcess,
  connections: NativeViewConnections, options?: SocketRequestOptions,
): Promise<NativeViewResolution<'seat-process'>> {
  validateLocalSource(source, connections, options);
  const before = await readOpenRigProcess(source, seat, options);
  if (!sameOpenRigProcess(before.process, intended)) {
    throw new NativeIdentityError('participant', 'The bound process changed. Refresh the seat first.');
  }
  const result = await discoverNativeViews(intended, connections, options);
  const after = await readOpenRigProcess(source, seat, options);
  if (!sameOpenRigProcess(after.process, intended)) {
    throw new NativeIdentityError('participant', 'The bound process changed while resolving native views.');
  }
  return { scope: 'seat-process', ...result };
}

function validateLocalSource(source: OpenRigConnection, connections: NativeViewConnections, options?: SocketRequestOptions): void {
  options?.signal?.throwIfAborted();
  if (connections.localHostId !== source.hostId) throw new Error('This source has no configured local process connection.');
}

async function discoverNativeViews(
  intended: OpenRigProcess, connections: NativeViewConnections, options?: SocketRequestOptions,
): Promise<NativeViewDiscovery> {
  const views: ResolvedNativeView[] = [];
  const unavailable: NativeViewUnavailable[] = [];
  for (const socketPath of connections.herdrSocketPaths) {
    options?.signal?.throwIfAborted();
    let snapshot;
    try {
      snapshot = await readHerdrSnapshot(socketPath, options);
      if (snapshot.panes.length > 256) throw new Error('The native view exceeds the bounded discovery limit.');
    } catch (error) {
      options?.signal?.throwIfAborted();
      unavailable.push({ scope: 'herdr', socketPath, message: error instanceof Error ? error.message : 'The Herdr source is unavailable.' });
      continue;
    }
    for (const pane of snapshot.panes) {
      options?.signal?.throwIfAborted();
      try {
        const observed = await readHerdrViewWitness(snapshot, pane, connections.tmux, options);
        const witness = await qualifyHerdrParticipant(observed, {
          processId: intended.processId, sessionName: intended.sessionName, paneId: intended.tmuxPane,
        }, options);
        unavailable.push(...witness.unavailable);
        const matches = witness.clients.filter(({ participantProof }) => participantProof !== undefined);
        if (matches.length === 0) continue;
        const exact = witness.clients.length === 1 && matches.length === 1
          && matches[0]!.view.paneId === intended.tmuxPane && !matches[0]!.view.independentPane;
        views.push({ witness, exact, reason: exact ? null : 'This view shows the verified native session; its exact active participant is not qualified.' });
      } catch (error) {
        options?.signal?.throwIfAborted();
        unavailable.push({ scope: 'pane', socketPath, paneId: pane.pane_id, message: error instanceof Error ? error.message : 'The Herdr pane is unavailable.' });
      }
    }
  }
  return { views, unavailable };
}
