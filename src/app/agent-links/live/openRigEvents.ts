import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { clearTimeout, setTimeout } from 'timers';
import { nativeObject, type OpenRigConnection } from '../native/openRigRead';
import { readNativeJson } from '../native/httpRead';
import type { EventSubscription, Frontier, NativeEvent } from './types';

/** Finite, source-owned frontier. Its telemetry cursor is never an SSE cursor. */
export async function readFrontier(source: OpenRigConnection, signal: AbortSignal): Promise<Frontier> {
  const value = await readNativeJson(source, '/api/telemetry/v1/events?start=latest&limit=1', { signal });
  if (!nativeObject(value) || value.schemaVersion !== 1 || value.stream !== 'events' || !nativeObject(value.source)
    || value.source.hostId !== source.hostId || typeof value.source.bootEpoch !== 'string' || !value.source.bootEpoch
    || !nativeObject(value.page) || typeof value.page.retainedHighWatermark !== 'string'
    || !/^(0|[1-9]\d*)$/.test(value.page.retainedHighWatermark) || value.page.retainedHighWatermark.length > 16
    || BigInt(value.page.retainedHighWatermark) > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('The native source or event frontier could not be verified.');
  }
  return { hostId: source.hostId, bootEpoch: value.source.bootEpoch, seq: value.page.retainedHighWatermark };
}

/** Bounded UTF-8 SSE framing; chunks and event frames are different boundaries. */
export class NativeEventDecoder {
  private readonly decoder = new TextDecoder('utf-8', { fatal: true });
  private pending = '';
  private data: string[] = [];
  private id = '';
  private bytes = 0;
  constructor(private readonly limit = 128 * 1024) {}

  push(chunk: Uint8Array): NativeEvent[] {
    if (chunk.byteLength > this.limit * 4) throw new Error('Native event buffer overflow.');
    this.pending += this.decoder.decode(chunk, { stream: true });
    const events: NativeEvent[] = [];
    let newline: number;
    while ((newline = this.pending.indexOf('\n')) !== -1) {
      const line = this.pending.slice(0, newline).replace(/\r$/, '');
      this.pending = this.pending.slice(newline + 1);
      this.bytes += Buffer.byteLength(line);
      if (this.bytes > this.limit) throw new Error('Native event buffer overflow.');
      if (!line) {
        if (this.data.length) {
          const value: unknown = JSON.parse(this.data.join('\n'));
          if (!nativeObject(value) || typeof value.type !== 'string' || !value.type
            || !Number.isSafeInteger(value.seq) || Number(value.seq) < 1 || this.id !== String(value.seq)) {
            throw new Error('The native event identity is invalid.');
          }
          events.push(value as NativeEvent);
          if (events.length > 1024) throw new Error('Native event buffer overflow.');
        }
        this.data = []; this.id = ''; this.bytes = 0;
      } else if (line.startsWith('data:')) this.data.push(line.slice(5).replace(/^ /, ''));
      else if (line.startsWith('id:')) this.id = line.slice(3).trim();
    }
    if (Buffer.byteLength(this.pending) + this.bytes > this.limit) throw new Error('Native event buffer overflow.');
    return events;
  }
}

/** One GET-only source-wide connection, cancelled by its owner. No hidden retries. */
export function subscribeOpenRig(
  source: OpenRigConnection, frontier: Frontier, signal: AbortSignal,
  onEvent: (event: NativeEvent) => void, onDisconnect: (error: Error) => void,
): Promise<EventSubscription> {
  return new Promise((resolve, reject) => {
    const base = new URL(source.endpoint);
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
      reject(new Error('Invalid native source endpoint.')); return;
    }
    const url = new URL(`${base.pathname.replace(/\/$/, '')}/api/events`, base);
    const request = base.protocol === 'https:' ? httpsRequest : httpRequest;
    const decoder = new NativeEventDecoder();
    let ready = false;
    let closed = false;
    const end = (error: Error): void => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      pending.destroy();
      if (!ready) reject(error);
      else if (!signal.aborted) onDisconnect(error);
    };
    const timer = setTimeout(() => end(new Error('Native event connection timed out.')), 5000);
    const pending = request(url, { method: 'GET', signal,
      headers: { Accept: 'text/event-stream', 'Last-Event-ID': frontier.seq, ...(source.bearerToken ? { Authorization: `Bearer ${source.bearerToken}` } : {}) },
    }, (response) => {
      if (response.statusCode !== 200 || !response.headers['content-type']?.startsWith('text/event-stream')) {
        response.destroy(); end(new Error(`Native event source returned HTTP ${response.statusCode ?? 0}.`)); return;
      }
      ready = true;
      clearTimeout(timer);
      resolve({ close: (): void => { closed = true; pending.destroy(); response.destroy(); } });
      response.on('data', (chunk: Buffer) => {
        if (closed || signal.aborted) return;
        try { for (const event of decoder.push(chunk)) onEvent(event); }
        catch (error) { end(error instanceof Error ? error : new Error('Native event parsing failed.')); }
      });
      response.once('end', () => end(new Error('Native event connection ended.')));
      response.once('error', end);
      response.once('close', () => end(new Error('Native event connection closed.')));
    });
    pending.once('error', end);
    pending.end();
  });
}
