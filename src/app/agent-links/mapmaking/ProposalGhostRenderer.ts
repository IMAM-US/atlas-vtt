import { Container, Graphics, Text } from 'pixi.js';
import type { Point } from '../../grid/hexGeometry';
import type { ViewAtlasState, ViewAtlasStore } from '../../storeFactory';
import { cssColorToHexNumber, getObsidianAccentColor } from '../../pixi/utils/colorUtils';
import { destroyTree } from '../../pixi/utils/destroyTree';

/** A seat Apply would add, drawn where it would go. */
export interface ProposalGhost { key: string; position: Point; radius: number; caption: string }

const GHOST_FILL_ALPHA = 0.16;
const GHOST_STROKE_ALPHA = 0.85;
const LABEL_SIZE = 13;

/**
 * Ghosts of the seats the Proposals panel would add: an outline at the exact cell, the caption and
 * "will be added hidden". It draws only what the panel hands it through `setGhosts`, never reads
 * or writes the scene, takes no pointer input, and is the DM's alone: hidden in player view and
 * while the DM previews it, and kept out of the player window's frame by the orchestrator.
 */
export class ProposalGhostRenderer {
  readonly container = new Container({ label: 'proposal-ghosts', eventMode: 'none', interactiveChildren: false });
  private ghosts: readonly ProposalGhost[] = [];
  private readonly unsubscribers: Array<() => void> = [];

  constructor(private readonly store: ViewAtlasStore) {
    this.unsubscribers.push(
      store.subscribe((state: ViewAtlasState) => state.isGMView, () => this.redraw()),
      store.subscribe((state: ViewAtlasState) => state.isPlayerView, () => this.redraw()),
    );
    this.redraw();
  }

  /** The panel's current selection; an empty list removes every ghost. */
  setGhosts(ghosts: readonly ProposalGhost[]): void {
    this.ghosts = ghosts;
    this.redraw();
  }

  private hidden(): boolean {
    const state = this.store.getState();
    return state.isPlayerView || !state.isGMView;
  }

  private redraw(): void {
    for (const child of this.container.removeChildren()) destroyTree(child);
    this.container.visible = !this.hidden() && this.ghosts.length > 0;
    if (!this.container.visible) return;
    const accent = cssColorToHexNumber(getObsidianAccentColor());
    for (const ghost of this.ghosts) {
      const mark = new Container({ label: `proposal-ghost-${ghost.key}`, eventMode: 'none' });
      mark.position.set(ghost.position.x, ghost.position.y);
      mark.addChild(new Graphics().circle(0, 0, ghost.radius).fill({ color: accent, alpha: GHOST_FILL_ALPHA }).stroke({ width: 2, color: accent, alpha: GHOST_STROKE_ALPHA }));
      const label = new Text({ text: `${ghost.caption}\nwill be added hidden`, style: { fontSize: LABEL_SIZE, fill: 0xffffff, align: 'center', stroke: { color: 0x000000, width: 3 } } });
      label.anchor.set(0.5, 0);
      label.position.set(0, ghost.radius + 4);
      mark.addChild(label);
      this.container.addChild(mark);
    }
  }

  destroy(): void {
    for (const unsubscribe of this.unsubscribers.splice(0)) unsubscribe();
    destroyTree(this.container);
  }
}
