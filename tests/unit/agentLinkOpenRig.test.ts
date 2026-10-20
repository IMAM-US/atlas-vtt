// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'http';
import { readOpenRigNode, readOpenRigParticipant, readOpenRigProcess, readOpenRigScreen, readOpenRigSeatScreen } from '../../src/app/agent-links/native/openRigRead';

const seat = { rigId: 'rig-one', nodeId: 'seat-one', logicalId: 'team.builder' };
const sessionName = 'team-builder@example';
const servers: Server[] = [];

function node(): Record<string, unknown> {
  return {
    hostSelfId: 'host-one', ...seat, canonicalSessionName: sessionName, runtime: 'codex', resumeToken: 'conversation-one',
    binding: { id: 'binding-one', nodeId: seat.nodeId, attachmentType: 'tmux', tmuxPane: '%7', tmuxSession: sessionName },
    identityVerdict: { nodeId: seat.nodeId, verdict: 'verified', evidenceSource: 'pane_process', sessionName,
      observedAt: new Date().toISOString(), evidence: { registeredPane: '%7', observedPid: 123 } },
    currentQitems: [{ qitemId: 'work-one', state: 'in-progress', unknownNativeMetadata: 'preserve' }],
  };
}

async function source(resolve: (path: string) => unknown): Promise<{ endpoint: string; hostId: string }> {
  const server = createServer((request, response) => response.end(JSON.stringify(resolve(request.url ?? ''))));
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing port');
  return { endpoint: `http://127.0.0.1:${address.port}`, hostId: 'host-one' };
}

afterEach(async () => {
  for (const server of servers) server.closeAllConnections();
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe('source-qualified native identity', () => {
  it('preserves native metadata but refuses matching names from another source, rig or node', async () => {
    let current = node();
    const connection = await source(() => current);
    expect((await readOpenRigNode(connection, seat)).currentQitems).toEqual(current.currentQitems);
    for (const field of ['hostSelfId', 'rigId', 'nodeId']) {
      current = { ...node(), [field]: 'replacement' };
      await expect(readOpenRigNode(connection, seat)).rejects.toMatchObject({ kind: field === 'hostSelfId' ? 'source' : 'seat' });
    }
  });

  it('joins verified current process and exact record metadata without reading transcript bytes', async () => {
    const requests: string[] = [];
    const connection = await source((path) => {
      requests.push(path);
      return path.endsWith('generation-record') ? { runtime: 'codex', sessionId: 'conversation-one', generationId: 'opaque-one', totalBytes: 500 } : node();
    });
    const result = await readOpenRigParticipant(connection, seat);
    expect(result.participant).toMatchObject({ conversationId: 'conversation-one', tmuxPane: '%7', processId: 123, recordGeneration: 'opaque-one' });
    expect(requests).toEqual(['/api/rigs/rig-one/nodes/team.builder', '/api/sessions/team-builder%40example/generation-record']);
  });

  it('does not upgrade a stale process verdict or a different provider record into current identity', async () => {
    let current = node();
    const connection = await source((path) => path.endsWith('generation-record')
      ? { runtime: 'codex', sessionId: 'different-conversation', generationId: 'opaque-one' } : current);
    await expect(readOpenRigParticipant(connection, seat)).rejects.toMatchObject({ kind: 'unverified' });
    current = { ...node(), identityVerdict: { ...(node().identityVerdict as Record<string, unknown>), observedAt: '2000-01-01T00:00:00Z' } };
    await expect(readOpenRigParticipant(connection, seat)).rejects.toThrow('fresh verified');
  });

  it('refuses screen reads for an old participant, and detects a handoff during capture', async () => {
    let generation = 'opaque-one';
    let captures = 0;
    let handoff = false;
    const connection = await source((path) => {
      if (path.endsWith('generation-record')) return { runtime: 'codex', sessionId: 'conversation-one', generationId: generation };
      if (path.includes('/preview')) {
        captures++;
        if (handoff) generation = 'opaque-two';
        return { sessionName, content: 'A screen, not a transcript', capturedAt: new Date().toISOString() };
      }
      return node();
    });
    const intended = (await readOpenRigParticipant(connection, seat)).participant;
    expect((await readOpenRigScreen(connection, seat, intended)).content).toContain('screen');
    handoff = true;
    await expect(readOpenRigScreen(connection, seat, intended)).rejects.toMatchObject({ kind: 'participant' });
    expect(captures).toBe(2);
    await expect(readOpenRigScreen(connection, seat, intended)).rejects.toMatchObject({ kind: 'participant' });
    expect(captures).toBe(2);
  });

  it('keeps a qualified seat screen available without claiming an unverified conversation', async () => {
    const requests: string[] = [];
    const connection = await source((path) => {
      requests.push(path);
      return path.includes('/preview') ? { sessionName, content: 'Seat screen', capturedAt: new Date().toISOString() } : node();
    });
    const intended = (await readOpenRigProcess(connection, seat)).process;
    expect(await readOpenRigSeatScreen(connection, seat, intended)).toMatchObject({ content: 'Seat screen', scope: 'seat-screen' });
    expect(requests.some((path) => path.includes('generation-record'))).toBe(false);
  });
});
