import type { ObjectAnchor } from './useObjectAnchor';

export interface CardBox { left: number; top: number; maxHeight: number }
export const CARD_WIDTH = 340;
const MARGIN = 8;
const GAP = 12;
const MIN_HEIGHT = 240;

/**
 * Where the card opens beside its object: to the right of the token when there is room,
 * otherwise to its left, never off the view, with the height capped to the room below.
 */
export function cardPlacement(anchor: ObjectAnchor, container: { width: number; height: number }): CardBox {
  const right = anchor.x + anchor.radius + GAP;
  const left = right + CARD_WIDTH <= container.width - MARGIN
    ? right
    : Math.max(MARGIN, Math.min(anchor.x - anchor.radius - GAP - CARD_WIDTH, container.width - MARGIN - CARD_WIDTH));
  const wanted = anchor.y - 24;
  const lowest = Math.max(MARGIN, container.height - MARGIN - MIN_HEIGHT);
  const top = Math.max(MARGIN, Math.min(wanted, lowest));
  return { left, top, maxHeight: Math.max(MIN_HEIGHT, container.height - top - MARGIN) };
}
