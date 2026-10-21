// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { fixture, owned, seat, subject } from '../fixtures/agentLinkLiveModel';

vi.mock('timers', () => ({
  setTimeout: (callback: () => void, ms: number) => globalThis.setTimeout(callback, ms),
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(timer),
}));

afterEach(() => vi.useRealTimers());

it('shares one source subscriber and ignores duplicate/late event payloads rather than folding them', async () => {
  vi.useFakeTimers();
  const f = fixture();
  const a = f.model.watchOwned(subject), b = f.model.watchOwned(subject);
  await vi.advanceTimersByTimeAsync(5);
  expect(f.wire.subscribe).toHaveBeenCalledTimes(1);
  expect(f.config.backend.readOwned).toHaveBeenCalledTimes(1);
  f.emit('queue.updated'); f.emit('queue.updated', 11); f.emit('queue.updated', 9);
  await vi.advanceTimersByTimeAsync(5);
  expect(f.config.backend.readOwned).toHaveBeenCalledTimes(2);
  expect(a.getSnapshot().value).toMatchObject({ items: [{ qitemId: 'a' }] });
  a.release(); expect(f.close).not.toHaveBeenCalled();
  b.release(); expect(f.close).toHaveBeenCalledTimes(1);
  expect(f.model.getConnection().status).toBe('closed');
});

it('reconnects at a new frontier and rehydrates without an outage-history replay', async () => {
  vi.useFakeTimers();
  const f = fixture(); const a = f.model.watchOwned(subject);
  await vi.advanceTimersByTimeAsync(5);
  f.disconnect();
  expect(a.getSnapshot().freshness).toBe('last-known');
  f.setFrontier('900');
  await vi.advanceTimersByTimeAsync(510);
  expect(f.wire.subscribe).toHaveBeenCalledTimes(2);
  expect(vi.mocked(f.wire.subscribe).mock.calls[1]?.[1].seq).toBe('900');
  expect(f.config.backend.readOwned).toHaveBeenCalledTimes(2);
  expect(a.getSnapshot().freshness).toBe('live');
  a.release();
});

it('separates identical native IDs across source keys and clears observations on source replacement', async () => {
  vi.useFakeTimers();
  const a = fixture('a'), b = fixture('b');
  const ah = a.model.watchOwned(subject), bh = b.model.watchOwned({ ...subject, sourceKey: 'b' });
  await vi.advanceTimersByTimeAsync(5);
  expect(ah.getSnapshot()).toMatchObject({ sourceKey: 'a', value: { items: [{ qitemId: 'a' }] } });
  expect(bh.getSnapshot()).toMatchObject({ sourceKey: 'b', value: { items: [{ qitemId: 'b' }] } });
  a.model.configure({ ...a.config, settings: { ...a.config.settings, openRigHostId: 'replacement-host' } });
  expect(ah.getSnapshot().value).toBeNull();
  await vi.advanceTimersByTimeAsync(5);
  expect(vi.mocked(a.wire.subscribe).mock.calls[1]?.[0].hostId).toBe('replacement-host');
  ah.release(); bh.release();
});

it('invalidates occupant metadata but never claims exact conversation from cached identity', async () => {
  vi.useFakeTimers();
  const f = fixture(); const handle = f.model.watchSeat(subject);
  await vi.advanceTimersByTimeAsync(5);
  expect(handle.getSnapshot()).toMatchObject({ freshness: 'read', value: { process: { processId: 10 }, participant: null } });
  vi.mocked(f.config.backend.readSeat).mockResolvedValue(seat(20));
  f.emit('seat.handover_completed');
  await vi.advanceTimersByTimeAsync(5);
  expect(handle.getSnapshot()).toMatchObject({ freshness: 'read', value: { process: { processId: 20 }, participant: null } });
  vi.mocked(f.config.backend.readSeat).mockResolvedValue({ state: 'different-seat', message: 'Different immutable node.', observedAt: new Date().toISOString() });
  handle.refresh(); await vi.advanceTimersByTimeAsync(5);
  expect(handle.getSnapshot()).toMatchObject({ freshness: 'refused', value: { state: 'different-seat' }, message: 'Different immutable node.' });
  handle.release();
});

it('retains truncation and reconciles a global sequence gap without declaring empty work', async () => {
  vi.useFakeTimers();
  const f = fixture(); vi.mocked(f.config.backend.readOwned).mockResolvedValue(owned('bounded', true));
  const handle = f.model.watchOwned(subject); await vi.advanceTimersByTimeAsync(5);
  expect(handle.getSnapshot()).toMatchObject({ freshness: 'live', value: { truncated: true } });
  f.emit('queue.updated', 99);
  await vi.advanceTimersByTimeAsync(250);
  expect(handle.getSnapshot()).toMatchObject({ freshness: 'last-known', value: { items: [{ qitemId: 'bounded' }] } });
  expect(f.model.getConnection().message).toContain('continuity');
  handle.release(); await vi.advanceTimersByTimeAsync(1000);
  expect(f.wire.subscribe).toHaveBeenCalledTimes(1);
});

