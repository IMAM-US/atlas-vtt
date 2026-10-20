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

/** Bounded native refusal metadata, without retaining the response body. */
export class NativeHttpError extends Error {
  constructor(readonly status: number, readonly code: string | null, readonly reason: string | null) {
    super(`Native source returned HTTP ${status}${code ? ` (${code})` : ''}.${reason ? ` ${reason}` : ''}`);
    this.name = 'NativeHttpError';
  }
}

function nativeHttpError(status: number, bytes: Buffer): NativeHttpError {
  try {
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const body = value as Record<string, unknown>;
      const code = typeof body.error === 'string' && /^[A-Za-z0-9_.-]{1,128}$/.test(body.error) ? body.error : null;
      const reason = typeof body.message === 'string' ? body.message : !code && typeof body.error === 'string' ? body.error : null;
      return new NativeHttpError(status, code, reason?.slice(0, 2048) ?? null);
    }
  } catch { /* Non-JSON error bodies are not collected or presented. */ }
  return new NativeHttpError(status, null, null);
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
      if (status >= 300 && status < 400) {
        response.destroy();
        reject(new NativeHttpError(status, null, null));
        return;
      }
      const successful = status >= 200 && status < 300;
      const chunks: Buffer[] = [];
      let length = 0;
      response.on('data', (chunk: Buffer) => {
        length += chunk.length;
        if (length > (successful ? options.maxBytes ?? 1024 * 1024 : 8192)) {
          response.destroy(new Error('Native response exceeded the read limit.'));
        } else chunks.push(chunk);
      });
      response.once('error', reject);
      response.once('end', () => {
        if (!successful) { reject(nativeHttpError(status, Buffer.concat(chunks, length))); return; }
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
