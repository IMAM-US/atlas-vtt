// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { fixture, owned, seat, subject } from '../fixtures/agentLinkLiveModel';
import { ObservationCache } from '../../src/app/agent-links/live/ObservationCache';
import { ConversationObservation } from '../../src/app/agent-links/live/ConversationObservation';
import type { OwnedWork, SeatRead } from '../../src/app/agent-links/reads';

vi.mock('timers', () => ({ setTimeout: (fn: () => void, ms: number) => globalThis.setTimeout(fn, ms), clearTimeout: (timer: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(timer) }));
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
function exactSeat(): SeatRead {
  const value = seat(10); if (value.state !== 'current') throw new Error('Expected process fixture');
  return { ...value, participant: { ...value.process, conversationId: 'thread-a', recordGeneration: 'generation-a' } };
}

it('freezes the prior Live observation and clock during a hold without advancing coverage', async () => {
  vi.useFakeTimers(); const f = fixture(), handle = f.model.watchOwned(subject); await vi.advanceTimersByTimeAsync(5);
  const old = handle.getSnapshot(), changed = vi.fn(), unsubscribe = handle.subscribe(changed);
  f.emit('view.changed', 12); await vi.advanceTimersByTimeAsync(100);
  expect(handle.getSnapshot()).toBe(old); expect(changed).not.toHaveBeenCalled();
  expect(f.config.backend.readOwned).toHaveBeenCalledTimes(1);
  expect(f.model.getConnection()).toMatchObject({ status: 'connected', checkingOrder: true });
  f.emit('queue.created', 11); await vi.advanceTimersByTimeAsync(5);
  expect(f.config.backend.readOwned).toHaveBeenCalledTimes(2); expect(f.close).not.toHaveBeenCalled();
  unsubscribe(); handle.release();
});

it('holds bootstrap and opening demand until the entire initial gap drains', async () => {
  vi.useFakeTimers(); const f = fixture(); f.setFrontier('12');
  vi.mocked(f.wire.frontier).mockResolvedValueOnce({ hostId: 'host-a', bootEpoch: 'boot-a', seq: '10' });
  vi.mocked(f.wire.subscribe).mockImplementationOnce(async (_source, _frontier, _signal, event) => {
    event({ seq: 12, type: 'view.changed' }); return { close: f.close };
  });
  const handle = f.model.watchSeat(subject), read = vi.fn(async () => exactSeat()), exact = new ConversationObservation(handle, read);
  await vi.advanceTimersByTimeAsync(50);
  expect(f.model.getConnection().status).toBe('connecting');
  expect(f.config.backend.readSeat).not.toHaveBeenCalled(); expect(read).not.toHaveBeenCalled();
  vi.mocked(f.wire.subscribe).mock.calls[0]![3]({ seq: 11, type: 'queue.created' });
  await vi.advanceTimersByTimeAsync(5);
  expect(read).toHaveBeenCalledTimes(1); expect(exact.getSnapshot().applicable).toBe(true);
  expect(f.wire.subscribe).toHaveBeenCalledTimes(1);
  exact.dispose(); handle.release(); expect(vi.getTimerCount()).toBe(0);
});

it('holds a completed pending read until ordered invalidations reject its obsolete version', async () => {
  vi.useFakeTimers(); const f = fixture(), handle = f.model.watchOwned(subject); await vi.advanceTimersByTimeAsync(5);
  const old = handle.getSnapshot(); let finish!: (value: OwnedWork) => void;
  vi.mocked(f.config.backend.readOwned).mockImplementationOnce(async () => new Promise((resolve) => { finish = resolve; }));
  handle.refresh(); await vi.advanceTimersByTimeAsync(5);
  f.emit('view.changed', 12); finish(owned('obsolete-read')); await vi.advanceTimersByTimeAsync(30);
  expect(handle.getSnapshot()).toMatchObject({ value: old.value, observedAt: old.observedAt });
  vi.mocked(f.config.backend.readOwned).mockResolvedValue(owned('ordered-successor'));
  f.emit('queue.created', 11); await vi.advanceTimersByTimeAsync(5);
  expect(handle.getSnapshot()).toMatchObject({ freshness: 'live', value: { items: [{ qitemId: 'ordered-successor' }] } });
  expect(f.close).not.toHaveBeenCalled(); handle.release();
});

it('checks the gap barrier after a frontier response opens a hole during verification', async () => {
  vi.useFakeTimers(); const f = fixture(), handle = f.model.watchOwned(subject); await vi.advanceTimersByTimeAsync(5);
  const old = handle.getSnapshot(); vi.mocked(f.config.backend.readOwned).mockResolvedValue(owned('premature'));
  vi.mocked(f.wire.frontier).mockImplementationOnce(async () => {
    f.emit('view.changed', 12); return { hostId: 'host-a', bootEpoch: 'boot-a', seq: '12' };
  });
  handle.refresh(); await vi.advanceTimersByTimeAsync(40);
  expect(handle.getSnapshot().value).toBe(old.value);
  expect(f.model.getConnection()).toMatchObject({ status: 'connected', checkingOrder: true });
  vi.mocked(f.config.backend.readOwned).mockResolvedValue(owned('after-drain'));
  f.emit('queue.updated', 11); await vi.advanceTimersByTimeAsync(5);
  expect(handle.getSnapshot()).toMatchObject({ freshness: 'live', value: { items: [{ qitemId: 'after-drain' }] } });
  handle.release();
});

it('rejects publication if a gap opens after verify returns and before the cache continuation runs', async () => {
  vi.useFakeTimers(); const cache = new ObservationCache('a', 1); let ready = true;
  const read = vi.fn(async () => ({ kind: 'value' as const, value: owned('fresh') }));
  const verify = vi.fn().mockImplementationOnce(async () => { queueMicrotask(() => { ready = false; }); }).mockResolvedValue(undefined);
  const handle = cache.observe('owned:a', true, read);
  cache.connect(1, new AbortController().signal, verify, () => ready); await vi.advanceTimersByTimeAsync(5);
  expect(handle.getSnapshot().value).toBeNull(); expect(read).toHaveBeenCalledTimes(1);
  ready = true; cache.resume(); await vi.advanceTimersByTimeAsync(5);
  expect(handle.getSnapshot()).toMatchObject({ freshness: 'live', value: { items: [{ qitemId: 'fresh' }] } });
  expect(read).toHaveBeenCalledTimes(2); handle.release(); expect(vi.getTimerCount()).toBe(0);
});

it('retains one explicit Recheck demand across a queue-only hold without a background exact read', async () => {
  vi.useFakeTimers(); const f = fixture(), handle = f.model.watchSeat(subject), read = vi.fn(async () => exactSeat());
  const exact = new ConversationObservation(handle, read); await vi.advanceTimersByTimeAsync(5);
  f.emit('view.changed', 12); exact.recheck(); await vi.advanceTimersByTimeAsync(50);
  expect(read).toHaveBeenCalledTimes(1); expect(f.config.backend.readSeat).toHaveBeenCalledTimes(1);
  f.emit('queue.created', 11); await vi.advanceTimersByTimeAsync(5);
  expect(read).toHaveBeenCalledTimes(2); expect(exact.getSnapshot()).toMatchObject({ applicable: true, needsRecheck: false });
  await vi.advanceTimersByTimeAsync(300); expect(read).toHaveBeenCalledTimes(2);
  exact.dispose(); handle.release(); expect(vi.getTimerCount()).toBe(0);
});

it('invalidates a pending exact result when a process event drains before the barrier releases', async () => {
  vi.useFakeTimers(); const f = fixture(), handle = f.model.watchSeat(subject); let finish!: (value: SeatRead) => void;
  const read = vi.fn(async () => new Promise<SeatRead>((resolve) => { finish = resolve; }));
  const exact = new ConversationObservation(handle, read); await vi.advanceTimersByTimeAsync(5);
  expect(exact.getSnapshot().pending).toBe(true);
  f.emit('view.changed', 12); vi.mocked(f.config.backend.readSeat).mockResolvedValue(seat(20));
  f.emit('binding.changed', 11); finish(exactSeat()); await vi.advanceTimersByTimeAsync(5);
  expect(exact.getSnapshot()).toMatchObject({ applicable: false, needsRecheck: true, value: null, pending: false });
  expect(handle.getSnapshot().value).toMatchObject({ process: { processId: 20 } }); expect(read).toHaveBeenCalledTimes(1);
  exact.dispose(); handle.release();
});

it.each(['queue.created', 'binding.changed'])('holds an already-completed exact result until missing %s drains', async (missing) => {
  vi.useFakeTimers(); const f = fixture(), handle = f.model.watchSeat(subject); let finish!: (value: SeatRead) => void;
  const read = vi.fn(async () => new Promise<SeatRead>((resolve) => { finish = resolve; }));
  const exact = new ConversationObservation(handle, read); await vi.advanceTimersByTimeAsync(5);
  f.emit('view.changed', 12); const value = exactSeat(), observedAt = value.observedAt; finish(value); await vi.advanceTimersByTimeAsync(50);
  expect(exact.getSnapshot()).toMatchObject({ pending: true, value: null, applicable: false });
  if (missing === 'binding.changed') vi.mocked(f.config.backend.readSeat).mockResolvedValue(seat(20));
  vi.setSystemTime(Date.now() + 60_000);
  f.emit(missing, 11); await vi.advanceTimersByTimeAsync(5);
  expect(read).toHaveBeenCalledTimes(1);
  if (missing === 'queue.created') {
    expect(exact.getSnapshot()).toMatchObject({ pending: false, applicable: true });
    expect(exact.getSnapshot().value).toBe(value); expect(value.observedAt).toBe(observedAt);
  } else expect(exact.getSnapshot()).toMatchObject({ pending: false, applicable: false, value: null, needsRecheck: true });
  exact.dispose(); handle.release();
});

it('rechecks readiness after the exact-result barrier returns before publishing its clock', async () => {
  vi.useFakeTimers(); const f = fixture(), handle = f.model.watchSeat(subject);
  vi.spyOn(handle, 'whenReady').mockImplementationOnce(async () => { queueMicrotask(() => f.emit('view.changed', 12)); });
  const read = vi.fn(async () => exactSeat()), exact = new ConversationObservation(handle, read);
  await vi.advanceTimersByTimeAsync(50);
  expect(exact.getSnapshot()).toMatchObject({ pending: true, value: null, applicable: false });
  f.emit('queue.created', 11); await vi.advanceTimersByTimeAsync(5);
  expect(exact.getSnapshot()).toMatchObject({ pending: false, applicable: true });
  expect(read).toHaveBeenCalledTimes(1); exact.dispose(); handle.release();
});

it('owns the hold per source and clears it on settings replacement and last-consumer release', async () => {
  vi.useFakeTimers(); const a = fixture('a'), b = fixture('b'), ah = a.model.watchOwned(subject), bh = b.model.watchOwned({ ...subject, sourceKey: 'b' });
  await vi.advanceTimersByTimeAsync(5); const old = vi.mocked(a.wire.subscribe).mock.calls[0]!;
  a.emit('view.changed', 12);
  expect(a.model.getConnection().checkingOrder).toBe(true); expect(b.model.getConnection().checkingOrder).not.toBe(true);
  a.model.configure({ ...a.config, settings: { ...a.config.settings, openRigHostId: 'replacement-host' } });
  expect(old[2].aborted).toBe(true); old[3]({ seq: 11, type: 'binding.changed' });
  await vi.advanceTimersByTimeAsync(5); expect(a.wire.subscribe).toHaveBeenCalledTimes(2);
  a.emit('view.changed', 14); ah.release(); bh.release();
  await vi.advanceTimersByTimeAsync(1000);
  expect(a.model.getConnection().status).toBe('closed'); expect(a.wire.subscribe).toHaveBeenCalledTimes(2); expect(vi.getTimerCount()).toBe(0);
});
