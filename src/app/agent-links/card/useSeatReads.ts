import { useCallback, useEffect, useRef, useState } from 'react';
import type { AccountWork, SeatSubject } from '../account/accountSchema';
import type { OwnedWork, SeatRead, Work } from '../reads';
import { useCard } from './cardContext';

export interface SeatReads {
  seat: SeatRead | null;
  owned: OwnedWork | null;
  /** Live state of the map's work rows, by account work id. */
  mapWork: ReadonlyMap<string, Work>;
  refresh: () => void;
}

/**
 * The reads a card makes on open: identity, owned work and the map's work rows. All are
 * bounded, run together, and cancelled when the subject changes; late answers are dropped.
 * Screen, views, artifacts and records stay on demand.
 */
export function useSeatReads(subject: SeatSubject, mapWork: readonly AccountWork[]): SeatReads {
  const { sources } = useCard();
  const [seat, setSeat] = useState<SeatRead | null>(null);
  const [owned, setOwned] = useState<OwnedWork | null>(null);
  const [work, setWork] = useState<ReadonlyMap<string, Work>>(new Map());
  const [attempt, setAttempt] = useState(0);
  // The reads key on the subject and work ids, so a re-render with equal rows does not re-read.
  const latest = useRef({ subject, mapWork });
  latest.current = { subject, mapWork };
  const workKey = mapWork.map((entry) => `${entry.id}:${entry.qitemId}`).join('|');
  const subjectKey = `${subject.id}:${subject.sourceKey}`;
  useEffect(() => {
    const controller = new AbortController();
    const live = (): boolean => !controller.signal.aborted;
    const current = latest.current;
    setSeat(null);
    setOwned(null);
    setWork(new Map());
    const options = { signal: controller.signal };
    void sources.readSeat(current.subject, options).then((result) => { if (live()) setSeat(result); });
    void sources.readOwnedWork(current.subject, options).then((result) => { if (live()) setOwned(result); });
    for (const entry of current.mapWork) {
      void sources.readWork(entry.sourceKey, entry.qitemId, options).then((result) => {
        if (live()) setWork((previous) => new Map(previous).set(entry.id, result));
      });
    }
    return () => controller.abort();
  }, [sources, subjectKey, workKey, attempt]);
  const refresh = useCallback((): void => setAttempt((count) => count + 1), []);
  return { seat, owned, mapWork: work, refresh };
}
