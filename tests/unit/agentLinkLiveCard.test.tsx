import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { AccountDocument, AccountWork, GroupSubject, SeatSubject } from '../../src/app/agent-links/account/accountSchema';
import { CardContext, type CardContextValue } from '../../src/app/agent-links/card/cardContext';
import { WorkSection } from '../../src/app/agent-links/card/WorkSection';
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
const inventory = vi.hoisted(() => ({ display: 'working', failure: null as string | null }));
vi.mock('timers', () => { const timers = { setTimeout: (callback: () => void, ms: number) => globalThis.setTimeout(callback, ms), clearTimeout: (timer: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(timer) }; return { ...timers, default: timers }; });
vi.mock('../../src/app/agent-links/live/openRigEvents', () => ({
  readFrontier: vi.fn(async () => ({ hostId: 'host-a', bootEpoch: 'boot-a', seq: String(transport.seq) })),
  subscribeOpenRig: vi.fn(async (_source, _frontier, _signal, event, lost) => { transport.event = event; transport.lost = lost; return { close: transport.close }; }),
}));
vi.mock('../../src/app/agent-links/native/httpRead', () => ({ readNativeJson: vi.fn(async () => { if (inventory.failure) throw new Error(inventory.failure); return [{ rigId: 'rig-a', nodeId: 'node-a', hostSelfId: 'host-a', activityState: { display: inventory.display } }]; }) }));
const subject: SeatSubject = { id: 'builder', kind: 'seat', caption: 'Builder', sourceKey: 'a', policy: 'current-seat', workIds: [], observedAt: '2026-01-01T10:00:00Z',
  seat: { rigId: 'rig-a', nodeId: 'node-a', logicalId: 'team.builder' }, participant: { runtime: 'codex', conversationId: 'map-conversation', observedAt: '2026-01-01T10:00:00Z' } };
const settings = { ...defaultSourceSettings('a'), openRigEndpoint: 'http://127.0.0.1:1', openRigHostId: 'host-a' };
function seat(pid: number, exact = false): CurrentSeat {
  const process = { runtime: 'codex', sessionName: 'builder@example', bindingId: `binding-${pid}`, tmuxPane: '%1', processId: pid };
  return { state: 'current', node: {}, process, participant: exact ? { ...process, conversationId: 'current-conversation', recordGeneration: 'generation-a' } : null,
    participantMessage: null, cwd: null, observedAt: new Date().toISOString() };
}
function fixture(): { sources: NativeSources; registry: LiveSources; process: ReturnType<typeof vi.fn>; exact: ReturnType<typeof vi.fn>; owned: ReturnType<typeof vi.fn>; work: ReturnType<typeof vi.fn> } {
  const process = vi.fn(async () => seat(10)), exact = vi.fn(async () => seat(10, true));
  const owned = vi.fn(async (): Promise<OwnedWork> => ({ state: 'current', items: [], truncated: false, sessionName: 'builder@example', observedAt: new Date().toISOString() }));
  const work = vi.fn(async () => ({ state: 'unavailable', message: 'Not expanded', observedAt: new Date().toISOString() }));
  const registry = new LiveSources(() => ({ settings, backend: { readSeat: process, readOwned: owned,
    readWork: work } }));
  return { registry, process, exact, owned, work, sources: { live: registry, readSeat: exact, source: () => settings, pinnedConversationProblem: () => null,
    readScreen: vi.fn(async () => ({ state: 'unavailable', message: 'No screen in this test', observedAt: new Date().toISOString() })),
    resolveViews: vi.fn(async () => ({ state: 'unavailable', message: 'No view in this test', observedAt: new Date().toISOString() })) } as unknown as NativeSources };
}
function Card({ sources, selected = subject }: { sources: NativeSources; selected?: SeatSubject }): React.ReactElement {
  const account = { capturedAt: '2026-01-01T10:00:00Z', subjects: [selected], sources: [], work: [], artifacts: [] } as unknown as AccountDocument;
  const value = { app: {}, sources, loaded: { account, path: 'synthetic.account.json', sha256: 'synthetic' } as LoadedAccount, openSubject: vi.fn() } as unknown as CardContextValue;
  return <TooltipProvider><CardContext.Provider value={value}><SeatCard subject={selected} /></CardContext.Provider></TooltipProvider>;
}
const settle = async (ms = 300): Promise<void> => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const emit = async (type: string): Promise<void> => { await act(async () => { transport.event?.({ type, seq: ++transport.seq }); }); await settle(); };
afterEach(() => { cleanup(); vi.useRealTimers(); transport.seq = 10; transport.close.mockClear(); inventory.display = 'working'; inventory.failure = null; });

it('updates the open card from native invalidations, keeps one exact opening read, and closes the last subscriber', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
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
  vi.setSystemTime(new Date('2026-01-01T13:00:00Z'));
  await act(async () => transport.lost?.(new Error('Socket closed')));
  expect(screen.getAllByText(/Last known/).length).toBeGreaterThan(0);
  const headline = (): string => view.container.querySelector('.agent-link-headline')?.textContent ?? '';
  expect(headline()).toContain("New participant since the map (codex); the map's conversation is previous (read 12:00Z, needs rechecking)");
  await settle(800);
  expect(headline()).toContain('(read 12:00Z, needs rechecking)');
  expect(headline()).not.toContain('not qualified');
  expect(f.exact).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Recheck conversation' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Read screen' })); await settle();
  expect(f.sources.readScreen).toHaveBeenCalledWith(subject, expect.objectContaining({ participant: null }), expect.anything());
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
  fireEvent.click(screen.getByRole('button', { name: 'Show group tab' })); await settle();
  expect(f.exact).toHaveBeenCalledTimes(1);
  expect(f.sources.resolveViews).toHaveBeenCalledWith(subject, expect.objectContaining({ participant: expect.objectContaining({ conversationId: 'current-conversation' }) }), expect.anything());
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

