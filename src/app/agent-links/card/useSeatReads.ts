import { useEffect, useRef, useState } from 'react';
import type { AccountWork, SeatSubject } from '../account/accountSchema';
import { SeatSubscription, type SeatSnapshot } from '../live/SeatSubscription';
import type { OwnedWork, SeatRead, Work } from '../reads';
import { useCard } from './cardContext';

export interface SeatReads {
  seat: SeatRead | null;
  owned: OwnedWork | null;
  mapWork: ReadonlyMap<string, Work>;
  snapshot: SeatSnapshot | null;
  refresh: () => void;
  recheckConversation: () => void;
}

/** Equal renders retain selectors; opening owns one dated exact read, background reads stop at process. */
export function useSeatReads(subject: SeatSubject, mapWork: readonly AccountWork[]): SeatReads {
  const { sources } = useCard();
  const registry = sources.live;
  const latest = useRef({ subject, mapWork });
  latest.current = { subject, mapWork };
  const key = JSON.stringify([subject.id, subject.sourceKey, subject.seat, subject.policy, subject.participant,
    mapWork.map(({ id, sourceKey, qitemId }) => [id, sourceKey, qitemId])]);
  const selectionKey = key;
  const [state, setState] = useState<{ key: string; value: SeatSnapshot | null; error?: SeatRead } | null>(null);
  const subscription = useRef<SeatSubscription | null>(null);
  useEffect(() => {
    const current = latest.current;
    let selected: SeatSubscription;
    try { selected = new SeatSubscription(registry, current.subject, current.mapWork,
      (signal) => sources.readSeat(current.subject, { signal })); }
    catch (error) {
      setState({ key: selectionKey, value: null, error: { state: 'unavailable', observedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Native observations could not be opened.' } });
      return;
    }
    subscription.current = selected;
    const update = (): void => setState({ key: selectionKey, value: selected.getSnapshot() });
    const unsubscribe = selected.subscribe(update);
    update();
    return () => { unsubscribe(); selected.dispose(); if (subscription.current === selected) subscription.current = null; };
  }, [sources, registry, selectionKey]);
  const snapshot = state?.key === selectionKey ? state.value : null;
  return { seat: snapshot?.seat ?? (state?.key === selectionKey ? state.error ?? null : null), owned: snapshot?.owned.value ?? null,
    mapWork: new Map([...snapshot?.mapWork ?? []].flatMap(([id, fact]) => fact.value ? [[id, fact.value] as const] : [])), snapshot,
    refresh: (): void => subscription.current?.refresh(), recheckConversation: (): void => subscription.current?.recheckConversation() };
}
