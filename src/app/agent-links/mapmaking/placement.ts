import { axialToPixel, createHexLayout, isHexGridType, pixelToAxial, type Point } from '../../grid/hexGeometry';
import type { GridState } from '../../services/MapPersistence';

/** The map's area in world coordinates. */
export interface MapBounds { x: number; y: number; width: number; height: number }
/** Something already on the map: its centre and the size of the box it covers. */
export interface Footprint { x: number; y: number; width: number; height: number }
export interface PlacementRequest { key: string; logicalId: string; anchors: readonly Point[] }

/** How far beside its pod's tokens a seat may be placed before it goes to the staging strip, in cells. */
const POD_REACH = 6;
const FALLBACK_CELL = 70;

interface Cells { centers: Point[]; cellOf: (point: Point) => string; size: number }

/** Every whole cell of the grid that lies inside the map, by centre. Without a grid, a square lattice of Atlas's default cell. */
function cellsOf(grid: GridState | null, bounds: MapBounds): Cells {
  const size = grid?.size && grid.size > 0 ? grid.size : FALLBACK_CELL;
  const type = grid?.type ?? 'square';
  const offsetX = grid?.offsetX ?? 0, offsetY = grid?.offsetY ?? 0;
  let center: (point: Point) => Point;
  let cellOf: (point: Point) => string;
  if (isHexGridType(type)) {
    const layout = createHexLayout(type, size, offsetX, offsetY);
    cellOf = (point) => { const hex = pixelToAxial(layout, point); return `${hex.q},${hex.r}`; };
    center = (point) => axialToPixel(layout, pixelToAxial(layout, point));
  } else {
    const index = (value: number, offset: number): number => Math.floor((value - offset) / size);
    cellOf = (point) => `${index(point.x, offsetX)},${index(point.y, offsetY)}`;
    center = (point) => ({ x: offsetX + (index(point.x, offsetX) + 0.5) * size, y: offsetY + (index(point.y, offsetY) + 0.5) * size });
  }
  const half = size / 2;
  const seen = new Map<string, Point>();
  for (let y = bounds.y; y <= bounds.y + bounds.height; y += half) {
    for (let x = bounds.x; x <= bounds.x + bounds.width; x += half) {
      const middle = center({ x, y });
      const key = cellOf(middle);
      const inside = middle.x - half >= bounds.x && middle.y - half >= bounds.y && middle.x + half <= bounds.x + bounds.width && middle.y + half <= bounds.y + bounds.height;
      if (inside && !seen.has(key)) seen.set(key, middle);
    }
  }
  return { centers: [...seen.values()], cellOf, size };
}

const covers = (footprint: Footprint, point: Point): boolean =>
  Math.abs(point.x - footprint.x) < footprint.width / 2 && Math.abs(point.y - footprint.y) < footprint.height / 2;

/** Right, below, left, above: the order a cell beside the pod is preferred in when distances tie. */
function direction(from: Point, to: Point): number {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 0 : 2;
  return dy > 0 ? 1 : 3;
}

/**
 * Where each proposed seat goes: the free cell nearest its pod's tokens, else the first free
 * cell of the staging strip along the map's top edge, else nowhere (null). Deterministic: seats
 * are placed in logical-name order and each one's cell is taken before the next.
 */
export function placeProposals(requests: readonly PlacementRequest[], objects: readonly Footprint[], grid: GridState | null, bounds: MapBounds): Map<string, Point | null> {
  const cells = cellsOf(grid, bounds);
  const taken = new Set(cells.centers.filter((cell) => objects.some((object) => covers(object, cell))).map((cell) => cells.cellOf(cell)));
  const free = (cell: Point): boolean => !taken.has(cells.cellOf(cell));
  const strip = [...cells.centers].sort((a, b) => a.y - b.y || a.x - b.x);
  const placed = new Map<string, Point | null>();
  for (const request of [...requests].sort((a, b) => a.logicalId.localeCompare(b.logicalId) || a.key.localeCompare(b.key))) {
    let choice: Point | null = null;
    if (request.anchors.length) {
      const middle = { x: request.anchors.reduce((sum, point) => sum + point.x, 0) / request.anchors.length, y: request.anchors.reduce((sum, point) => sum + point.y, 0) / request.anchors.length };
      const reach = (POD_REACH + 0.5) * cells.size;
      const near = cells.centers.filter(free).map((cell) => ({ cell, distance: Math.min(...request.anchors.map((anchor) => Math.hypot(cell.x - anchor.x, cell.y - anchor.y))) }))
        .filter((entry) => entry.distance <= reach)
        .sort((a, b) => a.distance - b.distance || direction(middle, a.cell) - direction(middle, b.cell) || a.cell.y - b.cell.y || a.cell.x - b.cell.x);
      choice = near[0]?.cell ?? null;
    }
    choice ??= strip.find(free) ?? null;
    if (choice) taken.add(cells.cellOf(choice));
    placed.set(request.key, choice);
  }
  return placed;
}
