// @vitest-environment node
import type { App } from 'obsidian';
import { afterEach, expect, it, vi } from 'vitest';
import { NativeSources } from '../../src/app/agent-links/NativeSources';
import { readSeat } from '../../src/app/agent-links/sourceReads';
import { defaultSourceSettings } from '../../src/app/agent-links/sourceSettings';
import type { SeatSubject } from '../../src/app/agent-links/account/accountSchema';

const fixture = vi.hoisted(() => ({ changed: null as null | (() => void), unsubscribe: vi.fn(), close: vi.fn() }));
vi.mock('timers', () => ({ setTimeout: (callback: () => void, ms: number) => globalThis.setTimeout(callback, ms), clearTimeout: (timer: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(timer) }));
vi.mock('../../src/app/services/SettingsService', () => ({ SettingsService: { forApp: () => ({
  getAgentLinkSource: () => ({ ...defaultSourceSettings('a'), openRigEndpoint: 'http://127.0.0.1:1', openRigHostId: 'host-a' }),
  onChange: (changed: () => void) => { fixture.changed = changed; return fixture.unsubscribe; },
}) } }));
vi.mock('../../src/app/agent-links/sourceReads', () => ({ readSeat: vi.fn(async () => ({ state: 'unavailable', message: 'Synthetic refusal', observedAt: new Date().toISOString() })), readOwnedWork: vi.fn(), readWork: vi.fn() }));
vi.mock('../../src/app/agent-links/live/openRigEvents', () => ({
  readFrontier: async () => ({ hostId: 'host-a', bootEpoch: 'boot-a', seq: '0' }),
  subscribeOpenRig: async () => ({ close: fixture.close }),
}));
afterEach(() => vi.useRealTimers());

it('wires background reads as process-only, owns settings invalidation, and releases the plugin instance on unload', async () => {
  vi.useFakeTimers();
  const app = {} as App;
  const sources = NativeSources.forApp(app);
  expect(NativeSources.forApp(app)).toBe(sources);
  const settingsChanged = vi.spyOn(sources.live, 'settingsChanged');
  fixture.changed?.(); expect(settingsChanged).toHaveBeenCalledTimes(1);
  const subject = { sourceKey: 'a', seat: { rigId: 'rig-a', nodeId: 'node-a', logicalId: 'team.builder' } } as SeatSubject;
  const model = sources.live.openRig('a'), handle = model.watchSeat(subject);
  await vi.advanceTimersByTimeAsync(150);
  expect(readSeat).toHaveBeenCalledWith(expect.anything(), subject, { signal: expect.any(AbortSignal), includeParticipant: false });
  await sources.readSeat(subject);
  expect(readSeat).toHaveBeenLastCalledWith(expect.anything(), subject, {});
  NativeSources.release(app);
  expect(model.getConnection().status).toBe('closed');
  expect(fixture.close).toHaveBeenCalledTimes(1);
  expect(fixture.unsubscribe).toHaveBeenCalledTimes(1);
  handle.release();
  expect(NativeSources.forApp(app)).not.toBe(sources);
  NativeSources.release(app);
});
