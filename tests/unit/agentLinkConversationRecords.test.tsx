import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SeatSubject } from '../../src/app/agent-links/account/accountSchema';
import { CardContext, type CardContextValue } from '../../src/app/agent-links/card/cardContext';
import { ConversationRecords } from '../../src/app/agent-links/card/ConversationRecords';
import type { NativeSources } from '../../src/app/agent-links/NativeSources';
import type { ConversationRecord, CurrentSeat } from '../../src/app/agent-links/reads';
import { TooltipProvider } from '../../src/app/packages/components/primitives/tooltip';

afterEach(cleanup);

const MAP = 'map00001-conversation';
const FIRST = 'first001-conversation';
const SECOND = 'second01-conversation';

const subject: SeatSubject = {
  id: 'seat:code.example', kind: 'seat', caption: 'code.example', sourceKey: 'local',
  seat: { rigId: 'rig-1', nodeId: 'node-1', logicalId: 'code.example' },
  participant: { runtime: 'claude-code', conversationId: MAP, observedAt: '2026-01-01T10:00:00Z' },
  policy: 'current-seat', workIds: [], observedAt: '2026-01-01T10:00:00Z',
};

/** Only the fields the record rows read; the seat itself is not under test. */
function seatWith(conversationId: string): CurrentSeat {
  return { state: 'current', participant: { runtime: 'claude-code', conversationId }, cwd: '/work' } as unknown as CurrentSeat;
}

/** A validated record whose checked count names its conversation, so a row shows whose record it holds. */
function recordOf(conversationId: string, validatedRecords: number): ConversationRecord {
  return {
    state: 'current', observedAt: '2026-01-01T11:00:00Z',
    record: { path: `/records/${conversationId}.jsonl`, runtime: 'claude-code', conversationId, validatedRecords, fileSizeBytes: 2048, complete: false },
  } as unknown as ConversationRecord;
}

/** Locate calls stay pending until the test answers them, in any order. */
function deferredSources(): { sources: NativeSources; locate: ReturnType<typeof vi.fn>; open: ReturnType<typeof vi.fn>; answer: (conversationId: string, read: ConversationRecord) => void } {
  const pending = new Map<string, (read: ConversationRecord) => void>();
  const locate = vi.fn((_sourceKey: string, participant: { conversationId: string }) => new Promise<ConversationRecord>((resolve) => pending.set(participant.conversationId, resolve)));
  const open = vi.fn(async () => ({ state: 'revealed', reason: 'Failed to open path', shownIn: 'Finder' }));
  const answer = (conversationId: string, read: ConversationRecord): void => {
    const resolve = pending.get(conversationId);
    if (!resolve) throw new Error(`no pending read for ${conversationId}`);
    pending.delete(conversationId);
    resolve(read);
  };
  return { sources: { locateRecord: locate, openConversationRecord: open } as unknown as NativeSources, locate, open, answer };
}

function Records({ sources, current }: { sources: NativeSources; current: CurrentSeat }): React.ReactElement {
  const value = { app: {}, sources, loaded: {}, openSubject: () => undefined } as unknown as CardContextValue;
  return <TooltipProvider><CardContext.Provider value={value}>
    <ConversationRecords subject={subject} current={current} changed pinnedElsewhere={false} startAction={() => new AbortController().signal} />
  </CardContext.Provider></TooltipProvider>;
}

const rowOf = (label: string): HTMLElement => screen.getByRole('button', { name: label }).closest('.agent-link-row') as HTMLElement;
const detailIn = (label: string): string | null => within(rowOf(label)).queryByText(/Exact provider record/)?.textContent ?? null;

describe('conversation record rows', () => {
  it("keeps the map's previous record and its opener in the previous row", async () => {
    const native = deferredSources();
    render(<Records sources={native.sources} current={seatWith(FIRST)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous conversation record' }));
    expect(native.locate).toHaveBeenLastCalledWith('local', expect.objectContaining({ conversationId: MAP }), expect.anything());
    await act(async () => native.answer(MAP, recordOf(MAP, 33)));
    expect(detailIn('Previous conversation record')).toContain('33 records checked');
    expect(detailIn('Current conversation record')).toBeNull();

    fireEvent.click(within(rowOf('Previous conversation record')).getByRole('button', { name: 'Open record' }));
    await act(async () => undefined);
    expect(native.open).toHaveBeenCalledWith('local', expect.objectContaining({ conversationId: MAP }), expect.anything());
    expect(within(rowOf('Previous conversation record')).getByText("Couldn't open the record (Failed to open path). Shown in Finder.")).toBeTruthy();
    expect(within(rowOf('Current conversation record')).queryByText(/Shown in Finder/)).toBeNull();
  });

  it('shows no earlier occupant\'s record once the current identity changes', async () => {
    const native = deferredSources();
    const { rerender } = render(<Records sources={native.sources} current={seatWith(FIRST)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Current conversation record' }));
    await act(async () => native.answer(FIRST, recordOf(FIRST, 7)));
    expect(detailIn('Current conversation record')).toContain('7 records checked');

    rerender(<Records sources={native.sources} current={seatWith(SECOND)} />);
    expect(detailIn('Current conversation record')).toBeNull();
    expect(within(rowOf('Current conversation record')).getByText(/second01/)).toBeTruthy();
    expect(within(rowOf('Current conversation record')).queryByRole('button', { name: /Copy native route/ })).toBeNull();
  });

  it('discards a read that completes after the current identity changed, and opens the identity the row names', async () => {
    const native = deferredSources();
    const { rerender } = render(<Records sources={native.sources} current={seatWith(FIRST)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Current conversation record' }));
    rerender(<Records sources={native.sources} current={seatWith(SECOND)} />);
    await act(async () => native.answer(FIRST, recordOf(FIRST, 7)));
    expect(detailIn('Current conversation record')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Current conversation record' }));
    expect(native.locate).toHaveBeenLastCalledWith('local', expect.objectContaining({ conversationId: SECOND }), expect.anything());
    await act(async () => native.answer(SECOND, recordOf(SECOND, 12)));
    expect(detailIn('Current conversation record')).toContain('12 records checked');
    fireEvent.click(within(rowOf('Current conversation record')).getByRole('button', { name: 'Open record' }));
    await act(async () => undefined);
    expect(native.open).toHaveBeenCalledTimes(1);
    expect(native.open).toHaveBeenCalledWith('local', expect.objectContaining({ conversationId: SECOND }), expect.anything());
  });
});
