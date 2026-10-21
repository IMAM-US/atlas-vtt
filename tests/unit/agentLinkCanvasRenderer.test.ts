import { afterEach, expect, it, vi } from 'vitest';
import { Container } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import { EventEmitter } from 'events';
import { createStore } from 'zustand/vanilla';
import type { ViewAtlasStore } from '../../src/app/storeFactory';
import type { TokenGroupContainer } from '../../src/app/pixi/token-renderer/types';
import { LiveLinkRenderer } from '../../src/app/agent-links/overlay/LiveLinkRenderer';
import type { LiveLayer } from '../../src/app/agent-links/overlay/LiveLayer';
import type { AppearanceMark, Halo } from '../../src/app/agent-links/overlay/types';
import { captureWithLayerVisibility } from '../../src/app/pixi/playerSafeFrame';

const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); vi.restoreAllMocks(); vi.useRealTimers(); });
function fixture(initial: Halo['activity'] = 'working'): {
  drawing: LiveLinkRenderer; sprite: TokenGroupContainer; bus: EventEmitter; store: ReturnType<typeof createStore>;
  publish: (activity: Halo['activity'], freshness?: Halo['freshness'], epoch?: number) => void;
} {
  const viewport = Object.assign(new Container(), { toScreen: (x: number, y: number) => ({ x, y }) }) as unknown as Viewport;
  const sprite = Object.assign(new Container(), { tokenSize: 62 }) as TokenGroupContainer; sprite.position.set(100, 100);
  const bus = new EventEmitter();
  const store = createStore(() => ({ objects: { tokens: {}, texts: {} }, grid: { size: 70 }, selectedIds: [] as string[], isDragging: false,
    activeTool: 'select', isGMView: true, isPlayerView: false, isMapLoading: false }));
  let halo: Halo = { key: 'node-a', sourceKey: 'source-a', epoch: 1, revision: 1, freshness: 'live', observedAt: '2026-01-01T12:00:00Z', message: null, activity: initial, label: 'Current seat' };
  const mark = (): AppearanceMark => ({ id: 'token-a', binding: 'authored-a', halos: [halo], pip: null, tethers: [], lines: [] });
  const listeners = new Set<() => void>();
  const layer = { getMarks: () => [mark()], isEnabled: () => true, setHovered: vi.fn(), subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); } } as unknown as LiveLayer;
  const drawing = new LiveLinkRenderer({ viewport, store: store as unknown as ViewAtlasStore, eventBus: bus, layer, sprites: () => ({ 'token-a': sprite }), canvas: document.createElement('canvas') });
  cleanups.push(() => { drawing.destroy(); sprite.destroy(); viewport.destroy(); });
  return { drawing, sprite, bus, store: store as ReturnType<typeof createStore>, publish: (activity, freshness = 'live', epoch = 1): void => {
    halo = { ...halo, activity, freshness, epoch, revision: halo.revision + 1 }; listeners.forEach((listener) => listener());
  } };
}

it('draws one non-interactive world container and follows actual sprite motion before a store commit', () => {
  const f = fixture();
  expect(f.drawing.container.zIndex).toBe(200); expect(f.drawing.container.eventMode).toBe('none'); expect(f.drawing.container.interactiveChildren).toBe(false);
  const measured = f.drawing.container.getLocalBounds();
  const before = { x: measured.x, y: measured.y, width: measured.width };
  expect(before.width).toBeGreaterThan(0);
  f.sprite.position.set(350, 225); f.bus.emit('token-visual-changed');
  const after = f.drawing.container.getLocalBounds();
  expect(after.x - before.x).toBeCloseTo(250); expect(after.y - before.y).toBeCloseTo(125);
  expect(f.drawing.hoverAnchor('token-a')?.x).toBe(350);
});

it('hides immediately in player/preview/loading modes and restores player capture visibility even on throw', () => {
  const f = fixture();
  expect(() => captureWithLayerVisibility([{ layer: f.drawing.container, visible: false }], () => {}, () => {
    expect(f.drawing.container.visible).toBe(false); throw new Error('Capture failed');
  })).toThrow('Capture failed');
  expect(f.drawing.container.visible).toBe(true);
  f.store.setState({ isGMView: false }); expect(f.drawing.container.visible).toBe(false);
  f.store.setState({ isGMView: true, isPlayerView: true }); expect(f.drawing.container.visible).toBe(false);
  f.store.setState({ isPlayerView: false, isMapLoading: true }); expect(f.drawing.container.visible).toBe(false);
});

it('pulses once for a real covered transition, never for hydration, duplicate redraw or reconnect', async () => {
  vi.useFakeTimers();
  const raf = vi.spyOn(window, 'requestAnimationFrame'); const f = fixture('needs-input');
  expect(raf).not.toHaveBeenCalled();
  f.publish('working'); f.publish('working', 'refreshing'); f.publish('needs-input');
  expect(raf).toHaveBeenCalledTimes(1); f.publish('needs-input'); expect(raf).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1000); raf.mockClear();
  f.publish('working', 'last-known', 2); f.publish('working', 'refreshing', 2); f.publish('needs-input', 'live', 2);
  expect(raf).not.toHaveBeenCalled();
  f.drawing.destroy(); expect(f.bus.listenerCount('token-visual-changed')).toBe(0); expect(f.bus.listenerCount('token-live-hover')).toBe(0); expect(vi.getTimerCount()).toBe(0);
});

it('suppresses transition animation for reduced motion', () => {
  const current = window.matchMedia('(prefers-reduced-motion: reduce)');
  vi.spyOn(window, 'matchMedia').mockReturnValue({ ...current, matches: true });
  const raf = vi.spyOn(window, 'requestAnimationFrame'), f = fixture('working');
  f.publish('needs-input'); expect(raf).not.toHaveBeenCalled();
});
