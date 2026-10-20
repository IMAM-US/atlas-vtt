// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { ObservationCache } from '../../src/app/agent-links/live/ObservationCache';
import type { ReadResult } from '../../src/app/agent-links/live/types';

vi.mock('timers', () => ({
  setTimeout: (callback: () => void, ms: number) => globalThis.setTimeout(callback, ms),
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(timer),
}));

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  return { promise: new Promise<T>((done) => { resolve = done; }), resolve: (value) => resolve(value) };
}
afterEach(() => vi.useRealTimers());

it('actually invalidates during hydration and never publishes the old value as live', async () => {
  vi.useFakeTimers();
  const cache = new ObservationCache('source-a', 1);
  const first = deferred<ReadResult<string>>();
  const read = vi.fn().mockImplementationOnce(() => first.promise).mockResolvedValue({ kind: 'value', value: 'new' });
  const handle = cache.observe<string>('owned:a', true, read);
  const seen: string[] = [];
  handle.subscribe(() => { const fact = handle.getSnapshot(); seen.push(`${fact.freshness}:${fact.value}`); });
  cache.connect(1, new AbortController().signal, async () => {});
  await vi.advanceTimersByTimeAsync(1);
  expect(read).toHaveBeenCalledTimes(1);
  cache.invalidate(() => true); // The first read is still unresolved here.
  first.resolve({ kind: 'value', value: 'old' });
  await vi.advanceTimersByTimeAsync(5);
  expect(read).toHaveBeenCalledTimes(2);
  expect(seen).not.toContain('live:old');
  expect(handle.getSnapshot()).toMatchObject({ freshness: 'live', value: 'new', sourceKey: 'source-a', epoch: 1 });
  handle.release();
});

it('rejects an obsolete read delayed past a source epoch change even if it ignores abort', async () => {
  vi.useFakeTimers();
  const cache = new ObservationCache('source-a', 1);
  const old = deferred<ReadResult<string>>();
  const read = vi.fn().mockImplementationOnce(() => old.promise).mockResolvedValue({ kind: 'value', value: 'successor' });
  const handle = cache.observe<string>('seat:a', false, read);
  cache.connect(1, new AbortController().signal, async () => {});
  await vi.advanceTimersByTimeAsync(1);
  cache.hold(2, 'Source replaced.', true);
  expect(handle.getSnapshot()).toMatchObject({ value: null, freshness: 'unavailable' });
  cache.connect(2, new AbortController().signal, async () => {});
  await vi.advanceTimersByTimeAsync(2);
  expect(handle.getSnapshot()).toMatchObject({ value: 'successor', freshness: 'read', epoch: 2 });
  old.resolve({ kind: 'value', value: 'predecessor' });
  await vi.advanceTimersByTimeAsync(2);
  expect(handle.getSnapshot().value).toBe('successor');
  handle.release();
});

it('drops obsolete subjects, shares reads between consumers, and cancels on the last release', async () => {
  vi.useFakeTimers();
  const cache = new ObservationCache('source-a', 1);
  const pending = deferred<ReadResult<string>>();
  let signal: AbortSignal | undefined;
  const read = vi.fn((incoming: AbortSignal) => { signal = incoming; return pending.promise; });
  const a = cache.observe('seat:a', false, read), b = cache.observe('seat:a', false, read);
  cache.connect(1, new AbortController().signal, async () => {});
  await vi.advanceTimersByTimeAsync(1);
  a.release();
  expect(signal?.aborted).toBe(false);
  b.release();
  expect(signal?.aborted).toBe(true);
  const next = cache.observe('seat:b', false, async () => ({ kind: 'refused', value: null, message: 'Native identity mismatch.' }));
  await vi.advanceTimersByTimeAsync(2);
  pending.resolve({ kind: 'value', value: 'wrong subject' });
  await vi.advanceTimersByTimeAsync(2);
  expect(read).toHaveBeenCalledTimes(1);
  expect(next.getSnapshot()).toMatchObject({ freshness: 'refused', value: null, message: 'Native identity mismatch.' });
  next.release();
});

it('keeps last-known values on disconnect and failed refresh, never inventing an empty list', async () => {
  vi.useFakeTimers();
  const cache = new ObservationCache('source-a', 1);
  const read = vi.fn().mockResolvedValueOnce({ kind: 'value', value: ['owned'] }).mockResolvedValue({ kind: 'unavailable', value: null, message: 'Offline' });
  const handle = cache.observe<string[]>('owned:a', true, read);
  cache.connect(1, new AbortController().signal, async () => {});
  await vi.advanceTimersByTimeAsync(2);
  cache.hold(2, 'Disconnected');
  expect(handle.getSnapshot()).toMatchObject({ freshness: 'last-known', value: ['owned'] });
  cache.connect(2, new AbortController().signal, async () => {});
  await vi.advanceTimersByTimeAsync(2);
  expect(handle.getSnapshot()).toMatchObject({ freshness: 'last-known', value: ['owned'], message: 'Offline' });
  handle.release();
});

it('bounds distinct observations and coalesces invalidation bursts', async () => {
  vi.useFakeTimers();
  const cache = new ObservationCache('a', 10, 1);
  const read = vi.fn().mockResolvedValue({ kind: 'value', value: 1 });
  const handle = cache.observe('owned:a', true, read);
  expect(() => cache.observe('owned:b', true, read)).toThrow('Too many');
  cache.connect(1, new AbortController().signal, async () => {});
  for (let i = 0; i < 500; i++) cache.invalidate(() => true);
  await vi.advanceTimersByTimeAsync(10);
  expect(read).toHaveBeenCalledTimes(1);
  handle.release();
});
