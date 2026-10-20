import { readLocalFileRange, sha256, type FileIdentity } from './localFiles';
import { validateRecordPrefix } from './providerRecord';
import { conversationRecordPath, type ProviderRecordLocation } from './providerRecordLocator';

/** Bytes read from a record's start to check its identity. */
export const RECORD_PREFIX_BYTES = 256 * 1024;
/** A first read and each *Load earlier* step take this many more bytes from the end. */
export const RECORD_WINDOW_STEP = 2 * 1024 * 1024;
/** The most one read takes; *Load earlier* pages back beyond it. */
export const RECORD_WINDOW_MAX = 16 * 1024 * 1024;
/**
 * Lines a pin remembers; the least recently read are forgotten first. 50,000 line hashes are
 * a few megabytes, far more lines than the view's 600-entry cap can span.
 */
export const RECORD_SHOWN_LINES_MAX = 50_000;

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
  /**
   * The complete lines read so far, by the record byte where each begins: where it ends and
   * the SHA-256 of its bytes. A later read compares every one it contains, exactly.
   */
  shown: ReadonlyMap<number, { end: number; sha256: string }>;
}

/** The complete lines of a range, by start byte, with their end and SHA-256. */
function lineWitnesses(bytes: Buffer, start: number, startsAtLine: boolean): Map<number, { end: number; sha256: string }> {
  const lines = new Map<number, { end: number; sha256: string }>();
  let position = 0;
  if (!startsAtLine) {
    const first = bytes.indexOf(10);
    if (first === -1) return lines;
    position = first + 1;
  }
  for (let newline = bytes.indexOf(10, position); newline !== -1; newline = bytes.indexOf(10, position)) {
    lines.set(start + position, { end: start + newline + 1, sha256: sha256(bytes.subarray(position, newline + 1)) });
    position = newline + 1;
  }
  return lines;
}

/** Adds lines to a pin as the most recently read, keeping the newest `RECORD_SHOWN_LINES_MAX`. */
export function withShownLines(pin: RecordPin, lines: ReadonlyMap<number, { end: number; sha256: string }>): RecordPin {
  const shown = new Map(pin.shown);
  for (const [offset, line] of lines) {
    shown.delete(offset);
    shown.set(offset, line);
  }
  for (const offset of shown.keys()) {
    if (shown.size <= RECORD_SHOWN_LINES_MAX) break;
    shown.delete(offset);
  }
  return { ...pin, shown };
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
  // The identity prefix ends at the read boundary, wherever this range ends.
  const boundary = pin?.boundary ?? read.end;
  const head = read.prefix.subarray(0, Math.min(read.prefix.length, boundary));
  const wholeHead = head.length === boundary && (boundary === 0 || head[boundary - 1] === 10);
  validateRecordPrefix(location.runtime, location.conversationId, head, wholeHead);
  const lead = read.bytes.length > windowBytes ? 1 : 0;
  const bytes = read.bytes.subarray(lead);
  const start = read.start + lead;
  const startsAtLine = start === 0 || read.bytes[0] === 10;
  const witnesses = lineWitnesses(bytes, start, startsAtLine);
  if (pin) {
    if (head.length < pin.prefixLength || sha256(head.subarray(0, pin.prefixLength)) !== pin.prefixSha256) {
      throw new Error('The record\'s beginning changed since it was read. Reload it.');
    }
    for (const [offset, line] of pin.shown) {
      if (offset < start || line.end > read.end) continue;
      // A line that now ends elsewhere has changed too: its old newline moved or a new one appeared.
      const now = witnesses.get(offset);
      if (now ? now.end !== line.end || now.sha256 !== line.sha256 : sha256(bytes.subarray(offset - start, line.end - start)) !== line.sha256) {
        throw new Error('Part of the record already shown changed since it was read. Reload it.');
      }
    }
  }
  const next: RecordPin = {
    identity: read.identity, boundary,
    prefixLength: pin?.prefixLength ?? head.length, prefixSha256: pin?.prefixSha256 ?? sha256(head),
    shown: pin?.shown ?? new Map(),
  };
  return {
    path: read.path, runtime: location.runtime, conversationId: location.conversationId,
    bytes, start, end: read.end, startsAtLine,
    fileSizeBytes: read.fileSizeBytes,
    pin: withShownLines(next, witnesses),
    observedAt: read.observedAt,
  };
}
