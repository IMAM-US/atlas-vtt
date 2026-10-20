import { readLocalFilePrefix, type LocalFilePrefix } from './localFiles';

export interface ProviderRecordRequest {
  providerRoot: string;
  relativePath: string;
  runtime: 'codex' | 'claude-code';
  conversationId: string;
  maxBytes?: number;
}

export interface ProviderRecord extends LocalFilePrefix {
  runtime: ProviderRecordRequest['runtime'];
  conversationId: string;
  validatedRecords: number;
}

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function parseRecord(line: string): Record<string, unknown> {
  let value: unknown;
  try { value = JSON.parse(line) as unknown; } catch { throw new Error('Provider record contains invalid JSON'); }
  const record = object(value);
  if (!record) throw new Error('Provider record contains an invalid record');
  return record;
}

/** The caller supplies an exact path from a verified source; this never searches by recency. */
export async function locateProviderRecord(request: ProviderRecordRequest): Promise<ProviderRecord> {
  if (request.runtime !== 'codex' && request.runtime !== 'claude-code') throw new Error('Unsupported provider record runtime');
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(request.conversationId)) throw new Error('Invalid native conversation ID');
  const file = await readLocalFilePrefix(request.providerRoot, request.relativePath, { maxBytes: request.maxBytes ?? 256 * 1024 });
  const lastNewline = file.bytes.lastIndexOf(10);
  const completeBytes = file.complete ? file.bytes : file.bytes.subarray(0, lastNewline + 1);
  if (!completeBytes.length) throw new Error('Provider identity was not found within the read limit');
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(completeBytes); } catch { throw new Error('Provider record is not valid UTF-8'); }
  const lines = text.split('\n').filter((line) => line.trim());
  let validatedRecords = 0;
  if (request.runtime === 'codex') {
    const first = lines[0];
    if (!first) throw new Error('Provider record is empty');
    const record = parseRecord(first);
    if (record.type !== 'session_meta' || object(record.payload)?.id !== request.conversationId) {
      throw new Error('Codex record conversation ID mismatch');
    }
    validatedRecords = 1;
  } else {
    for (const line of lines) {
      const record = parseRecord(line);
      if (record.isSidechain === true) throw new Error('Claude sidechain record is not a main conversation record');
      if (record.sessionId === undefined) continue;
      if (record.sessionId !== request.conversationId) throw new Error('Claude record conversation ID mismatch');
      validatedRecords++;
    }
    if (!validatedRecords) throw new Error('Provider identity was not found within the read limit');
  }
  return { ...file, runtime: request.runtime, conversationId: request.conversationId, validatedRecords };
}