it('recovers a reorder that misses its deadline and ignores the obsolete connection', async () => {
  vi.useFakeTimers();
  const f = fixture(), handle = f.model.watchOwned(subject);
  await vi.advanceTimersByTimeAsync(5);
  const old = vi.mocked(f.wire.subscribe).mock.calls[0]!;
  f.emit('queue.handed_off', 11);
  await vi.advanceTimersByTimeAsync(5);
  const before = handle.getSnapshot();
  f.emit('view.changed', 13);
  await vi.advanceTimersByTimeAsync(250);
  expect(old[2].aborted).toBe(true);
  expect(f.close).toHaveBeenCalledTimes(1);
  expect(handle.getSnapshot()).toMatchObject({ freshness: 'last-known', value: before.value });
  expect(f.model.getConnection()).toMatchObject({ status: 'reconnecting', epoch: before.epoch });
  const held = handle.getSnapshot();
  f.emit('queue.created', 12);
  expect(handle.getSnapshot()).toBe(held);
  vi.mocked(f.config.backend.readOwned).mockResolvedValue(owned('created-during-gap'));
  await vi.advanceTimersByTimeAsync(510);
  expect(f.wire.subscribe).toHaveBeenCalledTimes(2);
  expect(vi.mocked(f.wire.subscribe).mock.calls[1]?.[1].seq).toBe('13');
  expect(handle.getSnapshot()).toMatchObject({ freshness: 'live', value: { items: [{ qitemId: 'created-during-gap' }] } });
  expect(handle.getSnapshot().epoch).toBeGreaterThan(before.epoch);
  const recovered = handle.getSnapshot(), reads = vi.mocked(f.config.backend.readOwned).mock.calls.length;
  old[3]({ type: 'queue.created', seq: 12 });
  old[3]({ type: 'queue.updated', seq: 14 });
  old[4](new Error('Obsolete disconnect'));
  await vi.advanceTimersByTimeAsync(5);
  expect(handle.getSnapshot()).toBe(recovered);
  expect(f.config.backend.readOwned).toHaveBeenCalledTimes(reads);
  expect(f.model.getConnection().status).toBe('connected');
  handle.release(); expect(f.close).toHaveBeenCalledTimes(2);
});

it('rejects a changed boot epoch before publishing hydrated facts', async () => {
  vi.useFakeTimers();
  const f = fixture();
  vi.mocked(f.wire.frontier)
    .mockResolvedValueOnce({ hostId: 'host-a', bootEpoch: 'before', seq: '10' })
    .mockResolvedValueOnce({ hostId: 'host-a', bootEpoch: 'after', seq: '10' });
  const handle = f.model.watchOwned(subject);
  await vi.advanceTimersByTimeAsync(5);
  expect(handle.getSnapshot()).toMatchObject({ freshness: 'unavailable', value: null });
  expect(f.config.backend.readOwned).not.toHaveBeenCalled();
  expect(f.model.getConnection().message).toContain('epoch');
  handle.release();
});

it('bounds bootstrap arrivals and refuses to publish a source flooded before hydration', async () => {
  vi.useFakeTimers();
  const f = fixture();
  vi.mocked(f.wire.subscribe).mockImplementationOnce(async (_source, _frontier, _signal, onEvent) => {
    for (let seq = 11; seq < 1050; seq++) onEvent({ type: 'view.changed', seq });
    return { close: f.close };
  });
  const handle = f.model.watchOwned(subject);
  await vi.advanceTimersByTimeAsync(5);
  expect(f.model.getConnection().message).toContain('overflow');
  expect(handle.getSnapshot()).toMatchObject({ freshness: 'unavailable', value: null });
  expect(f.config.backend.readOwned).not.toHaveBeenCalled();
  handle.release();
});

it('backs off repeated connections that close before a valid event arrives', async () => {
  vi.useFakeTimers();
  const f = fixture(), handle = f.model.watchOwned(subject);
  await vi.advanceTimersByTimeAsync(5);
  f.disconnect(); await vi.advanceTimersByTimeAsync(510);
  expect(f.wire.subscribe).toHaveBeenCalledTimes(2);
  f.disconnect(); await vi.advanceTimersByTimeAsync(510);
  expect(f.wire.subscribe).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(500);
  expect(f.wire.subscribe).toHaveBeenCalledTimes(3);
  handle.release();
});
