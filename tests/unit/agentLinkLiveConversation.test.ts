// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { ObservationCache } from '../../src/app/agent-links/live/ObservationCache';
import { ConversationObservation, seatWithConversation } from '../../src/app/agent-links/live/ConversationObservation';
import type { SeatRead } from '../../src/app/agent-links/reads';

vi.mock('timers', () => ({ setTimeout: (callback: () => void, ms: number) => globalThis.setTimeout(callback, ms), clearTimeout: (timer: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(timer) }));
afterEach(() => vi.useRealTimers());
function seat(pid: number, exact = false): SeatRead {
  const process = { runtime: 'codex', sessionName: 'builder@example', bindingId: `binding-${pid}`, tmuxPane: '%1', processId: pid };
  return { state: 'current', node: {}, process,
    participant: exact ? { ...process, conversationId: 'native-thread-a', recordGeneration: 'native-generation-a' } : null,
    participantMessage: null, cwd: null, observedAt: '2026-01-01T10:00:00Z' };
}

it('makes one exact read on opening and never repeats it on invalidation or reconnect', async () => {
  vi.useFakeTimers();
  const cache = new ObservationCache('a', 1), reader = vi.fn(async () => ({ kind: 'value' as const, value: seat(1) }));
  const handle = cache.observe('seat:a', false, reader);
  const exactRead = vi.fn(async () => seat(1, true));
  const exact = new ConversationObservation(handle, exactRead);
  cache.connect(1, new AbortController().signal, async () => {});
  await vi.advanceTimersByTimeAsync(5);
  expect(exactRead).toHaveBeenCalledTimes(1);
  expect(seatWithConversation(handle.getSnapshot().value, exact.getSnapshot())).toMatchObject({ participant: { conversationId: 'native-thread-a' } });
  cache.invalidate(() => true); await vi.advanceTimersByTimeAsync(5);
  expect(exact.getSnapshot()).toMatchObject({ applicable: false, needsRecheck: true, changedSince: null, value: { participant: { conversationId: 'native-thread-a' } } });
  expect(seatWithConversation(handle.getSnapshot().value, exact.getSnapshot())).toMatchObject({ participant: null });
  cache.hold(2, 'Disconnected'); cache.connect(2, new AbortController().signal, async () => {});
  await vi.advanceTimersByTimeAsync(5);
  expect(exactRead).toHaveBeenCalledTimes(1);
  exact.recheck(); await vi.advanceTimersByTimeAsync(5);
  expect(exactRead).toHaveBeenCalledTimes(2);
  exact.dispose(); handle.release();
});

it('rejects an exact read delayed past an actual process invalidation and retains that invalidation', async () => {
  vi.useFakeTimers();
  let resolve!: (value: SeatRead) => void;
  const cache = new ObservationCache('a', 1), reader = vi.fn(async () => ({ kind: 'value' as const, value: seat(1) }));
  const handle = cache.observe('seat:a', false, reader);
  const exact = new ConversationObservation(handle, async () => new Promise<SeatRead>((done) => { resolve = done; }));
  cache.connect(1, new AbortController().signal, async () => {});
  await vi.advanceTimersByTimeAsync(5);
  expect(exact.getSnapshot().pending).toBe(true);
  reader.mockResolvedValue({ kind: 'value', value: seat(2) }); cache.invalidate(() => true);
  await vi.advanceTimersByTimeAsync(5);
  resolve(seat(1, true)); await vi.advanceTimersByTimeAsync(5);
  expect(exact.getSnapshot()).toMatchObject({ value: null, applicable: false, pending: false, needsRecheck: true, changedSince: '2026-01-01T10:00:00Z' });
  exact.dispose(); handle.release();
});

it('a refused process refresh is uncertainty, not evidence of a new conversation or changed seat', async () => {
  vi.useFakeTimers();
  const cache = new ObservationCache('a', 1), reader = vi.fn(async () => ({ kind: 'value' as const, value: seat(1) }));
  const handle = cache.observe('seat:a', false, reader);
  const exact = new ConversationObservation(handle, async () => ({ ...seat(1), participantMessage: 'HTTP 409 record_identity_unverified: native refusal.' }));
  cache.connect(1, new AbortController().signal, async () => {}); await vi.advanceTimersByTimeAsync(5);
  expect(exact.getSnapshot()).toMatchObject({ applicable: true, value: { participant: null, participantMessage: 'HTTP 409 record_identity_unverified: native refusal.' } });
  reader.mockResolvedValue({ kind: 'value', value: { state: 'unverified', node: {}, message: 'Process refused', observedAt: '2026-01-01T10:01:00Z' } });
  cache.invalidate(() => true); await vi.advanceTimersByTimeAsync(5);
  expect(exact.getSnapshot()).toMatchObject({ applicable: false, needsRecheck: true, changedSince: null });
  expect(seatWithConversation(handle.getSnapshot().value, exact.getSnapshot())).toMatchObject({ state: 'unverified' });
  exact.dispose(); handle.release();
});

it('retains an earlier exact observation when an explicit recheck is refused', async () => {
  vi.useFakeTimers();
  const cache = new ObservationCache('a', 1);
  const handle = cache.observe('seat:a', false, async () => ({ kind: 'value', value: seat(1) }));
  const read = vi.fn().mockResolvedValueOnce(seat(1, true)).mockResolvedValue({ ...seat(1), participantMessage: 'Native 409 refusal.' });
  const exact = new ConversationObservation(handle, read);
  cache.connect(1, new AbortController().signal, async () => {}); await vi.advanceTimersByTimeAsync(5);
  exact.recheck(); await vi.advanceTimersByTimeAsync(5);
  expect(exact.getSnapshot()).toMatchObject({ previous: { participant: { conversationId: 'native-thread-a' } },
    value: { participant: null, participantMessage: 'Native 409 refusal.' }, needsRecheck: true });
  exact.dispose(); handle.release();
});

it('refreshes the cached process before an explicit recheck when no event covered its replacement', async () => {
  vi.useFakeTimers();
  const cache = new ObservationCache('a', 1);
  const reader = vi.fn(async () => ({ kind: 'value' as const, value: seat(1) }));
  const handle = cache.observe('seat:a', false, reader);
  const read = vi.fn(async () => seat(1, true));
  const exact = new ConversationObservation(handle, read);
  cache.connect(1, new AbortController().signal, async () => {}); await vi.advanceTimersByTimeAsync(5);
  expect(read).toHaveBeenCalledTimes(1);
  // Native process changes without any delivered invalidation. Only explicit demand discovers it.
  reader.mockResolvedValue({ kind: 'value', value: seat(2) }); read.mockResolvedValue(seat(2, true));
  exact.recheck(); await vi.advanceTimersByTimeAsync(5);
  expect(reader).toHaveBeenCalledTimes(2);
  expect(read).toHaveBeenCalledTimes(2);
  expect(exact.getSnapshot()).toMatchObject({ applicable: true, needsRecheck: false, changedSince: null, value: { process: { processId: 2 } } });
  exact.dispose(); handle.release();
});

it('starts an opening demand with a new process read when another consumer already cached it', async () => {
  vi.useFakeTimers(); const cache = new ObservationCache('a', 1);
  const reader = vi.fn(async () => ({ kind: 'value' as const, value: seat(1) }));
  const handle = cache.observe('seat:a', false, reader);
  cache.connect(1, new AbortController().signal, async () => {}); await vi.advanceTimersByTimeAsync(5);
  reader.mockResolvedValue({ kind: 'value', value: seat(2) });
  const read = vi.fn(async () => seat(2, true)); const exact = new ConversationObservation(handle, read);
  await vi.advanceTimersByTimeAsync(5);
  expect(reader).toHaveBeenCalledTimes(2); expect(read).toHaveBeenCalledTimes(1);
  expect(exact.getSnapshot()).toMatchObject({ applicable: true, value: { process: { processId: 2 } } });
  exact.dispose(); handle.release();
});
