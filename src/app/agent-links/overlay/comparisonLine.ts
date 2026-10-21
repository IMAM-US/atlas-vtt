import type { SeatSubject } from '../account/accountSchema';
import type { ConversationObservationState } from '../live/ConversationObservation';
import { clock } from '../card/timeLabels';

/** This dated fact cannot borrow the separate activity fact's Live clock. */
export function comparisonLine(subject: SeatSubject, observation: ConversationObservationState | null): string | null {
  const value = observation?.value?.state === 'current' && observation.value.participant ? observation.value : observation?.previous;
  if (!subject.participant || value?.state !== 'current' || !value.participant) return null;
  if (value.participant.runtime === subject.participant.runtime && value.participant.conversationId === subject.participant.conversationId) return null;
  const historical = !observation?.applicable || observation.needsRecheck || observation.value !== value;
  return `New participant since the map · Read ${clock(value.observedAt)}${historical ? ', needs rechecking' : ''}`;
}
