import type { RecordLine } from './recordEntries';

/** A complete line longer than this is counted and skipped rather than parsed. */
export const RECORD_LINE_MAX_BYTES = 1024 * 1024;

export interface RecordLines {
  lines: RecordLine[];
  /** Where the range's first whole line begins; a read that pages back ends here at the latest. */
  firstLineOffset: number;
  /** The range began inside a line, so its first fragment was left out. */
  cutStart: boolean;
  /** The last bytes before the read boundary are a line still being written. */
  incompleteEnd: boolean;
  oversized: number;
  /** Complete lines that are not valid UTF-8. */
  invalidText: number;
}

/**
 * Splits the byte range starting at record byte `start` into its complete lines. A fragment
 * cut at the range start and an unterminated final line are reported, never counted as
 * malformed.
 */
export function recordLines(bytes: Buffer, start: number, startsAtLine: boolean): RecordLines {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const lines: RecordLine[] = [];
  let oversized = 0;
  let invalidText = 0;
  let position = 0;
  let cutStart = false;
  if (!startsAtLine) {
    const first = bytes.indexOf(10);
    cutStart = true;
    position = first === -1 ? bytes.length : first + 1;
  }
  const firstLineOffset = start + position;
  let incompleteEnd = false;
  while (position < bytes.length) {
    const newline = bytes.indexOf(10, position);
    if (newline === -1) {
      incompleteEnd = true;
      break;
    }
    const line = bytes.subarray(position, newline);
    const offset = start + position;
    position = newline + 1;
    if (line.length > RECORD_LINE_MAX_BYTES) {
      oversized++;
      continue;
    }
    let text: string;
    try {
      text = decoder.decode(line);
    } catch {
      invalidText++;
      continue;
    }
    if (text.trim()) lines.push({ text, offset, end: start + position });
  }
  return { lines, firstLineOffset, cutStart, incompleteEnd, oversized, invalidText };
}