it('shows Activity Refreshing before an inventory read, and deduplicates failed group facts without a zero-work claim', async () => {
  vi.useFakeTimers(); const f = fixture(); const view = render(<Card sources={f.sources} />);
  expect(screen.getByText('Activity · Refreshing…')).toBeTruthy();
  expect(screen.queryByText(/Activity not confirmed/)).toBeNull(); view.unmount();
  const group: GroupSubject = { id: 'group-a', kind: 'group', caption: 'Panel', purpose: 'Consultation', members: [{ subjectId: subject.id, lens: 'Source' }], membership: { basis: 'authored', observedAt: subject.observedAt }, observedAt: subject.observedAt };
  const account = { capturedAt: subject.observedAt, subjects: [subject, group], sources: [], work: [], artifacts: [] } as unknown as AccountDocument;
  const value = { app: {}, sources: f.sources, loaded: { account, path: 'synthetic.account.json', sha256: 'synthetic' }, openSubject: vi.fn() } as unknown as CardContextValue;
  render(<TooltipProvider><CardContext.Provider value={value}><GroupCard subject={group} /></CardContext.Provider></TooltipProvider>); await settle();
  expect(screen.getByText(/owns 0 rows/)).toBeTruthy();
  inventory.failure = 'Native seat missing.';
  f.process.mockResolvedValue({ state: 'unavailable', message: inventory.failure, observedAt: new Date().toISOString() });
  f.owned.mockResolvedValue({ state: 'unavailable', message: inventory.failure, observedAt: new Date().toISOString() });
  await emit('binding.changed');
  const detail = screen.getByText(/team.builder.*Last known/).textContent ?? '';
  expect(detail.match(/Native seat missing/g)).toHaveLength(1);
  expect(detail).not.toContain('owns');
  cleanup(); f.registry.dispose();
});

it('keeps native work event times and formats lazy deadline reads with the card clock', async () => {
  vi.useFakeTimers(); const f = fixture();
  f.owned.mockResolvedValue({ state: 'current', items: [{ qitemId: 'timed-work', summary: 'Timed work', state: 'in-progress', tsUpdated: '2026-10-20T21:20:00Z' }], truncated: false, sessionName: 'builder@example', observedAt: new Date().toISOString() });
  f.work.mockResolvedValue({ state: 'current', item: { state: 'blocked', waiting: { deadlineAt: '2026-10-21T19:28:00Z', nextBackstop: { dueAt: '2026-10-20T23:06:00Z', mechanism: 'watchdog' } } }, transitions: [], observedAt: '2026-10-20T22:41:00Z' });
  render(<Card sources={f.sources} />); await settle();
  expect(screen.getByText('Timed work · in-progress, updated 21:20Z')).toBeTruthy();
  expect(f.work).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Now' })); await settle();
  expect(screen.getByText('21 Oct 19:28Z · Read 22:41Z')).toBeTruthy();
  expect(screen.getByText('20 Oct 23:06Z (watchdog) · Read 22:41Z')).toBeTruthy();
  f.work.mockResolvedValue({ state: 'current', item: { state: 'blocked' }, transitions: [], observedAt: '2026-10-20T22:42:00Z' });
  await emit('queue.updated');
  expect(screen.queryByText('Closure due')).toBeNull(); expect(screen.queryByText('Backstop due')).toBeNull();
  cleanup(); f.registry.dispose();
});

it('labels the map work handoff time as an event rather than a read time', () => {
  const f = fixture();
  const work = { id: 'mapped', sourceKey: 'a', qitemId: 'mapped-native-work', caption: 'Mapped work', captured: { state: 'in-progress', observedAt: subject.observedAt } } as AccountWork;
  const account = { capturedAt: subject.observedAt, subjects: [subject], sources: [], work: [work], artifacts: [] } as unknown as AccountDocument;
  const value = { app: {}, sources: f.sources, loaded: { account }, openSubject: vi.fn() } as unknown as CardContextValue;
  const current = { state: 'current' as const, item: { state: 'done', handedOffTo: 'reviewer@example', tsUpdated: '2026-10-20T21:20:00Z' }, transitions: [], observedAt: '2026-10-20T22:00:00Z' };
  render(<TooltipProvider><CardContext.Provider value={value}><WorkSection subject={subject} owned={null} mapWork={[work]} liveMapWork={new Map([[work.id, current]])} /></CardContext.Provider></TooltipProvider>);
  expect(screen.getByText('Mapped work · handed off at 21:20Z')).toBeTruthy();
  cleanup(); f.registry.dispose();
});
