import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import { ViewStoreProvider } from '../../src/app/react/ViewStoreContext';

const { openSceneBrowser } = vi.hoisted(() => ({ openSceneBrowser: vi.fn() }));

vi.mock('../../src/app/react/root/AtlasUIContext', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../src/app/react/root/AtlasUIContext')>(),
  useAtlasUI: () => ({ view: { openSceneBrowser }, app: {} }),
}));
vi.mock('../../src/app/services/PlayerWindowService', () => ({ PlayerWindowService: {} }));
vi.mock('../../src/app/services/PlayerWindowPresenter', () => ({ presentActiveTabInPlayerWindow: vi.fn() }));
vi.mock('../../src/app/utils/activeLeafGuard', () => ({ isShortcutScopeActive: () => true }));
vi.mock('../../src/app/react/components/command-palette/GridSettingsPanel', () => ({ GridSettingsPanel: () => null }));
vi.mock('../../src/app/react/components/command-palette/TokenSettingsPanel', () => ({ TokenSettingsPanel: () => null }));
vi.mock('../../src/app/react/components/command-palette/WidgetSettingsPanel', () => ({ WidgetSettingsPanel: () => null }));
vi.mock('../../src/app/react/components/command-palette/LocalPlayerViewSettingsPanel', () => ({ LocalPlayerViewSettingsPanel: () => null }));

import { CommandPalette } from '../../src/app/react/components/CommandPalette';
import { trackOwnedTimers } from '../mocks/ownedTimers';

