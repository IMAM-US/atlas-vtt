import { randomUUID } from 'crypto';
import { createConnection } from 'net';
import { clearTimeout as cancelTimeout, setTimeout as scheduleTimeout } from 'timers';

export interface SocketRequestOptions {
  timeoutMs?: number;
  maxBytes?: number;
  signal?: AbortSignal;
}

/** One bounded request to an existing local server. Never retries a possible effect. */
export function requestJsonSocket(
  socketPath: string,
  method: string,
  params: Record<string, unknown>,
  options: SocketRequestOptions = {},
): Promise<unknown> {
  if (options.signal?.aborted) return Promise.reject(new Error('Request canceled.'));
  const id = randomUUID();
  const maxBytes = options.maxBytes ?? 1024 * 1024;
  return new Promise((resolve, reject) => {
    const socket = createConnection(socketPath);
    let pending = '';
    let receivedBytes = 0;
    let settled = false;
    const finish = (error: Error | null, value?: unknown): void => {
      if (settled) return;
      settled = true;
      cancelTimeout(timer);
      options.signal?.removeEventListener('abort', cancel);
      socket.destroy();
      if (error) reject(error);
      else resolve(value);
    };
    const cancel = (): void => finish(new Error('Request canceled.'));
    const timer = scheduleTimeout(() => finish(new Error('Native request timed out; its result is unknown.')), options.timeoutMs ?? 3000);
    options.signal?.addEventListener('abort', cancel, { once: true });
    socket.setEncoding('utf8');
    socket.once('connect', () => socket.write(`${JSON.stringify({ id, method, params })}\n`));
    socket.on('data', (chunk: string) => {
      receivedBytes += Buffer.byteLength(chunk);
      if (receivedBytes > maxBytes) {
        finish(new Error('Native response exceeded the read limit.'));
        return;
      }
      pending += chunk;
      let newline: number;
      while (!settled && (newline = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, newline);
        pending = pending.slice(newline + 1);
        if (!line.trim()) continue;
        let response: unknown;
        try {
          response = JSON.parse(line);
        } catch {
          finish(new Error('Native server returned invalid JSON.'));
          return;
        }
        if (typeof response !== 'object' || response === null || !('id' in response) || response.id !== id) continue;
        if ('error' in response && response.error != null) {
          const detail = typeof response.error === 'object' && 'message' in response.error
            && typeof response.error.message === 'string' ? response.error.message : 'Native request failed.';
          finish(new Error(detail));
        } else if ('result' in response) finish(null, response.result);
        else finish(new Error('Native response has no result.'));
      }
    });
    socket.once('error', (error) => finish(error));
    socket.once('close', () => finish(new Error('Native connection closed before a result arrived.')));
  });
}
