/** Entries a parser keeps: the newest this many, while it counts all of them. */
export const RECORD_ENTRY_MAX = 600;

type EntryBody =
  | { kind: 'turn'; role: 'user' | 'assistant' | 'developer' | 'agent'; label: string | null; at: string | null; text: string }
  | { kind: 'tool-call'; name: string; at: string | null; text: string }
  | { kind: 'tool-result'; name: string | null; at: string | null; text: string; isError: boolean }
  | { kind: 'reasoning'; at: string | null; text: string }
  | { kind: 'note'; label: string; at: string | null; text: string }
  /** An entry type this view does not know, kept as escaped raw JSON. */
  | { kind: 'raw'; type: string; at: string | null; text: string };

/**
 * One readable entry of a conversation record. `offset` and `lineEnd` are the record bytes of
 * its line; `ordinal` is its place among that line's entries, since one line can hold many.
 * Text is shown as text only, never as markup.
 */
export type RecordEntry = EntryBody & { offset: number; ordinal: number; lineEnd: number };

/** Where a page of entries ends: entries before this one are on the page. */
export interface EntryCursor { offset: number; ordinal: number }

/** A complete record line: its text, and the record bytes it spans with its newline. */
export interface RecordLine { text: string; offset: number; end: number }

/** What one provider parser made of a record's complete lines. */
export interface ParsedRecord {
  /** The newest entries, at most the parser's limit, oldest first. */
  entries: RecordEntry[];
  /** Every entry parsed, kept or not. */
  total: number;
  /** Complete lines that are not a JSON object. */
  malformed: number;
  /** Known entry types that carry no conversation text (runtime events, usage, settings), by type. */
  notShown: Map<string, number>;
}

/** A record line names another conversation or a sidechain; the whole read is refused, never mixed. */
export class RecordIdentityError extends Error {}

export type JsonObject = Record<string, unknown>;

export function asObject(value: unknown): JsonObject | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as JsonObject : null;
}

export function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** Parses a complete line; null when it is not a JSON object. */
export function parseLine(line: string): JsonObject | null {
  try {
    return asObject(JSON.parse(line) as unknown);
  } catch {
    return null;
  }
}

/** Pretty JSON for tool input and unknown entries; strings stay as they are. */
export function jsonText(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2) ?? '';
  } catch {
    return String(value);
  }
}

/** A tool's arguments arrive as a JSON string in some records; show them parsed when they are. */
export function argumentsText(value: unknown): string {
  if (typeof value !== 'string') return jsonText(value);
  try {
    return jsonText(JSON.parse(value) as unknown);
  } catch {
    return value;
  }
}

export function countNotShown(notShown: Map<string, number>, type: string): void {
  notShown.set(type, (notShown.get(type) ?? 0) + 1);
}

/**
 * Keeps the newest `limit` entries before `before` in bounded memory while counting every
 * such entry. A parser calls `line` for each line, then `add` for each entry it reads there.
 */
export class EntryCollector {
  private items: RecordEntry[] = [];
  private current: RecordLine = { text: '', offset: 0, end: 0 };
  private ordinal = 0;
  total = 0;

  constructor(private readonly limit: number, private readonly before: EntryCursor | null = null) {}

  line(line: RecordLine): void {
    this.current = line;
    this.ordinal = 0;
  }

  add(body: EntryBody): void {
    const entry: RecordEntry = { ...body, offset: this.current.offset, ordinal: this.ordinal++, lineEnd: this.current.end };
    if (this.before && (entry.offset > this.before.offset || (entry.offset === this.before.offset && entry.ordinal >= this.before.ordinal))) return;
    this.total++;
    this.items.push(entry);
    if (this.items.length >= this.limit * 2) this.items.splice(0, this.items.length - this.limit);
  }

  entries(): RecordEntry[] {
    return this.items.slice(-this.limit);
  }
}
