export interface Point { x: number; y: number }

/** Arc polyline, with gaps generated explicitly rather than a renderer-specific dash extension. */
export function arcPoints(center: Point, radius: number, start: number, end: number): number[] {
  const count = Math.max(2, Math.ceil(Math.abs(end - start) * 16));
  return Array.from({ length: count + 1 }, (_, i) => {
    const angle = start + (end - start) * i / count;
    return [center.x + radius * Math.cos(angle), center.y + radius * Math.sin(angle)];
  }).flat();
}

export function insetLine(from: Point, to: Point, fromRadius: number, toRadius: number): { from: Point; to: Point } | null {
  const dx = to.x - from.x, dy = to.y - from.y, distance = Math.hypot(dx, dy);
  if (distance <= fromRadius + toRadius) return null;
  return { from: { x: from.x + dx / distance * fromRadius, y: from.y + dy / distance * fromRadius },
    to: { x: to.x - dx / distance * toRadius, y: to.y - dy / distance * toRadius } };
}
