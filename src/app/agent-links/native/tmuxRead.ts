import { realpath, stat } from 'fs/promises';
import { readProcessAncestry, runNativeRead, sameProcessIdentity, type ProcessIdentity, type ProcessReadOptions } from './processAncestry';

export interface TmuxConnection { socketPath: string; executablePath: string }
export interface TmuxClientView {
  socketPath: string;
  socketIdentity: string;
  clientPid: number;
  clientTty: string;
  clientCreated: string;
  processStarted: string;
  sessionName: string;
  paneId: string;
  panePid: number;
  independentPane: boolean;
}

async function serverIdentity(path: string): Promise<string> {
  const socket = await stat(path);
  if (!socket.isSocket()) throw new Error('Configured tmux path is not a socket.');
  return JSON.stringify([socket.dev, socket.ino, socket.birthtimeMs]);
}

/** Server-reported attached clients are witnesses; process argv is not. */
export async function readTmuxClientPids(connection: TmuxConnection, options?: ProcessReadOptions): Promise<number[]> {
  options?.signal?.throwIfAborted();
  await serverIdentity(connection.socketPath);
  const text = await runNativeRead(connection.executablePath, ['-S', connection.socketPath, 'list-clients', '-F', '#{client_pid}'], options);
  if (!text) return [];
  return text.split('\n').map((pid) => {
    if (!/^\d+$/.test(pid) || !Number.isSafeInteger(Number(pid))) throw new Error('Invalid native client identity.');
    return Number(pid);
  });
}

async function processTty(pid: number, options?: ProcessReadOptions): Promise<{ tty: string; started: string }> {
  if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('Invalid native process identity.');
  // Only process ID, TTY and start time. Do not collect command text or environment.
  const text = await runNativeRead('/bin/ps', ['-p', String(pid), '-o', 'pid=,tty=,lstart='], options);
  const match = /^\s*(\d+)\s+(\S+)\s+(.+)$/.exec(text);
  if (!match || Number(match[1]) !== pid || !match[2] || match[2] === '??' || match[2] === '?') {
    throw new Error('The attached client has no qualified terminal process.');
  }
  return { tty: match[2].startsWith('/dev/') ? match[2] : `/dev/${match[2]}`, started: match[3]! };
}

/** All formats are adapter constants. Read each field separately so names cannot corrupt a delimiter. */
export async function readTmuxClientView(connection: TmuxConnection, pid: number, options?: ProcessReadOptions): Promise<TmuxClientView> {
  options?.signal?.throwIfAborted();
  const identity = await serverIdentity(connection.socketPath);
  if (!(await readTmuxClientPids(connection, options)).includes(pid)) throw new Error('The process is not attached to this tmux server.');
  const process = await processTty(pid, options);
  const fields = ['client_pid', 'client_tty', 'client_session', 'pane_id', 'pane_pid', 'client_created', 'client_flags', 'socket_path'] as const;
  const values = await Promise.all(fields.map((field) => runNativeRead(connection.executablePath, [
    '-S', connection.socketPath, 'display-message', '-p', '-c', process.tty, `#{${field}}`,
  ], options)));
  const [clientPid, tty, sessionName, paneId, panePid, created, flags, socketPath] = values;
  if (Number(clientPid) !== pid || tty !== process.tty || !sessionName || !paneId || !/^%\d+$/.test(paneId)
    || !panePid || !/^\d+$/.test(panePid) || !created || !socketPath || flags === undefined
    || await realpath(socketPath) !== await realpath(connection.socketPath)
    || identity !== await serverIdentity(connection.socketPath)) {
    throw new Error('The native client changed or returned an inconsistent view.');
  }
  const after = await processTty(pid, options);
  if (after.tty !== process.tty || after.started !== process.started) throw new Error('The native client process changed.');
  const current = await Promise.all(['client_session', 'pane_id'].map((field) => runNativeRead(connection.executablePath, [
    '-S', connection.socketPath, 'display-message', '-p', '-c', process.tty, `#{${field}}`,
  ], options)));
  if (current[0] !== sessionName || current[1] !== paneId) throw new Error('The native client changed its displayed view.');
  return {
    socketPath: connection.socketPath, socketIdentity: identity, clientPid: pid, clientTty: tty,
    clientCreated: created, processStarted: process.started, sessionName, paneId, panePid: Number(panePid),
    independentPane: flags.split(',').includes('active-pane'),
  };
}

export interface TmuxParticipantTarget { processId: number; sessionName: string; paneId: string }
export interface TmuxPaneProof extends TmuxParticipantTarget {
  socketPath: string;
  socketIdentity: string;
  panePid: number;
  ancestry: ProcessIdentity[];
}

async function readPanePid(connection: TmuxConnection, target: TmuxParticipantTarget, options?: ProcessReadOptions): Promise<number> {
  if (!/^%\d+$/.test(target.paneId) || !target.sessionName || target.sessionName.length > 512
    || [...target.sessionName].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
    throw new Error('Invalid native pane target.');
  }
  const panes = await runNativeRead(connection.executablePath, [
    '-S', connection.socketPath, 'list-panes', '-s', '-t', `=${target.sessionName}`, '-F', '#{pane_id}',
  ], options);
  if (!panes.split('\n').includes(target.paneId)) throw new Error('The native pane is not in this session.');
  const pid = await runNativeRead(connection.executablePath, [
    '-S', connection.socketPath, 'display-message', '-p', '-t', target.paneId, '#{pane_pid}',
  ], options);
  if (!/^\d+$/.test(pid) || !Number.isSafeInteger(Number(pid)) || Number(pid) <= 0) throw new Error('Invalid native pane process.');
  return Number(pid);
}

/** A server-local name is insufficient: the intended process must descend from this server's pane process. */
export async function readTmuxPaneProof(connection: TmuxConnection, target: TmuxParticipantTarget, options?: ProcessReadOptions): Promise<TmuxPaneProof> {
  options?.signal?.throwIfAborted();
  const identity = await serverIdentity(connection.socketPath);
  const panePid = await readPanePid(connection, target, options);
  const ancestry = await readProcessAncestry(target.processId, panePid, options);
  if (await readPanePid(connection, target, options) !== panePid || await serverIdentity(connection.socketPath) !== identity) {
    throw new Error('The native pane or server changed during qualification.');
  }
  return { ...target, socketPath: connection.socketPath, socketIdentity: identity, panePid, ancestry };
}

export function sameTmuxPaneProof(left: TmuxPaneProof, right: TmuxPaneProof): boolean {
  return left.socketPath === right.socketPath && left.socketIdentity === right.socketIdentity
    && left.processId === right.processId && left.sessionName === right.sessionName && left.paneId === right.paneId
    && left.panePid === right.panePid && left.ancestry.length === right.ancestry.length
    && left.ancestry.every((entry, index) => sameProcessIdentity(entry, right.ancestry[index]!));
}

export function sameTmuxClientView(left: TmuxClientView, right: TmuxClientView): boolean {
  return left.socketPath === right.socketPath && left.socketIdentity === right.socketIdentity
    && left.clientPid === right.clientPid && left.clientTty === right.clientTty
    && left.clientCreated === right.clientCreated && left.processStarted === right.processStarted
    && left.sessionName === right.sessionName && left.paneId === right.paneId && left.panePid === right.panePid
    && left.independentPane === right.independentPane;
}
