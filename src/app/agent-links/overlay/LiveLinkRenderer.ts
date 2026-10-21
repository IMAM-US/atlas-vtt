import { Container, Graphics, Text } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import type { EventEmitter } from 'events';
import type { ViewAtlasStore } from '../../storeFactory';
import type { TokenGroupContainer } from '../../pixi/token-renderer/types';
import { restingTokenUIScale, selectedTokenUIScale } from '../../pixi/token-renderer/tokenSizing';
import { destroyTree } from '../../pixi/utils/destroyTree';
import { ValueTransition } from '../../pixi/utils/ValueTransition';
import { cssColorToHexNumber, getObsidianAccentColor } from '../../pixi/utils/colorUtils';
import { MOTION_NORMAL_MS } from '../../utils/motion';
import type { LiveLayer } from './LiveLayer';
import { arcPoints, insetLine, type Point } from './markGeometry';
import type { Activity } from './types';

interface Options {
  viewport: Viewport; store: ViewAtlasStore; eventBus: EventEmitter; layer: LiveLayer;
  sprites: () => Record<string, TokenGroupContainer>;
  canvas: HTMLCanvasElement;
}

/** One non-interactive world overlay. The player-safe frame hides this entire container. */
export class LiveLinkRenderer {
  readonly container = new Container({ label: 'native-live-links', eventMode: 'none', interactiveChildren: false });
  private readonly graphics = new Graphics();
  private readonly counts = new Map<string, Text>();
  private readonly previous = new Map<string, { epoch: number; activity: Activity }>();
  private readonly pulses = new Map<string, ValueTransition>();
  private readonly cleanups: (() => void)[] = [];
  private readonly anchorListeners = new Set<() => void>();
  private destroyed = false;

  constructor(private readonly options: Options) {
    this.container.zIndex = 200; this.container.addChild(this.graphics);
    const changed = (): void => { this.syncPulses(); this.redraw(); };
    const geometry = (): void => { this.redraw(); this.anchorListeners.forEach((listener) => listener()); };
    const hover = (id: string | null): void => options.layer.setHovered(id);
    const clearHover = (): void => hover(null);
    options.eventBus.on('token-visual-changed', geometry);
    options.eventBus.on('token-live-hover', hover);
    options.viewport.on('zoomed', geometry); options.viewport.on('moved', geometry);
    options.viewport.on('pointerdown', clearHover);
    this.cleanups.push(options.layer.subscribe(changed), options.store.subscribe((state, previous) => {
      if (state.activeTool !== previous.activeTool || state.isDragging !== previous.isDragging) clearHover();
      if (state.selectedIds !== previous.selectedIds || state.isDragging !== previous.isDragging || state.isGMView !== previous.isGMView
        || state.isPlayerView !== previous.isPlayerView || state.isMapLoading !== previous.isMapLoading) geometry();
    }), () => {
      options.eventBus.off('token-visual-changed', geometry); options.eventBus.off('token-live-hover', hover);
      options.viewport.off('zoomed', geometry); options.viewport.off('moved', geometry); options.viewport.off('pointerdown', clearHover);
    });
    changed();
  }

  subscribeAnchors = (listener: () => void): (() => void) => { this.anchorListeners.add(listener); return () => this.anchorListeners.delete(listener); };

  hoverAnchor(id: string): Point | null {
    const geometry = this.geometry(id);
    if (!geometry || !this.container.visible) return null;
    const point = this.options.viewport.toScreen(geometry.x, geometry.y - geometry.radius);
    const rect = this.options.canvas.getBoundingClientRect();
    return { x: rect.left + point.x, y: rect.top + point.y };
  }

  private geometry(id: string): (Point & { radius: number }) | null {
    const sprite = this.options.sprites()[id];
    const state = this.options.store.getState();
    if (sprite && !sprite.destroyed) {
      const resting = restingTokenUIScale(state.grid?.size ?? 70);
      const scale = state.selectedIds.includes(id) && !state.isDragging ? selectedTokenUIScale(resting, this.zoom) : resting;
      return { x: sprite.x, y: sprite.y, radius: sprite.tokenSize / 2 + 24 * scale };
    }
    const text = state.objects.texts[id];
    return text ? { x: text.x, y: text.y, radius: 8 / this.zoom } : null;
  }

  private get zoom(): number { return Math.max(0.01, this.options.viewport.scale.x); }

