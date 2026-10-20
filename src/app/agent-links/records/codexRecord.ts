import {
  argumentsText, asObject, asString, countNotShown, jsonText, parseLine, RecordIdentityError,
  type ParsedRecord, type RecordEntry,
} from './recordEntries';

/** Codex line types that carry no conversation text. */
const NOT_SHOWN = new Set(['turn_context', 'token_usage_record', 'world_state', 'inter_agent_communication_metadata']);

/** Message and output content is a string or a list of `{ type, text }` items. */
function contentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return jsonText(content);
  return content.map((item) => {
    const value = asObject(item);
    const text = asString(value?.text);
    return text ?? `[${asString(value?.type) ?? 'content'}]`;
  }).join('\n\n');
}

/** A function call's output is a string, sometimes JSON with the output inside. */
function outputText(output: unknown): string {
  if (typeof output !== 'string') return contentText(output);
  try {
    const inner = asObject(JSON.parse(output) as unknown);
    const text = asString(inner?.output);
    if (text !== null) return text;
  } catch {
    // Not JSON: the string is the output.
  }
  return output;
}

/**
 * Reads a Codex rollout: each line is `{ timestamp, type, payload }`. Conversation turns and
 * tool calls are `response_item` payloads. `event_msg` lines mirror those items or report
 * runtime events, so they are counted and never shown as turns. A `session_meta` line must
 * name this conversation.
 */
export function parseCodexRecord(lines: readonly string[], conversationId: string): ParsedRecord {
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
    const type = asString(entry.type) ?? 'unknown';
    const at = asString(entry.timestamp);
    const payload = asObject(entry.payload);
    if (type === 'session_meta') {
      if (asString(payload?.id) !== conversationId) throw new RecordIdentityError('This record names another conversation.');
      countNotShown(notShown, type);
    } else if (type === 'event_msg') {
      countNotShown(notShown, `event_msg ${asString(payload?.type) ?? ''}`.trim());
    } else if (type === 'compacted') {
      entries.push({ kind: 'note', label: 'Compacted history', at, text: asString(payload?.message) ?? '' });
    } else if (NOT_SHOWN.has(type)) {
      countNotShown(notShown, type);
    } else if (type === 'response_item' && payload) {
      const itemType = asString(payload.type);
      const callId = asString(payload.call_id);
      if (itemType === 'message') {
        const role = asString(payload.role);
        const text = contentText(payload.content);
        if (role === 'user' || role === 'assistant' || role === 'developer') entries.push({ kind: 'turn', role, label: null, at, text });
        else if (role === 'system') entries.push({ kind: 'turn', role: 'developer', label: 'system', at, text });
        else entries.push({ kind: 'raw', type: `message ${role ?? ''}`.trim(), at, text: jsonText(payload) });
      } else if (itemType === 'agent_message') {
        const route = [asString(payload.author), asString(payload.recipient)].filter(Boolean).join(' → ');
        entries.push({ kind: 'turn', role: 'agent', label: route || null, at, text: contentText(payload.content) });
      } else if (itemType === 'reasoning') {
        entries.push({ kind: 'reasoning', at, text: Array.isArray(payload.summary) ? contentText(payload.summary) : '' });
      } else if (itemType === 'function_call' || itemType === 'custom_tool_call' || itemType === 'local_shell_call' || itemType === 'web_search_call') {
        const name = asString(payload.name) ?? itemType.replace(/_call$/, '');
        if (callId) toolNames.set(callId, name);
        const input = itemType === 'function_call' ? payload.arguments : itemType === 'custom_tool_call' ? payload.input : payload.action;
        entries.push({ kind: 'tool-call', name, at, text: argumentsText(input) });
      } else if (itemType === 'function_call_output' || itemType === 'custom_tool_call_output' || itemType === 'local_shell_call_output') {
        entries.push({ kind: 'tool-result', name: (callId && toolNames.get(callId)) || null, at, text: outputText(payload.output), isError: false });
      } else {
        entries.push({ kind: 'raw', type: `response_item ${itemType ?? ''}`.trim(), at, text: jsonText(entry) });
      }
    } else {
      entries.push({ kind: 'raw', type, at, text: jsonText(entry) });
    }
  }
  return { entries, malformed, notShown };
}
