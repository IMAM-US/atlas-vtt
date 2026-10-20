/** One readable entry of a conversation record. Text is shown as text only, never as markup. */
export type RecordEntry =
  | { kind: 'turn'; role: 'user' | 'assistant' | 'developer' | 'agent'; label: string | null; at: string | null; text: string }
  | { kind: 'tool-call'; name: string; at: string | null; text: string }
  | { kind: 'tool-result'; name: string | null; at: string | null; text: string; isError: boolean }
  | { kind: 'reasoning'; at: string | null; text: string }
  | { kind: 'note'; label: string; at: string | null; text: string }
  /** An entry type this view does not know, kept as escaped raw JSON. */
  | { kind: 'raw'; type: string; at: string | null; text: string };

/** What one provider parser made of a record's complete lines. */
export interface ParsedRecord {
  entries: RecordEntry[];
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
