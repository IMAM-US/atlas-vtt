// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { RecordWindow } from '../../src/app/agent-links/native/recordWindow';
import { parseClaudeRecord } from '../../src/app/agent-links/records/claudeRecord';
import { parseCodexRecord } from '../../src/app/agent-links/records/codexRecord';
import type { RecordEntry, RecordLine } from '../../src/app/agent-links/records/recordEntries';
import { recordLines, RECORD_LINE_MAX_BYTES } from '../../src/app/agent-links/records/recordLines';
import { boundedText, recordPage, RECORD_ENTRY_TEXT_MAX } from '../../src/app/agent-links/records/recordPage';

const ID = 'conversation-example-1';
/** Complete lines at made-up offsets 100 bytes apart; parsers only carry offsets through. */
const lines = (...entries: unknown[]): RecordLine[] => entries.map((entry, index) => ({ text: typeof entry === 'string' ? entry : JSON.stringify(entry), offset: index * 100, end: index * 100 + 100 }));
const bodies = (entries: RecordEntry[]): unknown[] => entries.map(({ offset: _offset, ordinal: _ordinal, lineEnd: _lineEnd, ...body }) => body);

describe('Claude Code records', () => {
  const claude = (type: string, content: unknown, extra: Record<string, unknown> = {}): Record<string, unknown> =>
    ({ type, sessionId: ID, timestamp: '2026-01-01T10:00:00Z', message: { role: type, content }, ...extra });

  it('reads turns, pairs tool results with their call, keeps thinking apart and counts what carries no text', () => {
    const parsed = parseClaudeRecord(lines(
      claude('user', 'Please check the brief.'),
      claude('assistant', [{ type: 'thinking', thinking: 'Plan the check.' }, { type: 'text', text: 'Checking it.' }, { type: 'tool_use', id: 'call-1', name: 'Read', input: { file: 'brief.md' } }]),
      claude('user', [{ type: 'tool_result', tool_use_id: 'call-1', content: [{ type: 'text', text: 'brief text' }] }]),
      claude('user', [{ type: 'tool_result', tool_use_id: 'call-unknown', content: 'failed', is_error: true }]),
      { type: 'api-request-blob', sessionId: ID, message: { role: 'user', content: 'Please check the brief.' } },
      { type: 'system', subtype: 'turn_duration', sessionId: ID },
      { type: 'summary', summary: 'Checked the brief.' },
    ), ID);
    expect(parsed.entries.map((entry) => [entry.offset, entry.ordinal, entry.lineEnd])).toEqual([[0, 0, 100], [100, 0, 200], [100, 1, 200], [100, 2, 200], [200, 0, 300], [300, 0, 400], [600, 0, 700]]);
    expect(bodies(parsed.entries)).toEqual([
      { kind: 'turn', role: 'user', label: null, at: '2026-01-01T10:00:00Z', text: 'Please check the brief.' },
      { kind: 'reasoning', at: '2026-01-01T10:00:00Z', text: 'Plan the check.' },
      { kind: 'turn', role: 'assistant', label: null, at: '2026-01-01T10:00:00Z', text: 'Checking it.' },
      { kind: 'tool-call', name: 'Read', at: '2026-01-01T10:00:00Z', text: '{\n  "file": "brief.md"\n}' },
      { kind: 'tool-result', name: 'Read', at: '2026-01-01T10:00:00Z', text: 'brief text', isError: false },
      { kind: 'tool-result', name: null, at: '2026-01-01T10:00:00Z', text: 'failed', isError: true },
      { kind: 'note', label: 'Summary', at: null, text: 'Checked the brief.' },
    ]);
    expect([...parsed.notShown]).toEqual([['api-request-blob', 1], ['system turn_duration', 1]]);
  });

  it('keeps unknown entries as raw JSON text and counts malformed complete lines', () => {
    const parsed = parseClaudeRecord(lines({ type: 'future-entry', sessionId: ID, value: '<b>bold</b>' }, '{"type":', '[1,2]'), ID);
    expect(parsed.malformed).toBe(2);
    expect(bodies(parsed.entries)).toEqual([{ kind: 'raw', type: 'future-entry', at: null, text: expect.stringContaining('"value": "<b>bold</b>"') }]);
  });

  it('keeps only the newest entries up to its limit while counting all of them', () => {
    const parsed = parseClaudeRecord(lines(...Array.from({ length: 10 }, (_, index) => claude('user', `turn ${index}`))), ID, 3);
    expect(parsed.total).toBe(10);
    expect(parsed.entries.map((entry) => entry.kind === 'turn' && entry.text)).toEqual(['turn 7', 'turn 8', 'turn 9']);
  });

  it('reaches every entry of one line holding many, through a cursor inside that line', () => {
    const blocks = Array.from({ length: 1000 }, (_, index) => ({ type: 'tool_use', id: `call-${index}`, name: `tool-${index}`, input: {} }));
    const one = lines(claude('assistant', blocks));
    const newest = parseClaudeRecord(one, ID, 600);
    expect([newest.total, newest.entries[0]!.ordinal, newest.entries.at(-1)!.ordinal]).toEqual([1000, 400, 999]);
    const earlier = parseClaudeRecord(one, ID, 600, { offset: 0, ordinal: 200 });
    expect(earlier.total).toBe(200);
    expect(earlier.entries.map((entry) => entry.ordinal)).toEqual(Array.from({ length: 200 }, (_, index) => index));
  });

  it('refuses another conversation or a sidechain rather than mixing it in', () => {
    expect(() => parseClaudeRecord(lines(claude('user', 'x', { sessionId: 'conversation-other-2' })), ID)).toThrow('another conversation');
    expect(() => parseClaudeRecord(lines(claude('user', 'x', { isSidechain: true })), ID)).toThrow('sidechain');
  });
});

