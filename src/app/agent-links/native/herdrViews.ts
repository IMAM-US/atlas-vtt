import { readHerdrProcesses, readHerdrSnapshot, type HerdrPane, type HerdrProcessInfo, type HerdrSnapshot } from './herdrRead';
import { readTmuxClientPids, readTmuxClientView, readTmuxPaneProof, sameTmuxClientView, sameTmuxPaneProof,
  type TmuxClientView, type TmuxConnection, type TmuxPaneProof, type TmuxParticipantTarget } from './tmuxRead';
import type { SocketRequestOptions } from './jsonSocket';

export interface NativeViewUnavailable {
  scope: 'herdr' | 'pane' | 'tmux' | 'participant';
  socketPath: string;
  paneId?: string;
  message: string;
}

/** An in-memory observation of a named view, never an exported account field. */
export interface HerdrViewWitness {
  socketPath: string;
  socketIdentity: string;
  pane: HerdrPane;
  label: string;
  processes: HerdrProcessInfo;
  clients: Array<{ connection: TmuxConnection; view: TmuxClientView; participantProof?: TmuxPaneProof }>;
  unavailable: NativeViewUnavailable[];
  participantTarget?: TmuxParticipantTarget;
}

export async function readHerdrViewWitness(
  snapshot: HerdrSnapshot, pane: HerdrPane, tmux: readonly TmuxConnection[], options?: SocketRequestOptions,
): Promise<HerdrViewWitness> {
  const processes = await readHerdrProcesses(snapshot, pane.pane_id, options);
  const clients: HerdrViewWitness['clients'] = [];
  const unavailable: NativeViewUnavailable[] = [];
  for (const connection of tmux) {
    options?.signal?.throwIfAborted();
    let pids: number[];
    try {
      pids = await readTmuxClientPids(connection, options);
    } catch (error) {
      options?.signal?.throwIfAborted();
      unavailable.push({ scope: 'tmux', socketPath: connection.socketPath, paneId: pane.pane_id, message: failureMessage(error) });
      continue;
    }
    for (const pid of processes.foregroundPids.filter((candidate) => pids.includes(candidate))) {
      try {
        clients.push({ connection, view: await readTmuxClientView(connection, pid, options) });
      } catch (error) {
        options?.signal?.throwIfAborted();
        unavailable.push({ scope: 'tmux', socketPath: connection.socketPath, paneId: pane.pane_id, message: failureMessage(error) });
      }
    }
  }
  const workspace = snapshot.workspaces.find((entry) => entry.workspace_id === pane.workspace_id);
  const tab = snapshot.tabs.find((entry) => entry.tab_id === pane.tab_id);
  return {
    socketPath: snapshot.socketPath, socketIdentity: snapshot.socketIdentity, pane,
    label: `${workspace?.label ?? pane.workspace_id} / ${tab?.label ?? pane.tab_id}`,
    processes, clients, unavailable,
  };
}

function failureMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The native view could not be qualified.';
}

/** Qualifies both exact-pane and broader-session candidates by the same actual process/server join. */
export async function qualifyHerdrParticipant(
  witness: HerdrViewWitness, target: TmuxParticipantTarget, options?: SocketRequestOptions,
): Promise<HerdrViewWitness> {
  const clients: HerdrViewWitness['clients'] = [];
  const unavailable = [...witness.unavailable];
  for (const client of witness.clients) {
    options?.signal?.throwIfAborted();
    if (client.view.sessionName !== target.sessionName) {
      clients.push(client);
      continue;
    }
    try {
      const participantProof = await readTmuxPaneProof(client.connection, target, options);
      const after = await readTmuxClientView(client.connection, client.view.clientPid, options);
      if (!sameTmuxClientView(client.view, after)) throw new Error('The native client changed during participant qualification.');
      clients.push({ ...client, participantProof });
    } catch (error) {
      options?.signal?.throwIfAborted();
      clients.push(client);
      unavailable.push({ scope: 'participant', socketPath: client.connection.socketPath, paneId: witness.pane.pane_id, message: failureMessage(error) });
    }
  }
  return { ...witness, clients, unavailable, participantTarget: { ...target } };
}

export function sameHerdrView(left: HerdrViewWitness, right: HerdrViewWitness): boolean {
  return left.socketPath === right.socketPath && left.socketIdentity === right.socketIdentity
    && left.pane.pane_id === right.pane.pane_id && left.pane.terminal_id === right.pane.terminal_id
    && left.pane.workspace_id === right.pane.workspace_id && left.pane.tab_id === right.pane.tab_id
    && left.processes.shellPid === right.processes.shellPid
    && [...left.processes.foregroundPids].sort().join(',') === [...right.processes.foregroundPids].sort().join(',')
    && left.clients.length === right.clients.length
    && left.clients.every((client) => right.clients.some((other) => sameTmuxClientView(client.view, other.view)
      && (client.participantProof ? Boolean(other.participantProof && sameTmuxPaneProof(client.participantProof, other.participantProof)) : !other.participantProof)));
}

export async function revalidateHerdrView(
  intended: HerdrViewWitness, tmux: readonly TmuxConnection[], options?: SocketRequestOptions,
): Promise<{ witness: HerdrViewWitness; snapshot: HerdrSnapshot }> {
  const snapshot = await readHerdrSnapshot(intended.socketPath, options);
  const pane = snapshot.panes.find((entry) => entry.pane_id === intended.pane.pane_id);
  if (!pane) throw new Error('The previous Herdr view is no longer available.');
  let witness = await readHerdrViewWitness(snapshot, pane, tmux, options);
  if (intended.participantTarget) witness = await qualifyHerdrParticipant(witness, intended.participantTarget, options);
  if (!sameHerdrView(intended, witness)) throw new Error('The Herdr view or its native participant changed. Select a current view.');
  return { witness, snapshot };
}
