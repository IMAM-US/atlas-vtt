import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { AccountDocument, AccountWork, GroupSubject, SeatSubject } from '../../src/app/agent-links/account/accountSchema';
import { CardContext, type CardContextValue } from '../../src/app/agent-links/card/cardContext';
import { GroupCard } from '../../src/app/agent-links/card/GroupCard';
import { SeatCard } from '../../src/app/agent-links/card/SeatCard';
import { SeatSubscription } from '../../src/app/agent-links/live/SeatSubscription';
import { LiveSources } from '../../src/app/agent-links/live/LiveSources';
import type { NativeSources } from '../../src/app/agent-links/NativeSources';
import type { NativeEvent } from '../../src/app/agent-links/live/types';
import { defaultSourceSettings } from '../../src/app/agent-links/sourceSettings';
import type { CurrentSeat, LoadedAccount, OwnedWork } from '../../src/app/agent-links/reads';
import { TooltipProvider } from '../../src/app/packages/components/primitives/tooltip';

const transport = vi.hoisted(() => ({ seq: 10, event: null as null | ((event: NativeEvent) => void), lost: null as null | ((error: Error) => void), close: vi.fn() }));
const inventory = vi.hoisted(() => ({ display: 'working' }));
vi.mock('timers', () => { const timers = { setTimeout: (callback: () => void, ms: number) => globalThis.setTimeout(callback, ms), clearTimeout: (timer: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(timer) }; return { ...timers, default: timers }; });
vi.mock('../../src/app/agent-links/live/openRigEvents', () => ({
  readFrontier: vi.fn(async () => ({ hostId: 'host-a', bootEpoch: 'boot-a', seq: String(transport.seq) })),
  subscribeOpenRig: vi.fn(async (_source, _frontier, _signal, event, lost) => { transport.event = event; transport.lost = lost; return { close: transport.close }; }),
}));
vi.mock('../../src/app/agent-links/native/httpRead', () => ({ readNativeJson: vi.fn(async () => [{ rigId: 'rig-a', nodeId: 'node-a', hostSelfId: 'host-a', activityState: { display: inventory.display } }]) }));
const subject: SeatSubject = { id: 'builder', kind: 'seat', caption: 'Builder', sourceKey: 'a', policy: 'current-seat', workIds: [], observedAt: '2026-01-01T10:00:00Z',
  seat: { rigId: 'rig-a', nodeId: 'node-a', logicalId: 'team.builder' }, participant: { runtime: 'codex', conversationId: 'map-conversation', observedAt: '2026-01-01T10:00:00Z' } };
const settings = { ...defaultSourceSettings('a'), openRigEndpoint: 'http://127.0.0.1:1', openRigHostId: 'host-a' };
function seat(pid: number, exact = false): CurrentSeat {
  const process = { runtime: 'codex', sessionName: 'builder@example', bindingId: `binding-${pid}`, tmuxPane: '%1', processId: pid };
  return { state: 'current', node: {}, process, participant: exact ? { ...process, conversationId: 'current-conversation', recordGeneration: 'generation-a' } : null,
    participantMessage: null, cwd: null, observedAt: new Date().toISOString() };
}
function fixture(): { sources: NativeSources; registry: LiveSources; process: ReturnType<typeof vi.fn>; exact: ReturnType<typeof vi.fn>; owned: ReturnType<typeof vi.fn> } {
  const process = vi.fn(async () => seat(10)), exact = vi.fn(async () => seat(10, true));
  const owned = vi.fn(async (): Promise<OwnedWork> => ({ state: 'current', items: [], truncated: false, sessionName: 'builder@example', observedAt: new Date().toISOString() }));
  const registry = new LiveSources(() => ({ settings, backend: { readSeat: process, readOwned: owned,
    readWork: async () => { throw new Error('No map work'); } } }));
  return { registry, process, exact, owned, sources: { live: registry, readSeat: exact, source: () => settings, pinnedConversationProblem: () => null } as unknown as NativeSources };
}
function Card({ sources, selected = subject }: { sources: NativeSources; selected?: SeatSubject }): React.ReactElement {
  const account = { capturedAt: '2026-01-01T10:00:00Z', subjects: [selected], sources: [], work: [], artifacts: [] } as unknown as AccountDocument;
  const value = { app: {}, sources, loaded: { account, path: 'synthetic.account.json', sha256: 'synthetic' } as LoadedAccount, openSubject: vi.fn() } as unknown as CardContextValue;
  return <TooltipProvider><CardContext.Provider value={value}><SeatCard subject={selected} /></CardContext.Provider></TooltipProvider>;
}
const settle = async (ms = 300): Promise<void> => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const emit = async (type: string): Promise<void> => { await act(async () => { transport.event?.({ type, seq: ++transport.seq }); }); await settle(); };
afterEach(() => { cleanup(); vi.useRealTimers(); transport.seq = 10; transport.close.mockClear(); inventory.display = 'working'; });

it('updates the open card from native invalidations, keeps one exact opening read, and closes the last subscriber', async () => {
  vi.useFakeTimers();
  const f = fixture();
  const view = render(<Card sources={f.sources} />); await settle();
  expect(f.exact).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/map's conversation is previous/)).toBeTruthy();
  expect(screen.getByText(/working · Live/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Recheck conversation' })).toBeNull();
  view.rerender(<Card sources={f.sources} selected={{ ...subject }} />); await settle();
  inventory.display = 'idle'; await emit('seat.activity_changed');
  expect(screen.getByText(/idle · Live/)).toBeTruthy();
  f.owned.mockResolvedValue({ state: 'current', items: [{ qitemId: 'new-work', summary: 'New native work', state: 'in-progress' }], truncated: true, sessionName: 'builder@example', observedAt: new Date().toISOString() });
  await emit('queue.updated');
  expect(screen.getByText(/New native work · in-progress/)).toBeTruthy();
  expect(screen.getByText('1+ owned')).toBeTruthy();
  expect(f.exact).toHaveBeenCalledTimes(1);
  await act(async () => transport.lost?.(new Error('Socket closed')));
  expect(screen.getAllByText(/Last known/).length).toBeGreaterThan(0);
  await settle(800);
  expect(f.exact).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Recheck conversation' })).toBeTruthy();
  view.unmount();
  expect(f.registry.openRig('a').getConnection().status).toBe('closed');
  expect(transport.close).toHaveBeenCalledTimes(2);
  f.registry.dispose();
});

it('shows changed process as historical, never an exact successor until an explicit recheck', async () => {
  vi.useFakeTimers(); const f = fixture(); render(<Card sources={f.sources} />); await settle();
  f.process.mockResolvedValue(seat(20));
  await emit('binding.changed');
  expect(screen.getByText(/Seat changed since/)).toBeTruthy();
  expect(screen.queryByText(/historical read/)).toBeNull();
  expect(screen.queryByText('Exact conversation needs rechecking.')).toBeNull();
  expect(f.exact).toHaveBeenCalledTimes(1);
  f.exact.mockResolvedValue(seat(20, true));
  fireEvent.click(screen.getByRole('button', { name: 'Recheck conversation' })); await settle();
  expect(f.exact).toHaveBeenCalledTimes(2);
  expect(screen.queryByText(/Seat changed since/)).toBeNull();
  cleanup(); f.registry.dispose();
});

it('discards old exact observations on source settings replacement without another provider read', async () => {
  vi.useFakeTimers(); const f = fixture(); render(<Card sources={f.sources} />); await settle();
  expect(f.exact).toHaveBeenCalledTimes(1);
  await act(async () => { settings.allowedRoots = ['/synthetic/new-root']; f.registry.settingsChanged(); });
  await settle();
  expect(f.exact).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/Exact conversation · Read/)).toBeNull();
  expect(screen.getByRole('button', { name: 'Recheck conversation' })).toBeTruthy();
  cleanup(); f.registry.dispose(); settings.allowedRoots = [];
});

it('shares member oracle/custody reads and omits unknown activity and Live timestamps in the group', async () => {
  vi.useFakeTimers(); const f = fixture(); inventory.display = 'unknown';
  const group: GroupSubject = { id: 'group-a', kind: 'group', caption: 'Panel', purpose: 'Consultation', members: [{ subjectId: subject.id, lens: 'Source' }],
    membership: { basis: 'authored', observedAt: subject.observedAt }, observedAt: subject.observedAt };
  const account = { capturedAt: subject.observedAt, subjects: [subject, group], sources: [], work: [], artifacts: [] } as unknown as AccountDocument;
  const value = { app: {}, sources: f.sources, loaded: { account, path: 'synthetic.account.json', sha256: 'synthetic' }, openSubject: vi.fn() } as unknown as CardContextValue;
  const view = render(<TooltipProvider><CardContext.Provider value={value}><GroupCard subject={group} /></CardContext.Provider></TooltipProvider>);
  await settle();
  expect(f.exact).not.toHaveBeenCalled();
  expect(f.process).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/team.builder · owns 0 rows/)).toBeTruthy();
  expect(screen.queryByText(/unknown|Activity not confirmed|Live \d/)).toBeNull();
  inventory.display = 'working'; await emit('seat.activity_changed');
  expect(screen.getByText(/team.builder · working · owns 0 rows/)).toBeTruthy();
  expect(f.exact).not.toHaveBeenCalled();
  view.unmount(); expect(f.registry.openRig('a').getConnection().status).toBe('closed'); f.registry.dispose();
});

