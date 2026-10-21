import { sha256 } from '../native/localFiles';
import type { RecordWindow } from '../native/recordWindow';
import { parseClaudeRecord } from './claudeRecord';
import { parseCodexRecord } from './codexRecord';
import { RECORD_ENTRY_MAX, type EntryCursor, type RecordEntry } from './recordEntries';
import { recordLines } from './recordLines';

/** The view renders this many entries first, and each *Load earlier* adds as many again up to `RECORD_ENTRY_MAX`. */
export const RECORD_ENTRY_STEP = 200;
/** Characters of one entry rendered before the rest is cut. */
export const RECORD_ENTRY_TEXT_MAX = 20_000;

export interface RecordPage {
  path: string;
  runtime: RecordWindow['runtime'];
  conversationId: string;
  /** The newest entries of the range before the page's cursor, oldest first, never more than `RECORD_ENTRY_MAX`. */
  entries: RecordEntry[];
  /** Entries parsed from the range before the cursor, shown or not. */
  parsedEntries: number;
  /** The lines the entries come from, by start byte: their end and the SHA-256 of their bytes, for the next read's check. */
  shownLines: Map<number, { end: number; sha256: string }>;
  /** The range starts at the record's first byte, so `parsedEntries` is every entry up to its end. */
  complete: boolean;
  /** The range ends at the read boundary with no cursor: the newest entries this read covers. */
  latest: boolean;
  start: number;
  end: number;
  boundary: number;
  /** Where the range's first whole line begins. */
  firstLineOffset: number;
  fileSizeBytes: number;
  malformed: number;
  oversized: number;
  cutStart: boolean;
  incompleteEnd: boolean;
  notShown: Array<[type: string, count: number]>;
  observedAt: string;
}

/**
 * Parses a record window with its provider's parser and keeps the newest `entryLimit`
 * entries before `before`, which may lie inside the window's last line.
 */
export function recordPage(window: RecordWindow, entryLimit: number, before: EntryCursor | null = null): RecordPage {
  const limit = Math.min(Math.max(1, entryLimit), RECORD_ENTRY_MAX);
  const split = recordLines(window.bytes, window.start, window.startsAtLine);
  const parsed = window.runtime === 'codex'
    ? parseCodexRecord(split.lines, window.conversationId, limit, before)
    : parseClaudeRecord(split.lines, window.conversationId, limit, before);
  const shownLines = new Map<number, { end: number; sha256: string }>();
  for (const entry of parsed.entries) {
    if (shownLines.has(entry.offset)) continue;
    shownLines.set(entry.offset, { end: entry.lineEnd, sha256: sha256(window.bytes.subarray(entry.offset - window.start, entry.lineEnd - window.start)) });
  }
  return {
    path: window.path, runtime: window.runtime, conversationId: window.conversationId,
    entries: parsed.entries, parsedEntries: parsed.total, shownLines,
    complete: window.start === 0, latest: before === null && window.end === window.pin.boundary,
    start: window.start, end: window.end, boundary: window.pin.boundary, firstLineOffset: split.firstLineOffset,
    fileSizeBytes: window.fileSizeBytes,
    malformed: parsed.malformed + split.invalidText, oversized: split.oversized,
    cutStart: split.cutStart, incompleteEnd: split.incompleteEnd,
    notShown: [...parsed.notShown].sort((a, b) => b[1] - a[1]),
    observedAt: window.observedAt,
  };
}

/** Cuts an entry's text for rendering and says how much was left out. */
export function boundedText(text: string): { text: string; omitted: number } {
  return text.length > RECORD_ENTRY_TEXT_MAX ? { text: text.slice(0, RECORD_ENTRY_TEXT_MAX), omitted: text.length - RECORD_ENTRY_TEXT_MAX } : { text, omitted: 0 };
}
