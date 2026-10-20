import type { SeatRead } from '../reads';
import { sameOpenRigProcess } from '../native/openRigRead';
import type { Observation, ObservationHandle } from './types';

export interface ConversationObservationState {
  /** A dated explicit read, retained as historical after invalidation. Never Live. */
  value: SeatRead | null;
  previous: SeatRead | null;
  pending: boolean;
  applicable: boolean;
  needsRecheck: boolean;
  changedSince: string | null;
}

/** Opening is the demand. Background process reads cannot repeat an exact-provider read. */
export class ConversationObservation {
  private readonly listeners = new Set<() => void>();
  private state: ConversationObservationState = { value: null, previous: null, pending: false, applicable: false, needsRecheck: false, changedSince: null };
  private attempted = false;
  private disposed = false;
  private controller: AbortController | null = null;
  private pinned: Observation<SeatRead> | null = null;
  private readonly unsubscribe: () => void;

  constructor(private readonly process: ObservationHandle<SeatRead>, private readonly read: (signal: AbortSignal) => Promise<SeatRead>) {
    this.unsubscribe = process.subscribe(() => this.processChanged());
    this.processChanged();
  }

  getSnapshot = (): ConversationObservationState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };

  /** An explicit recheck is the only repeat after the opening demand. */
  recheck = (): void => {
    const fact = this.process.getSnapshot();
    if (this.disposed || fact.value?.state !== 'current') return;
    this.attempted = true;
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller; this.pinned = fact;
    this.update({ ...this.state, pending: true, applicable: false });
    void this.read(controller.signal).then((value) => {
      const current = this.process.getSnapshot();
      if (controller.signal.aborted || this.disposed || this.controller !== controller
        || current.epoch !== fact.epoch || current.revision !== fact.revision) return;
      if (value.state === 'current' && fact.value?.state === 'current' && !sameOpenRigProcess(value.process, fact.value.process)) {
        // A changed process during the explicit read cannot publish a current conversation.
        this.update({ ...this.state, value, pending: false, applicable: false, needsRecheck: true, changedSince: fact.value.observedAt });
        return;
      }
      const confirmed = value.state === 'current' && value.participant !== null;
      this.update({ value, previous: confirmed ? null : this.state.value ?? this.state.previous, pending: false,
        applicable: value.state === 'current', needsRecheck: !confirmed, changedSince: null });
    }).catch(() => {
      if (!controller.signal.aborted && !this.disposed) this.update({ ...this.state, pending: false, applicable: false, needsRecheck: true });
    });
  };

  private processChanged(): void {
    const fact = this.process.getSnapshot();
    if (!this.attempted && fact.freshness !== 'refreshing' && fact.freshness !== 'unavailable') {
      this.attempted = true;
      if (fact.value?.state === 'current') this.recheck();
      else this.update({ ...this.state, needsRecheck: true });
      return;
    }
    if (!this.pinned || (fact.epoch === this.pinned.epoch && fact.revision === this.pinned.revision)) return;
    this.controller?.abort();
    const before = this.pinned.value;
    const after = fact.value;
    const changed = before?.state === 'current' && after?.state === 'current' && !sameOpenRigProcess(before.process, after.process);
    this.update({ ...this.state, pending: false, applicable: false, needsRecheck: true,
      changedSince: changed ? this.state.value?.observedAt ?? before.observedAt : this.state.changedSince });
  }

  private update(state: ConversationObservationState): void { this.state = state; for (const listener of this.listeners) listener(); }

  dispose(): void { this.disposed = true; this.controller?.abort(); this.unsubscribe(); this.listeners.clear(); }
}

/** The old exact read is never silently attached to a replacement or refused process. */
export function seatWithConversation(process: SeatRead | null, exact: ConversationObservationState | null): SeatRead | null {
  if (process?.state !== 'current' || !exact?.applicable || exact.value?.state !== 'current'
    || !sameOpenRigProcess(process.process, exact.value.process)) return process;
  return { ...process, participant: exact.value.participant, participantMessage: exact.value.participantMessage,
    observedAt: exact.value.observedAt };
}
