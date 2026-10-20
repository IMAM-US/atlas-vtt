import type { AccountWork, SeatSubject } from '../account/accountSchema';
import type { NativeObject } from '../native/openRigRead';
import type { OwnedWork, SeatRead } from '../reads';
import type { ConversationObservationState } from '../live/ConversationObservation';
import { clock } from './timeLabels';

export interface Headline {
  /** The most important difference since the map, worst first. */
  identity: string;
  tone: 'changed' | 'same' | 'unavailable';
  /** New current work the map does not represent, when the live read found any. */
  work: string | null;
}

const createdAt = (item: NativeObject): string | null => (typeof item.tsCreated === 'string' ? item.tsCreated : null);

/** Which live rows are new work: owned now in `sourceKey` but not represented by the map's work of that source. */
export function newWork(owned: OwnedWork | null, mapWork: readonly AccountWork[], sourceKey: string): NativeObject[] {
  if (!owned || owned.state !== 'current') return [];
  const known = new Set(mapWork.filter((work) => work.sourceKey === sourceKey).map((work) => work.qitemId));
  return owned.items.filter((item) => typeof item.qitemId === 'string' && !known.has(item.qitemId));
}

/**
 * One line states the most consequential established difference: different seat, new
 * participant, new work, or "same as map" naming what matched. Unread facets stay unverified.
 */
export function headlineOf(subject: SeatSubject, capturedAt: string, seat: SeatRead | null, owned: OwnedWork | null, mapWork: readonly AccountWork[], conversation?: ConversationObservationState): Headline {
  const fresh = newWork(owned, mapWork, subject.sourceKey);
  const earliest = fresh.map(createdAt).filter((value): value is string => value !== null).sort()[0];
  const work = fresh.length ? `Work changed: ${fresh.length === 1 ? 'new work' : `${fresh.length} new rows`}${earliest ? ` since ${clock(earliest)}` : ''}` : null;
  if (!seat) return { identity: `Checking… On map ${clock(capturedAt)}`, tone: 'same', work };
  if (seat.state === 'different-seat') return { identity: `A different seat now uses ${subject.seat.logicalId}`, tone: 'changed', work };
  if (seat.state === 'unavailable') return { identity: `Unavailable: ${seat.message}`, tone: 'unavailable', work };
  if (seat.state === 'unverified') return { identity: 'Same seat as map; its participant is not verified right now', tone: 'unavailable', work };
  const captured = subject.participant;
  // The dated comparison is presentation evidence, independent of current action authority.
  const exact = conversation ? conversation.value : seat;
  const participant = exact?.state === 'current' ? exact.participant : null;
  const qualifier = conversation?.changedSince ? `, seat changed since ${clock(conversation.changedSince)}`
    : conversation && (!conversation.applicable || conversation.needsRecheck) ? ', needs rechecking' : '';
  const read = conversation && participant ? `read ${clock(exact?.observedAt)}${qualifier}` : '';
  if (captured && participant && (participant.conversationId !== captured.conversationId || participant.runtime !== captured.runtime)) {
    const pinned = subject.policy === 'captured-conversation';
    const occupant = conversation && !conversation.applicable ? 'Another conversation was read in this seat' : 'The seat now holds another conversation';
    return { identity: pinned ? `${occupant}; this card pins the map's (${clock(capturedAt)})${read ? `; ${read}` : ''}`
      : `New participant since the map (${participant.runtime}); the map's conversation is previous${read ? ` (${read})` : ''}`, tone: 'changed', work };
  }
  if (captured && !participant) return { identity: `Same seat as map (${clock(capturedAt)}); exact conversation not qualified now`, tone: 'same', work };
  return { identity: `Same seat${captured ? ' and conversation' : ''} as map (${clock(capturedAt)})${read ? `; ${read}` : ''}`, tone: work ? 'changed' : 'same', work };
}
