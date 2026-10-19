// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveNativeSeatViews, resolveNativeViews } from '../../src/app/agent-links/native/viewResolution';
import { focusHerdrView } from '../../src/app/agent-links/native/herdrFocus';
import { readProcessAncestry } from '../../src/app/agent-links/native/processAncestry';
import { readTmuxClientView } from '../../src/app/agent-links/native/tmuxRead';
import type { HerdrSnapshot } from '../../src/app/agent-links/native/herdrRead';

const boundary = vi.hoisted(() => ({
  exec: vi.fn(), stat: vi.fn(), realpath: vi.fn(), snapshot: vi.fn(), processes: vi.fn(), participant: vi.fn(), process: vi.fn(), request: vi.fn(),
}));
vi.mock('child_process', () => ({ execFile: boundary.exec }));
vi.mock('fs/promises', () => ({ stat: boundary.stat, realpath: boundary.realpath }));
vi.mock('../../src/app/agent-links/native/herdrRead', async (original) => ({
  ...await original<object>(), readHerdrSnapshot: boundary.snapshot, readHerdrProcesses: boundary.processes,
}));
vi.mock('../../src/app/agent-links/native/openRigRead', async (original) => ({
  ...await original<object>(), readOpenRigParticipant: boundary.participant, readOpenRigProcess: boundary.process,
}));
vi.mock('../../src/app/agent-links/native/jsonSocket', () => ({ requestJsonSocket: boundary.request }));

const intended = { sessionName: 'builder@example', runtime: 'codex', bindingId: 'binding-one', tmuxPane: '%7',
  processId: 123, conversationId: 'conversation-one', recordGeneration: 'generation-one' };
const source = { hostId: 'host-one', endpoint: 'http://configured' };
const seat = { rigId: 'rig-one', nodeId: 'node-one', logicalId: 'builder' };
const a = { socketPath: '/tmux/a', executablePath: '/configured/tmux' };
const b = { socketPath: '/tmux/b', executablePath: '/configured/tmux' };
const connections = { localHostId: source.hostId, herdrSocketPaths: ['/herdr/healthy'], tmux: [a, b] };
interface Process { parent: number; started: string; tty?: string }
interface Server { client: number; root: number; activePane: string; epoch: number }
let processes: Map<number, Process>;
let servers: Map<string, Server>;
let vanishedPanes: Set<string>;
let onAncestryRead: (pid: number, count: number) => void;
let onFieldRead: (field: string, count: number) => void;
let ancestryReads: Map<number, number>;
let fieldReads: Map<string, number>;

function snapshot(): HerdrSnapshot {
  return {
    socketPath: '/herdr/healthy', socketIdentity: 'herdr-epoch-one', version: 'fixture', protocol: 22,
    panes: [
      { pane_id: 'w:p1', terminal_id: 'terminal-one', workspace_id: 'w', tab_id: 'w:t1' },
      { pane_id: 'w:p2', terminal_id: 'terminal-two', workspace_id: 'w', tab_id: 'w:t2' },
    ],
    tabs: [{ tab_id: 'w:t1', workspace_id: 'w', label: 'First' }, { tab_id: 'w:t2', workspace_id: 'w', label: 'Second' }],
    workspaces: [{ workspace_id: 'w', label: 'Example' }], focusedPaneId: 'w:p1', focusedTabId: 'w:t1', focusedWorkspaceId: 'w',
  };
}

function command(file: string, args: string[]): string {
  if (file === '/bin/ps') {
    expect(args[0]).toBe('-p');
    const pid = Number(args[1]);
    const format = args[3];
    expect(['pid=,tty=,lstart=', 'pid=,ppid=,lstart=']).toContain(format);
    if (format === 'pid=,ppid=,lstart=') {
      const count = (ancestryReads.get(pid) ?? 0) + 1;
      ancestryReads.set(pid, count);
      onAncestryRead(pid, count);
    }
    const process = processes.get(pid);
    if (!process) throw new Error('Process exited');
    return `${pid} ${format === 'pid=,ppid=,lstart=' ? process.parent : process.tty ?? '??'} ${process.started}\n`;
  }
  expect(file).toBe('/configured/tmux');
  const socketPath = args[1]!;
  const server = servers.get(socketPath);
  if (!server) throw new Error('Server unavailable');
  if (args[2] === 'list-clients') return String(server.client);
  if (args[2] === 'list-panes') {
    expect(args).toEqual(['-S', socketPath, 'list-panes', '-s', '-t', '=builder@example', '-F', '#{pane_id}']);
    return '%7\n%8';
  }
  expect(args[2]).toBe('display-message');
  if (args.includes('-t')) {
    expect(args.slice(-3)).toEqual(['-t', '%7', '#{pane_pid}']);
    return String(server.root);
  }
  const field = args.at(-1)!.slice(2, -1);
  const count = (fieldReads.get(field) ?? 0) + 1;
  fieldReads.set(field, count);
  onFieldRead(field, count);
  const values: Record<string, string> = {
    client_pid: String(server.client), client_tty: `/dev/tty${server.client}`, client_session: intended.sessionName,
    pane_id: server.activePane, pane_pid: String(server.activePane === '%7' ? server.root : server.root + 1),
    client_created: '1000', client_flags: '', socket_path: socketPath,
  };
  return values[field]!;
}

