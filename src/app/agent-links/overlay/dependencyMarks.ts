import { freshnessLabel } from '../card/freshnessLabels';
import { clock } from '../card/timeLabels';
import type { SeatSubject } from '../account/accountSchema';
import type { InventoryRead } from '../live/OpenRigLive';
import type { Observation } from '../live/types';
import { nativeObject, type NativeObject } from '../native/openRigRead';
import type { OwnedWork, Work } from '../reads';
import { blockerReference, nativeReference } from './blockerReference';
import { appearanceBinding } from './appearanceBindings';
import { plain, factStamp } from './markSelectors';
import type { NativeMarks } from './NativeMarks';
import type { BoundAppearance, Tether } from './types';

export interface TargetSeat { appearance: BoundAppearance; subject: SeatSubject; inventory: Observation<InventoryRead> }
interface Dependencies { tethers: Tether[]; lines: string[] }

const active = (row: NativeObject): boolean => typeof row.state === 'string' && ['pending', 'in-progress', 'blocked'].includes(row.state);
const usable = <T>(fact: Observation<T>, epoch: number, source: string): boolean => fact.sourceKey === source && fact.epoch === epoch && ['live', 'read'].includes(fact.freshness) && fact.value !== null;

/** Join queue custody, never participant identity. Every component remains separately dated. */
export function dependencyMarks(
  subject: SeatSubject, owned: Observation<OwnedWork>, targets: readonly TargetSeat[], appearances: readonly BoundAppearance[], reads: NativeMarks,
): Dependencies {
  const result: Dependencies = { tethers: [], lines: [] };
  const value = owned.value?.state === 'current' ? owned.value : null;
  if (!value || owned.sourceKey !== subject.sourceKey) return result;
  const source = subject.sourceKey;
  const read = (id: string): Observation<Work> => reads.read(source, `work:${JSON.stringify(id)}`, (model) => model.watchWork(id));
  for (const row of value.items.filter((item) => item.state === 'blocked')) {
    const id = nativeReference(row.qitemId), ref = blockerReference(row.blockedOn);
    const fallback = `Waiting on ${plain(row.blockedOn) || 'unresolved dependency'} · ${freshnessLabel(owned)}`;
    const unresolved = (fact: Observation<unknown>, reason = 'target not resolved'): string => `Waiting on ${plain(row.blockedOn) || 'unresolved dependency'} (${reason}) · ${freshnessLabel(fact)}`;
    if (!id || !['qitem', 'seat'].includes(ref.kind)) { result.lines.push(fallback); continue; }
    const full = read(id), item = full.value?.state === 'current' ? full.value.item : null;
    if (!item || item.qitemId !== id || item.destinationSession !== value.sessionName || item.state !== 'blocked' || item.blockedOn !== row.blockedOn
      || !usable(owned, full.epoch, source) || !usable(full, owned.epoch, source)) { result.lines.push(unresolved(full, 'native dependency needs rechecking')); continue; }
    let owner = ref.ref, blocker: NativeObject | null = null;
    const inputs: Observation<unknown>[] = [owned, full];
    if (ref.kind === 'qitem') {
      const work = read(ref.ref);
      blocker = work.value?.state === 'current' ? work.value.item : null;
      if (!blocker || blocker.qitemId !== ref.ref || !active(blocker) || !usable(work, owned.epoch, source)) { result.lines.push(unresolved(work)); continue; }
      owner = nativeReference(blocker.destinationSession) ?? ''; inputs.push(work);
      if (!owner) { result.lines.push(unresolved(work, 'current owner not verified')); continue; }
      const waiting = nativeObject(item.waiting) && nativeObject(item.waiting.blocker) ? item.waiting.blocker : null;
      if (waiting && (waiting.ref !== ref.ref || (waiting.owner !== null && waiting.owner !== owner)
        || (waiting.state !== null && waiting.state !== blocker.state))) { result.lines.push(unresolved(work, 'native dependency needs rechecking')); continue; }
    }
    const nodes = new Map<string, TargetSeat>();
    const matching: TargetSeat[] = [];
    for (const target of targets) {
      if (target.subject.sourceKey !== source || !usable(target.inventory, owned.epoch, source)) continue;
      const inventory = target.inventory.value;
      if (!inventory?.complete) continue;
      const candidates = inventory.nodes.filter((node) => node.canonicalSessionName === owner);
      for (const node of candidates) nodes.set(JSON.stringify([node.rigId, node.nodeId]), target);
      if (candidates.some((node) => node.rigId === target.subject.seat.rigId && node.nodeId === target.subject.seat.nodeId)) matching.push(target);
    }
    const workTargets = ref.kind === 'qitem' ? appearances.filter((appearance) => appearance.account.work.some((entry) =>
      entry.id === appearance.subjectId && entry.sourceKey === source && entry.qitemId === ref.ref)) : [];
    const destinations = workTargets.length ? workTargets : nodes.size === 1 ? matching.map((entry) => entry.appearance) : [];
    if (!destinations.length || !reads.ready(source)) { result.lines.push(unresolved(full)); continue; }
    if (!workTargets.length || nodes.size === 1) inputs.push(...new Set(matching.map((entry) => entry.inventory)));
    const observed = inputs.map((fact) => fact.observedAt).filter((time): time is string => time !== null).sort()[0];
    for (const destination of destinations) {
      const ownerSeat = nodes.size === 1 ? matching.find((entry) => entry.appearance.id === destination.id) ?? matching[0] : undefined;
      const itemName = plain(workTargets.find((entry) => entry.id === destination.id)?.caption) || plain(blocker?.title) || plain(blocker?.summary) || ref.ref.slice(0, 24);
      const ownerName = ownerSeat ? `${plain(ownerSeat.appearance.caption)} · ${owner}` : owner;
      const label = ref.kind === 'qitem' ? `Waiting on ${itemName}${ownerName ? ` (owned by ${ownerName})` : ''}` : `Waiting on ${plain(destination.caption)} · ${owner}`;
      const line = `${label} · Read ${clock(observed ?? null)}`;
      const bindings = [destination, ...(ownerSeat && ownerSeat.appearance.id !== destination.id ? [ownerSeat.appearance] : [])]
        .map((appearance) => ({ appearanceId: appearance.id, binding: appearanceBinding(appearance) }));
      result.tethers.push({ key: JSON.stringify([source, id, ref.ref, destination.id]), targetId: destination.id, bindings, label: line, freshness: 'read', evidence: inputs.map(factStamp) });
      result.lines.push(line);
    }
  }
  return result;
}
