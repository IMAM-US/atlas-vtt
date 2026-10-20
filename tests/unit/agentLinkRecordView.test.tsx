import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RECORD_WINDOW_STEP, type RecordPin, type RecordWindow } from '../../src/app/agent-links/native/recordWindow';
import { RecordViewContent, type RecordSources } from '../../src/app/agent-links/records/RecordViewContent';
import { recordViewIdentity, type RecordViewIdentity } from '../../src/app/agent-links/records/recordViewState';

afterEach(cleanup);

const ID = 'conversation-example-1';
const identity: RecordViewIdentity = { sourceKey: 'local', runtime: 'claude-code', conversationId: ID, cwd: '/work/example', seatCaption: 'Build A' };
const pin = (shownStart: number): RecordPin => ({ identity: { dev: 1, ino: 2 }, boundary: 4096, prefixLength: 10, prefixSha256: 'a', shownStart, shownSha256: 'b' });

const turn = (text: string, sessionId = ID): string => JSON.stringify({ type: 'user', sessionId, timestamp: '2026-01-01T10:00:00Z', message: { role: 'user', content: text } });

function windowOf(lines: string[], start: number, end = 4096, fileSizeBytes = end): RecordWindow {
  return {
    path: '/records/-work-example/conversation-example-1.jsonl', runtime: 'claude-code', conversationId: ID,
    bytes: Buffer.from(lines.map((line) => `${line}\n`).join('')), start, end, startsAtLine: true, fileSizeBytes,
    pin: pin(start), observedAt: '2026-01-01T11:00:00Z',
  };
}

/** Reads stay pending until the test answers them, so ordering and cancellation are visible. */
function deferredSources(): { sources: RecordSources; reads: Array<{ options: { windowBytes: number; pin?: RecordPin | null; signal?: AbortSignal }; answer: (window: RecordWindow) => void }>; reveal: ReturnType<typeof vi.fn> } {
  const reads: Array<{ options: { windowBytes: number; pin?: RecordPin | null; signal?: AbortSignal }; answer: (window: RecordWindow) => void }> = [];
  const reveal = vi.fn(async () => 'Finder');
  const sources = {
    readRecordWindow: (_sourceKey: string, _location: unknown, options: { windowBytes: number; pin?: RecordPin | null; signal?: AbortSignal }) =>
      new Promise<RecordWindow>((resolve) => reads.push({ options, answer: resolve })),
    revealConversationRecord: reveal,
  } as unknown as RecordSources;
  return { sources, reads, reveal };
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
    expect(native.reads[1]!.options).toMatchObject({ windowBytes: 2 * RECORD_WINDOW_STEP, pin: pin(1024 * 1024) });
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