beforeEach(() => {
  vi.clearAllMocks();
  processes = new Map([
    [123, { parent: 777, started: 'agent-start' }], [777, { parent: 1, started: 'shell-a-start' }],
    [888, { parent: 1, started: 'shell-b-start' }], [1, { parent: 0, started: 'root-start' }],
    [456, { parent: 1, started: 'client-a-start', tty: '/dev/tty456' }],
    [457, { parent: 1, started: 'client-b-start', tty: '/dev/tty457' }],
  ]);
  servers = new Map([[a.socketPath, { client: 456, root: 777, activePane: '%7', epoch: 1 }],
    [b.socketPath, { client: 457, root: 888, activePane: '%7', epoch: 2 }]]);
  vanishedPanes = new Set();
  ancestryReads = new Map();
  fieldReads = new Map();
  onAncestryRead = (): void => {};
  onFieldRead = (): void => {};
  boundary.exec.mockImplementation((file: string, args: string[], _options: unknown, done: (error: Error | null, output: string) => void): void => {
    try { done(null, command(file, args)); } catch (error) { done(error as Error, ''); }
  });
  boundary.realpath.mockImplementation(async (path: string): Promise<string> => path);
  boundary.stat.mockImplementation(async (path: string): Promise<unknown> => {
    const server = servers.get(path);
    if (!server) throw new Error('Configured socket unavailable');
    return { dev: 1, ino: server.epoch, birthtimeMs: 1, isSocket: (): boolean => true };
  });
  boundary.participant.mockResolvedValue({ participant: intended });
  boundary.process.mockResolvedValue({ process: intended });
  boundary.snapshot.mockImplementation(async (path: string): Promise<HerdrSnapshot> => {
    if (path !== '/herdr/healthy') throw new Error('Configured Herdr unavailable');
    return snapshot();
  });
  boundary.processes.mockImplementation(async (_snapshot: unknown, paneId: string): Promise<unknown> => {
    if (vanishedPanes.has(paneId)) throw new Error('Unrelated pane closed');
    return { paneId, shellPid: 100, tty: null, foregroundPids: [paneId === 'w:p1' ? 456 : 457] };
  });
});