it('aborts a pending opening read when the selected subject changes and discards its late result', async () => {
  vi.useFakeTimers(); const f = fixture();
  let answer!: (seat: CurrentSeat) => void;
  f.exact.mockImplementationOnce(async () => new Promise<CurrentSeat>((resolve) => { answer = resolve; }));
  const view = render(<Card sources={f.sources} />); await settle();
  const oldSignal = f.exact.mock.calls[0]![1].signal as AbortSignal;
  const replacement = { ...subject, id: 'other-builder', seat: { ...subject.seat, nodeId: 'node-b' } };
  view.rerender(<Card sources={f.sources} selected={replacement} />); await settle();
  expect(oldSignal.aborted).toBe(true);
  const old = seat(99, true); old.participant!.conversationId = 'late-old-conversation';
  await act(async () => answer(old));
  fireEvent.click(screen.getByRole('button', { name: /Sources/ }));
  expect(screen.queryByText(/late-old-conversation/)).toBeNull();
  expect(f.exact).toHaveBeenCalledTimes(2);
  view.unmount(); f.registry.dispose();
});

it('releases partial selector acquisition when the bounded cache refuses an oversized card', async () => {
  vi.useFakeTimers(); const f = fixture();
  const work = Array.from({ length: 260 }, (_, index) => ({ id: `work-${index}`, sourceKey: 'a', qitemId: `native-work-${index}` })) as AccountWork[];
  expect(() => new SeatSubscription(f.registry, subject, work, f.exact)).toThrow('Too many native observations');
  await settle();
  expect(f.registry.openRig('a').getConnection().status).toBe('closed');
  expect(f.exact).not.toHaveBeenCalled();
  f.registry.dispose();
});
