import React, { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useAtlasUI } from '../../react/root/AtlasUIContext';
import { LabelTooltip } from '../../packages/components/primitives/tooltip';
import './live-layer.scss';

const subscribeNone = (): (() => void) => (): void => {};
const noHover = (): null => null;

/** Controlled passive hover: geometry updates the anchor directly, without per-frame React work. */
export function LiveLayerHover(): React.ReactElement | null {
  const { renderer } = useAtlasUI();
  const layer = renderer?.getLiveLayer(), drawing = renderer?.getLiveLinkRenderer();
  const hover = useSyncExternalStore(layer?.subscribe ?? subscribeNone, layer?.getHover ?? noHover);
  const anchor = useRef<HTMLSpanElement>(null);
  const canvas = hover ? renderer?.getCanvasElement() : null;
  useLayoutEffect(() => {
    if (!drawing || !hover) return undefined;
    const move = (): void => {
      const point = drawing.hoverAnchor(hover.id), element = anchor.current;
      if (!element) return;
      element.style.left = `${point?.x ?? -10000}px`; element.style.top = `${point?.y ?? -10000}px`;
    };
    move(); return drawing.subscribeAnchors(move);
  }, [drawing, hover]);
  if (!hover || !canvas) return null;
  return createPortal(<LabelTooltip label={hover.lines.join('\n')} open contentClassName="atlas-live-hover" portalContainer={canvas.ownerDocument.body}>
    <span ref={anchor} className="atlas-live-hover-anchor" />
  </LabelTooltip>, canvas.ownerDocument.body);
}