describe('Atlas search actions', () => {
  const originalScrollIntoView = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    if (originalScrollIntoView) Object.defineProperty(Element.prototype, 'scrollIntoView', originalScrollIntoView);
    else Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  });

  it('closes on an outside click even when the toolbar re-renders it with a new onClose before the check', () => {
    vi.useFakeTimers();
    const toolbar = document.body.appendChild(document.createElement('div'));
    try {
      const store = create(() => ({}));
      const toolbarRef = { current: toolbar };
      const palette = (onClose: () => void, isOpen = true): React.ReactElement =>
        <ViewStoreProvider store={store}><CommandPalette isOpen={isOpen} onClose={onClose} toolbarRef={toolbarRef} /></ViewStoreProvider>;
      const first = vi.fn(), second = vi.fn();
      const { rerender } = render(palette(first));
      fireEvent.mouseDown(document.body);
      rerender(palette(second));
      vi.advanceTimersByTime(10);
      expect([first.mock.calls.length, second.mock.calls.length]).toEqual([0, 1]);
      // Closing first still cancels the pending check.
      fireEvent.mouseDown(document.body);
      rerender(palette(second, false));
      vi.advanceTimersByTime(10);
      expect(second).toHaveBeenCalledTimes(1);
    } finally {
      toolbar.remove();
      vi.useRealTimers();
    }
  });

  it('drops a pending outside-click check when grid alignment hides the palette', () => {
    vi.useFakeTimers();
    const toolbar = document.body.appendChild(document.createElement('div'));
    try {
      const store = create(() => ({ isGridAlignmentOpen: false }));
      const onClose = vi.fn();
      render(<ViewStoreProvider store={store}><CommandPalette isOpen onClose={onClose} toolbarRef={{ current: toolbar }} /></ViewStoreProvider>);
      fireEvent.click(screen.getByRole('button', { name: 'Grid settings' }));
      fireEvent.mouseDown(document.body);
      act(() => store.setState({ isGridAlignmentOpen: true }));
      vi.advanceTimersByTime(15);
      expect(onClose).not.toHaveBeenCalled();
    } finally {
      toolbar.remove();
      vi.useRealTimers();
    }
  });

  it('leaves no timer or frame of its own running once it closes or unmounts', () => {
    const timers = trackOwnedTimers('CommandPalette.tsx');
    const store = create(() => ({}));
    const palette = (isOpen: boolean): React.ReactElement => <ViewStoreProvider store={store}><CommandPalette isOpen={isOpen} onClose={vi.fn()} /></ViewStoreProvider>;
    const { rerender, unmount } = render(palette(true));
    // Its transition switch-on, focus retries, the focus frame and an outside click's delayed check.
    fireEvent.mouseDown(document.body);
    expect(timers.live().length).toBeGreaterThan(0);
    rerender(palette(false));
    expect(timers.live()).toEqual([]);
    rerender(palette(true));
    fireEvent.mouseDown(document.body);
    unmount();
    expect(timers.live()).toEqual([]);
  });

  it.each([
    { shiftKey: false, labels: ['Tools', 'Mode', 'Settings', 'All'] },
    { shiftKey: true, labels: ['Settings', 'Mode', 'Tools', 'All'] },
  ])('cycles palette tabs with wraparound (shift: $shiftKey)', ({ shiftKey, labels }) => {
    const store = create(() => ({}));
    render(<ViewStoreProvider store={store}><CommandPalette isOpen onClose={vi.fn()} /></ViewStoreProvider>);
    const input = screen.getByPlaceholderText('Search commands...');
    fireEvent.change(input, { target: { value: 'no matching command' } });

    for (const label of labels) {
      expect(fireEvent.keyDown(input, { key: 'Tab', shiftKey })).toBe(false);
      expect(screen.getByRole('button', { name: new RegExp(`^${label}`) }).classList.contains('atlas-active')).toBe(true);
      expect(document.activeElement).toBe(input);
      expect((input as HTMLInputElement).value).toBe('no matching command');
    }
  });

  it('shows tab labels without dedicated shortcuts and ignores Cmd+number', () => {
    const store = create(() => ({}));
    render(<ViewStoreProvider store={store}><CommandPalette isOpen onClose={vi.fn()} /></ViewStoreProvider>);

    for (const label of ['All', 'Tools', 'Mode', 'Settings']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${label}`) }).textContent).toBe(label);
    }
    for (const key of ['1', '2', '3', '4']) {
      expect(fireEvent.keyDown(document, { key, metaKey: true })).toBe(true);
      expect(screen.getByRole('button', { name: 'All' }).classList.contains('atlas-active')).toBe(true);
    }
  });

  it('uses arrow keys and Enter to select commands after switching tabs', () => {
    const onClose = vi.fn();
    const store = create(() => ({}));
    render(<ViewStoreProvider store={store}><CommandPalette isOpen onClose={onClose} /></ViewStoreProvider>);
    const input = screen.getByPlaceholderText('Search commands...');
    fireEvent.keyDown(input, { key: 'Tab' });
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(screen.getByRole('button', { name: /^Enter Player Mode/ }).classList.contains('atlas-focused')).toBe(true);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByRole('button', { name: /^Freeze Player Camera/ }).classList.contains('atlas-focused')).toBe(true);
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it.each(['Grid settings', 'Token settings', 'Widget settings', 'Local player view settings'])('preserves native Tab navigation inside %s', (label) => {
    const store = create(() => ({}));
    render(<ViewStoreProvider store={store}><CommandPalette isOpen onClose={vi.fn()} /></ViewStoreProvider>);
    fireEvent.click(screen.getByRole('button', { name: label }));

    expect(fireEvent.keyDown(document, { key: 'Tab' })).toBe(true);
    expect(fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })).toBe(true);
  });

  it.each(['scene', 'asset manager', 'toggle'])('finds and opens the scene browser for "%s"', (query) => {
    const setActiveTool = vi.fn();
    const onClose = vi.fn();
    const store = create(() => ({ setActiveTool }));
    render(<ViewStoreProvider store={store}><CommandPalette isOpen onClose={onClose} /></ViewStoreProvider>);

    fireEvent.change(screen.getByPlaceholderText('Search commands...'), { target: { value: query } });
    fireEvent.click(screen.getByRole('button', { name: 'Open scene browser' }));

    expect(openSceneBrowser).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalled();
    expect(setActiveTool).not.toHaveBeenCalled();
  });

  it.each([
    { initiallyOpen: false, activation: 'click' },
    { initiallyOpen: true, activation: 'click' },
    { initiallyOpen: false, activation: 'keyboard' },
    { initiallyOpen: true, activation: 'keyboard' },
  ])('opens the dice log and closes search ($activation, initially open: $initiallyOpen)', ({ initiallyOpen, activation }) => {
    const setDiceLogOpen = vi.fn();
    const onClose = vi.fn();
    const store = create(() => ({ isDiceLogOpen: initiallyOpen, setDiceLogOpen }));
    render(<ViewStoreProvider store={store}><CommandPalette isOpen onClose={onClose} /></ViewStoreProvider>);

    fireEvent.click(screen.getByRole('button', { name: /Tools/ }));
    const input = screen.getByPlaceholderText('Search commands...');
    fireEvent.change(input, { target: { value: 'dice log' } });
    const action = screen.getByRole('button', { name: /Open dice log/ });
    expect(action.querySelector('.atlas-command-item-toggle')).toBeNull();

    if (activation === 'click') fireEvent.click(action);
    else fireEvent.keyDown(input, { key: 'Enter' });

    expect(setDiceLogOpen).toHaveBeenCalledExactlyOnceWith(true);
    expect(onClose).toHaveBeenCalled();
  });
});
