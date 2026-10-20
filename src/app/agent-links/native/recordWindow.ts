import { readLocalFileRange, sha256, type FileIdentity } from './localFiles';
import { validateRecordPrefix } from './providerRecord';
import { conversationRecordPath, type ProviderRecordLocation } from './providerRecordLocator';

/** Bytes read from a record's start to check its identity. */
export const RECORD_PREFIX_BYTES = 256 * 1024;
/** A first read and each *Load earlier* step take this many more bytes from the end. */
export const RECORD_WINDOW_STEP = 2 * 1024 * 1024;
/** The most one read takes; *Load earlier* pages back beyond it. */
export const RECORD_WINDOW_MAX = 16 * 1024 * 1024;
/** Bytes shown before are compared in chunks of this size, aligned back from the read boundary. */
const SHOWN_CHUNK = 16 * 1024;

/**
 * What a later read of the same record must still find: the same file, at least as long as
 * the read boundary, with the same beginning and the same bytes already shown. Bytes
 * appended after the boundary stay outside until the person reloads. It lives in memory
 * only and holds hashes, never record bytes.
 */
export interface RecordPin {
  identity: FileIdentity;
  boundary: number;
  prefixLength: number;
  prefixSha256: string;
  /** The last read's range, compared exactly when a later read covers all of it. */
  last: { start: number; end: number; sha256: string };
  /** Every whole chunk shown so far, by index back from the boundary. */
  chunks: ReadonlyMap<number, string>;
}

/** A bounded byte range of one exact record, ending at its read boundary. */
export interface RecordWindow {
  path: string;
  runtime: ProviderRecordLocation['runtime'];
  conversationId: string;
  bytes: Buffer;
  start: number;
  end: number;
  /** Whether `start` is the first byte of a line, so the first line is whole. */
  startsAtLine: boolean;
  /** The record's size when this read began. */
  fileSizeBytes: number;
  pin: RecordPin;
  observedAt: string;
}

export interface RecordWindowOptions {
  windowBytes: number;
  /** The pin of an earlier read; without it the read starts a new boundary at the record's current end. */
  pin?: RecordPin | null;
  /** Where the range ends, at or before the pin's boundary; the boundary when omitted. */
  end?: number;
  signal?: AbortSignal;
}

/** Hashes the whole chunks of `[start, start + bytes.length)`, indexed back from `boundary`. */
function chunkHashes(bytes: Buffer, start: number, boundary: number): Map<number, string> {
  // Chunk `index` covers `[boundary - (index + 1) * SHOWN_CHUNK, boundary - index * SHOWN_CHUNK)`.
  const hashes = new Map<number, string>();
  const first = Math.ceil((boundary - (start + bytes.length)) / SHOWN_CHUNK);
  const last = Math.floor((boundary - start) / SHOWN_CHUNK) - 1;
  for (let index = first; index <= last; index++) {
    const from = boundary - (index + 1) * SHOWN_CHUNK - start;
    hashes.set(index, sha256(bytes.subarray(from, from + SHOWN_CHUNK)));
  }
  return hashes;
}

/**
 * Reads the `windowBytes` before `end` (the read boundary when omitted) of a conversation's
 * exact record, located again now and checked against its own identity through the same file
 * handle.
 */
export async function readRecordWindow(
  roots: { claudeProjectsRoot: string; codexSessionsRoot: string }, location: ProviderRecordLocation, options: RecordWindowOptions,
): Promise<RecordWindow> {
  options.signal?.throwIfAborted();
  const windowBytes = Math.min(Math.max(Math.floor(options.windowBytes), 1), RECORD_WINDOW_MAX);
  const pin = options.pin ?? null;
  if (options.end !== undefined && (!pin || !Number.isSafeInteger(options.end) || options.end < 0 || options.end > pin.boundary)) {
    throw new Error('An earlier range needs the pin of the read it pages back from.');
  }
  const { providerRoot, relativePath } = await conversationRecordPath(roots, location);
  options.signal?.throwIfAborted();
  // One byte more than the window shows whether the window starts at a line.
  const read = await readLocalFileRange(providerRoot, relativePath, {
    prefixBytes: RECORD_PREFIX_BYTES, rangeBytes: windowBytes + 1,
    ...(pin ? { end: options.end ?? pin.boundary, expect: { identity: pin.identity, minSize: pin.boundary } } : {}),
  });
  options.signal?.throwIfAborted();
  const head = read.prefix.subarray(0, Math.min(read.prefix.length, read.end));
  const wholeHead = head.length === read.end && (read.end === 0 || head[read.end - 1] === 10);
  validateRecordPrefix(location.runtime, location.conversationId, head, wholeHead);
  const lead = read.bytes.length > windowBytes ? 1 : 0;
  const bytes = read.bytes.subarray(lead);
  const start = read.start + lead;
  const boundary = pin?.boundary ?? read.end;
  const chunks = chunkHashes(bytes, start, boundary);
  if (pin) {
    if (head.length < pin.prefixLength || sha256(head.subarray(0, pin.prefixLength)) !== pin.prefixSha256) {
      throw new Error('The record\'s beginning changed since it was read. Reload it.');
    }
    const coversLast = pin.last.start >= start && pin.last.end <= read.end;
    const lastChanged = coversLast && sha256(bytes.subarray(pin.last.start - start, pin.last.end - start)) !== pin.last.sha256;
    if (lastChanged || [...chunks].some(([index, hash]) => pin.chunks.has(index) && pin.chunks.get(index) !== hash)) {
      throw new Error('Part of the record already shown changed since it was read. Reload it.');
    }
  }
  return {
    path: read.path, runtime: location.runtime, conversationId: location.conversationId,
    bytes, start, end: read.end, startsAtLine: start === 0 || read.bytes[0] === 10,
    fileSizeBytes: read.fileSizeBytes,
    pin: {
      identity: read.identity, boundary,
      prefixLength: pin?.prefixLength ?? head.length, prefixSha256: pin?.prefixSha256 ?? sha256(head),
      last: { start, end: read.end, sha256: sha256(bytes) },
      chunks: new Map([...(pin?.chunks ?? []), ...chunks]),
    },
    observedAt: read.observedAt,
  };
}
