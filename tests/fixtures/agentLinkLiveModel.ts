import { vi } from 'vitest';
import { OpenRigLive, type OpenRigTransport } from '../../src/app/agent-links/live/OpenRigLive';
import { defaultSourceSettings } from '../../src/app/agent-links/sourceSettings';
import type { LiveConfiguration, NativeEvent } from '../../src/app/agent-links/live/types';
import type { SeatSubject } from '../../src/app/agent-links/account/accountSchema';
import type { OwnedWork, SeatRead } from '../../src/app/agent-links/reads';

export const subject: SeatSubject = { id: 'authored-a', kind: 'seat', caption: 'Builder', sourceKey: 'a', policy: 'current-seat', workIds: [], observedAt: '2026-01-01T00:00:00Z',
  seat: { rigId: 'rig-a', nodeId: 'node-a', logicalId: 'team.builder' } };
export const owned = (id: string, truncated = false): OwnedWork => ({ state: 'current', items: [{ qitemId: id }], sessionName: 'builder@example', truncated, observedAt: new Date().toISOString() });
export const seat = (pid: number): SeatRead => ({ state: 'current', node: { nodeId: 'node-a' },
  process: { runtime: 'codex', sessionName: 'builder@example', bindingId: `binding-${pid}`, tmuxPane: '%1', processId: pid },
  participant: null, participantMessage: 'Exact conversation is read on demand.', cwd: null, observedAt: new Date().toISOString() });

export function fixture(key = 'a'): { model: OpenRigLive; config: LiveConfiguration; wire: OpenRigTransport; emit: (type: string, seq?: number) => void; disconnect: () => void; close: ReturnType<typeof vi.fn>; setFrontier: (seq: string) => void } {
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
