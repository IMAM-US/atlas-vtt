import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { ViewAtlasStore } from '../../src/app/storeFactory';
import { ViewStoreProvider } from '../../src/app/react/ViewStoreContext';
import { AtlasUIContext, type AtlasUIContextValue } from '../../src/app/react/root/AtlasUIContext';
import { SourceOverlays } from '../../src/app/react/components/SourceOverlays';
import { TooltipProvider } from '../../src/app/packages/components/primitives/tooltip';

/**
 * Every native read of a subject starts inside its account card, so the card stands in here
 * with one pending action of the kind its sections start: a card that never mounts reads
 * nothing, and an unmounted card's pending action is aborted.
 */
const cards = vi.hoisted(() => ({ mounted: [] as string[], signals: new Map<string, AbortSignal>() }));
vi.mock('../../src/app/agent-links/card/AgentLinkCard', async () => {
  const { createElement, useEffect } = await import('react');
  const { useActionSignal } = await import('../../src/app/agent-links/card/useActionSignal');
  return {
    AgentLinkCard: ({ reference }: { reference: { subjectId: string } }) => {
      const next = useActionSignal();
      useEffect(() => {
        cards.mounted.push(reference.subjectId);
        cards.signals.set(reference.subjectId, next());
      }, [next, reference.subjectId]);
      return createElement('section', { 'aria-label': 'Source account' }, reference.subjectId);
    },
  };
});

interface State {
  objects: { tokens: Record<string, unknown>; texts: Record<string, unknown> };
  selectedIds: string[];
  clickedObjectId: string | null;
  isDragging: boolean;
  isGMView: boolean;
  isMapLoading: boolean;
  grid: { size: number };
  setClickedObjectId: (id: string | null) => void;
  setSelection: (ids: string[]) => void;
}

const bound = (id: string, name: string, subjectId: string): Record<string, unknown> => ({
  id, kind: 'token', x: 100, y: 100, name, imagePath: `${id}.png`, sourceReference: { accountPath: 'accounts/example.json', subjectId },
});

let store: StoreApi<State>;
beforeEach(() => {
  cards.mounted.length = 0;
  cards.signals.clear();
  store = createStore<State>((set) => ({
    objects: { tokens: { build: bound('build', 'Build A', 'seat:build-a'), panel: bound('panel', 'Panel', 'group:panel') }, texts: {} },
    selectedIds: [], clickedObjectId: null, isDragging: false, isGMView: true, isMapLoading: false, grid: { size: 70 },
    setClickedObjectId: (clickedObjectId) => set({ clickedObjectId }),
    setSelection: (selectedIds) => set({ selectedIds }),
  }));
});
afterEach(cleanup);

const viewport = { toScreen: (x: number, y: number) => ({ x, y }), scale: { x: 1 }, on: () => undefined, off: () => undefined };
const ui = { app: {}, view: null, pixiApp: null, renderer: { getViewportInstance: () => viewport } } as unknown as AtlasUIContextValue;

function Overlays({ isPlayerView = false }: { isPlayerView?: boolean }): React.ReactElement {
  return <ViewStoreProvider store={store as unknown as ViewAtlasStore}><AtlasUIContext.Provider value={ui}><TooltipProvider>
    <SourceOverlays isPlayerView={isPlayerView} />
  </TooltipProvider></AtlasUIContext.Provider></ViewStoreProvider>;
}

/** A completed click as the token renderer reports it: the object is selected (Shift adds it), then marked clicked on release. */
const click = (id: string, shift = false): void => act(() => {
  store.setState((state) => ({ selectedIds: shift ? [...state.selectedIds, id] : [id], clickedObjectId: id }));
});

describe('the account card overlay', () => {
  it('shows the chooser and starts no card for a Shift-selection, whichever bound object was clicked last', () => {
    render(<Overlays />);
    click('build');
    expect(cards.mounted).toEqual(['seat:build-a']);
    click('panel', true);
    expect(screen.getByRole('region', { name: 'Choose a subject' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Source account' })).toBeNull();
    expect(cards.mounted).toEqual(['seat:build-a']);
    expect(cards.signals.get('seat:build-a')?.aborted).toBe(true);
  });

  it('opens the card chosen in the chooser, and only for the selection it was chosen in', () => {
    render(<Overlays />);
    click('build');
    click('panel', true);
    fireEvent.click(screen.getByRole('button', { name: /Panel/ }));
    expect(screen.getByRole('region', { name: 'Source account' }).textContent).toBe('group:panel');
    act(() => store.setState({ selectedIds: ['build'] }));
    act(() => store.setState({ selectedIds: ['build', 'panel'] }));
    expect(screen.getByRole('region', { name: 'Choose a subject' })).toBeTruthy();
    expect(cards.mounted).toEqual(['seat:build-a', 'group:panel']);
  });

  it('spends a chooser pick when the selection is dragged, so release shows the chooser and starts no card', () => {
    render(<Overlays />);
    click('build');
    click('panel', true);
    fireEvent.click(screen.getByRole('button', { name: /Panel/ }));
    expect(cards.mounted).toEqual(['seat:build-a', 'group:panel']);
    act(() => store.setState({ isDragging: true, clickedObjectId: null }));
    expect(screen.queryByRole('region', { name: 'Source account' })).toBeNull();
    act(() => store.setState({ isDragging: false, clickedObjectId: null }));
    expect(screen.getByRole('region', { name: 'Choose a subject' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Source account' })).toBeNull();
    expect(cards.mounted).toEqual(['seat:build-a', 'group:panel']);
  });

  it("unmounts in the DM's player preview, cancelling the card's pending action, and never mounts in player view", () => {
    const { unmount } = render(<Overlays />);
    click('build');
    const pending = cards.signals.get('seat:build-a');
    expect(pending?.aborted).toBe(false);
    act(() => store.setState({ isGMView: false }));
    expect(pending?.aborted).toBe(true);
    expect(screen.queryByRole('region', { name: 'Source account' })).toBeNull();
    click('panel', true);
    expect(screen.queryByRole('region', { name: 'Choose a subject' })).toBeNull();
    unmount();

    act(() => store.setState({ isGMView: true }));
    render(<Overlays isPlayerView />);
    expect(screen.queryByRole('region', { name: 'Choose a subject' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Source account' })).toBeNull();
    expect(cards.mounted).toEqual(['seat:build-a']);
  });
});
