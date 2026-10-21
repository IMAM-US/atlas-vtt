// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server, type Socket } from 'net';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { readHerdrSnapshot } from '../../src/app/agent-links/native/herdrRead';
import { readHerdrViewWitness } from '../../src/app/agent-links/native/herdrViews';
import { focusHerdrView, returnToHerdrView } from '../../src/app/agent-links/native/herdrFocus';

const servers: Server[] = [];
const connections: Socket[] = [];
const directories: string[] = [];

async function fixture(): Promise<{
  path: string;
  methods: string[];
  state: { focused: string; secondPid: number; noAck: boolean; redirectFocus: boolean; protocol: number };
}> {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-view-'));
  directories.push(directory);
  const path = join(directory, 'herdr.sock');
  const methods: string[] = [];
  const state = { focused: 'w:p1', secondPid: 202, noAck: false, redirectFocus: false, protocol: 22 };
  const panes = [
    { pane_id: 'w:p1', terminal_id: 'term1', workspace_id: 'w', tab_id: 'w:t1' },
    { pane_id: 'w:p2', terminal_id: 'term2', workspace_id: 'w', tab_id: 'w:t2' },
  ];
  const server = createServer((socket) => {
    connections.push(socket);
    let input = '';
    socket.on('data', (chunk) => {
      input += chunk.toString();
      if (!input.endsWith('\n')) return;
      const request = JSON.parse(input) as { id: string; method: string; params: { pane_id: string } };
      methods.push(request.method);
      let result: unknown;
      if (request.method === 'session.snapshot') {
        result = { type: 'session_snapshot', snapshot: {
          protocol: state.protocol, version: 'test', panes,
          workspaces: [{ workspace_id: 'w', label: 'Work' }],
          tabs: [{ tab_id: 'w:t1', workspace_id: 'w', label: 'First' }, { tab_id: 'w:t2', workspace_id: 'w', label: 'Second' }],
          focused_workspace_id: 'w', focused_tab_id: state.focused === 'w:p1' ? 'w:t1' : 'w:t2', focused_pane_id: state.focused,
        } };
      } else if (request.method === 'pane.process_info') {
        const pid = request.params.pane_id === 'w:p1' ? 101 : state.secondPid;
        result = { type: 'pane_process_info', process_info: { pane_id: request.params.pane_id, shell_pid: pid, foreground_processes: [{ pid, name: 'shell' }] } };
      } else if (request.method === 'pane.focus') {
        state.focused = state.redirectFocus ? 'w:p1' : request.params.pane_id;
        if (state.noAck) return;
        result = { type: 'pane_info', pane: panes.find((pane) => pane.pane_id === state.focused) };
      } else throw new Error(`Unexpected control: ${request.method}`);
      socket.end(`${JSON.stringify({ id: request.id, result })}\n`);
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(path, resolve));
  return { path, state, methods };
}

afterEach(async () => {
  for (const connection of connections.splice(0)) connection.destroy();
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function secondView(path: string): ReturnType<typeof readHerdrViewWitness> {
  const snapshot = await readHerdrSnapshot(path);
  return readHerdrViewWitness(snapshot, snapshot.panes[1]!, []);
}

describe('explicit native view focus', () => {
  it('revalidates before focus, reads back the actual tab, and returns only on a separate call', async () => {
    const test = await fixture();
    const target = await secondView(test.path);
    expect(test.state.focused).toBe('w:p1');
    let participantChecks = 0;
    const result = await focusHerdrView(target, [], async () => { participantChecks++; });
    expect(result.status).toBe('focused');
    expect(participantChecks).toBe(2);
    expect(test.state.focused).toBe('w:p2');
    expect(result.previous?.pane.pane_id).toBe('w:p1');
    await returnToHerdrView(result.previous!, []);
    expect(test.state.focused).toBe('w:p1');
    expect(test.methods.filter((method) => method === 'pane.focus')).toHaveLength(2);
  });

  it('refuses a changed process, socket epoch, or participant before any focus request', async () => {
    const test = await fixture();
    const target = await secondView(test.path);
    test.state.secondPid = 303;
    await expect(focusHerdrView(target, [], async () => {})).rejects.toThrow('changed');
    test.state.secondPid = 202;
    await expect(focusHerdrView({ ...target, socketIdentity: 'another server' }, [], async () => {})).rejects.toThrow('changed');
    await expect(focusHerdrView(target, [], async () => { throw new Error('New participant'); })).rejects.toThrow('New participant');
    expect(test.methods).not.toContain('pane.focus');
  });

  it('reads back an applied action after a timeout without repeating it', async () => {
    const test = await fixture();
    const target = await secondView(test.path);
    test.state.noAck = true;
    // The one timeout covers the reads before and after the focus too, so it must outlast a socket round trip on a loaded runner.
    const result = await focusHerdrView(target, [], async () => {}, { timeoutMs: 1000 });
    expect(result.status).toBe('focused');
    expect(test.methods.filter((method) => method === 'pane.focus')).toHaveLength(1);
  });

  it('reports concurrent focus honestly and refuses Return after its target changes', async () => {
    const test = await fixture();
    const target = await secondView(test.path);
    test.state.redirectFocus = true;
    const result = await focusHerdrView(target, [], async () => {});
    expect(result.status).toBe('uncertain');
    expect(test.state.focused).toBe('w:p1');
    test.state.secondPid = 303;
    await expect(returnToHerdrView(target, [])).rejects.toThrow('changed');
    expect(test.methods.filter((method) => method === 'pane.focus')).toHaveLength(1);
  });

  it('does not assume a newer protocol is compatible', async () => {
    const test = await fixture();
    test.state.protocol = 999;
    await expect(readHerdrSnapshot(test.path)).rejects.toThrow('not supported');
  });
});
