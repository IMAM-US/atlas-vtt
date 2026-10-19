import { request as requestHttp } from 'http';
import { request as requestHttps } from 'https';

/** Machine-local connection settings. Never read these values from a bundled account. */
export interface NativeHttpConnection {
  endpoint: string;
  bearerToken?: string;
}

export interface HttpReadOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  maxBytes?: number;
}

/** A bounded, nonredirecting GET. A source cannot redirect credentials to another endpoint. */
export async function readNativeJson(
  connection: NativeHttpConnection,
  route: string,
  options: HttpReadOptions = {},
): Promise<unknown> {
  const base = new URL(connection.endpoint);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new Error('Invalid native source endpoint.');
  }
  if (!route.startsWith('/') || route.startsWith('//')) throw new Error('Invalid native source route.');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (connection.bearerToken) headers.Authorization = `Bearer ${connection.bearerToken}`;
  const deadline = AbortSignal.timeout(options.timeoutMs ?? 5000);
  const signal = options.signal ? AbortSignal.any([deadline, options.signal]) : deadline;
  const url = new URL(`${base.pathname.replace(/\/$/, '')}${route}`, base);
  // Use desktop Node transport: the plugin renderer's browser fetch imposes a different origin boundary.
  const request = base.protocol === 'https:' ? requestHttps : requestHttp;
  return new Promise((resolve, reject) => {
    const pending = request(url, { method: 'GET', headers, signal }, (response) => {
      const status = response.statusCode ?? 0;
      if (status < 200 || status >= 300) {
        response.destroy();
        reject(new Error(`Native source returned HTTP ${status}.`));
        return;
      }
      const chunks: Buffer[] = [];
      let length = 0;
      response.on('data', (chunk: Buffer) => {
        length += chunk.length;
        if (length > (options.maxBytes ?? 1024 * 1024)) {
          response.destroy(new Error('Native response exceeded the read limit.'));
        } else chunks.push(chunk);
      });
      response.once('error', reject);
      response.once('end', () => {
        try {
          resolve(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, length))) as unknown);
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Native source returned invalid JSON.'));
        }
      });
    });
    pending.once('error', reject);
    pending.end();
  });
}
