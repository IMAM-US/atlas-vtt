import { clearTimeout, setTimeout } from 'timers';
import { readHerdrSnapshot, socketIdentity, type HerdrSnapshot } from '../native/herdrRead';
import { ObservationCache } from './ObservationCache';
import { subscribeHerdr } from './herdrEvents';
import type { ConnectionState, ObservationHandle } from './types';

export interface HerdrTransport {
  snapshot: typeof readHerdrSnapshot;
  identity: typeof socketIdentity;
  subscribe: typeof subscribeHerdr;
}
const wire: HerdrTransport = { snapshot: readHerdrSnapshot, identity: socketIdentity, subscribe: subscribeHerdr };

/** A shared socket observer. Views remain dated reads until full delivery coverage is qualified. */
export class HerdrLive {
  private readonly cache: ObservationCache;
  private readonly listeners = new Set<() => void>();
  private state: ConnectionState = { status: 'closed', since: null, message: null, epoch: 0 };
  private epoch = 0;
  private refs = 0;
  private attempt = 0;
  private controller: AbortController | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private panes = '';
  private identity = '';

  constructor(private readonly sourceKey: string, readonly socketPath: string, private readonly transport: HerdrTransport = wire, delayMs = 120) {
    this.cache = new ObservationCache(sourceKey, delayMs);
  }

  getConnection = (): ConnectionState => this.state;
  subscribeConnection = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };

  watchSnapshot(): ObservationHandle<HerdrSnapshot> {
    const handle = this.cache.observe('snapshot', false, async (signal) => {
      const snapshot = await this.transport.snapshot(this.socketPath, { signal });
      if (snapshot.socketIdentity !== this.identity) {
        const error = new Error('The Herdr server changed.'); this.reconnect(this.epoch, error); throw error;
      }
      const panes = snapshot.panes.map((pane) => pane.pane_id).sort().join('\n');
      if (this.panes !== panes && !signal.aborted && !this.retry) {
        // This read is still dated and useful; the replacement subscription learns new panes.
        this.retry = setTimeout(() => { this.retry = null; this.reconnect(this.epoch, new Error('Herdr pane subscriptions changed.'), 0); }, 0);
      }
      return { kind: 'value', value: { ...snapshot, observedAt: new Date().toISOString() } };
    });
    if (++this.refs === 1) this.start();
    let released = false;
    return { ...handle, release: (): void => {
      if (released) return;
      released = true; handle.release();
      this.refs = Math.max(0, this.refs - 1);
      if (!this.refs) this.stop();
    } };
  }

  private update(state: ConnectionState): void { this.state = state; for (const listener of this.listeners) listener(); }

  private start(): void {
    const epoch = ++this.epoch;
    const controller = new AbortController();
    this.controller = controller;
    this.update({ status: this.attempt ? 'reconnecting' : 'connecting', since: null, message: null, epoch });
    this.cache.hold(epoch, 'Connecting to Herdr.');
    void this.bootstrap(epoch, controller.signal).catch((error: unknown) => this.reconnect(epoch, error));
  }

  private async bootstrap(epoch: number, signal: AbortSignal): Promise<void> {
    const before = await this.transport.snapshot(this.socketPath, { signal });
    if (signal.aborted) return;
    this.identity = before.socketIdentity;
    this.panes = before.panes.map((pane) => pane.pane_id).sort().join('\n');
    let events = 0;
    let starting = true;
    const subscription = await this.transport.subscribe(this.socketPath, before.panes.map((pane) => pane.pane_id), signal, () => {
      if (signal.aborted || epoch !== this.epoch) return;
      this.attempt = 0;
      if (starting && ++events > 1024) { this.reconnect(epoch, new Error('Herdr bootstrap event buffer overflow.')); return; }
      this.cache.invalidate(() => true);
    }, (error) => this.reconnect(epoch, error));
    if (signal.aborted) { subscription.close(); return; }
    signal.addEventListener('abort', () => subscription.close(), { once: true });
    if (this.identity !== await this.transport.identity(this.socketPath)) throw new Error('The Herdr server changed.');
    if (signal.aborted) return;
    starting = false;
    this.update({ status: 'connected', since: new Date().toISOString(), message: 'Views are dated reads.', epoch });
    this.cache.connect(epoch, signal, async () => {
      if (this.identity !== await this.transport.identity(this.socketPath)) {
        const error = new Error('The Herdr server changed.'); this.reconnect(epoch, error); throw error;
      }
    });
  }

  private reconnect(epoch: number, error: unknown, delay?: number): void {
    if (epoch !== this.epoch || this.controller?.signal.aborted || !this.refs) return;
    this.controller?.abort();
    const message = error instanceof Error ? error.message : 'Herdr unavailable.';
    this.cache.hold(epoch, message);
    this.update({ status: 'reconnecting', since: null, message, epoch });
    if (this.retry) clearTimeout(this.retry);
    this.retry = setTimeout(() => { this.retry = null; if (this.refs) this.start(); }, delay ?? Math.min(30_000, 500 * 2 ** Math.min(this.attempt++, 6)));
  }

  dispose(): void { this.refs = 0; this.stop(); this.listeners.clear(); }

  private stop(): void {
    ++this.epoch; this.controller?.abort(); this.controller = null;
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
    this.cache.hold(this.epoch, 'Herdr disconnected.');
    this.update({ status: 'closed', since: null, message: null, epoch: this.epoch });
  }
}
