import { describe, expect, it } from 'vitest';
import { axialToPixel, createHexLayout, pixelToAxial } from '../../src/app/grid/hexGeometry';
import { placeProposals, type Footprint, type PlacementRequest } from '../../src/app/agent-links/mapmaking/placement';
import type { GridState } from '../../src/app/services/MapPersistence';

const square: GridState = { enabled: true, type: 'square', size: 100, offsetX: 0, offsetY: 0, opacity: 1 };
const bounds = { x: 0, y: 0, width: 1000, height: 600 };
const token = (x: number, y: number, size = 1): Footprint => ({ x, y, width: size * 100, height: size * 100 });
const request = (key: string, anchors: Array<{ x: number; y: number }> = []): PlacementRequest => ({ key, logicalId: key, anchors });

describe('placing proposed seats', () => {
  it('puts seats beside their pod, preferring right, then below, and never on a taken cell', () => {
    const pod = [{ x: 450, y: 350 }];
    const placed = placeProposals([request('b.second', pod), request('a.first', pod)], [token(450, 350)], square, bounds);
    expect(placed.get('a.first')).toEqual({ x: 550, y: 350 });
    expect(placed.get('b.second')).toEqual({ x: 450, y: 450 });
    const busy = placeProposals([request('a.first', pod)], [token(450, 350), token(550, 350)], square, bounds);
    expect(busy.get('a.first')).toEqual({ x: 450, y: 450 });
  });

  it('uses the staging strip along the top edge when a seat has no pod on the map', () => {
    const text: Footprint = { x: 50, y: 50, width: 80, height: 30 };
    const placed = placeProposals([request('a.first'), request('b.second')], [text], square, bounds);
    expect(placed.get('a.first')).toEqual({ x: 150, y: 50 });
    expect(placed.get('b.second')).toEqual({ x: 250, y: 50 });
  });

  it('says there is no room rather than overlapping or leaving the map', () => {
    const tiny = { x: 0, y: 0, width: 200, height: 100 };
    const placed = placeProposals([request('a.first'), request('b.second'), request('c.third')], [], square, tiny);
    expect([...placed.values()]).toEqual([{ x: 50, y: 50 }, { x: 150, y: 50 }, null]);
  });

  it('falls back to the strip when the pod is surrounded beyond its reach', () => {
    const pod = [{ x: 450, y: 350 }];
    const crowd = Array.from({ length: 10 }, (_, col) => Array.from({ length: 6 }, (__, row) => token(col * 100 + 50, row * 100 + 50))).flat()
      .filter((cell) => !(cell.x === 950 && cell.y === 50));
    expect(placeProposals([request('a.first', pod)], crowd, square, bounds).get('a.first')).toEqual({ x: 950, y: 50 });
  });

  it('places on hex cell centres and gives the same answer whatever order seats arrive in', () => {
    const hex: GridState = { enabled: true, type: 'hex-vertical', size: 100, offsetX: 0, offsetY: 0, opacity: 1 };
    const layout = createHexLayout('hex-vertical', 100, 0, 0);
    const center = axialToPixel(layout, { q: 3, r: 2 });
    const requests = [request('c.third', [center]), request('a.first', [center]), request('b.second', [center])];
    const forward = placeProposals(requests, [{ x: center.x, y: center.y, width: 90, height: 90 }], hex, bounds);
    const backward = placeProposals([...requests].reverse(), [{ x: center.x, y: center.y, width: 90, height: 90 }], hex, bounds);
    expect([...backward.entries()].sort()).toEqual([...forward.entries()].sort());
    for (const point of forward.values()) {
      expect(point).not.toBeNull();
      expect(axialToPixel(layout, pixelToAxial(layout, point!))).toEqual(point);
      expect(point).not.toEqual(center);
    }
    expect(new Set([...forward.values()].map((point) => JSON.stringify(point))).size).toBe(3);
  });

  it('keeps a whole new token clear of objects that sit off the grid, and of the seats placed before it', () => {
    const strip = { x: 0, y: 0, width: 300, height: 100 };
    expect(placeProposals([request('a.first')], [{ x: 60, y: 50, width: 100, height: 100, round: true }], square, strip).get('a.first')).toEqual({ x: 250, y: 50 });
    expect(placeProposals([request('a.first')], [{ x: 60, y: 50, width: 80, height: 20 }], square, strip).get('a.first')).toEqual({ x: 150, y: 50 });
    const wide = placeProposals([request('a.first'), request('b.second')], [], square, strip, 150);
    expect([...wide.values()]).toEqual([{ x: 50, y: 50 }, { x: 250, y: 50 }]);
  });

  it('lets round tokens sit in neighbouring hexes', () => {
    const hex: GridState = { enabled: true, type: 'hex-vertical', size: 100, offsetX: 0, offsetY: 0, opacity: 1 };
    const layout = createHexLayout('hex-vertical', 100, 0, 0);
    const center = axialToPixel(layout, { q: 3, r: 2 });
    const placed = placeProposals([request('a.first', [center])], [{ x: center.x, y: center.y, width: 90, height: 90, round: true }], hex, bounds, 90).get('a.first')!;
    expect(Math.hypot(placed.x - center.x, placed.y - center.y)).toBeCloseTo(100);
  });
});
