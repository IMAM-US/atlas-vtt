import { useEffect, useState } from 'react';
import { useAtlasUI } from '../../react/root/AtlasUIContext';
import { useAtlasStore } from '../../react/ViewStoreContext';

export interface ObjectAnchor { x: number; y: number; radius: number }

/**
 * Where a map object sits on screen, refreshed as the viewport pans or zooms, so a card
 * can open beside it. Null while the object or viewport is missing.
 */
export function useObjectAnchor(objectId: string | null): ObjectAnchor | null {
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
      setAnchor({ x: point.x, y: point.y, radius: (gridSize * size * viewport.scale.x) / 2 });
    };
    update();
    viewport.on('moved', update);
    viewport.on('zoomed', update);
    return () => {
      viewport.off('moved', update);
      viewport.off('zoomed', update);
    };
  }, [renderer, object, gridSize]);
  return anchor;
}