  private syncPulses(): void {
    const current = new Set<string>();
    const reduced = this.options.canvas.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? true;
    for (const mark of this.options.layer.getMarks()) for (const halo of mark.halos) {
      const key = JSON.stringify([mark.id, mark.binding, halo.key]); current.add(key);
      const previous = this.previous.get(key);
      if (!reduced && previous && previous.epoch === halo.epoch && previous.activity !== 'needs-input'
        && halo.activity === 'needs-input' && halo.freshness === 'live') {
        this.pulses.get(key)?.cancel();
        const pulse = new ValueTransition(1, MOTION_NORMAL_MS, () => this.redraw());
        this.pulses.set(key, pulse);
        pulse.animateTo(1.12, () => pulse.animateTo(1, () => this.pulses.delete(key)));
      }
      if (halo.freshness === 'live') this.previous.set(key, { epoch: halo.epoch, activity: halo.activity });
      else {
        this.pulses.get(key)?.cancel(); this.pulses.delete(key);
        if (previous?.epoch !== halo.epoch || halo.freshness !== 'refreshing') this.previous.delete(key);
      }
    }
    for (const key of this.previous.keys()) if (!current.has(key)) {
      this.previous.delete(key); this.pulses.get(key)?.cancel(); this.pulses.delete(key);
    }
  }

  private arc(center: Point, radius: number, start: number, end: number, color: number, width: number, alpha: number, dashed: boolean): void {
    if (dashed) {
      const step = Math.max(0.04, 6 / (radius * this.zoom));
      for (let angle = start; angle < end; angle += step * 2) this.graphics.poly(arcPoints(center, radius, angle, Math.min(end, angle + step)), false).stroke({ color, width, alpha });
    } else this.graphics.poly(arcPoints(center, radius, start, end), false).stroke({ color, width, alpha });
  }

  private redraw(): void {
    if (this.destroyed) return;
    const state = this.options.store.getState(), marks = this.options.layer.getMarks();
    this.container.visible = this.options.layer.isEnabled() && !state.isPlayerView && state.isGMView && !state.isMapLoading && marks.length > 0;
    this.graphics.clear();
    for (const label of this.counts.values()) label.visible = false;
    if (!this.container.visible) { this.removeUnusedCounts(); return; }
    const accent = cssColorToHexNumber(getObsidianAccentColor());
    for (const mark of marks) {
      const point = this.geometry(mark.id);
      if (!point) continue;
      for (const tether of mark.tethers) {
        const target = this.geometry(tether.targetId);
        const line = target && insetLine(point, target, point.radius, target.radius);
        if (!line) continue;
        this.graphics.moveTo(line.from.x, line.from.y).lineTo(line.to.x, line.to.y).stroke({ color: accent, width: 1 / this.zoom, alpha: 0.35 });
      }
      mark.halos.forEach((halo, index) => {
        const span = Math.PI * 2 / Math.max(1, mark.halos.length), gap = mark.halos.length > 1 ? 0.04 : 0;
        const start = -Math.PI / 2 + index * span + gap, end = start + span - gap * 2;
        const key = JSON.stringify([mark.id, mark.binding, halo.key]);
        const radius = point.radius * (this.pulses.get(key)?.value ?? 1);
        const color = halo.activity === 'needs-input' ? accent : halo.activity === 'working' ? 0x59b987 : 0x9a9da8;
        const live = halo.freshness === 'live';
        if (live && ['working', 'idle', 'needs-input'].includes(halo.activity)) this.arc(point, radius, start, end, color, 7 / this.zoom, 0.18, false);
        this.arc(point, radius, start, end, color, (live && halo.activity !== 'absent' ? 2.5 : 1) / this.zoom, live ? 0.95 : 0.45, halo.activity === 'unknown');
        if (halo.activity === 'absent') this.arc(point, radius + 3 / this.zoom, start, end, color, 1 / this.zoom, live ? 0.8 : 0.35, false);
      });
      if (mark.pip) {
        const pip = mark.pip, radius = 10 / this.zoom, x = point.x + point.radius * 0.72, y = point.y + point.radius * 0.72;
        const center = { x, y }, live = pip.freshness === 'live';
        if (live && pip.count !== null) this.graphics.circle(x, y, radius).fill({ color: 0x252631, alpha: 0.95 });
        this.arc(center, radius, 0, Math.PI * 2, accent, 1.5 / this.zoom, live ? 1 : 0.45, pip.count === null);
        if (pip.blocked) this.graphics.moveTo(x, y - radius).lineTo(x, y + radius).stroke({ color: accent, width: 1 / this.zoom, alpha: live ? 1 : 0.45 });
        if (pip.count !== null) {
          let label = this.counts.get(mark.id);
          if (!label) { label = new Text({ text: '', style: { fontFamily: 'sans-serif', fontSize: 11, fill: 0xffffff } }); label.anchor.set(0.5); this.counts.set(mark.id, label); this.container.addChild(label); }
          label.text = `${pip.count}${pip.truncated ? '+' : ''}`; label.scale.set(1 / this.zoom); label.position.set(x, y); label.alpha = live ? 1 : 0.45; label.visible = true;
        }
      }
    }
    this.removeUnusedCounts();
  }

  private removeUnusedCounts(): void {
    for (const [key, label] of this.counts) if (!label.visible) { destroyTree(label); this.counts.delete(key); }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const cleanup of this.cleanups) cleanup();
    for (const pulse of this.pulses.values()) pulse.cancel();
    this.pulses.clear(); this.previous.clear(); this.counts.clear(); this.anchorListeners.clear(); destroyTree(this.container);
  }
}
