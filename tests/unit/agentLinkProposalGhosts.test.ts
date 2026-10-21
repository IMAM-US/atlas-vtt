import { expect, it } from 'vitest';
import type { Text } from 'pixi.js';
import { createViewAtlasStore } from '../../src/app/storeFactory';
import { ProposalGhostRenderer } from '../../src/app/agent-links/mapmaking/ProposalGhostRenderer';
import { createInMemoryApp } from '../mocks/inMemoryVault';

it('draws a ghost at each chosen cell for the DM alone, and nothing in the session view or player view', () => {
  const store = createViewAtlasStore(createInMemoryApp().app, 'proposal-ghosts');
  const ghosts = new ProposalGhostRenderer(store);
  try {
    expect(ghosts.container.visible).toBe(false);
    ghosts.setGhosts([{ key: 'new', position: { x: 175, y: 105 }, radius: 30, caption: 'New builder' }]);
    expect(ghosts.container.visible).toBe(true);
    const mark = ghosts.container.children[0]!;
    expect(mark.position).toMatchObject({ x: 175, y: 105 });
    expect((mark.children[1] as Text).text).toBe('New builder\nwill be added hidden');
    expect(ghosts.container.eventMode).toBe('none');
    store.getState().setGMView(false);
    expect(ghosts.container.visible).toBe(false);
    store.getState().setGMView(true);
    store.setState({ isPlayerView: true });
    expect(ghosts.container.visible).toBe(false);
    store.setState({ isPlayerView: false });
    ghosts.setGhosts([]);
    expect([ghosts.container.visible, ghosts.container.children.length]).toEqual([false, 0]);
  } finally { ghosts.destroy(); }
});
