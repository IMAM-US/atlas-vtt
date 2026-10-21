import type { App } from 'obsidian';
import type { ViewAtlasStore } from '../../storeFactory';
import type { NativeSources } from '../NativeSources';
import type { InventoryRead } from '../live/OpenRigLive';
import type { SeatSubject } from '../account/accountSchema';
import type { Observation } from '../live/types';
import { AccountLoads } from './AccountLoads';
import { appearanceReferences, appearanceSubject, groupSeats, resolvedAppearances } from './appearanceBindings';
import { dependencyMarks, type TargetSeat } from './dependencyMarks';
import { activityHalo, plain, workPip } from './markSelectors';
import { NativeMarks } from './NativeMarks';
import { comparisonLine } from './comparisonLine';
import { subjectKey, type AppearanceMark, type Halo } from './types';

export interface LiveHover { id: string; lines: readonly string[] }

/** Per-view, memory-only observation owner. No store actions or native commands. */
export class LiveLayer {
  private enabled = true;
  private active = false;
  private disposed = false;
  private updating = false;
  private again = false;
  private loads: AccountLoads | null = null;
  private readonly native: NativeMarks;
  private readonly listeners = new Set<() => void>();
  private readonly cleanups: (() => void)[] = [];
  private marks: readonly AppearanceMark[] = [];
  private prior = new Map<string, { binding: string; halo: Halo; pip: AppearanceMark['pip']; tethers: AppearanceMark['tethers']; lines: readonly string[] }>();
  private hoverId: string | null = null;
  private hover: LiveHover | null = null;

  constructor(private readonly app: App, private readonly store: ViewAtlasStore, private readonly sources: Pick<NativeSources, 'live' | 'loadAccount'>) {
    this.native = new NativeMarks(sources.live, this.changed);
    this.cleanups.push(store.subscribe((state, previous) => {
      if (state.objects.tokens !== previous.objects.tokens || state.objects.texts !== previous.objects.texts || state.mapPath !== previous.mapPath
        || state.isGMView !== previous.isGMView || state.isPlayerView !== previous.isPlayerView || state.isMapLoading !== previous.isMapLoading) {
        if (state.mapPath !== previous.mapPath) this.clear();
        this.changed();
      }
    }), sources.live.subscribe(this.changed));
    const refs = [
      app.vault.on('modify', (file) => this.loads?.invalidate(file.path)),
      app.vault.on('create', (file) => this.loads?.invalidate(file.path)),
      app.vault.on('delete', (file) => this.loads?.invalidate(file.path)),
      app.vault.on('rename', (file, oldPath) => { this.loads?.invalidate(oldPath); this.loads?.invalidate(file.path); }),
    ];
    this.cleanups.push(() => refs.forEach((ref) => app.vault.offref(ref)));
    this.changed();
  }

  isEnabled = (): boolean => this.enabled;
  getMarks = (): readonly AppearanceMark[] => this.marks;
  getHover = (): LiveHover | null => this.hover;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  toggle = (): void => { this.enabled = !this.enabled; this.changed(); };

  setHovered(id: string | null): void {
    if (id === this.hoverId) return;
    this.hoverId = id; this.updateHover(); this.emit();
  }

  private changed = (): void => {
    if (this.disposed) return;
    if (this.updating) { this.again = true; return; }
    this.updating = true;
    do { this.again = false; this.rebuild(); } while (this.again && !this.disposed);
    this.updating = false; this.updateHover(); this.emit();
  };

