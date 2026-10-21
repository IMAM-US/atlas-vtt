import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RECORD_WINDOW_STEP, type RecordPin, type RecordWindow } from '../../src/app/agent-links/native/recordWindow';
import { RecordViewContent, type RecordSources } from '../../src/app/agent-links/records/RecordViewContent';
import { recordViewIdentity, type RecordViewIdentity } from '../../src/app/agent-links/records/recordViewState';

afterEach(cleanup);

const ID = 'conversation-example-1';
const identity: RecordViewIdentity = { sourceKey: 'local', runtime: 'claude-code', conversationId: ID, cwd: '/work/example', seatCaption: 'Build A' };
const pin = (boundary = 4096): RecordPin => ({ identity: { dev: 1, ino: 2 }, boundary, prefixLength: 10, prefixSha256: 'a', shown: new Map() });
/** The pin a later read gets back: the read's pin, with the lines the view showed added. */
const samePin = (boundary: number): unknown => expect.objectContaining({ identity: { dev: 1, ino: 2 }, boundary, prefixSha256: 'a' });

const turn = (text: string, sessionId = ID): string => JSON.stringify({ type: 'user', sessionId, timestamp: '2026-01-01T10:00:00Z', message: { role: 'user', content: text } });

function windowOf(lines: string[], start: number, end = 4096, fileSizeBytes = end): RecordWindow {
  return {
    path: '/records/-work-example/conversation-example-1.jsonl', runtime: 'claude-code', conversationId: ID,
    bytes: Buffer.from(lines.map((line) => `${line}\n`).join('')), start, end, startsAtLine: true, fileSizeBytes,
    pin: pin(end), observedAt: '2026-01-01T11:00:00Z',
  };
}

/** Reads stay pending until the test answers them, so ordering and cancellation are visible. */
interface ReadOptions { windowBytes: number; pin?: RecordPin | null; end?: number; signal?: AbortSignal }

function deferredSources(): { sources: RecordSources; reads: Array<{ options: ReadOptions; answer: (window: RecordWindow) => void }>; reveal: ReturnType<typeof vi.fn>; changeSettings: () => void } {
  const reads: Array<{ options: ReadOptions; answer: (window: RecordWindow) => void }> = [];
  const reveal = vi.fn(async () => 'Finder');
  const watchers = new Set<() => void>();
  const sources = {
    readRecordWindow: (_sourceKey: string, _location: unknown, options: ReadOptions) =>
      new Promise<RecordWindow>((resolve) => reads.push({ options, answer: resolve })),
    revealConversationRecord: reveal,
    watchSource: (_sourceKey: string, changed: () => void) => { watchers.add(changed); return () => watchers.delete(changed); },
  } as unknown as RecordSources;
  return { sources, reads, reveal, changeSettings: () => watchers.forEach((changed) => changed()) };
}