describe('Codex records', () => {
  const item = (payload: Record<string, unknown>): Record<string, unknown> => ({ timestamp: '2026-01-01T10:00:00Z', type: 'response_item', payload });
  const event = (payload: Record<string, unknown>): Record<string, unknown> => ({ timestamp: '2026-01-01T10:00:00Z', type: 'event_msg', payload });

  it('shows response items once and counts their event mirrors and runtime events', () => {
    const parsed = parseCodexRecord(lines(
      { timestamp: '2026-01-01T10:00:00Z', type: 'session_meta', payload: { id: ID } },
      item({ type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Run the tests.' }] }),
      event({ type: 'user_message', message: 'Run the tests.' }),
      item({ type: 'reasoning', summary: [{ type: 'summary_text', text: 'Use the focused suite.' }], encrypted_content: 'opaque' }),
      item({ type: 'function_call', name: 'shell', arguments: '{"command":["npm","test"]}', call_id: 'call-1' }),
      item({ type: 'function_call_output', call_id: 'call-1', output: '{"output":"2 passed","metadata":{"exit_code":0}}' }),
      item({ type: 'custom_tool_call', name: 'apply_patch', input: '*** Begin Patch', call_id: 'call-2' }),
      item({ type: 'custom_tool_call_output', call_id: 'call-2', output: [{ type: 'input_text', text: 'Done' }] }),
      item({ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Tests pass.' }] }),
      event({ type: 'agent_message', message: 'Tests pass.' }),
      event({ type: 'item_completed', item: { content: [{ type: 'text', text: 'Tests pass.' }] } }),
      { timestamp: '2026-01-01T10:00:00Z', type: 'token_usage_record', payload: {} },
      item({ type: 'agent_message', author: 'lead', recipient: 'builder', content: [{ type: 'text', text: 'Ship it.' }] }),
      { timestamp: '2026-01-01T10:00:00Z', type: 'compacted', payload: { message: 'Earlier work summarised.' } },
    ), ID);
    expect(parsed.entries.map((entry) => [entry.kind, 'text' in entry ? entry.text : ''])).toEqual([
      ['turn', 'Run the tests.'],
      ['reasoning', 'Use the focused suite.'],
      ['tool-call', '{\n  "command": [\n    "npm",\n    "test"\n  ]\n}'],
      ['tool-result', '2 passed'],
      ['tool-call', '*** Begin Patch'],
      ['tool-result', 'Done'],
      ['turn', 'Tests pass.'],
      ['turn', 'Ship it.'],
      ['note', 'Earlier work summarised.'],
    ]);
    expect(parsed.entries.filter((entry) => entry.kind === 'tool-result').map((entry) => entry.kind === 'tool-result' && entry.name)).toEqual(['shell', 'apply_patch']);
    expect(parsed.entries[7]).toMatchObject({ role: 'agent', label: 'lead → builder' });
    expect(Object.fromEntries(parsed.notShown)).toEqual({
      session_meta: 1, 'event_msg user_message': 1, 'event_msg agent_message': 1, 'event_msg item_completed': 1, token_usage_record: 1,
    });
  });

  it('keeps unknown items raw and refuses a session_meta for another conversation', () => {
    const parsed = parseCodexRecord(lines(item({ type: 'future_item', value: 1 }), { type: 'future_line' }, 'not json'), ID);
    expect(parsed.entries.map((entry) => entry.kind === 'raw' && entry.type)).toEqual(['response_item future_item', 'future_line']);
    expect(parsed.malformed).toBe(1);
    expect(() => parseCodexRecord(lines({ type: 'session_meta', payload: { id: 'conversation-other-2' } }), ID)).toThrow('another conversation');
  });
});

describe('record lines and pages', () => {
  it('separates a cut start and an unfinished end from malformed lines', () => {
    const bytes = Buffer.from('ut line"}\n{"a":1}\n\n{"b":2}\n{"c":');
    expect(recordLines(bytes, 1000, false)).toEqual({
      lines: [{ text: '{"a":1}', offset: 1010, end: 1018 }, { text: '{"b":2}', offset: 1019, end: 1027 }], firstLineOffset: 1010,
      cutStart: true, incompleteEnd: true, oversized: 0, invalidText: 0,
    });
    expect(recordLines(Buffer.from('{"a":1}\n'), 0, true)).toMatchObject({ lines: [{ text: '{"a":1}', offset: 0, end: 8 }], firstLineOffset: 0, cutStart: false, incompleteEnd: false });
  });

  it('counts oversized and invalid UTF-8 lines without parsing them', () => {
    const big = Buffer.alloc(RECORD_LINE_MAX_BYTES + 1, 0x61);
    const bytes = Buffer.concat([big, Buffer.from('\n'), Buffer.from([0xff, 0xfe, 0x0a]), Buffer.from('{"a":1}\n')]);
    expect(recordLines(bytes, 0, true)).toMatchObject({ lines: [{ text: '{"a":1}' }], oversized: 1, invalidText: 1 });
  });

  it('keeps the newest entries, says whether the range covers the whole record, and bounds text', () => {
    const content = Array.from({ length: 5 }, (_, index) => `${JSON.stringify({ type: 'user', sessionId: ID, message: { role: 'user', content: `turn ${index}` } })}\n`).join('');
    const window = { path: '/records/example.jsonl', runtime: 'claude-code', conversationId: ID, bytes: Buffer.from(content), start: 0, end: content.length,
      startsAtLine: true, fileSizeBytes: content.length, pin: { boundary: content.length }, observedAt: '2026-01-01T11:00:00Z' } as unknown as RecordWindow;
    const page = recordPage(window, 2);
    expect(page).toMatchObject({ parsedEntries: 5, complete: true, latest: true, malformed: 0 });
    expect(recordPage({ ...window, end: content.length - 1 }, 2).latest).toBe(false);
    expect(page.entries.map((entry) => entry.kind === 'turn' && entry.text)).toEqual(['turn 3', 'turn 4']);
    expect(recordPage({ ...window, start: 10 }, 2).complete).toBe(false);
    expect(boundedText('x'.repeat(RECORD_ENTRY_TEXT_MAX + 5))).toMatchObject({ omitted: 5 });
  });
});