  private rebuild(): void {
    const state = this.store.getState();
    if (!this.enabled || state.isPlayerView || !state.isGMView || state.isMapLoading) { this.clear(); return; }
    this.active = true;
    this.loads ??= new AccountLoads((path, signal) => this.sources.loadAccount(path, { signal }), this.changed);
    const references = appearanceReferences(state);
    this.loads.setPaths(new Set(references.map((entry) => entry.path)));
    const appearances = resolvedAppearances(references, this.loads);
    this.native.begin();
    const targets: TargetSeat[] = appearances.flatMap((appearance) => {
      const subject = appearanceSubject(appearance);
      return subject?.kind === 'seat' ? [{ appearance, subject, inventory: this.inventory(subject) }] : [];
    });
    const prior = new Map<string, (typeof this.prior extends Map<string, infer T> ? T : never)>();
    const marks: AppearanceMark[] = [];
    for (const appearance of appearances) {
      if (!appearance.token) continue;
      const subject = appearanceSubject(appearance);
      const binding = JSON.stringify([appearance.path, appearance.subjectId, appearance.revision]);
      if (subject?.kind === 'seat') {
        const source = subject.sourceKey, key = JSON.stringify([appearance.id, subjectKey(subject)]);
        const version = JSON.stringify([binding, this.sources.live.getRevision(source)]);
        const inventory = this.inventory(subject);
        const owned = this.native.read(source, `owned:${subjectKey(subject)}`, (model) => model.watchOwned(subject));
        const deps = dependencyMarks(subject, owned, targets, appearances, this.native);
        const pip = workPip(owned), comparison = comparisonLine(subject, this.sources.live.peekConversation(subject));
        const next = { binding: version, halo: activityHalo(subject, inventory, this.native.ready(source)), pip,
          tethers: deps.tethers, lines: [...(comparison ? [comparison] : []), ...(pip ? [pip.label] : []), ...deps.lines] };
        const old = this.prior.get(key);
        const held = this.native.model(source).getConnection().checkingOrder;
        const fact = held ? old?.binding === version ? old : { ...next, halo: this.unknown(source, key, 'Checking native event order'),
          pip: { sourceKey: source, epoch: -1, revision: 0, observedAt: null, message: 'Checking native event order', count: null, truncated: false, blocked: 0, freshness: 'refreshing' as const, label: 'Owned work not confirmed · Checking native event order' }, tethers: [], lines: [] } : next;
        prior.set(key, fact);
        marks.push({ id: appearance.id, binding: version, halos: [fact.halo], pip: fact.pip, tethers: fact.tethers,
          lines: ['Current seat', fact.halo.label, ...fact.lines] });
      } else if (subject?.kind === 'group') {
        const lines: string[] = [], halos: Halo[] = [];
        for (const member of groupSeats(appearance)) {
          const seat = member.subject;
          const key = JSON.stringify([appearance.id, member.id]), source = seat?.sourceKey ?? '';
          const version = JSON.stringify([binding, this.sources.live.getRevision(source)]);
          let halo = seat ? activityHalo(seat, this.inventory(seat), this.native.ready(source)) : this.unknown(source, key, 'Member is not a bound seat');
          if (seat && this.native.model(source).getConnection().checkingOrder) halo = this.prior.get(key)?.binding === version ? this.prior.get(key)!.halo : this.unknown(source, key, 'Checking native event order');
          prior.set(key, { binding: version, halo, pip: null, tethers: [], lines: [] });
          halos.push(halo);
          const activity = halo.activity === 'absent' ? halo.label : halo.activity === 'unknown' ? '' : halo.activity.replace('-', ' ');
          const exception = halo.freshness === 'live' ? '' : halo.label.split(' · ').slice(1).join(' · ');
          lines.push([plain(member.lens), plain(seat?.caption ?? member.id), 'current seat', activity, exception].filter(Boolean).join(' · '));
        }
        marks.push({ id: appearance.id, binding, halos, pip: null, tethers: [], lines });
      } else if (!appearance.account.work.some((work) => work.id === appearance.subjectId)) {
        const reason = 'Subject not found in this account';
        marks.push({ id: appearance.id, binding, halos: [this.unknown('', appearance.id, reason)], pip: null, tethers: [], lines: [`Unavailable: ${reason}`] });
      }
    }
    for (const reference of references) if (reference.token && !appearances.some((entry) => entry.id === reference.id)) {
      const message = this.loads.get(reference.path)?.error ?? 'Reading the account…';
      marks.push({ id: reference.id, binding: JSON.stringify([reference.path, reference.subjectId]), halos: [this.unknown('', reference.id, message)], pip: null, tethers: [], lines: [`Unavailable: ${plain(message)}`] });
    }
    this.native.finish();
    if (!this.again) { this.prior = prior; this.marks = marks; }
  }

  private inventory(subject: SeatSubject): Observation<InventoryRead> {
    return this.native.read(subject.sourceKey, `inventory:${JSON.stringify(subject.seat.rigId)}`, (model) => model.watchInventory(subject.seat.rigId));
  }

  private unknown(sourceKey: string, key: string, message: string): Halo {
    return { key, sourceKey, activity: 'unknown', freshness: 'unavailable', epoch: -1, revision: 0, observedAt: null, message, label: `Seat activity now: unknown · Unavailable: ${plain(message)}` };
  }

  private updateHover(): void {
    const mark = this.active ? this.marks.find((entry) => entry.id === this.hoverId) : null;
    const next = mark ? { id: mark.id, lines: mark.lines.length > 24 ? [...mark.lines.slice(0, 24), 'More facts on the card'] : mark.lines } : null;
    if (JSON.stringify(next) !== JSON.stringify(this.hover)) this.hover = next;
  }

  private emit(): void { for (const listener of this.listeners) listener(); }

  private clear(): void {
    this.active = false; this.loads?.dispose(); this.loads = null;
    this.native.dispose(); this.marks = []; this.prior.clear(); this.hoverId = null; this.hover = null;
  }

  dispose(): void {
    this.disposed = true;
    for (const cleanup of this.cleanups) cleanup();
    this.clear(); this.emit(); this.listeners.clear();
  }
}
