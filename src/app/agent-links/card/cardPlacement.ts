import type { ObjectAnchor } from './useObjectAnchor';

export interface CardBox { left: number; top: number; maxHeight: number }
/** The parts of the view a card must keep clear of: the top bar row and the bottom toolbar row. */
export interface ViewInsets { top: number; bottom: number }
export const CARD_WIDTH = 340;
const MARGIN = 8;
const GAP = 12;
const MIN_HEIGHT = 240;

/**
 * Where the card opens beside its object: past the token and its nameplate on the side with
 * room (else the other side), never off the view, between the top bar and the bottom
 * toolbar, with the height capped to that room so the card scrolls inside itself.
 */
export function cardPlacement(anchor: ObjectAnchor, container: { width: number; height: number }, insets: ViewInsets = { top: 0, bottom: 0 }): CardBox {
  const clearance = Math.max(anchor.radius, anchor.labelHalfWidth) + GAP;
  const right = anchor.x + clearance;
  const left = right + CARD_WIDTH <= container.width - MARGIN
    ? right
    : Math.max(MARGIN, Math.min(anchor.x - clearance - CARD_WIDTH, container.width - MARGIN - CARD_WIDTH));
  const ceiling = insets.top + MARGIN;
  const floor = container.height - insets.bottom - MARGIN;
  const wanted = anchor.y - anchor.radius;
  const lowest = Math.max(ceiling, floor - MIN_HEIGHT);
  const top = Math.max(ceiling, Math.min(wanted, lowest));
  return { left, top, maxHeight: Math.max(MIN_HEIGHT, floor - top) };
}
