import type { SeatSubject } from '../account/accountSchema';
import { clock } from '../card/timeLabels';
import type { InventoryRead } from './OpenRigLive';
import type { Observation } from './types';

/** A negative is meaningful only in this qualified, complete, currently covered inventory. */
export function inventoryAbsence(subject: SeatSubject, fact: Observation<InventoryRead> | null | undefined, ready: boolean): string | null {
  if (!ready || fact?.freshness !== 'live' || fact.sourceKey !== subject.sourceKey || !fact.value?.complete || !fact.observedAt) return null;
  if (fact.value.nodes.some((node) => node.rigId !== subject.seat.rigId)) return null;
  return fact.value.nodes.some((node) => node.nodeId === subject.seat.nodeId) ? null
    : `Not in OpenRig now (inventory ${clock(fact.observedAt)})`;
}

/** An order hold may retain a negative already proved by this exact frozen observation. */
export class InventoryAbsenceProof {
  private proven: Observation<InventoryRead> | null = null;
  constructor(private readonly subject: SeatSubject) {}

  read(fact: Observation<InventoryRead>, ready: boolean): string | null {
    const current = inventoryAbsence(this.subject, fact, ready);
    if (current) { this.proven = fact; return current; }
    if (!ready && fact === this.proven && fact.freshness === 'live') return inventoryAbsence(this.subject, fact, true);
    this.proven = null; return null;
  }
}
