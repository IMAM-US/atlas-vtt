// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { EventOrder, EVENT_ORDER_HOLD_MS } from '../../src/app/agent-links/live/EventOrder';

vi.mock('timers', () => ({ setTimeout: (fn: () => void, ms: number) => globalThis.setTimeout(fn, ms), clearTimeout: (timer: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(timer) }));
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
function fixture(): { order: EventOrder; controller: AbortController; delivered: ReturnType<typeof vi.fn>; checking: ReturnType<typeof vi.fn>; failed: ReturnType<typeof vi.fn> } {
  vi.useFakeTimers();
  const controller = new AbortController(), delivered = vi.fn(), checking = vi.fn(), failed = vi.fn();
  return { order: new EventOrder(0, controller.signal, delivered, checking, failed), controller, delivered, checking, failed };
}

it('drains every missing sequence before releasing coverage, preserving duplicates without replacement', async () => {
  const f = fixture(); f.order.push({ seq: 1, type: 'queue.handed_off' }); f.order.push({ seq: 3, type: 'view.changed' });
  const settled = vi.fn(); const barrier = f.order.settled().then(settled);
  f.order.push({ seq: 3, type: 'view.changed' }); await vi.advanceTimersByTimeAsync(50);
  expect(f.order.cursor).toBe(1); expect(settled).not.toHaveBeenCalled();
  f.order.push({ seq: 2, type: 'queue.created' }); await barrier;
  expect(f.delivered.mock.calls.map(([event]) => event.seq)).toEqual([1, 2, 3]);
  expect(f.checking.mock.calls).toEqual([[true], [false]]); expect(f.failed).not.toHaveBeenCalled();
  expect(f.order.ready()).toBe(true); expect(vi.getTimerCount()).toBe(0); f.order.dispose();
});

it('does not extend the first deadline for duplicates, partial progress or a later hole', async () => {
  const f = fixture(); f.order.push({ seq: 3, type: 'view.changed' });
  await vi.advanceTimersByTimeAsync(100); f.order.push({ seq: 1, type: 'queue.updated' });
  f.order.push({ seq: 3, type: 'view.changed' }); f.order.push({ seq: 5, type: 'view.changed' });
  await vi.advanceTimersByTimeAsync(EVENT_ORDER_HOLD_MS - 101); expect(f.failed).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1); expect(f.failed).toHaveBeenCalledTimes(1);
  expect(f.order.cursor).toBe(1); f.order.push({ seq: 2, type: 'queue.created' });
  expect(f.delivered).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
});

it.each(['arrival', 'readiness', 'drain'])('enforces monotonic expiry on %s even when the timer has not run', (at) => {
  const f = fixture(); let now = 0; vi.spyOn(performance, 'now').mockImplementation(() => now);
  f.order.push({ seq: 2, type: 'view.changed' });
  if (at === 'drain') f.delivered.mockImplementation(() => { now = EVENT_ORDER_HOLD_MS; });
  else now = EVENT_ORDER_HOLD_MS;
  if (at === 'readiness') f.order.ready(); else f.order.push({ seq: 1, type: 'queue.updated' });
  expect(f.failed).toHaveBeenCalledTimes(1); expect(f.order.ready()).toBe(false); expect(vi.getTimerCount()).toBe(0);
});

it.each(['poison', 'distance', 'capacity', 'conflict'])('recovers immediately on %s', (cause) => {
  const f = fixture();
  if (cause === 'capacity') for (let seq = 2; seq <= 130; seq++) f.order.push({ seq, type: 'view.changed' });
  if (cause === 'distance') f.order.push({ seq: 257, type: 'view.changed' });
  if (cause === 'poison') f.order.push({ seq: 2, type: 'event.delivery_poisoned' });
  if (cause === 'conflict') { f.order.push({ seq: 2, type: 'view.changed' }); f.order.push({ seq: 2, type: 'queue.created' }); }
  expect(f.failed).toHaveBeenCalledTimes(1); expect(f.delivered).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});

it('abort releases waiting readers and clears every owned timer and event', async () => {
  const f = fixture(); f.order.push({ seq: 2, type: 'view.changed' });
  const barrier = f.order.settled(); const rejected = expect(barrier).rejects.toThrow();
  f.controller.abort(); await rejected;
  f.order.push({ seq: 1, type: 'queue.created' }); await vi.advanceTimersByTimeAsync(500);
  expect(f.failed).not.toHaveBeenCalled(); expect(f.delivered).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});
