import { clearTimeout, setTimeout } from 'timers';
import type { Observation, ObservationHandle, ReadResult } from './types';

interface Slot<T> {
  refs: number;
  covered: boolean;
  version: number;
  dirty: boolean;
  pending: AbortController | null;
  read: (signal: AbortSignal) => Promise<ReadResult<T>>;
  fact: Observation<T>;
  listeners: Set<() => void>;
}
interface Context { epoch: number; signal: AbortSignal; verify: () => Promise<void>; ready: () => boolean }

/** A disposable observation store. No Atlas store, persistence or undo dependencies. */
export class ObservationCache {
  private readonly slots = new Map<string, Slot<unknown>>();
  private context: Context | null = null;
  private epoch = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = 0;

  constructor(private readonly sourceKey: string, private readonly delayMs = 120, private readonly capacity = 256) {}

  observe<T>(key: string, covered: boolean, read: Slot<T>['read']): ObservationHandle<T> {
    if (!this.slots.has(key) && this.slots.size >= this.capacity) throw new Error('Too many native observations are open.');
    let slot = this.slots.get(key) as Slot<T> | undefined;
    if (!slot) {
      slot = { refs: 0, covered, read, version: 0, dirty: true, pending: null, listeners: new Set(),
        fact: { sourceKey: this.sourceKey, epoch: this.epoch, revision: 0, freshness: 'refreshing', value: null, observedAt: null, message: null } };
      this.slots.set(key, slot);
    }
    const owned = slot;
    owned.refs++;
    let released = false;
    this.schedule();
    return {
      getSnapshot: () => owned.fact,
      subscribe: (listener): (() => void) => { owned.listeners.add(listener); return () => owned.listeners.delete(listener); },
      isReady: (): boolean => !released && this.context !== null && this.context.ready(),
      whenReady: async (): Promise<void> => {
        const context = this.context;
        if (released || !context) throw new Error('Native observation connection is unavailable.');
        await context.verify();
        context.signal.throwIfAborted();
        if (released || this.context !== context) throw new Error('Native observation connection changed.');
      },
      refresh: (): void => this.invalidate((candidate) => candidate === key),
      release: (): void => {
        if (released) return;
        released = true;
        if (--owned.refs === 0) {
          if (owned.pending) { owned.pending.abort(); owned.pending = null; this.running--; }
          this.slots.delete(key); owned.listeners.clear(); this.schedule();
        }
      },
    };
  }

  connect(epoch: number, signal: AbortSignal, verify: () => Promise<void>, ready: () => boolean = () => true): void {
    this.epoch = epoch;
    this.context = { epoch, signal, verify, ready };
    this.invalidate(() => true);
  }

  /** A temporary order barrier may reopen without invalidating process observations. */
  resume(): void { this.schedule(); }

  hold(epoch: number, message: string, clear = false): void {
    this.epoch = epoch;
    this.context = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    for (const slot of this.slots.values()) {
      slot.version++;
      slot.dirty = true;
      if (slot.pending) { slot.pending.abort(); slot.pending = null; this.running--; }
      this.publish(slot, { ...slot.fact, epoch, revision: slot.version, value: clear ? null : slot.fact.value,
        observedAt: clear ? null : slot.fact.observedAt,
        freshness: clear || slot.fact.value === null ? 'unavailable' : 'last-known', message });
    }
  }

  invalidate(matches: (key: string) => boolean): void {
    for (const [key, slot] of this.slots) {
      if (!matches(key)) continue;
      slot.version++;
      slot.dirty = true;
      if (this.context && slot.fact.freshness !== 'refreshing') this.publish(slot, { ...slot.fact, revision: slot.version, freshness: 'refreshing', message: null });
    }
    this.schedule();
  }

  private publish<T>(slot: Slot<T>, fact: Observation<T>): void {
    slot.fact = fact;
    for (const listener of slot.listeners) listener();
  }

  private schedule(): void {
    if (!this.context || !this.context.ready() || this.timer || this.running >= 4 || ![...this.slots.values()].some((slot) => slot.dirty && !slot.pending)) return;
    this.timer = setTimeout(() => { this.timer = null; this.pump(); }, this.delayMs);
  }

  private pump(): void {
    const context = this.context;
    if (!context || !context.ready() || context.signal.aborted) return;
    for (const [key, slot] of this.slots) {
      if (this.running >= 4) break;
      if (!slot.dirty || slot.pending) continue;
      const controller = new AbortController();
      const signal = AbortSignal.any([controller.signal, context.signal]);
      const version = slot.version;
      slot.pending = controller;
      slot.dirty = false;
      this.running++;
      void this.read(key, slot, context, controller, signal, version);
    }
  }

  private async read(key: string, slot: Slot<unknown>, context: Context, controller: AbortController, signal: AbortSignal, version: number): Promise<void> {
    try {
      const result = await slot.read(signal);
      if (signal.aborted || this.context !== context || this.slots.get(key) !== slot || slot.version !== version) return;
      await context.verify();
      if (signal.aborted || this.context !== context || this.slots.get(key) !== slot || slot.version !== version) return;
      // A new hole can open after verify resolves but before this continuation runs.
      if (!context.ready()) { slot.dirty = true; return; }
      const value = result.value ?? (result.kind !== 'value' ? slot.fact.value : null);
      const observedAt = result.value && typeof result.value === 'object' && 'observedAt' in result.value
        && typeof result.value.observedAt === 'string' ? result.value.observedAt : new Date().toISOString();
      this.publish(slot, { sourceKey: this.sourceKey, epoch: context.epoch, revision: version, value,
        observedAt: result.kind === 'value' || result.value !== null ? observedAt : slot.fact.observedAt,
        freshness: result.kind === 'value' ? slot.covered ? 'live' : 'read' : result.kind === 'refused' ? 'refused' : value !== null ? 'last-known' : 'unavailable',
        message: result.message ?? null, ...(result.refusal ? { refusal: result.refusal } : {}) });
    } catch (error) {
      if (!signal.aborted && this.context === context && this.slots.get(key) === slot && slot.version === version) {
        this.publish(slot, { ...slot.fact, freshness: slot.fact.value !== null ? 'last-known' : 'unavailable',
          message: error instanceof Error ? error.message : 'Native observation unavailable.' });
      }
    } finally {
      if (slot.pending === controller) { slot.pending = null; this.running--; }
      this.schedule();
    }
  }
}
