import { clearTimeout, setTimeout } from 'timers';
import type { NativeEvent } from './types';

/** Provisional client bounds, not promises made by the native emitter. */
export const EVENT_ORDER_HOLD_MS = 250;
const MAX_EVENTS = 128;
const MAX_DISTANCE = 256;
const CONTINUITY = 'Native event continuity is unverified; reconciling.';

/** One connection's contiguous prefix. Payloads only invalidate facts after ordered delivery. */
export class EventOrder {
  private readonly buffered = new Map<number, NativeEvent>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private deadline = 0;
  private waiting: Promise<void> | null = null;
  private release: (() => void) | null = null;
  private closed = false;

  constructor(private accepted: number, private readonly signal: AbortSignal,
    private readonly deliver: (event: NativeEvent) => void, private readonly checking: (pending: boolean) => void,
    private readonly failed: (error: Error) => void) {
    signal.addEventListener('abort', this.dispose, { once: true });
  }

  get cursor(): number { return this.accepted; }

  /** Checks monotonic expiry even if the event loop has delayed the timer callback. */
  ready = (): boolean => {
    if (!this.closed && this.waiting && performance.now() >= this.deadline) this.fail();
    return !this.closed && this.waiting === null;
  };

  async settled(): Promise<void> {
    while (!this.ready() && !this.closed) await this.waiting;
    this.signal.throwIfAborted();
    if (this.closed) throw new Error(CONTINUITY);
  }

  push(event: NativeEvent): void {
    this.ready();
    if (this.closed || this.signal.aborted || event.seq <= this.cursor) return;
    if (event.type === 'event.delivery_poisoned' || event.seq - this.cursor > MAX_DISTANCE) { this.fail(); return; }
    const previous = this.buffered.get(event.seq);
    if (previous) { if (JSON.stringify(previous) !== JSON.stringify(event)) this.fail(); return; }
    if (this.buffered.size >= MAX_EVENTS) { this.fail(); return; }
    this.buffered.set(event.seq, event);
    let next: NativeEvent | undefined;
    while (!this.closed && (next = this.buffered.get(this.cursor + 1))) {
      this.ready();
      if (this.closed) return;
      this.buffered.delete(next.seq);
      this.accepted = next.seq;
      this.deliver(next);
    }
    this.ready();
    if (this.closed) return;
    if (this.buffered.size) {
      if (!this.waiting) {
        this.deadline = performance.now() + EVENT_ORDER_HOLD_MS;
        this.waiting = new Promise((resolve) => { this.release = resolve; });
        this.timer = setTimeout(() => this.fail(), EVENT_ORDER_HOLD_MS);
        this.checking(true);
      }
    } else if (this.waiting) {
      // All invalidations have run before readers or source coverage can resume.
      this.clear();
      this.checking(false);
    }
  }

  private fail(): void { this.dispose(); this.failed(new Error(CONTINUITY)); }

  private clear(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.release?.(); this.release = null; this.waiting = null;
  }

  dispose = (): void => {
    this.closed = true;
    this.clear(); this.buffered.clear();
    this.signal.removeEventListener('abort', this.dispose);
  };
}