describe('verified native view discovery', () => {
  it('joins the agent ancestry to the correct server despite duplicate session names and pane IDs', async () => {
    const result = await resolveNativeViews(source, seat, intended, connections);
    expect(result.scope).toBe('conversation');
    expect(result.views).toHaveLength(1);
    expect(result.views[0]).toMatchObject({ exact: true, witness: { pane: { pane_id: 'w:p1' } } });
    expect(result.views[0]!.witness.clients[0]!.participantProof?.ancestry.map(({ pid }) => pid)).toEqual([123, 777]);
    expect(result.unavailable).toContainEqual(expect.objectContaining({ scope: 'participant', socketPath: b.socketPath }));
  });

  it('requires an explicit seat policy when the conversation generation is unavailable', async () => {
    boundary.participant.mockRejectedValue(new Error('Generation record unavailable: HTTP 409'));
    await expect(resolveNativeViews(source, seat, intended, connections)).rejects.toThrow('Generation record unavailable');
    expect(boundary.process).not.toHaveBeenCalled();
    expect(boundary.snapshot).not.toHaveBeenCalled();

    const result = await resolveNativeSeatViews(source, seat, intended, connections);
    expect(result.scope).toBe('seat-process');
    expect(result.views).toHaveLength(1);
    expect(result.views[0]).toMatchObject({ exact: true, witness: { pane: { pane_id: 'w:p1' } } });
    expect(result.views[0]!.witness.clients[0]!.participantProof?.ancestry.map(({ pid }) => pid)).toEqual([123, 777]);
    expect(result.unavailable).toContainEqual(expect.objectContaining({ scope: 'participant', socketPath: b.socketPath }));
    expect(boundary.participant).toHaveBeenCalledTimes(1);
    expect(boundary.process).toHaveBeenCalledTimes(2);
  });

  it('does not call a terminal with competing foreground clients an exact view', async () => {
    boundary.processes.mockResolvedValue({ paneId: 'w:p1', shellPid: 100, tty: null, foregroundPids: [456, 457] });
    boundary.snapshot.mockResolvedValue({ ...snapshot(), panes: [snapshot().panes[0]] });
    const result = await resolveNativeViews(source, seat, intended, connections);
    expect(result.views).toHaveLength(1);
    expect(result.views[0]).toMatchObject({ exact: false });
  });

  it.each(['before', 'during'] as const)('rejects a bound process change %s seat discovery', async (when) => {
    if (when === 'during') boundary.process.mockResolvedValueOnce({ process: intended });
    boundary.process.mockResolvedValue({ process: { ...intended, processId: 124 } });
    await expect(resolveNativeSeatViews(source, seat, intended, connections)).rejects.toThrow('bound process changed');
    expect(boundary.participant).not.toHaveBeenCalled();
    expect(boundary.process).toHaveBeenCalledTimes(when === 'before' ? 1 : 2);
    expect(boundary.snapshot).toHaveBeenCalledTimes(when === 'before' ? 0 : 1);
    expect(boundary.request).not.toHaveBeenCalled();
  });

  it('rejects a changed conversation even while the same bound process survives', async () => {
    boundary.participant.mockResolvedValueOnce({ participant: intended });
    boundary.participant.mockResolvedValue({ participant: { ...intended, conversationId: 'conversation-two' } });
    await expect(resolveNativeViews(source, seat, intended, connections)).rejects.toThrow('participant changed');
    expect(boundary.process).not.toHaveBeenCalled();
    expect(boundary.request).not.toHaveBeenCalled();
  });

  it('does not offer an unrelated server as a broader session fallback', async () => {
    servers.get(b.socketPath)!.activePane = '%8';
    const result = await resolveNativeViews(source, seat, intended, { ...connections, tmux: [b] });
    expect(result.views).toEqual([]);
    expect(result.unavailable).toContainEqual(expect.objectContaining({ scope: 'participant', socketPath: b.socketPath }));
  });

  it('offers the correct server as a broader view when another pane of that verified session is active', async () => {
    servers.get(a.socketPath)!.activePane = '%8';
    const result = await resolveNativeViews(source, seat, intended, { ...connections, tmux: [a] });
    expect(result.views).toHaveLength(1);
    expect(result.views[0]).toMatchObject({ exact: false, witness: { participantTarget: { processId: 123, paneId: '%7' } } });
  });

  it('preserves healthy candidates and explicit failures for dead Herdr/tmux sources and a closing unrelated pane', async () => {
    vanishedPanes.add('w:p2');
    const result = await resolveNativeViews(source, seat, intended, {
      ...connections, herdrSocketPaths: ['/herdr/healthy', '/herdr/dead'], tmux: [a, { ...b, socketPath: '/tmux/dead' }],
    });
    expect(result.views).toHaveLength(1);
    expect(result.unavailable).toEqual(expect.arrayContaining([
      expect.objectContaining({ scope: 'herdr', socketPath: '/herdr/dead' }),
      expect.objectContaining({ scope: 'tmux', socketPath: '/tmux/dead' }),
      expect.objectContaining({ scope: 'pane', paneId: 'w:p2' }),
    ]));
  });

  it.each(['reparented', 'reused'] as const)('rejects an action-time %s PID before any focus effect', async (change) => {
    const { views } = await resolveNativeViews(source, seat, intended, { ...connections, tmux: [a] });
    processes.set(123, change === 'reparented' ? { parent: 888, started: 'agent-start' } : { parent: 777, started: 'new-agent-start' });
    await expect(focusHerdrView(views[0]!.witness, [a], async (): Promise<void> => {})).rejects.toThrow('changed');
    expect(boundary.request).not.toHaveBeenCalled();
  });

  it('reports a process exiting during ancestry verification without promoting its view', async () => {
    onAncestryRead = (pid, count): void => { if (pid === 123 && count === 2) processes.delete(pid); };
    const result = await resolveNativeViews(source, seat, intended, { ...connections, tmux: [a] });
    expect(result.views).toEqual([]);
    expect(result.unavailable).toContainEqual(expect.objectContaining({ scope: 'participant' }));
  });
});

it('bounds ancestry walking and never enumerates unrelated process arguments or environments', async () => {
  for (let pid = 1000; pid < 1040; pid++) processes.set(pid, { parent: pid + 1, started: `start-${pid}` });
  await expect(readProcessAncestry(1000, 777)).rejects.toThrow('does not belong');
  expect([...ancestryReads.keys()]).toHaveLength(32);
  expect(boundary.exec.mock.calls.every(([file, args]) => file === '/bin/ps' && args[0] === '-p' && args[3] === 'pid=,ppid=,lstart=')).toBe(true);
});

it('does not return a mixed client view after it switches active panes during separate field reads', async () => {
  onFieldRead = (field, count): void => { if (field === 'client_session' && count === 2) servers.get(a.socketPath)!.activePane = '%8'; };
  await expect(readTmuxClientView(a, 456)).rejects.toThrow('changed its displayed view');
});

it('propagates cancellation instead of converting it into an unavailable-source observation', async () => {
  const controller = new AbortController();
  onAncestryRead = (): void => controller.abort();
  await expect(resolveNativeViews(source, seat, intended, connections, { signal: controller.signal })).rejects.toThrow();
  expect(boundary.request).not.toHaveBeenCalled();
  expect(ancestryReads.size).toBe(1);
});
