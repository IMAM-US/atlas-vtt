// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server, type RequestListener } from 'http';
import { NativeHttpError, readNativeJson } from '../../src/app/agent-links/native/httpRead';

const servers: Server[] = [];
async function serve(handler: RequestListener): Promise<string> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test server port');
  return `http://127.0.0.1:${address.port}`;
}
afterEach(async () => {
  for (const server of servers) server.closeAllConnections();
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe('native HTTP reads', () => {
  it('preserves bounded native refusal status, code and the verbatim reason without response bodies', async () => {
    const reason = 'The bound pane no longer matches its verified occupant.';
    const endpoint = await serve((_request, response) => { response.writeHead(409); response.end(JSON.stringify({ error: 'record_identity_unverified', message: reason, transcript: 'must not be retained' })); });
    try { await readNativeJson({ endpoint }, '/api/session'); throw new Error('Expected refusal'); }
    catch (error) {
      expect(error).toBeInstanceOf(NativeHttpError);
      expect(error).toMatchObject({ status: 409, code: 'record_identity_unverified', reason });
      expect(JSON.stringify(error)).not.toContain('must not be retained');
    }
  });
  it('reads through the real transport with GET and the configured source token', async () => {
    const endpoint = await serve((request, response) => {
      expect(request.method).toBe('GET');
      expect(request.url).toBe('/native/api/node');
      expect(request.headers.authorization).toBe('Bearer test-only');
      response.end('{"nodeId":"seat-a"}');
    });
    await expect(readNativeJson({ endpoint: `${endpoint}/native`, bearerToken: 'test-only' }, '/api/node')).resolves.toEqual({ nodeId: 'seat-a' });
  });

  it('refuses redirects without following them or forwarding a credential', async () => {
    let followed = false;
    const target = await serve((_request, response) => { followed = true; response.end('{}'); });
    const endpoint = await serve((_request, response) => { response.writeHead(302, { Location: target }); response.end(); });
    await expect(readNativeJson({ endpoint, bearerToken: 'test-only' }, '/api/node')).rejects.toThrow();
    expect(followed).toBe(false);
  });

  it('bounds actual received bytes and rejects failed or malformed responses', async () => {
    const large = await serve((_request, response) => response.end(' '.repeat(128)));
    await expect(readNativeJson({ endpoint: large }, '/api/node', { maxBytes: 64 })).rejects.toThrow('read limit');
    const failed = await serve((_request, response) => { response.writeHead(404); response.end('{}'); });
    await expect(readNativeJson({ endpoint: failed }, '/api/node')).rejects.toThrow('HTTP 404');
    const malformed = await serve((_request, response) => response.end('not json'));
    await expect(readNativeJson({ endpoint: malformed }, '/api/node')).rejects.toThrow();
  });

  it('cancels a stalled source without retrying', async () => {
    let count = 0;
    const endpoint = await serve(() => { count++; });
    await expect(readNativeJson({ endpoint }, '/api/node', { timeoutMs: 30 })).rejects.toThrow();
    expect(count).toBe(1);
  });
});
