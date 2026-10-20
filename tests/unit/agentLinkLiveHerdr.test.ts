// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { createServer, type Server, type Socket } from 'net';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { subscribeHerdr } from '../../src/app/agent-links/live/herdrEvents';
import { HerdrLive, type HerdrTransport } from '../../src/app/agent-links/live/HerdrLive';
import type { HerdrSnapshot } from '../../src/app/agent-links/native/herdrRead';

vi.mock('timers', () => ({
  setTimeout: (callback: () => void, ms: number) => globalThis.setTimeout(callback, ms),
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(timer),
}));

let server: Server | null = null;
let root = '';
const sockets = new Set<Socket>();
afterEach(async () => {
  vi.useRealTimers();
  for (const socket of sockets) socket.destroy(); sockets.clear();
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = null;
  if (root) await rm(root, { recursive: true, force: true }); root = '';
});

it('sends subscribe first on a real Unix socket, waits for ack and parses both namespaces', async () => {
  root = await mkdtemp(join(tmpdir(), 'atlas-herdr-events-'));
  const path = join(root, 'server.sock');
  const methods: string[] = [];
  server = createServer((socket) => {
    sockets.add(socket);
    let pending = '';
    socket.on('data', (data) => {
      pending += data.toString(); if (!pending.includes('\n')) return;
      const request = JSON.parse(pending.slice(0, pending.indexOf('\n')));
      methods.push(request.method);
      expect(request.params.subscriptions).toContainEqual({ type: 'pane.focused' });
      expect(request.params.subscriptions).toContainEqual({ type: 'pane.agent_status_changed', pane_id: 'pane-a' });
      expect(request.params.subscriptions.some((s: { type: string }) => s.type === 'pane.output_matched')).toBe(false);
      const ack = JSON.stringify({ id: request.id, result: { type: 'subscription_started' } }) + '\n';
      socket.write(ack.slice(0, 10)); socket.write(ack.slice(10));
      socket.write('{"event":"pane_focused","data":{"pane_id":"pane-a"}}\n{"event":"pane.agent_status_changed","data":{"agent_status":"working"}}\n');
    });
  });
  await new Promise<void>((resolve) => server!.listen(path, resolve));
  const controller = new AbortController(), events: string[] = [];
  const subscription = await subscribeHerdr(path, ['pane-a'], controller.signal, (event) => events.push(event), vi.fn());
  await vi.waitFor(() => expect(events).toEqual(['pane_focused', 'pane.agent_status_changed']));
  expect(methods).toEqual(['events.subscribe']);
  controller.abort(); subscription.close();
});

const snapshot: HerdrSnapshot = { socketPath: '/synthetic/herdr.sock', socketIdentity: 'server-one', version: '0.9.5', protocol: 22,
  panes: [{ pane_id: 'pane-a', tab_id: 'tab-a', workspace_id: 'space-a', terminal_id: 'terminal-a' }],
  tabs: [{ tab_id: 'tab-a', workspace_id: 'space-a', label: 'Example' }], workspaces: [{ workspace_id: 'space-a', label: 'Example' }],
  focusedPaneId: 'pane-a', focusedTabId: 'tab-a', focusedWorkspaceId: 'space-a' };

it('rehydrates after ack/reconnect and never labels Herdr focus Live', async () => {
  vi.useFakeTimers();
  let disconnect: ((error: Error) => void) | undefined;
  const order: string[] = [];
  const close = vi.fn();
  const transport: HerdrTransport = {
    identity: async () => 'server-one',
    snapshot: vi.fn(async () => { order.push('snapshot'); return snapshot; }),
    subscribe: vi.fn(async (_path, _panes, _signal, _onEvent, lost) => { order.push('subscribe-ack'); disconnect = lost; return { close }; }),
  };
  const model = new HerdrLive('a', snapshot.socketPath, transport, 1);
  const handle = model.watchSnapshot();
  await vi.advanceTimersByTimeAsync(5);
  expect(order.slice(0, 3)).toEqual(['snapshot', 'subscribe-ack', 'snapshot']);
  expect(handle.getSnapshot().freshness).toBe('read');
  disconnect?.(new Error('Connection lost.'));
  expect(handle.getSnapshot().freshness).toBe('last-known');
  await vi.advanceTimersByTimeAsync(510);
  expect(transport.subscribe).toHaveBeenCalledTimes(2);
  expect(handle.getSnapshot().freshness).toBe('read');
  handle.release(); expect(close).toHaveBeenCalledTimes(2);
});
