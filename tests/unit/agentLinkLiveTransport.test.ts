// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'http';
import { NativeEventDecoder, readFrontier, subscribeOpenRig } from '../../src/app/agent-links/live/openRigEvents';

const servers: Server[] = [];
afterEach(async () => {
  for (const server of servers) server.closeAllConnections();
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve()))));
});
const frame = (seq: number, type = 'queue.updated'): string => `id: ${seq}\r\ndata: ${JSON.stringify({ type, seq, summary: 'é' })}\r\n\r\n`;

async function serve(handler: Parameters<typeof createServer>[0]): Promise<string> {
  const server = createServer(handler); servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test address');
  return `http://127.0.0.1:${address.port}`;
}

it('parses split UTF-8, CRLF and multiple SSE frames while bounding partial frames', () => {
  const decoder = new NativeEventDecoder();
  const bytes = Buffer.from(frame(12) + frame(13));
  const accent = bytes.indexOf(Buffer.from('é'));
  expect(decoder.push(bytes.subarray(0, accent + 1))).toEqual([]);
  expect(decoder.push(bytes.subarray(accent + 1))).toMatchObject([{ seq: 12, summary: 'é' }, { seq: 13 }]);
  expect(() => new NativeEventDecoder(30).push(Buffer.from('data: ' + 'x'.repeat(40)))).toThrow('overflow');
  expect(() => new NativeEventDecoder().push(Buffer.from('id: 9\ndata: {"type":"queue.updated","seq":10}\n\n'))).toThrow('identity');
});

it('uses a real GET-only source-wide socket with the finite numeric frontier and cancels it', async () => {
  let observedRequest = '';
  const endpoint = await serve((request, response) => {
    expect(request.method).toBe('GET');
    expect(request.headers.authorization).toBe('Bearer synthetic-token');
    observedRequest = request.url ?? '';
    if (request.url?.startsWith('/native/api/telemetry')) {
      response.end(JSON.stringify({ schemaVersion: 1, stream: 'events', source: { hostId: 'host-one', bootEpoch: 'boot-one' }, page: { retainedHighWatermark: '11' }, rows: [] }));
    } else {
      expect(request.headers['last-event-id']).toBe('11');
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      response.write(frame(12).slice(0, 7));
      response.write(frame(12).slice(7));
    }
  });
  const source = { endpoint: endpoint + '/native', hostId: 'host-one', bearerToken: 'synthetic-token' };
  const controller = new AbortController();
  const frontier = await readFrontier(source, controller.signal);
  expect(observedRequest).toBe('/native/api/telemetry/v1/events?start=latest&limit=1');
  const events: unknown[] = [];
  const subscription = await subscribeOpenRig(source, frontier, controller.signal, (event) => events.push(event), vi.fn());
  await vi.waitFor(() => expect(events).toMatchObject([{ seq: 12 }]));
  expect(observedRequest).toBe('/native/api/events');
  controller.abort(); subscription.close();
});

it.each(['9007199254740992', '-1', 'cursor-token'])('refuses an invalid or unsafe frontier: %s', async (watermark) => {
  const endpoint = await serve((_req, res) => res.end(JSON.stringify({ schemaVersion: 1, stream: 'events', source: { hostId: 'host-one', bootEpoch: 'boot-one' }, page: { retainedHighWatermark: watermark } })));
  await expect(readFrontier({ endpoint, hostId: 'host-one' }, new AbortController().signal)).rejects.toThrow('verified');
});

it('refuses a different native host and does not follow SSE redirects', async () => {
  const endpoint = await serve((_req, res) => { res.writeHead(302, { location: 'http://127.0.0.1:1' }); res.end(); });
  await expect(subscribeOpenRig({ endpoint, hostId: 'a' }, { hostId: 'a', bootEpoch: 'boot', seq: '0' }, new AbortController().signal, vi.fn(), vi.fn())).rejects.toThrow('302');
  const other = await serve((_req, res) => res.end(JSON.stringify({ schemaVersion: 1, stream: 'events', source: { hostId: 'other', bootEpoch: 'boot' }, page: { retainedHighWatermark: '1' } })));
  await expect(readFrontier({ endpoint: other, hostId: 'a' }, new AbortController().signal)).rejects.toThrow('verified');
});
