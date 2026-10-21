import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createViewAtlasStore } from '../../src/app/storeFactory';

const setActiveTool = vi.fn();
const setSelectionMode = vi.fn();
const setGMView = vi.fn();
const setCommandPaletteOpen = vi.fn();
const setDiceTrayOpen = vi.fn();
const setSelection = vi.fn();
const openAssetManager = vi.fn();
const closeAssetManager = vi.fn();
const setInitiativeTrackerOpen = vi.fn();
let actualPlayerView = false;
let liveEnabled = true;
const liveListeners = new Set<() => void>();
const liveLayer = { isEnabled: (): boolean => liveEnabled, subscribe: (listener: () => void): (() => void) => {
  liveListeners.add(listener); return () => liveListeners.delete(listener);
}, toggle: (): void => { liveEnabled = !liveEnabled; liveListeners.forEach((listener) => listener()); } };

let capturedShortcuts: Record<string, (event: KeyboardEvent) => void> = {};

const storeState = {
  activeTool: 'move',
  setActiveTool,
  selectionMode: 'box',
  setSelectionMode,
  isGMView: true,
  setGMView,
  isCommandPaletteOpen: false,
  setCommandPaletteOpen,
  isAssetManagerOpen: false,
  assetManagerInitialTab: 'assets',
  isDiceTrayOpen: false,
  setDiceTrayOpen,
  initiativeTrackerOpen: false,
  lootRoller: { open: false },
  setLootRollerOpen: vi.fn(),
  setInitiativeTrackerOpen,
  objects: { tokens: {} },
  setSelection,
  openAssetManager,
  closeAssetManager,
};

const storeHook = {
  getState: () => storeState,
};

vi.mock('../../src/app/react/ViewStoreContext', () => ({
  useAtlasStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
  useViewStoreHook: () => storeHook,
}));

vi.mock('../../src/app/react/root/AtlasUIContext', () => ({
  useAtlasUI: () => ({
    view: {
      getViewType: () => actualPlayerView ? 'atlas-vtt-player' : 'atlas-vtt',
      serviceManager: {
        getEventBus: () => null,
        getToolController: () => null,
        getNotePreviewUIManager: () => null,
      },
      setFogBrushSize: vi.fn(),
      clearAllFog: vi.fn(),
    },
    mapData: null,
    renderer: { getLiveLayer: () => liveLayer },
  }),
}));

vi.mock('../../src/app/keyboard/useMapHotkeys', () => ({
  useHotkeyLabels: () => (id: string) => id,
  useAtlasSettings: () => undefined,
  useMapHotkeys: (shortcuts: Record<string, (event: KeyboardEvent) => void>) => {
    capturedShortcuts = shortcuts;
  },
}));

vi.mock('../../src/app/utils/activeLeafGuard', () => ({
  isActiveAtlasLeaf: () => true,
}));

vi.mock('../../src/app/packages/components/primitives/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  LabelTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../src/app/packages/components/primitives/ToolButton', () => ({
  ToolButton: ({ label, onClick, disabled }: { label: string; onClick?: () => void; disabled?: boolean }) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {label}
    </button>
  ),
}));

vi.mock('../../src/app/packages/components/primitives/DropdownMenu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../src/app/packages/components/primitives/DropdownMenuItem', () => ({
  DropdownMenuItem: ({ label }: { label: string }) => <div>{label}</div>,
}));

vi.mock('../../src/app/packages/components/primitives/DropdownToggleRow', () => ({
  DropdownToggleRow: () => null,
}));

vi.mock('../../src/app/packages/components/primitives/DropdownSliderRow', () => ({
  DropdownSliderRow: () => null,
}));

vi.mock('../../src/app/packages/components/primitives/DropdownModeSelector', () => ({
  DropdownModeSelector: () => null,
}));

vi.mock('../../src/app/packages/components/primitives/Toggle', () => ({
  Toggle: () => null,
}));

vi.mock('../../src/app/react/components/CommandPalette', () => ({
  CommandPalette: () => null,
}));

vi.mock('../../src/app/packages/components/asset-manager/AssetManager', () => ({
  default: () => null,
}));

vi.mock('../../src/app/react/components/dice/DiceDropdownMenu', () => ({
  DiceDropdownMenu: () => null,
}));

import { MainToolbar } from '../../src/app/packages/components/MainToolbar';

describe('MainToolbar text tool', () => {
  beforeEach(() => {
    actualPlayerView = false; liveEnabled = true;
    capturedShortcuts = {};
    setActiveTool.mockReset();
    setSelectionMode.mockReset();
    setGMView.mockReset();
    setCommandPaletteOpen.mockReset();
    setDiceTrayOpen.mockReset();
    setSelection.mockReset();
    openAssetManager.mockReset();
    closeAssetManager.mockReset();
    setInitiativeTrackerOpen.mockReset();
  });

  it('activates the text tool from the T shortcut', () => {
    render(<MainToolbar viewId="view-1" />);

    capturedShortcuts.text(new KeyboardEvent('keydown', { key: 't' }));

    expect(setActiveTool).toHaveBeenCalledWith('text');
  });

  it('renders the text tool button enabled', () => {
    render(<MainToolbar viewId="view-1" />);

    const button = screen.getByRole('button', { name: 'Text Tool' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it('accepts the text tool in the store', () => {
    const store = createViewAtlasStore({} as never, 'test-view');
    store.getState().setPersistenceEnabled(false);

    store.getState().setActiveTool('text');

    expect(store.getState().activeTool).toBe('text');
  });

  it('still refuses the ambient audio tool, which is withheld from this release', () => {
    const store = createViewAtlasStore({} as never, 'test-view');
    store.getState().setPersistenceEnabled(false);

    store.getState().setActiveTool('audio');

    expect(store.getState().activeTool).toBe('move');
  });

  it('toggles the per-view live layer without changing the tool, selection, or GM mode', () => {
    render(<MainToolbar viewId="live-toggle" />);
    fireEvent.click(screen.getByRole('button', { name: 'Live layer' }));
    expect(liveEnabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Live layer' }));
    expect(liveEnabled).toBe(true);
    expect(setActiveTool).not.toHaveBeenCalled(); expect(setGMView).not.toHaveBeenCalled(); expect(setSelection).not.toHaveBeenCalled();
  });

  it('omits the live control from the actual player view', () => {
    actualPlayerView = true;
    render(<MainToolbar viewId="player-live-toggle" />);
    expect(screen.queryByRole('button', { name: 'Live layer' })).toBeNull();
  });
});
