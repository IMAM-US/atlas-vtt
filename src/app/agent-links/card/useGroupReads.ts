import { useEffect, useRef, useState } from 'react';
import type { SeatSubject } from '../account/accountSchema';
import type { InventoryRead } from '../live/OpenRigLive';
import type { ConnectionState, Observation, ObservationHandle } from '../live/types';
import type { OwnedWork, SeatRead } from '../reads';
import { useCard } from './cardContext';
import { InventoryAbsenceProof } from '../live/inventoryFacts';

export interface MemberState { seat: SeatRead | null; owned: OwnedWork | null; process: Observation<SeatRead>; work: Observation<OwnedWork>; inventory: Observation<InventoryRead>; inventoryReady: boolean; absence: string | null }
export interface GroupReads { members: ReadonlyMap<string, MemberState>; connections: ReadonlyMap<string, ConnectionState>; error: string | null }

/** Groups retain process, oracle and custody selectors. Exact conversation is a member-card demand. */
export function useGroupReads(subjects: readonly SeatSubject[]): GroupReads {
  const { sources } = useCard();
  const registry = sources.live;
  const latest = useRef(subjects); latest.current = subjects;
  const key = JSON.stringify(subjects.map(({ id, sourceKey, seat }) => [id, sourceKey, seat]));
  const selectionKey = key;
  const [state, setState] = useState<{ key: string; value: GroupReads } | null>(null);
  useEffect(() => {
    const releases: (() => void)[] = [];
    const retain = <T,>(handle: ObservationHandle<T>): ObservationHandle<T> => { releases.push(handle.release); return handle; };
    let entries;
    try { entries = latest.current.map((subject) => {
      const model = registry.openRig(subject.sourceKey);
      return { subject, model, process: retain(model.watchSeat(subject)), work: retain(model.watchOwned(subject)), inventory: retain(model.watchInventory(subject.seat.rigId)), absence: new InventoryAbsenceProof(subject) };
    }); } catch (error) {
      releases.forEach((release) => release());
      setState({ key: selectionKey, value: { members: new Map(), connections: new Map(), error: error instanceof Error ? error.message : 'Native observations could not be opened.' } });
      return;
    }
    const update = (): void => setState({ key: selectionKey, value: {
      members: new Map(entries.map(({ subject, process, work, inventory, absence }) => [subject.id,
        { seat: process.getSnapshot().value, owned: work.getSnapshot().value, process: process.getSnapshot(), work: work.getSnapshot(), inventory: inventory.getSnapshot(), inventoryReady: inventory.isReady(), absence: absence.read(inventory.getSnapshot(), inventory.isReady()) }])),
      connections: new Map(entries.map(({ subject, model }) => [subject.sourceKey, model.getConnection()])),
      error: null,
    } });
    const cleanups = entries.flatMap(({ model, process, work, inventory }) => [model.subscribeConnection(update), process.subscribe(update), work.subscribe(update), inventory.subscribe(update)]);
    update();
    return () => { cleanups.forEach((cleanup) => cleanup()); releases.forEach((release) => release()); };
  }, [registry, selectionKey]);
  return state?.key === selectionKey ? state.value : { members: new Map(), connections: new Map(), error: null };
}
