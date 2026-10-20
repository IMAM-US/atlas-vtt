import type { RecordWindow } from '../native/recordWindow';
import { parseClaudeRecord } from './claudeRecord';
import { parseCodexRecord } from './codexRecord';
import { RECORD_ENTRY_MAX, type RecordEntry } from './recordEntries';
import { recordLines } from './recordLines';

/** The view renders this many entries first, and each *Load earlier* adds as many again up to `RECORD_ENTRY_MAX`. */
export const RECORD_ENTRY_STEP = 200;
/** Characters of one entry rendered before the rest is cut. */
export const RECORD_ENTRY_TEXT_MAX = 20_000;

export interface RecordPage {
  path: string;
  runtime: RecordWindow['runtime'];
  conversationId: string;
  /** The newest entries of the range, oldest first, never more than `RECORD_ENTRY_MAX`. */
  entries: RecordEntry[];
  /** Entries parsed from the range, shown or not. */
  parsedEntries: number;
  /** The range starts at the record's first byte, so `parsedEntries` is every entry up to its end. */
  complete: boolean;
  /** The range ends at the read boundary: the newest entries this read covers. */
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

/** Parses a record window with its provider's parser and keeps the newest `entryLimit` entries. */
export function recordPage(window: RecordWindow, entryLimit: number): RecordPage {
  const limit = Math.min(Math.max(1, entryLimit), RECORD_ENTRY_MAX);
  const split = recordLines(window.bytes, window.start, window.startsAtLine);
  const parsed = window.runtime === 'codex'
    ? parseCodexRecord(split.lines, window.conversationId, limit)
    : parseClaudeRecord(split.lines, window.conversationId, limit);
  return {
    path: window.path, runtime: window.runtime, conversationId: window.conversationId,
    entries: parsed.entries, parsedEntries: parsed.total,
    complete: window.start === 0, latest: window.end === window.pin.boundary,
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
