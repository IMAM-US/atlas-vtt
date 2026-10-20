import {
  argumentsText, asObject, asString, countNotShown, EntryCollector, jsonText, parseLine, RECORD_ENTRY_MAX, RecordIdentityError,
  type JsonObject, type EntryCursor, type ParsedRecord, type RecordLine,
} from './recordEntries';

/** Claude Code entry types that carry no conversation text; `api-request-blob` repeats messages already shown as turns. */
const NOT_SHOWN = new Set([
  'attachment', 'api-request', 'api-request-blob', 'api-request-shape', 'bridge-session', 'custom-title', 'agent-name',
  'mode', 'permission-mode', 'atis-latch', 'last-prompt', 'pr-link', 'queue-operation', 'file-history-snapshot',
  'file-history-delta', 'progress',
]);

function blocksOf(message: JsonObject | null): unknown[] | string | null {
  const content = message?.content;
  return typeof content === 'string' || Array.isArray(content) ? content : null;
}

/** A tool result's content is a string or a list of text and image blocks. */
function resultText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return jsonText(content);
  return content.map((block) => {
    const value = asObject(block);
    if (value?.type === 'text') return asString(value.text) ?? '';
    return `[${asString(value?.type) ?? 'content'}]`;
  }).join('\n');
}

/**
 * Reads Claude Code's JSONL: `user` and `assistant` entries hold a message whose content is
 * a string or blocks (`text`, `tool_use`, `tool_result`, `thinking`). Tool results are paired
 * with their call's name by id. Every entry that names a session must name this one, and
 * none may be a sidechain. Keeps the newest `limit` entries.
 */
export function parseClaudeRecord(lines: readonly RecordLine[], conversationId: string, limit = RECORD_ENTRY_MAX, before: EntryCursor | null = null): ParsedRecord {
  const collected = new EntryCollector(limit, before);
  const notShown = new Map<string, number>();
  const toolNames = new Map<string, string>();
  let malformed = 0;
  for (const line of lines) {
    collected.line(line);
    const entry = parseLine(line.text);
    if (!entry) {
      malformed++;
      continue;
    }
    if (entry.isSidechain === true) throw new RecordIdentityError('This record contains a sidechain conversation.');
    if (entry.sessionId !== undefined && entry.sessionId !== conversationId) throw new RecordIdentityError('This record names another conversation.');
    const type = asString(entry.type) ?? 'unknown';
    const at = asString(entry.timestamp);
    const content = blocksOf(asObject(entry.message));
    if ((type === 'user' || type === 'assistant') && content !== null) {
      const role = type === 'user' ? 'user' : 'assistant';
      const say = (text: string): void => collected.add(entry.isMeta === true
        ? { kind: 'note', label: 'Injected context', at, text }
        : { kind: 'turn', role, label: null, at, text });
      if (typeof content === 'string') {
        say(content);
        continue;
      }
      let text: string[] = [];
      const flush = (): void => {
        if (text.length) say(text.join('\n\n'));
        text = [];
      };
      for (const raw of content) {
        const block = asObject(raw);
        const blockType = asString(block?.type);
        if (blockType === 'text') {
          text.push(asString(block?.text) ?? '');
          continue;
        }
        if (blockType === 'image') {
          text.push('[image]');
          continue;
        }
        flush();
        if (blockType === 'tool_use' || blockType === 'server_tool_use') {
          const name = asString(block?.name) ?? 'tool';
          const id = asString(block?.id);
          if (id) toolNames.set(id, name);
          collected.add({ kind: 'tool-call', name, at, text: argumentsText(block?.input) });
        } else if (blockType === 'tool_result' || (blockType?.endsWith('_tool_result') ?? false)) {
          const id = asString(block?.tool_use_id);
          collected.add({ kind: 'tool-result', name: (id && toolNames.get(id)) || null, at, text: resultText(block?.content), isError: block?.is_error === true });
        } else if (blockType === 'thinking' || blockType === 'redacted_thinking') {
          collected.add({ kind: 'reasoning', at, text: asString(block?.thinking) ?? '' });
        } else {
          collected.add({ kind: 'raw', type: `${type} ${blockType ?? 'block'}`, at, text: jsonText(raw) });
        }
      }
      flush();
    } else if (type === 'summary') {
      collected.add({ kind: 'note', label: 'Summary', at, text: asString(entry.summary) ?? '' });
    } else if (type === 'system') {
      countNotShown(notShown, `system ${asString(entry.subtype) ?? ''}`.trim());
    } else if (NOT_SHOWN.has(type)) {
      countNotShown(notShown, type);
    } else {
      collected.add({ kind: 'raw', type, at, text: jsonText(entry) });
    }
  }
  return { entries: collected.entries(), total: collected.total, malformed, notShown };
}
