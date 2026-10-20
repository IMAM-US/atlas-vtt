import { readLocalFileRange, sha256, type FileIdentity } from './localFiles';
import { validateRecordPrefix } from './providerRecord';
import { conversationRecordPath, type ProviderRecordLocation } from './providerRecordLocator';

/** Bytes read from a record's start to check its identity. */
export const RECORD_PREFIX_BYTES = 256 * 1024;
/** A first read and each *Load earlier* step take this many more bytes from the end. */
export const RECORD_WINDOW_STEP = 2 * 1024 * 1024;
/** Everything *Load earlier* may accumulate; earlier bytes are not read. */
export const RECORD_WINDOW_MAX = 16 * 1024 * 1024;

/**
 * What a later read of the same record must still find: the same file, at least as long as
 * the read boundary, with the same beginning and the same bytes already shown. Bytes
 * appended after the boundary stay outside until the person reloads.
 */
export interface RecordPin {
  identity: FileIdentity;
  boundary: number;
  prefixLength: number;
  prefixSha256: string;
  shownStart: number;
  shownSha256: string;
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
  signal?: AbortSignal;
}

/**
 * Reads the last `windowBytes` before the read boundary of a conversation's exact record,
 * located again now and checked against its own identity through the same file handle.
 */
export async function readRecordWindow(
  roots: { claudeProjectsRoot: string; codexSessionsRoot: string }, location: ProviderRecordLocation, options: RecordWindowOptions,
): Promise<RecordWindow> {
  options.signal?.throwIfAborted();
  const windowBytes = Math.min(Math.max(Math.floor(options.windowBytes), 1), RECORD_WINDOW_MAX);
  const pin = options.pin ?? null;
  const { providerRoot, relativePath } = await conversationRecordPath(roots, location);
  options.signal?.throwIfAborted();
  // One byte more than the window shows whether the window starts at a line.
  const read = await readLocalFileRange(providerRoot, relativePath, {
    prefixBytes: RECORD_PREFIX_BYTES, rangeBytes: windowBytes + 1,
    ...(pin ? { end: pin.boundary, expect: { identity: pin.identity, minSize: pin.boundary } } : {}),
  });
  options.signal?.throwIfAborted();
  const head = read.prefix.subarray(0, Math.min(read.prefix.length, read.end));
  const wholeHead = head.length === read.end && (read.end === 0 || head[read.end - 1] === 10);
  validateRecordPrefix(location.runtime, location.conversationId, head, wholeHead);
  const lead = read.bytes.length > windowBytes ? 1 : 0;
  const bytes = read.bytes.subarray(lead);
  const start = read.start + lead;
  if (pin) {
    if (head.length < pin.prefixLength || sha256(head.subarray(0, pin.prefixLength)) !== pin.prefixSha256) {
      throw new Error('The record\'s beginning changed since it was read. Reload it.');
    }
    if (pin.shownStart < start || sha256(bytes.subarray(pin.shownStart - start)) !== pin.shownSha256) {
      throw new Error('Part of the record already shown changed since it was read. Reload it.');
    }
  }
  return {
    path: read.path, runtime: location.runtime, conversationId: location.conversationId,
    bytes, start, end: read.end, startsAtLine: start === 0 || read.bytes[0] === 10,
    fileSizeBytes: read.fileSizeBytes,
    pin: { identity: read.identity, boundary: read.end, prefixLength: head.length, prefixSha256: sha256(head), shownStart: start, shownSha256: sha256(bytes) },
    observedAt: read.observedAt,
  };
}
