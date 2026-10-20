import type { RecordWindow } from '../native/recordWindow';
import { parseClaudeRecord } from './claudeRecord';
import { parseCodexRecord } from './codexRecord';
import type { RecordEntry } from './recordEntries';
import { recordLines } from './recordLines';

/** The view renders at most this many entries, and *Load earlier* adds as many again. */
export const RECORD_ENTRY_STEP = 200;
/** Characters of one entry rendered before the rest is cut. */
export const RECORD_ENTRY_TEXT_MAX = 20_000;

export interface RecordPage {
  path: string;
  runtime: RecordWindow['runtime'];
  conversationId: string;
  /** The newest entries of the range, oldest first. */
  entries: RecordEntry[];
  /** Entries parsed from the range, shown or not. */
  parsedEntries: number;
  /** The range starts at the record's first byte, so `parsedEntries` is every entry up to the read boundary. */
  complete: boolean;
  start: number;
  end: number;
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
  const split = recordLines(window.bytes, window.startsAtLine);
  const parsed = window.runtime === 'codex'
    ? parseCodexRecord(split.lines, window.conversationId)
    : parseClaudeRecord(split.lines, window.conversationId);
  return {
    path: window.path, runtime: window.runtime, conversationId: window.conversationId,
    entries: parsed.entries.slice(-Math.max(1, entryLimit)),
    parsedEntries: parsed.entries.length,
    complete: window.start === 0,
    start: window.start, end: window.end, fileSizeBytes: window.fileSizeBytes,
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
