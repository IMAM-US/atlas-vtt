import React from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackOwnedTimers } from '../mocks/ownedTimers';

const state = {
  initiativeTrackerOpen: true,
  initiative: {
    entries: [],
    removedTokenIds: [],
    isActive: false,
    round: 0,
  },
  objects: {
    tokens: {
      'token-1': { id: 'token-1', kind: 'character', name: 'Bandit Captain', hp: { current: 8, max: 10 }, imagePath: 'tokens/bandit-captain.png' },
      'seat-token': { id: 'seat-token', kind: 'character', name: 'team.builder', imagePath: '', isHidden: true, initiativeAutoAdd: false },
    },
  },
  addToInitiative: vi.fn(),
  removeFromInitiative: vi.fn(),
  rollAllInitiative: vi.fn(),
  rollEntryInitiative: vi.fn(),
  nextTurn: vi.fn(),
  previousTurn: vi.fn(),
  reorderInitiative: vi.fn(),
  moveToFront: vi.fn(),
  moveToBack: vi.fn(),
  startCombat: vi.fn(),
  endCombat: vi.fn(),
  updateInitiativeEntry: vi.fn(),
};

vi.mock('../../src/app/react/root/AtlasUIContext', () => ({
  useAtlasUI: () => ({
    app: {},
    view: {},
  }),
}));

vi.mock('../../src/app/react/ViewStoreContext', () => ({
  useAtlasStore: (selector: (storeState: typeof state) => unknown) => selector(state),
}));

vi.mock('../../src/app/react/components/InitiativeCard', () => ({
  InitiativeCard: () => <div data-testid="initiative-card" />,
}));

vi.mock('../../src/app/react/components/StatblockHoverPreview', () => ({
  StatblockHoverPreview: () => null,
  useStatblockHoverPreview: () => [
    {
      hoveredEntry: null,
      statblockData: null,
      statblockFile: null,
      isVisible: false,
      isClosing: false,
      position: null,
      anchorRect: null,
    },
    {
      showPreview: vi.fn(),
      closePreview: vi.fn(),
      clearPreview: vi.fn(),
    },
  ],
}));

import { InitiativeTracker } from '../../src/app/react/components/InitiativeTracker';

describe('InitiativeTracker auto-add', () => {
  it('adds map tokens on its own except those marked to stay out, such as seats added by map-making', () => {
    render(<InitiativeTracker />);
    expect(state.addToInitiative.mock.calls.map(([entry]) => (entry as { tokenId: string }).tokenId)).toEqual(['token-1']);
  });
});

describe('InitiativeTracker timers', () => {
  afterEach(() => vi.restoreAllMocks());

  it('clears the hotkey highlight timer when it unmounts', () => {
    const timers = trackOwnedTimers('InitiativeTracker.tsx');
    const { unmount } = render(<InitiativeTracker />);
    act(() => { window.dispatchEvent(new CustomEvent('atlas-initiative-hotkey', { detail: 'next' })); });
    expect(timers.live().length).toBeGreaterThan(0);
    unmount();
    expect(timers.live()).toEqual([]);
  });
});
