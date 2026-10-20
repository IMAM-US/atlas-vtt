// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { OpenRigLive, type OpenRigTransport } from '../../src/app/agent-links/live/OpenRigLive';
import { defaultSourceSettings } from '../../src/app/agent-links/sourceSettings';
import type { LiveConfiguration, NativeEvent } from '../../src/app/agent-links/live/types';
import type { SeatSubject } from '../../src/app/agent-links/account/accountSchema';
import type { OwnedWork, SeatRead } from '../../src/app/agent-links/reads';

vi.mock('timers', () => ({
  setTimeout: (callback: () => void, ms: number) => globalThis.setTimeout(callback, ms),
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(timer),
}));

const subject: SeatSubject = { id: 'authored-a', kind: 'seat', caption: 'Builder', sourceKey: 'a', policy: 'current-seat', workIds: [], observedAt: '2026-01-01T00:00:00Z',
  seat: { rigId: 'rig-a', nodeId: 'node-a', logicalId: 'team.builder' } };
const owned = (id: string, truncated = false): OwnedWork => ({ state: 'current', items: [{ qitemId: id }], sessionName: 'builder@example', truncated, observedAt: new Date().toISOString() });
const seat = (pid: number): SeatRead => ({ state: 'current', node: { nodeId: 'node-a' },
  process: { runtime: 'codex', sessionName: 'builder@example', bindingId: `binding-${pid}`, tmuxPane: '%1', processId: pid },
  participant: null, participantMessage: 'Exact conversation is read on demand.', cwd: null, observedAt: new Date().toISOString() });

function fixture(key = 'a'): { model: OpenRigLive; config: LiveConfiguration; wire: OpenRigTransport; emit: (type: string, seq?: number) => void; disconnect: () => void; close: ReturnType<typeof vi.fn>; setFrontier: (seq: string) => void } {
  let callback: ((event: NativeEvent) => void) | null = null;
  let lost: ((error: Error) => void) | null = null;
  let seq = 10;
  let frontier = '10';
  const close = vi.fn();
  const wire: OpenRigTransport = {
    frontier: vi.fn(async (source) => ({ hostId: source.hostId, bootEpoch: 'boot-a', seq: frontier })),
    subscribe: vi.fn(async (_source, _frontier, _signal, onEvent, onDisconnect) => { callback = onEvent; lost = onDisconnect; return { close }; }),
  };
  const config: LiveConfiguration = { settings: { ...defaultSourceSettings(key), openRigEndpoint: 'http://127.0.0.1:1', openRigHostId: `host-${key}` }, backend: {
    readSeat: vi.fn(async () => seat(10)), readOwned: vi.fn(async () => owned(key)),
    readWork: vi.fn(async () => ({ state: 'unavailable', message: 'Not read', observedAt: new Date().toISOString() })),
  } };
  return { model: new OpenRigLive(config, wire, 1), config, wire, close,
    emit: (type, supplied): void => { seq = supplied ?? seq + 1; if (seq > Number(frontier)) frontier = String(seq); callback?.({ type, seq }); },
    disconnect: (): void => { lost?.(new Error('Disconnected')); }, setFrontier: (value): void => { frontier = value; seq = Number(value); } };
}
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
  expect(handle.getSnapshot()).toMatchObject({ freshness: 'last-known', value: { items: [{ qitemId: 'bounded' }] } });
  expect(f.model.getConnection().message).toContain('continuity');
  handle.release(); await vi.advanceTimersByTimeAsync(1000);
  expect(f.wire.subscribe).toHaveBeenCalledTimes(1);
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
