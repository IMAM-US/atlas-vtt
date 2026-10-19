// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server, type Socket } from 'net';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { requestJsonSocket } from '../../src/app/agent-links/native/jsonSocket';

const servers: Server[] = [];
const sockets: Socket[] = [];
const directories: string[] = [];

async function serve(reply: (socket: Socket, request: Record<string, unknown>) => void): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-socket-'));
  directories.push(directory);
  const socketPath = join(directory, 'native.sock');
  const server = createServer((socket) => {
    sockets.push(socket);
    let input = '';
    socket.on('data', (chunk) => {
      input += chunk.toString();
      if (input.endsWith('\n')) reply(socket, JSON.parse(input) as Record<string, unknown>);
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(socketPath, resolve));
  return socketPath;
}

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.destroy();
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('native JSON socket transport', () => {
  it('sends exact framing and correlates a fragmented result after an unrelated event', async () => {
    const path = await serve((socket, request) => {
      expect(request).toMatchObject({ method: 'pane.focus', params: { pane_id: 'w1:p2' } });
      expect(typeof request.id).toBe('string');
      socket.write('{"event":"changed"}\n');
      const response = JSON.stringify({ id: request.id, result: { focused: 'w1:p2' } });
      socket.write(response.slice(0, 9));
      socket.end(`${response.slice(9)}\n`);
    });
    await expect(requestJsonSocket(path, 'pane.focus', { pane_id: 'w1:p2' })).resolves.toEqual({ focused: 'w1:p2' });
  });

  it('rejects a protocol error, malformed JSON and a premature close', async () => {
    const errorPath = await serve((socket, request) => socket.end(`${JSON.stringify({ id: request.id, error: { message: 'Pane gone' } })}\n`));
    await expect(requestJsonSocket(errorPath, 'pane.focus', {})).rejects.toThrow('Pane gone');
    const malformed = await serve((socket) => socket.end('broken\n'));
    await expect(requestJsonSocket(malformed, 'view', {})).rejects.toThrow('invalid JSON');
    const closed = await serve((socket) => socket.end());
    await expect(requestJsonSocket(closed, 'view', {})).rejects.toThrow('closed before');
  });

  it('bounds oversized and uncorrelated responses without retrying an action', async () => {
    const large = await serve((socket) => socket.write('x'.repeat(65)));
    await expect(requestJsonSocket(large, 'view', {}, { maxBytes: 64 })).rejects.toThrow('read limit');
    let requests = 0;
    const stalled = await serve((socket) => {
      requests++;
      socket.write('{"id":"someone-else","result":true}\n');
    });
    await expect(requestJsonSocket(stalled, 'pane.focus', {}, { timeoutMs: 30 })).rejects.toThrow('result is unknown');
    expect(requests).toBe(1);
  });

  it('cancels an outstanding read', async () => {
    const controller = new AbortController();
    const path = await serve(() => controller.abort());
    await expect(requestJsonSocket(path, 'view', {}, { signal: controller.signal })).rejects.toThrow('canceled');
  });
});
