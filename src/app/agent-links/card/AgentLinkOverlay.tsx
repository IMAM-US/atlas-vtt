import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAtlasStore, useViewStoreHook } from '../../react/ViewStoreContext';
import type { SourceReference } from '../../types';
import { AgentLinkCard } from './AgentLinkCard';
import { cardPlacement, CARD_WIDTH, type ViewInsets } from './cardPlacement';
import { ChooserCard } from './ChooserCard';
import { useObjectAnchor } from './useObjectAnchor';

interface Bound { objectId: string; label: string; reference: SourceReference }

/**
 * Shows the account card for the bound object a completed click landed on, or a chooser
 * when several bound objects are selected: then only a choice made in the chooser opens a
 * card, whichever object was clicked last, so Shift-selecting tokens to move them reads
 * nothing. Hidden during drags and while nothing bound is selected; mounted only in the
 * DM's own view (not player view or its preview) and outside loading.
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
  // A chooser pick holds only for the selection it was made in, and a drag spends it as it spends a click.
  const selection = selectedIds.join('\n');
  const [picked, setPicked] = useState<{ objectId: string; selection: string } | null>(null);
  useEffect(() => setPicked((current) => (current && (isDragging || current.selection !== selection) ? null : current)), [selection, isDragging]);
  const cardId = bound.length > 1 ? (picked?.selection === selection ? picked.objectId : null) : clickedObjectId;
  const chosen = bound.find((entry) => entry.objectId === cardId) ?? null;
  // A click is spent once its object leaves the selection: a later marquee reselect opens no card without a new click.
  useEffect(() => {
    if (clickedObjectId && !selectedIds.includes(clickedObjectId)) store.getState().setClickedObjectId(null);
  }, [store, clickedObjectId, selectedIds]);
  const anchorEntry = chosen ?? bound[0] ?? null;
  const anchorId = anchorEntry?.objectId ?? null;
  const anchor = useObjectAnchor(anchorId, anchorEntry?.label ?? '');
  const container = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [insets, setInsets] = useState<ViewInsets>({ top: 0, bottom: 0 });
  useLayoutEffect(() => {
    const parent = container.current?.parentElement;
    if (!parent) return undefined;
    const measure = (): void => {
      setSize({ width: parent.clientWidth, height: parent.clientHeight });
      // The card stays between the top bar row and the bottom toolbar row, both siblings in the map chrome.
      const frame = parent.getBoundingClientRect();
      const topBar = parent.querySelector('.atlas-top-bar-row')?.getBoundingClientRect();
      const bottomBar = parent.querySelector('.atlas-bottom-toolbar-row')?.getBoundingClientRect();
      setInsets({
        top: topBar && topBar.height > 0 ? Math.max(0, topBar.bottom - frame.top) : 0,
        bottom: bottomBar && bottomBar.height > 0 ? Math.max(0, frame.bottom - bottomBar.top) : 0,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    for (const bar of parent.querySelectorAll('.atlas-top-bar-row, .atlas-bottom-toolbar-row')) observer.observe(bar);
    return () => observer.disconnect();
  }, [anchorId]);
  const close = (): void => {
    setPicked(null);
    store.getState().setClickedObjectId(null);
  };
  if (isDragging || bound.length === 0 || !anchor) return <div ref={container} hidden />;
  const box = cardPlacement(anchor, size.width && size.height ? size : { width: CARD_WIDTH + 32, height: 600 }, insets);
  const style: React.CSSProperties = { left: box.left, top: box.top, maxHeight: box.maxHeight, width: CARD_WIDTH };
  return <div ref={container} className="agent-link-overlay">
    {chosen
      ? <AgentLinkCard key={chosen.objectId} reference={chosen.reference} authoredLabel={chosen.label} style={style} onClose={close} />
      : bound.length > 1 ? <ChooserCard entries={bound} style={style} onChoose={(id) => setPicked({ objectId: id, selection })} onClose={() => store.getState().setSelection([])} /> : null}
  </div>;
}
