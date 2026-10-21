import type { LiveSources } from '../live/LiveSources';
import type { OpenRigLive } from '../live/OpenRigLive';
import type { Observation, ObservationHandle } from '../live/types';

interface Retained { source: string; handle: ObservationHandle<unknown>; unsubscribe: () => void }

/** Ref-counted selector ownership only. The plugin's shared model owns all transport. */
export class NativeMarks {
  private readonly entries = new Map<string, Retained>();
  private readonly models = new Map<string, { model: OpenRigLive; unsubscribe: () => void }>();
  private used = new Set<string>();

  constructor(readonly registry: LiveSources, private readonly changed: () => void) {}

  begin(): void { this.used = new Set(); }

  model(source: string): OpenRigLive {
    let entry = this.models.get(source);
    if (!entry) {
      const model = this.registry.openRig(source);
      entry = { model, unsubscribe: model.subscribeConnection(this.changed) }; this.models.set(source, entry);
    }
    return entry.model;
  }

  read<T>(source: string, key: string, acquire: (model: OpenRigLive) => ObservationHandle<T>): Observation<T> {
    const id = JSON.stringify([source, this.registry.getRevision(source), key]);
    this.used.add(id);
    let entry = this.entries.get(id);
    if (!entry) {
      try {
        const handle = acquire(this.model(source));
        entry = { source, handle, unsubscribe: handle.subscribe(this.changed) };
        this.entries.set(id, entry);
      } catch (error) {
        return { sourceKey: source, epoch: this.model(source).getConnection().epoch, revision: 0, freshness: 'unavailable', value: null,
          observedAt: null, message: error instanceof Error ? error.message : 'Native observation is unavailable.' };
      }
    }
    return entry.handle.getSnapshot() as Observation<T>;
  }

  ready(source: string): boolean {
    const connection = this.model(source).getConnection();
    if (connection.status !== 'connected' || connection.checkingOrder) return false;
    return [...this.entries.values()].filter((entry) => entry.source === source).every((entry) => entry.handle.isReady());
  }

  finish(): void {
    for (const [key, entry] of this.entries) if (!this.used.has(key)) {
      entry.unsubscribe(); this.entries.delete(key); entry.handle.release();
    }
    for (const [source, entry] of this.models) if (![...this.entries.values()].some((item) => item.source === source)) {
      entry.unsubscribe(); this.models.delete(source);
    }
  }

  dispose(): void {
    for (const entry of this.models.values()) entry.unsubscribe();
    for (const entry of this.entries.values()) { entry.unsubscribe(); entry.handle.release(); }
    this.entries.clear(); this.models.clear();
  }
}
