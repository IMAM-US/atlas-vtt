import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAtlasStore, useViewStoreHook } from '../../react/ViewStoreContext';
import type { SourceReference } from '../../types';
import { AgentLinkCard } from './AgentLinkCard';
import { cardPlacement, CARD_WIDTH } from './cardPlacement';
import { ChooserCard } from './ChooserCard';
import { useObjectAnchor } from './useObjectAnchor';

interface Bound { objectId: string; label: string; reference: SourceReference }

/**
 * Shows the account card for the bound object a completed click landed on, or a chooser
 * when several bound objects are selected. Hidden during drags and while nothing bound is
 * selected; mounted only outside player view and loading, like the recorded inspector.
 */
export function AgentLinkOverlay(): React.ReactElement | null {
  const store = useViewStoreHook();
  const tokens = useAtlasStore((state) => state.objects.tokens);
  const texts = useAtlasStore((state) => state.objects.texts);
  const selectedIds = useAtlasStore((state) => state.selectedIds);
  const clickedObjectId = useAtlasStore((state) => state.clickedObjectId);
  const isDragging = useAtlasStore((state) => state.isDragging);
  const bound = useMemo((): Bound[] => selectedIds.flatMap((id) => {
    const object = tokens[id] ?? texts[id];
    if (!object?.sourceReference) return [];
    const label = 'text' in object ? object.text : 'name' in object && typeof object.name === 'string' && object.name ? object.name : object.sourceReference.subjectId;
    return [{ objectId: id, label, reference: object.sourceReference }];
  }), [selectedIds, tokens, texts]);
  const chosen = bound.find((entry) => entry.objectId === clickedObjectId) ?? null;
  const anchorId = chosen?.objectId ?? bound[0]?.objectId ?? null;
  const anchor = useObjectAnchor(anchorId);
  const container = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const parent = container.current?.parentElement;
    if (!parent) return undefined;
    const measure = (): void => setSize({ width: parent.clientWidth, height: parent.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [anchorId]);
  const close = (): void => store.getState().setClickedObjectId(null);
  if (isDragging || bound.length === 0 || !anchor) return <div ref={container} hidden />;
  const box = cardPlacement(anchor, size.width && size.height ? size : { width: CARD_WIDTH + 32, height: 600 });
  const style: React.CSSProperties = { left: box.left, top: box.top, maxHeight: box.maxHeight, width: CARD_WIDTH };
  return <div ref={container} className="agent-link-overlay">
    {chosen
      ? <AgentLinkCard key={chosen.objectId} reference={chosen.reference} authoredLabel={chosen.label} style={style} onClose={close} />
      : bound.length > 1 ? <ChooserCard entries={bound} style={style} onChoose={(id) => store.getState().setClickedObjectId(id)} onClose={() => store.getState().setSelection([])} /> : null}
  </div>;
}
