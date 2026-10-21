import type { AccountWork, SeatSubject } from '../account/accountSchema';
import type { HerdrSnapshot } from '../native/herdrRead';
import type { OwnedWork, SeatRead, Work } from '../reads';
import { ConversationObservation, seatWithConversation, type ConversationObservationState } from './ConversationObservation';
import type { LiveSources } from './LiveSources';
import type { OpenRigLive, InventoryRead } from './OpenRigLive';
import type { HerdrLive } from './HerdrLive';
import type { ConnectionState, Observation, ObservationHandle } from './types';
import { InventoryAbsenceProof } from './inventoryFacts';

export interface SeatSnapshot {
  seat: SeatRead | null;
  process: Observation<SeatRead>;
  conversation: ConversationObservationState;
  owned: Observation<OwnedWork>;
  inventory: Observation<InventoryRead>;
  inventoryReady: boolean;
  absence: string | null;
  mapWork: ReadonlyMap<string, Observation<Work>>;
  connections: ReadonlyMap<string, ConnectionState>;
  herdr: readonly { connection: ConnectionState; observation: Observation<HerdrSnapshot> }[];
}

/** A card's retained selectors, with an independently dated opening conversation read. */
export class SeatSubscription {
  private readonly process: ObservationHandle<SeatRead>;
  private readonly owned: ObservationHandle<OwnedWork>;
  private readonly inventory: ObservationHandle<InventoryRead>;
  private readonly conversation: ConversationObservation;
  private readonly work = new Map<string, ObservationHandle<Work>>();
  private readonly models = new Map<string, OpenRigLive>();
  private views: { model: HerdrLive; observation: ObservationHandle<HerdrSnapshot> }[] = [];
  private viewCleanups: (() => void)[] = [];
  private readonly listeners = new Set<() => void>();
  private readonly cleanups: (() => void)[] = [];
  private snapshot: SeatSnapshot;
  private disposed = false;
  private readonly absenceProof: InventoryAbsenceProof;
  private publishComparison: () => void = (): void => {};

  constructor(registry: LiveSources, subject: SeatSubject, mapWork: readonly AccountWork[], readExact: (signal: AbortSignal) => Promise<SeatRead>) {
    this.absenceProof = new InventoryAbsenceProof(subject);
    const releases: (() => void)[] = [];
    const retain = <T>(handle: ObservationHandle<T>): ObservationHandle<T> => { releases.push(handle.release); return handle; };
    let conversation: ConversationObservation | undefined;
    try {
      const source = registry.openRig(subject.sourceKey);
      this.models.set(subject.sourceKey, source);
      this.process = retain(source.watchSeat(subject));
      this.owned = retain(source.watchOwned(subject));
      this.inventory = retain(source.watchInventory(subject.seat.rigId));
      for (const entry of mapWork) {
        if (this.work.has(entry.id)) continue;
        const model = registry.openRig(entry.sourceKey);
        this.models.set(entry.sourceKey, model);
        this.work.set(entry.id, retain(model.watchWork(entry.qitemId)));
      }
      this.conversation = conversation = new ConversationObservation(this.process, readExact);
      let sourceRevision = registry.getRevision(subject.sourceKey);
      this.publishComparison = (): void => registry.setConversation(subject, this, sourceRevision, this.conversation.getSnapshot());
      this.cleanups.push(() => registry.setConversation(subject, this, sourceRevision, null));
      this.snapshot = this.collect();
      const changed = (): void => { if (!this.disposed) { this.snapshot = this.collect(); for (const listener of this.listeners) listener(); } };
      for (const handle of [this.process, this.owned, this.inventory, ...this.work.values()]) {
        this.cleanups.push(handle.subscribe(changed));
      }
      this.cleanups.push(this.conversation.subscribe(changed));
      for (const model of this.models.values()) this.cleanups.push(model.subscribeConnection(changed));
      const bindViews = (): void => {
        this.releaseViews();
        this.views = registry.herdr(subject.sourceKey).map((model) => ({ model, observation: model.watchSnapshot() }));
        this.viewCleanups = this.views.flatMap((view) => [view.model.subscribeConnection(changed), view.observation.subscribe(changed)]);
        changed();
      };
      bindViews();
      let revision = registry.getRevision(subject.sourceKey);
      this.cleanups.push(registry.subscribe(() => {
        const next = registry.getRevision(subject.sourceKey);
        if (next === revision) return;
        revision = next;
        sourceRevision = next;
        this.conversation.sourceChanged(); bindViews();
      }));
    } catch (error) {
      for (const cleanup of this.cleanups) cleanup();
      conversation?.dispose(); this.releaseViews(); releases.forEach((release) => release());
      throw error;
    }
  }

  getSnapshot = (): SeatSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };

  refresh = (): void => {
    this.conversation.refresh();
    for (const handle of [this.owned, this.inventory, ...this.work.values(), ...this.views.map((view) => view.observation)]) handle.refresh();
  };
  recheckConversation = (): void => this.conversation.recheck();

  private collect(): SeatSnapshot {
    this.publishComparison();
    const process = this.process.getSnapshot(), conversation = this.conversation.getSnapshot();
    return { seat: seatWithConversation(process.value, conversation), process, conversation,
      owned: this.owned.getSnapshot(), inventory: this.inventory.getSnapshot(), inventoryReady: this.inventory.isReady(),
      absence: this.absenceProof.read(this.inventory.getSnapshot(), this.inventory.isReady()),
      mapWork: new Map([...this.work].map(([id, handle]) => [id, handle.getSnapshot()])),
      connections: new Map([...this.models].map(([key, model]) => [key, model.getConnection()])),
      herdr: this.views.map((view) => ({ connection: view.model.getConnection(), observation: view.observation.getSnapshot() })) };
  }

  dispose(): void {
    this.disposed = true;
    for (const cleanup of this.cleanups) cleanup();
    this.conversation.dispose();
    for (const handle of [this.process, this.owned, this.inventory, ...this.work.values()]) handle.release();
    this.releaseViews();
    this.listeners.clear();
  }

  private releaseViews(): void {
    for (const cleanup of this.viewCleanups) cleanup();
    for (const view of this.views) view.observation.release();
    this.viewCleanups = []; this.views = [];
  }
}
