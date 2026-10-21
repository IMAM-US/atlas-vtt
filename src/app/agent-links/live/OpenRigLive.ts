import { clearTimeout, setTimeout } from 'timers';
import type { SeatSubject } from '../account/accountSchema';
import type { OwnedWork, SeatRead, Work } from '../reads';
import { readNativeJson } from '../native/httpRead';
import { nativeObject, type NativeObject, type OpenRigConnection } from '../native/openRigRead';
import { openRigConnectionOf } from '../sourceSettings';
import { ObservationCache } from './ObservationCache';
import { EventOrder } from './EventOrder';
import { invalidatedFacets } from './eventInvalidation';
import { readFrontier, subscribeOpenRig } from './openRigEvents';
import { seatKey, type ConnectionState, type Frontier, type LiveConfiguration, type NativeEvent, type ObservationHandle, type ReadResult } from './types';

export interface InventoryRead { nodes: NativeObject[]; observedAt: string; complete: true }
export interface OpenRigTransport {
  frontier: typeof readFrontier;
  subscribe: typeof subscribeOpenRig;
}
const transport: OpenRigTransport = { frontier: readFrontier, subscribe: subscribeOpenRig };

function result<T extends SeatRead | OwnedWork | Work>(value: T): ReadResult<T> {
  if (value.state === 'current') return { kind: 'value', value };
  if (value.state === 'unavailable') return { kind: value.refusal ? 'refused' : 'unavailable', value: null, message: value.message,
    ...(value.refusal ? { refusal: value.refusal } : {}) };
  return { kind: 'refused', value, message: value.message };
}

/** One source-wide invalidation owner. Its only current values come from scoped reads. */
export class OpenRigLive {
  private readonly cache: ObservationCache;
  private readonly listeners = new Set<() => void>();
  private readonly rigs = new Map<string, { rigId: string; nodeId: string; logicalId: string; refs: number }>();
  private controller: AbortController | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private refs = 0;
  private epoch = 0;
  private attempt = 0;
  private state: ConnectionState = { status: 'closed', since: null, message: null, epoch: 0 };
  private configuration: LiveConfiguration;

  constructor(configuration: LiveConfiguration, private readonly wire: OpenRigTransport = transport, delayMs = 120) {
    this.configuration = configuration;
    this.cache = new ObservationCache(configuration.settings.key, delayMs);
  }

