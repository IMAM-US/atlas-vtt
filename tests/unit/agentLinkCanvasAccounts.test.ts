import { afterEach, expect, it, vi } from 'vitest';
import { AccountLoads } from '../../src/app/agent-links/overlay/AccountLoads';
import type { LoadedAccount } from '../../src/app/agent-links/reads';

afterEach(() => vi.useRealTimers());
function loaded(path: string): LoadedAccount { return { path, sha256: path, loadedAt: '2026-01-01T12:00:00Z', account: { format: 'atlas-source-account', version: 1, capturedAt: '2026-01-01T10:00:00Z', sources: [], subjects: [], work: [], artifacts: [] } }; }

it('independently bounds account concurrency and removes obsolete queued paths without admitting late results', async () => {
  vi.useFakeTimers();
  const pending: { path: string; signal: AbortSignal; resolve: (value: LoadedAccount) => void }[] = [];
  const read = vi.fn((path: string, signal: AbortSignal) => new Promise<LoadedAccount>((resolve) => pending.push({ path, signal, resolve })));
  const changed = vi.fn(), queue = new AccountLoads(read, changed);
  queue.setPaths(new Set(Array.from({ length: 20 }, (_, i) => `old-${i}.json`)));
  await vi.advanceTimersByTimeAsync(120);
  expect(read).toHaveBeenCalledTimes(4);
  queue.setPaths(new Set(['current.json']));
  expect(pending.every((item) => item.signal.aborted)).toBe(true);
  for (const item of pending) item.resolve(loaded(item.path));
  await vi.advanceTimersByTimeAsync(120);
  expect(read).toHaveBeenCalledTimes(5);
  expect(read.mock.calls[4]![0]).toBe('current.json');
  expect(changed).not.toHaveBeenCalled();
  pending[4]!.resolve(loaded('current.json')); await vi.advanceTimersByTimeAsync(0);
  expect(queue.get('current.json')?.value?.path).toBe('current.json');
  expect(queue.get('old-0.json')).toBeUndefined();
  queue.dispose();
});

it('coalesces repeated invalidations to one latest revision and cancels an in-flight obsolete revision', async () => {
  vi.useFakeTimers();
  const pending: ((value: LoadedAccount) => void)[] = [];
  const read = vi.fn((_path: string, _signal: AbortSignal) => new Promise<LoadedAccount>((resolve) => pending.push(resolve)));
  const queue = new AccountLoads(read, vi.fn());
  queue.setPaths(new Set(['one.json', 'one.json'])); await vi.advanceTimersByTimeAsync(120);
  queue.invalidate('one.json'); queue.invalidate('one.json'); queue.invalidate('one.json');
  expect(read.mock.calls[0]![1].aborted).toBe(true);
  pending[0]!(loaded('obsolete.json')); await vi.advanceTimersByTimeAsync(120);
  expect(read).toHaveBeenCalledTimes(2);
  expect(queue.get('one.json')?.value).toBeNull();
  pending[1]!(loaded('one.json')); await vi.advanceTimersByTimeAsync(0);
  expect(queue.get('one.json')?.value?.path).toBe('one.json'); queue.dispose();
  expect(read.mock.calls[1]![1].aborted).toBe(false);
});

it('disposal clears queued work, aborts active loads and ignores their eventual results', async () => {
  vi.useFakeTimers(); let resolve!: (value: LoadedAccount) => void;
  const changed = vi.fn(), read = vi.fn((_path: string, _signal: AbortSignal) => new Promise<LoadedAccount>((answer) => { resolve = answer; }));
  const queue = new AccountLoads(read, changed); queue.setPaths(new Set(['one.json'])); await vi.advanceTimersByTimeAsync(120);
  queue.dispose(); resolve(loaded('one.json')); await vi.advanceTimersByTimeAsync(1000);
  expect(changed).not.toHaveBeenCalled(); expect(read.mock.calls[0]![1].aborted).toBe(true); expect(vi.getTimerCount()).toBe(0);
});
