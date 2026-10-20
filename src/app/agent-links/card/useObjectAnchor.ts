import { useEffect, useState } from 'react';
import { useAtlasUI } from '../../react/root/AtlasUIContext';
import { useAtlasStore } from '../../react/ViewStoreContext';

export interface ObjectAnchor {
  x: number;
  y: number;
  /** Half the token's screen size. */
  radius: number;
  /** Half the width its nameplate is likely to take on screen, so a card opens past the label. */
  labelHalfWidth: number;
}

/** Nameplates rest at a constant screen size; this estimates their half width from the label's length. */
const NAMEPLATE_CHARACTER_PX = 7;
const NAMEPLATE_PADDING_PX = 16;

/**
 * Where a map object sits on screen, refreshed as the viewport pans or zooms, so a card
 * can open beside it. Null while the object or viewport is missing.
 */
export function useObjectAnchor(objectId: string | null, label = ''): ObjectAnchor | null {
  const { renderer } = useAtlasUI();
  const object = useAtlasStore((state) => (objectId ? state.objects.tokens[objectId] ?? state.objects.texts[objectId] ?? null : null));
  const gridSize = useAtlasStore((state) => state.grid?.size ?? 70);
  const [anchor, setAnchor] = useState<ObjectAnchor | null>(null);
  useEffect(() => {
    const viewport = renderer?.getViewportInstance() ?? null;
    if (!viewport || !object) {
      setAnchor(null);
      return undefined;
    }
    const size = 'size' in object && typeof object.size === 'number' ? object.size : 1;
    const update = (): void => {
      const point = viewport.toScreen(object.x, object.y);
      const labelHalfWidth = label ? (label.length * NAMEPLATE_CHARACTER_PX + NAMEPLATE_PADDING_PX) / 2 : 0;
      setAnchor({ x: point.x, y: point.y, radius: (gridSize * size * viewport.scale.x) / 2, labelHalfWidth });
    };
    update();
    viewport.on('moved', update);
    viewport.on('zoomed', update);
    return () => {
      viewport.off('moved', update);
      viewport.off('zoomed', update);
    };
  }, [renderer, object, gridSize, label]);
  return anchor;
}
