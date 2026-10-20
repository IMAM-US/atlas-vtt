import type { AccountWork, SeatSubject } from '../account/accountSchema';
import type { NativeObject } from '../native/openRigRead';
import type { OwnedWork, SeatRead } from '../reads';
import { clock } from './timeLabels';

export interface Headline {
  /** The most important difference since the map, worst first. */
  identity: string;
  tone: 'changed' | 'same' | 'unavailable';
  /** New current work the map does not represent, when the live read found any. */
  work: string | null;
}

const createdAt = (item: NativeObject): string | null => (typeof item.tsCreated === 'string' ? item.tsCreated : null);

/** Which live rows are new work: owned now but not represented by the map. */
export function newWork(owned: OwnedWork | null, mapWork: readonly AccountWork[]): NativeObject[] {
  if (!owned || owned.state !== 'current') return [];
  const known = new Set(mapWork.map((work) => work.qitemId));
  return owned.items.filter((item) => typeof item.qitemId === 'string' && !known.has(item.qitemId));
}

/**
 * One line states the most consequential established difference: different seat, new
 * participant, new work, or "same as map" naming what matched. Unread facets stay unverified.
 */
export function headlineOf(subject: SeatSubject, capturedAt: string, seat: SeatRead | null, owned: OwnedWork | null, mapWork: readonly AccountWork[]): Headline {
  const fresh = newWork(owned, mapWork);
  const earliest = fresh.map(createdAt).filter((value): value is string => value !== null).sort()[0];
  const work = fresh.length ? `Work changed: ${fresh.length === 1 ? 'new work' : `${fresh.length} new rows`}${earliest ? ` since ${clock(earliest)}` : ''}` : null;
  if (!seat) return { identity: `Checking… On map ${clock(capturedAt)}`, tone: 'same', work };
  if (seat.state === 'different-seat') return { identity: `A different seat now uses ${subject.seat.logicalId}`, tone: 'changed', work };
  if (seat.state === 'unavailable') return { identity: `Unavailable: ${seat.message}`, tone: 'unavailable', work };
  if (seat.state === 'unverified') return { identity: 'Same seat as map; its participant is not verified right now', tone: 'unavailable', work };
  const captured = subject.participant;
  if (captured && seat.participant && seat.participant.conversationId !== captured.conversationId) {
    return { identity: `New participant since the map (${seat.participant.runtime}); the map's conversation is previous`, tone: 'changed', work };
  }
  if (captured && !seat.participant) return { identity: `Same seat as map (${clock(capturedAt)}); exact conversation not qualified now`, tone: 'same', work };
  return { identity: `Same seat${captured ? ' and conversation' : ''} as map (${clock(capturedAt)})`, tone: work ? 'changed' : 'same', work };
}
