import type { SeatSubject } from '../account/accountSchema';
import { freshnessLabel } from '../card/freshnessLabels';
import { inventoryAbsence } from '../live/inventoryFacts';
import type { InventoryRead } from '../live/OpenRigLive';
import type { Observation } from '../live/types';
import { nativeObject } from '../native/openRigRead';
import type { OwnedWork } from '../reads';
import { subjectKey, type Activity, type Halo, type Pip, type FactStamp } from './types';

export function factStamp<T>(fact: Observation<T>): FactStamp {
  return { sourceKey: fact.sourceKey, epoch: fact.epoch, revision: fact.revision, freshness: fact.freshness,
    observedAt: fact.observedAt, message: fact.message, ...(fact.refusal ? { refusal: fact.refusal } : {}) };
}

export function plain(value: unknown, limit = 180): string {
  return typeof value === 'string' ? [...value].slice(0, limit).map((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? ' ' : char).join('') : '';
}

export function activityHalo(subject: SeatSubject, fact: Observation<InventoryRead>, ready: boolean): Halo {
  const node = fact.value?.nodes.find((entry) => entry.nodeId === subject.seat.nodeId && entry.rigId === subject.seat.rigId);
  const oracle = node && nativeObject(node.activityState) ? node.activityState : null;
  const display = oracle?.display;
  const absence = inventoryAbsence(subject, fact, ready);
  const activity: Activity = absence ? 'absent' : typeof display === 'string' && ['working', 'idle', 'needs-input', 'unknown'].includes(display)
    ? display as Activity : 'unknown';
  const needs = oracle && nativeObject(oracle.needsInput) ? oracle.needsInput : null;
  const reason = activity === 'needs-input' && needs ? plain(needs.reason) : '';
  return { ...factStamp(fact), key: subjectKey(subject), activity,
    label: absence ?? `Seat activity now: ${activity.replace('-', ' ')}${reason ? ` (${reason})` : ''} · ${freshnessLabel(fact)}` };
}

export function workPip(fact: Observation<OwnedWork>): Pip | null {
  const owned = fact.value?.state === 'current' ? fact.value : null;
  if (owned && !owned.truncated && owned.items.length === 0 && fact.freshness === 'live') return null;
  const count = owned ? owned.truncated ? 51 : owned.items.length : null;
  const blocked = owned?.items.filter((item) => item.state === 'blocked').length ?? 0;
  const rows = count === null ? 'Owned work not confirmed' : `Owes ${count}${owned?.truncated ? '+' : ''} rows${blocked ? ` (${blocked}${owned?.truncated ? '+' : ''} blocked)` : ''}`;
  return { ...factStamp(fact), count, truncated: owned?.truncated ?? false, blocked, label: `${rows} · ${freshnessLabel(fact)}` };
}
