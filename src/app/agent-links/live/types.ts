import type { SeatSubject } from '../account/accountSchema';
import type { AgentLinkSourceSettings } from '../sourceSettings';
import type { NativeRefusal, OwnedWork, SeatRead, Work } from '../reads';

export type Freshness = 'live' | 'read' | 'last-known' | 'refreshing' | 'refused' | 'unavailable';
export interface Observation<T> {
  sourceKey: string;
  epoch: number;
  /** Invalidations within this connection; an on-demand exact read pins this version. */
  revision: number;
  freshness: Freshness;
  value: T | null;
  observedAt: string | null;
  message: string | null;
  refusal?: NativeRefusal;
}
export interface ObservationHandle<T> {
  getSnapshot: () => Observation<T>;
  subscribe: (listener: () => void) => () => void;
  refresh: () => void;
  release: () => void;
}
export interface ConnectionState {
  status: 'connecting' | 'connected' | 'reconnecting' | 'unavailable' | 'closed';
  since: string | null;
  message: string | null;
  epoch: number;
  /** Prior snapshots are frozen while new coverage waits for an ordered prefix. */
  checkingOrder?: boolean;
}
export interface LiveBackend {
  /** Process-only: never background-read provider transcript suffixes. */
  readSeat: (subject: SeatSubject, signal: AbortSignal) => Promise<SeatRead>;
  readOwned: (subject: SeatSubject, signal: AbortSignal) => Promise<OwnedWork>;
  readWork: (sourceKey: string, qitemId: string, signal: AbortSignal) => Promise<Work>;
}
export interface LiveConfiguration { settings: AgentLinkSourceSettings; backend: LiveBackend }
export interface NativeEvent { type: string; seq: number; [key: string]: unknown }
export interface Frontier { hostId: string; bootEpoch: string; seq: string }
export interface EventSubscription { close: () => void }
export interface ReadResult<T> { kind: 'value' | 'refused' | 'unavailable'; value: T | null; message?: string; refusal?: NativeRefusal }

export const seatKey = (subject: SeatSubject): string => JSON.stringify([subject.seat.rigId, subject.seat.nodeId, subject.seat.logicalId]);
