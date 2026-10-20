import { stat } from 'fs/promises';
import { requestJsonSocket, type SocketRequestOptions } from './jsonSocket';
import { nativeObject } from './openRigRead';

export interface HerdrPane {
  pane_id: string;
  terminal_id: string;
  workspace_id: string;
  tab_id: string;
}
export interface HerdrTab { tab_id: string; workspace_id: string; label: string }
export interface HerdrWorkspace { workspace_id: string; label: string }
export interface HerdrSnapshot {
  socketPath: string;
  socketIdentity: string;
  version: string;
  protocol: number;
  panes: HerdrPane[];
  tabs: HerdrTab[];
  workspaces: HerdrWorkspace[];
  focusedPaneId: string | null;
  focusedTabId: string | null;
  focusedWorkspaceId: string | null;
}

/** Socket paths are local configuration. IDs from a replaced socket are not reusable. */
export async function socketIdentity(socketPath: string): Promise<string> {
  const value = await stat(socketPath);
  if (!value.isSocket()) throw new Error('Configured Herdr path is not a socket.');
  return JSON.stringify([value.dev, value.ino, value.birthtimeMs]);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}
function isPane(value: unknown): value is HerdrPane {
  return nativeObject(value) && ['pane_id', 'terminal_id', 'workspace_id', 'tab_id'].every((key) => typeof value[key] === 'string' && value[key] !== '');
}
function isTab(value: unknown): value is HerdrTab {
  return nativeObject(value) && ['tab_id', 'workspace_id', 'label'].every((key) => typeof value[key] === 'string');
}
function isWorkspace(value: unknown): value is HerdrWorkspace {
  return nativeObject(value) && typeof value.workspace_id === 'string' && typeof value.label === 'string';
}

export async function readHerdrSnapshot(socketPath: string, options?: SocketRequestOptions): Promise<HerdrSnapshot> {
  const identity = await socketIdentity(socketPath);
  const response = await requestJsonSocket(socketPath, 'session.snapshot', {}, options);
  if (identity !== await socketIdentity(socketPath)) throw new Error('The Herdr server changed during the read.');
  const data = nativeObject(response) && response.type === 'session_snapshot' ? response.snapshot : null;
  if (!nativeObject(data) || data.protocol !== 22 || typeof data.version !== 'string'
    || !Array.isArray(data.panes) || !data.panes.every(isPane)
    || !Array.isArray(data.tabs) || !data.tabs.every(isTab)
    || !Array.isArray(data.workspaces) || !data.workspaces.every(isWorkspace)) {
    throw new Error('This Herdr snapshot or protocol is not supported.');
  }
  const { panes, tabs, workspaces } = data;
  if (new Set(panes.map((pane) => pane.pane_id)).size !== panes.length
    || panes.some((pane) => !tabs.some((tab) => tab.tab_id === pane.tab_id && tab.workspace_id === pane.workspace_id)
      || !workspaces.some((workspace) => workspace.workspace_id === pane.workspace_id))) {
    throw new Error('Herdr returned inconsistent view identities.');
  }
  return {
    socketPath, socketIdentity: identity, version: data.version, protocol: data.protocol,
    panes: data.panes, tabs: data.tabs, workspaces: data.workspaces,
    focusedPaneId: stringOrNull(data.focused_pane_id), focusedTabId: stringOrNull(data.focused_tab_id),
    focusedWorkspaceId: stringOrNull(data.focused_workspace_id),
  };
}

export interface HerdrProcessInfo {
  paneId: string;
  shellPid: number | null;
  tty: string | null;
  foregroundPids: number[];
}

export async function readHerdrProcesses(
  snapshot: HerdrSnapshot, paneId: string, options?: SocketRequestOptions,
): Promise<HerdrProcessInfo> {
  if (!snapshot.panes.some((pane) => pane.pane_id === paneId)) throw new Error('The Herdr pane is no longer in this view.');
  if (snapshot.socketIdentity !== await socketIdentity(snapshot.socketPath)) throw new Error('The Herdr server changed.');
  const response = await requestJsonSocket(snapshot.socketPath, 'pane.process_info', { pane_id: paneId }, options);
  const value = nativeObject(response) && response.type === 'pane_process_info' ? response.process_info : null;
  if (!nativeObject(value) || value.pane_id !== paneId) throw new Error('Herdr returned a different pane process.');
  const pids: number[] = [];
  if (Array.isArray(value.foreground_processes)) {
    for (const process of value.foreground_processes) {
      if (nativeObject(process) && typeof process.pid === 'number' && Number.isSafeInteger(process.pid) && process.pid > 0) pids.push(process.pid);
    }
  }
  return { paneId, shellPid: typeof value.shell_pid === 'number' ? value.shell_pid : null, tty: stringOrNull(value.tty), foregroundPids: pids };
}

export function isHerdrFocused(snapshot: HerdrSnapshot, pane: HerdrPane): boolean {
  return snapshot.focusedPaneId === pane.pane_id && snapshot.focusedTabId === pane.tab_id
    && snapshot.focusedWorkspaceId === pane.workspace_id;
}