  getConnection = (): ConnectionState => this.state;
  subscribeConnection = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };

  configure(configuration: LiveConfiguration): void {
    const changed = JSON.stringify(configuration.settings) !== JSON.stringify(this.configuration.settings);
    this.configuration = configuration;
    if (!changed) return;
    this.stop('Native source settings changed.', true);
    if (this.refs) this.start();
  }

  watchSeat(subject: SeatSubject): ObservationHandle<SeatRead> {
    this.requireSource(subject);
    return this.watch(`seat:${seatKey(subject)}`, subject.seat.rigId, false,
      async (signal) => result(await this.configuration.backend.readSeat(subject, signal)), subject);
  }

  watchOwned(subject: SeatSubject): ObservationHandle<OwnedWork> {
    this.requireSource(subject);
    return this.watch(`owned:${seatKey(subject)}`, subject.seat.rigId, true,
      async (signal) => result(await this.configuration.backend.readOwned(subject, signal)), subject);
  }

  watchWork(qitemId: string): ObservationHandle<Work> {
    // Full records include clocks whose every change is not continuously covered.
    return this.watch(`work:${JSON.stringify(qitemId)}`, '', false,
      async (signal) => result(await this.configuration.backend.readWork(this.configuration.settings.key, qitemId, signal)));
  }

  /** Complete qualified inventory for activity/membership, never exact participant proof. */
  watchInventory(rigId: string): ObservationHandle<InventoryRead> {
    return this.watch(`inventory:${JSON.stringify(rigId)}`, rigId, true, async (signal) => {
      const source = this.source();
      const nodes = await readNativeJson(source, `/api/rigs/${encodeURIComponent(rigId)}/nodes`, { signal, maxBytes: 8 * 1024 * 1024 });
      if (!Array.isArray(nodes) || nodes.length > 5000 || !nodes.every((node): node is NativeObject => nativeObject(node)
        && node.rigId === rigId && node.hostSelfId === source.hostId && typeof node.nodeId === 'string' && !!node.nodeId)
        || new Set(nodes.map((node) => node.nodeId)).size !== nodes.length) throw new Error('The native inventory identities could not be verified.');
      return { kind: 'value', value: { nodes, complete: true, observedAt: new Date().toISOString() } };
    });
  }

  private watch<T>(key: string, rigId: string, covered: boolean, read: (signal: AbortSignal) => Promise<ReadResult<T>>, subject?: SeatSubject): ObservationHandle<T> {
    const handle = this.cache.observe(key, covered, read);
    const binding = this.rigs.get(key) ?? { rigId, nodeId: subject?.seat.nodeId ?? '', logicalId: subject?.seat.logicalId ?? '', refs: 0 };
    binding.refs++; this.rigs.set(key, binding);
    if (++this.refs === 1) this.start();
    let released = false;
    return { ...handle, release: (): void => {
      if (released) return;
      released = true;
      handle.release();
      if (--binding.refs === 0) this.rigs.delete(key);
      this.refs = Math.max(0, this.refs - 1);
      if (!this.refs) this.stop('No active native-source consumers.');
    } };
  }

  private source(): OpenRigConnection {
    const source = openRigConnectionOf(this.configuration.settings);
    if (!source) throw new Error('This native source is not configured in Atlas settings.');
    return source;
  }

  private requireSource(subject: SeatSubject): void {
    if (subject.sourceKey !== this.configuration.settings.key) throw new Error('The subject belongs to a different native source.');
  }

  private update(state: ConnectionState): void { this.state = state; for (const listener of this.listeners) listener(); }

  private start(): void {
    const epoch = ++this.epoch;
    const controller = new AbortController();
    this.controller = controller;
    this.update({ status: this.attempt ? 'reconnecting' : 'connecting', since: null, message: null, epoch });
    this.cache.hold(epoch, 'Connecting to the native source.');
    if (!openRigConnectionOf(this.configuration.settings)) {
      const message = 'This native source is not configured in Atlas settings.';
      this.cache.hold(epoch, message);
      this.update({ status: 'unavailable', since: null, message, epoch });
      return;
    }
    void this.bootstrap(epoch, controller).catch((error: unknown) => this.disconnected(epoch, error));
  }

  private async bootstrap(epoch: number, controller: AbortController): Promise<void> {
    const source = this.source();
    const { signal } = controller;
    const frontier = await this.wire.frontier(source, signal);
    if (signal.aborted) return;
    let bootstrapping = true;
    let buffered = 0;
    const order = new EventOrder(Number(frontier.seq), signal, (event: NativeEvent) => {
      this.attempt = 0;
      if (bootstrapping && ++buffered > 1024) {
        this.disconnected(epoch, new Error('Native bootstrap event buffer overflow.')); return;
      }
      const facets = invalidatedFacets(event);
      this.cache.invalidate((key) => {
        const binding = this.rigs.get(key);
        if (!facets.has(key.slice(0, key.indexOf(':')))) return false;
        if (typeof event.rigId === 'string' && binding?.rigId && binding.rigId !== event.rigId) return false;
        if (typeof event.nodeId === 'string' && binding?.nodeId && binding.nodeId !== event.nodeId
          && (!event.logicalId || event.logicalId !== binding.logicalId)) return false;
        return true;
      });
    }, (checkingOrder) => {
      if (this.state.status === 'connected') this.update({ ...this.state, checkingOrder });
      if (!checkingOrder && !signal.aborted) this.cache.resume();
    }, (error) => this.disconnected(epoch, error));
    const subscription = await this.wire.subscribe(source, frontier, signal, (event) => order.push(event), (error) => this.disconnected(epoch, error));
    if (signal.aborted) { subscription.close(); return; }
    signal.addEventListener('abort', () => subscription.close(), { once: true });
    let checking: Promise<void> | null = null;
    const verify = (): Promise<void> => {
      if (!checking) checking = (async (): Promise<void> => {
        await order.settled();
        await this.verify(source, { ...frontier, seq: String(order.cursor) }, signal);
        await order.settled();
      })().catch((error: unknown) => {
        this.disconnected(epoch, error); throw error;
      }).finally(() => { checking = null; });
      return checking;
    };
    do { await verify(); } while (!signal.aborted && !order.ready());
    if (signal.aborted || epoch !== this.epoch) return;
    bootstrapping = false;
    this.update({ status: 'connected', since: new Date().toISOString(), message: null, epoch });
    this.cache.connect(epoch, signal, verify, order.ready);
  }

  private async verify(source: OpenRigConnection, expected: Frontier, signal: AbortSignal): Promise<void> {
    const current = await this.wire.frontier(source, signal);
    if (current.hostId !== expected.hostId || current.bootEpoch !== expected.bootEpoch || BigInt(current.seq) < BigInt(expected.seq)) {
      throw new Error('The native source epoch changed; reconciling current facts.');
    }
    signal.throwIfAborted();
  }

  private disconnected(epoch: number, error: unknown): void {
    if (epoch !== this.epoch || this.controller?.signal.aborted || !this.refs) return;
    this.controller?.abort();
    const message = error instanceof Error ? error.message : 'Native source unavailable.';
    this.cache.hold(epoch, message);
    this.update({ status: 'reconnecting', since: null, message, epoch });
    const delay = Math.min(30_000, 500 * 2 ** Math.min(this.attempt++, 6));
    this.retry = setTimeout(() => { this.retry = null; if (this.refs) this.start(); }, delay);
  }

  /** Unload and last-consumer release cancel retries, requests and subscriptions. */
  dispose(): void { this.refs = 0; this.stop('Native model unloaded.'); this.listeners.clear(); }

  private stop(message: string, clear = false): void {
    ++this.epoch;
    this.controller?.abort(); this.controller = null;
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
    this.cache.hold(this.epoch, message, clear);
    this.update({ status: 'closed', since: null, message, epoch: this.epoch });
  }
}