describe('the conversation record view', () => {
  it('shows the exact identity and says a bounded range is bounded', async () => {
    const native = deferredSources();
    render(<RecordViewContent identity={identity} sources={native.sources} />);
    expect(screen.getByText('Reading…')).toBeTruthy();
    expect(native.reads[0]!.options).toMatchObject({ windowBytes: RECORD_WINDOW_STEP, pin: null });
    await act(async () => native.reads[0]!.answer(windowOf([turn('first'), turn('second')], 1024 * 1024, 3 * 1024 * 1024)));
    expect(screen.getByText(ID)).toBeTruthy();
    expect(screen.getByText('/records/-work-example/conversation-example-1.jsonl')).toBeTruthy();
    expect(screen.getByText('Read 11:00Z')).toBeTruthy();
    expect(screen.getByText('2 entries from the last 2.0 MB of 3.0 MB')).toBeTruthy();
    expect(screen.queryByText(/^All /)).toBeNull();
  });

  it('renders record text inertly: no markup, embeds, links or images', async () => {
    const native = deferredSources();
    const { container } = render(<RecordViewContent identity={identity} sources={native.sources} />);
    const hostile = '<img src=x onerror="alert(1)"><script>alert(2)</script> [[Private note]] ![[embed.png]] obsidian://open?vault=x https://example.com/a.png <a href="https://example.com">link</a>';
    await act(async () => native.reads[0]!.answer(windowOf([turn(hostile)], 0)));
    expect(screen.getByText('All 1 entry')).toBeTruthy();
    expect(container.querySelector('pre')?.textContent).toBe(hostile);
    expect(container.querySelectorAll('img, script, a, iframe').length).toBe(0);
  });

  it('reads earlier bytes with the same pin, and reloads with a new boundary', async () => {
    const native = deferredSources();
    render(<RecordViewContent identity={identity} sources={native.sources} />);
    await act(async () => native.reads[0]!.answer(windowOf([turn('latest')], 1024 * 1024)));
    fireEvent.click(screen.getByRole('button', { name: 'Load earlier' }));
    expect(native.reads[1]!.options).toMatchObject({ windowBytes: 2 * RECORD_WINDOW_STEP, pin: samePin(4096) });
    expect((native.reads[1]!.options.pin!).shown.size).toBe(1);
    expect(native.reads[1]!.options.end).toBeUndefined();
    await act(async () => native.reads[1]!.answer(windowOf([turn('earlier'), turn('latest')], 0, 4096, 9000)));
    expect(screen.getByText('All 2 entries')).toBeTruthy();
    expect(screen.getByText('The record has grown by 5 KB since this read. Reload to read it.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Load earlier' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(native.reads[2]!.options).toMatchObject({ windowBytes: RECORD_WINDOW_STEP, pin: null });
  });

  it('shows the record in Finder only through a fresh validation of that identity', async () => {
    const native = deferredSources();
    render(<RecordViewContent identity={identity} sources={native.sources} />);
    await act(async () => native.reads[0]!.answer(windowOf([turn('x')], 0)));
    fireEvent.click(screen.getByRole('button', { name: /^Show in / }));
    await act(async () => undefined);
    expect(native.reveal).toHaveBeenCalledWith('local', { runtime: 'claude-code', conversationId: ID, cwd: '/work/example' }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(screen.getByText('Shown in Finder.')).toBeTruthy();
  });

  it('cancels a pending read when the view closes and discards its late result', async () => {
    const native = deferredSources();
    const { unmount } = render(<RecordViewContent identity={identity} sources={native.sources} />);
    const pending = native.reads[0]!;
    unmount();
    expect(pending.options.signal?.aborted).toBe(true);
    await act(async () => pending.answer(windowOf([turn('late')], 0)));
    expect(screen.queryByText('late')).toBeNull();
  });

  it('drops a pending read and the record when the source settings change, and waits for Reload', async () => {
    const native = deferredSources();
    render(<RecordViewContent identity={identity} sources={native.sources} />);
    const pending = native.reads[0]!;
    act(() => native.changeSettings());
    expect(pending.options.signal?.aborted).toBe(true);
    await act(async () => pending.answer(windowOf([turn('read with the old settings')], 0)));
    expect(screen.queryByText('read with the old settings')).toBeNull();
    expect(screen.getByText('The source settings changed. Reload to read the record with them.')).toBeTruthy();
    expect(native.reads).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(native.reads[1]!.options).toMatchObject({ windowBytes: RECORD_WINDOW_STEP, pin: null });
  });

  it('never renders more than the entry cap and pages back past it, then returns to the latest entries', async () => {
    const native = deferredSources();
    const { container } = render(<RecordViewContent identity={identity} sources={native.sources} />);
    const lines = Array.from({ length: 1000 }, (_, index) => `${turn(`entry ${index}`)}\n`);
    const all = lines.join('');
    const offsets = [...lines, ''].map((_, index) => lines.slice(0, index).join('').length);
    const answer = async (index: number): Promise<void> => {
      const end = native.reads[index]!.options.end ?? all.length;
      const window = { ...windowOf([], 0, end), bytes: Buffer.from(all.slice(0, end)), pin: pin(all.length) };
      await act(async () => native.reads[index]!.answer(window));
    };
    const rendered = (): number => container.querySelectorAll('.atlas-record-entry').length;
    await answer(0);
    expect(rendered()).toBe(200);
    for (const index of [1, 2]) {
      fireEvent.click(screen.getByRole('button', { name: 'Load earlier' }));
      await answer(index);
    }
    expect(rendered()).toBe(600);
    expect(screen.getByText(/At most 600 entries are shown at once/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Load earlier' }));
    expect(native.reads[3]!.options.end).toBe(offsets[801]);
    await answer(3);
    expect(rendered()).toBe(600);
    expect(screen.getByText('entry 200')).toBeTruthy();
    expect(screen.queryByText('entry 800')).toBeNull();
    expect(screen.getByText(/^Showing entries from a bounded earlier range/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to latest' }));
    expect(native.reads[4]!.options).toMatchObject({ windowBytes: RECORD_WINDOW_STEP, pin: samePin(all.length) });
    expect(native.reads[4]!.options.end).toBeUndefined();
  });

  it('pages through every entry of one line that holds a thousand', async () => {
    const native = deferredSources();
    render(<RecordViewContent identity={identity} sources={native.sources} />);
    const blocks = Array.from({ length: 1000 }, (_, index) => ({ type: 'tool_use', id: `call-${index}`, name: `tool-${index}`, input: {} }));
    const line = JSON.stringify({ type: 'assistant', sessionId: ID, message: { role: 'assistant', content: blocks } });
    const answer = async (index: number): Promise<void> => {
      await act(async () => native.reads[index]!.answer({ ...windowOf([line], 0, line.length + 1), pin: pin(line.length + 1) }));
    };
    await answer(0);
    for (let click = 1; click <= 4; click++) {
      fireEvent.click(screen.getByRole('button', { name: 'Load earlier' }));
      await answer(click);
    }
    expect(native.reads[4]!.options.end).toBe(line.length + 1);
    // Four loads: 200, 400, 600, then two pages back to the first 600 of the line.
    expect(screen.getByText('Tool call · tool-0')).toBeTruthy();
    expect(screen.getByText('Tool call · tool-599')).toBeTruthy();
    expect(screen.queryByText('Tool call · tool-600')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Load earlier' })).toBeNull();
  });

  it('opens at the newest entry and keeps the reader in place when loading earlier entries', async () => {
    const native = deferredSources();
    const { container } = render(<RecordViewContent identity={identity} sources={native.sources} />);
    const view = container.querySelector<HTMLElement>('.atlas-record-view__scroller')!;
    let scrollTop = 0;
    Object.defineProperty(view, 'scrollHeight', { configurable: true, get: () => 5000 });
    Object.defineProperty(view, 'scrollTop', { configurable: true, get: () => scrollTop, set: (value: number) => { scrollTop = value; } });
    await act(async () => native.reads[0]!.answer(windowOf([turn('older'), turn('newest')], 1024 * 1024)));
    expect(scrollTop).toBe(5000);
    // Before the load the first entry sits 40px below the top; afterwards earlier entries above it push it to 640px.
    const tops = new Map<string, number>();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const top = this === view ? 0 : tops.get(this.dataset.entryKey ?? '') ?? 0;
      return { top, bottom: top, left: 0, right: 0, width: 0, height: 0, x: 0, y: top, toJSON: () => ({}) };
    });
    const firstKey = view.querySelector<HTMLElement>('[data-entry-key]')!.dataset.entryKey!;
    tops.set(firstKey, 40);
    scrollTop = 100;
    fireEvent.click(screen.getByRole('button', { name: 'Load earlier' }));
    tops.set(firstKey, 640);
    await act(async () => native.reads[1]!.answer(windowOf([turn('earlier'), turn('older'), turn('newest')], 1024 * 1024 - turn('earlier').length - 1)));
    expect(scrollTop).toBe(700);
    vi.restoreAllMocks();
  });

  it('keeps the header outside the entries\' scroller, with Load earlier at the top of the list, and leaves the read boundary and clock as they were', async () => {
    const native = deferredSources();
    const { container } = render(<RecordViewContent identity={identity} sources={native.sources} />);
    await act(async () => native.reads[0]!.answer(windowOf([turn('older'), turn('newest')], 1024 * 1024)));
    const scroller = container.querySelector<HTMLElement>('.atlas-record-view__scroller')!;
    for (const fixed of [screen.getByText(ID), screen.getByText('Read 11:00Z'), screen.getByRole('button', { name: 'Reload' }), screen.getByRole('button', { name: /^Show in / })]) {
      expect(scroller.contains(fixed)).toBe(false);
    }
    const entries = scroller.querySelector('.atlas-record-view__entries')!;
    expect(entries.firstElementChild?.textContent).toBe('Load earlier');
    fireEvent.click(screen.getByRole('button', { name: 'Load earlier' }));
    expect(native.reads[1]!.options).toMatchObject({ pin: samePin(4096) });
    await act(async () => native.reads[1]!.answer({ ...windowOf([turn('earlier'), turn('older'), turn('newest')], 1024 * 1024 - turn('earlier').length - 1), observedAt: '2026-01-01T11:05:00Z' }));
    expect(screen.getByText('Read 11:05Z')).toBeTruthy();
    expect(scroller.contains(screen.getByText('Read 11:05Z'))).toBe(false);
  });

  it('never moves focus itself: not on a late read, a reload or paging', async () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    const native = deferredSources();
    render(<RecordViewContent identity={identity} sources={native.sources} />);
    await act(async () => native.reads[0]!.answer(windowOf([turn('x')], 1024 * 1024)));
    fireEvent.click(screen.getByRole('button', { name: 'Load earlier' }));
    await act(async () => native.reads[1]!.answer(windowOf([turn('y'), turn('x')], 1024 * 1024 - turn('y').length - 1)));
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    await act(async () => native.reads[2]!.answer(windowOf([turn('x')], 1024 * 1024)));
    expect(focus).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('refuses a range that names another conversation instead of showing it', async () => {
    const native = deferredSources();
    render(<RecordViewContent identity={identity} sources={native.sources} />);
    await act(async () => native.reads[0]!.answer(windowOf([turn('mine'), turn('theirs', 'conversation-other-2')], 0)));
    expect(screen.getByText('This record names another conversation.')).toBeTruthy();
    expect(screen.queryByText('mine')).toBeNull();
  });
});

describe('the record view state', () => {
  it('keeps only the identity and refuses anything malformed', () => {
    expect(recordViewIdentity({ ...identity, text: 'record content', page: [1, 2] })).toEqual(identity);
    expect(recordViewIdentity({ ...identity, cwd: undefined })).toEqual({ ...identity, cwd: null });
    expect(recordViewIdentity({ ...identity, runtime: 'other' })).toBeNull();
    expect(recordViewIdentity({ ...identity, conversationId: '../escape' })).toBeNull();
    expect(recordViewIdentity({ ...identity, cwd: 'relative/path' })).toBeNull();
    expect(recordViewIdentity(null)).toBeNull();
  });
});
