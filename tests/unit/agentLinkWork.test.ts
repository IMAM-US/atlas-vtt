// @vitest-environment node
import { afterEach, expect, it } from 'vitest';
import { createServer, type Server } from 'http';
import { readOpenRigOwnedWork, readOpenRigWork } from '../../src/app/agent-links/native/openRigWork';

const servers: Server[] = [];
afterEach(async () => {
  for (const server of servers) server.closeAllConnections();
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

async function source(respond: (path: string) => unknown): Promise<{ hostId: string; endpoint: string }> {
  const server = createServer((request, response) => response.end(JSON.stringify(respond(request.url ?? ''))));
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing port');
  return { hostId: 'host-one', endpoint: `http://127.0.0.1:${address.port}` };
}

it('reads historical work without requiring a still-existing seat and preserves native fields', async () => {
  const item = { qitemId: 'item-one', body: 'A path in prose is not an artifact reference.', state: 'done', unknownExtension: { meaning: 'native' } };
  const transitions = [{ qitemId: 'item-one', toState: 'done', actorSession: 'earlier-seat' }];
  const connection = await source((path) => path === '/healthz' ? { selfHostId: 'host-one' }
    : path.endsWith('/transitions') ? transitions : item);
  expect(await readOpenRigWork(connection, 'item-one')).toMatchObject({ item, transitions });
});

it('refuses another source before reading a work item with the same name', async () => {
  const paths: string[] = [];
  const connection = await source((path) => { paths.push(path); return { selfHostId: 'host-two' }; });
  await expect(readOpenRigWork(connection, 'item-one')).rejects.toMatchObject({ kind: 'source' });
  expect(paths).toEqual(['/healthz']);
});

it('rejects mismatched transitions and a source replaced during the read', async () => {
  let hostReads = 0;
  let wrongTransition = true;
  const connection = await source((path) => {
    if (path === '/healthz') return { selfHostId: ++hostReads === 3 ? 'host-two' : 'host-one' };
    if (path.endsWith('/transitions')) return [{ qitemId: wrongTransition ? 'another-item' : 'item-one' }];
    return { qitemId: 'item-one' };
  });
  await expect(readOpenRigWork(connection, 'item-one')).rejects.toThrow('does not match');
  wrongTransition = false;
  await expect(readOpenRigWork(connection, 'item-one')).rejects.toMatchObject({ kind: 'source' });
});

it('bounds current native custody without claiming provider conversation ownership', async () => {
  const seat = { rigId: 'rig-one', nodeId: 'node-one', logicalId: 'pod.member' };
  const sessionName = 'member@example';
  const connection = await source((path) => {
    if (path.startsWith('/api/rigs/')) return { ...seat, hostSelfId: 'host-one', canonicalSessionName: sessionName };
    const query = new URL(path, 'http://example.invalid').searchParams;
    expect(query.get('destinationSession')).toBe(sessionName);
    expect(query.get('compact')).toBe('1');
    expect(query.get('limit')).toBe('51');
    return Array.from({ length: 51 }, (_, index) => ({ qitemId: `work-${index}`, destinationSession: sessionName, state: 'blocked' }));
  });
  const result = await readOpenRigOwnedWork(connection, seat);
  expect(result).toMatchObject({ scope: 'native-seat-address', sessionName, truncated: true });
  expect(result.items).toHaveLength(50);
});

it('rejects wrong-seat list results and a reused locator during the current-work read', async () => {
  const seat = { rigId: 'rig-one', nodeId: 'node-one', logicalId: 'pod.member' };
  let wrongSeat = true;
  let nodeReads = 0;
  const connection = await source((path) => {
    if (path.startsWith('/api/rigs/')) return { ...seat, nodeId: ++nodeReads === 3 ? 'replacement' : seat.nodeId, hostSelfId: 'host-one', canonicalSessionName: 'member@example' };
    return [{ qitemId: 'work-one', destinationSession: wrongSeat ? 'other@example' : 'member@example', state: 'in-progress' }];
  });
  await expect(readOpenRigOwnedWork(connection, seat)).rejects.toThrow('does not match');
  wrongSeat = false;
  await expect(readOpenRigOwnedWork(connection, seat)).rejects.toMatchObject({ kind: 'seat' });
});
