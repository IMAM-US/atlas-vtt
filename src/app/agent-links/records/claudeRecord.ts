import {
  argumentsText, asObject, asString, countNotShown, jsonText, parseLine, RecordIdentityError,
  type JsonObject, type ParsedRecord, type RecordEntry,
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
 * none may be a sidechain.
 */
export function parseClaudeRecord(lines: readonly string[], conversationId: string): ParsedRecord {
  const entries: RecordEntry[] = [];
  const notShown = new Map<string, number>();
  const toolNames = new Map<string, string>();
  let malformed = 0;
  for (const line of lines) {
    const entry = parseLine(line);
    if (!entry) {
      malformed++;
      continue;
    }
    if (entry.isSidechain === true) throw new RecordIdentityError('This record contains a sidechain conversation.');
    if (entry.sessionId !== undefined && entry.sessionId !== conversationId) throw new RecordIdentityError('This record names another conversation.');
    const type = asString(entry.type) ?? 'unknown';
    const at = asString(entry.timestamp);
    const message = asObject(entry.message);
    const content = blocksOf(message);
    if ((type === 'user' || type === 'assistant') && content !== null) {
      const role = type === 'user' ? 'user' : 'assistant';
      if (typeof content === 'string') {
        entries.push(entry.isMeta === true ? { kind: 'note', label: 'Injected context', at, text: content } : { kind: 'turn', role, label: null, at, text: content });
        continue;
      }
      let text: string[] = [];
      const flush = (): void => {
        if (!text.length) return;
        entries.push(entry.isMeta === true ? { kind: 'note', label: 'Injected context', at, text: text.join('\n\n') } : { kind: 'turn', role, label: null, at, text: text.join('\n\n') });
        text = [];
      };
      for (const raw of content) {
        const block = asObject(raw);
        const blockType = asString(block?.type);
        if (blockType === 'text') {
          text.push(asString(block?.text) ?? '');
          continue;
        }
        flush();
        if (blockType === 'tool_use' || blockType === 'server_tool_use') {
          const name = asString(block?.name) ?? 'tool';
          const id = asString(block?.id);
          if (id) toolNames.set(id, name);
          entries.push({ kind: 'tool-call', name, at, text: argumentsText(block?.input) });
        } else if (blockType === 'tool_result' || (blockType?.endsWith('_tool_result') ?? false)) {
          const id = asString(block?.tool_use_id);
          entries.push({ kind: 'tool-result', name: (id && toolNames.get(id)) || null, at, text: resultText(block?.content), isError: block?.is_error === true });
        } else if (blockType === 'thinking' || blockType === 'redacted_thinking') {
          entries.push({ kind: 'reasoning', at, text: asString(block?.thinking) ?? '' });
        } else if (blockType === 'image') {
          text.push('[image]');
        } else {
          entries.push({ kind: 'raw', type: `${type} ${blockType ?? 'block'}`, at, text: jsonText(raw) });
        }
      }
      flush();
    } else if (type === 'summary') {
      entries.push({ kind: 'note', label: 'Summary', at, text: asString(entry.summary) ?? '' });
    } else if (type === 'system') {
      countNotShown(notShown, `system ${asString(entry.subtype) ?? ''}`.trim());
    } else if (NOT_SHOWN.has(type)) {
      countNotShown(notShown, type);
    } else {
      entries.push({ kind: 'raw', type, at, text: jsonText(entry) });
    }
  }
  return { entries, malformed, notShown };
}
