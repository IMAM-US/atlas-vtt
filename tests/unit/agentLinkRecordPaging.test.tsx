import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { readRecordWindow, RECORD_WINDOW_MAX } from '../../src/app/agent-links/native/recordWindow';
import { RecordViewContent, type RecordSources } from '../../src/app/agent-links/records/RecordViewContent';
import { RECORD_ENTRY_MAX } from '../../src/app/agent-links/records/recordEntries';

const roots: string[] = [];
afterEach(async () => {
  cleanup();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const ID = 'conversation-example-1';
const identity = { sourceKey: 'local', runtime: 'claude-code' as const, conversationId: ID, cwd: '/work/example', seatCaption: 'Build A' };

/** The real reader over a synthetic record: one earlier turn, then one complete line of `bytes` bytes of attachment data. */
async function recordWithLongLine(bytes: number): Promise<{ sources: RecordSources; read: ReturnType<typeof vi.fn> }> {
  const root = await mkdtemp(join(tmpdir(), 'atlas-record-paging-'));
  roots.push(root);
  await mkdir(join(root, '-work-example'));
  const turn = `${JSON.stringify({ type: 'user', sessionId: ID, message: { role: 'user', content: 'the earlier turn' } })}\n`;
  const attachment = `${JSON.stringify({ type: 'attachment', sessionId: ID, data: 'x'.repeat(bytes) })}\n`;
  await writeFile(join(root, '-work-example', `${ID}.jsonl`), turn + attachment);
  const providerRoots = { claudeProjectsRoot: root, codexSessionsRoot: root };
  const read = vi.fn((_sourceKey: string, location: Parameters<typeof readRecordWindow>[1], options: Parameters<typeof readRecordWindow>[2]) => readRecordWindow(providerRoots, location, options));
  return { sources: { readRecordWindow: read, revealConversationRecord: vi.fn(), watchSource: () => () => undefined } as unknown as RecordSources, read };
}

/** Presses *Load earlier* until the earlier turn shows, at most `limit` times. */
async function loadUntilEarlierTurn(limit: number): Promise<number> {
  for (let presses = 0; presses < limit; presses++) {
    if (screen.queryByText('the earlier turn')) return presses;
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Load earlier' })));
    await waitFor(() => expect(screen.queryByText('Reading…')).toBeNull());
  }
  return screen.queryByText('the earlier turn') ? limit : -1;
}

describe('reading back past long lines', () => {
  it('reaches an earlier turn behind one oversized complete line, growing the range by what it shows', async () => {
    const { sources, read } = await recordWithLongLine(8 * 1024 * 1024);
    render(<RecordViewContent identity={identity} sources={sources} />);
    await waitFor(() => expect(screen.queryByText('Reading…')).toBeNull());
    expect(await loadUntilEarlierTurn(8)).toBeGreaterThan(0);
    expect(screen.getByText('1 line over 1.0 MB not shown.')).toBeTruthy();
    const options = read.mock.calls.map((call) => call[2] as { windowBytes: number; end?: number });
    expect(options.every((option) => option.windowBytes <= RECORD_WINDOW_MAX)).toBe(true);
  });

  it('pages back inside a line longer than one read until the earlier turn shows', async () => {
    const { sources, read } = await recordWithLongLine(RECORD_WINDOW_MAX + 1024 * 1024);
    const { container } = render(<RecordViewContent identity={identity} sources={sources} />);
    await waitFor(() => expect(screen.queryByText('Reading…')).toBeNull());
    expect(await loadUntilEarlierTurn(12)).toBeGreaterThan(0);
    const options = read.mock.calls.map((call) => call[2] as { windowBytes: number; end?: number });
    expect(options.some((option) => option.end !== undefined)).toBe(true);
    expect(options.every((option) => option.windowBytes <= RECORD_WINDOW_MAX)).toBe(true);
    expect(container.querySelectorAll('.atlas-record-entry').length).toBeLessThanOrEqual(RECORD_ENTRY_MAX);
    expect(screen.getByText(/^Showing entries from a bounded earlier range/)).toBeTruthy();
  });
});
