import React from 'react';
import { ItemView, type ViewStateResult } from 'obsidian';
import { createRoot, type Root } from 'react-dom/client';
import { short } from '../card/timeLabels';
import { NativeSources } from '../NativeSources';
import { RecordViewContent } from './RecordViewContent';
import { recordIdentityKey, recordViewIdentity, type RecordViewIdentity } from './recordViewState';
import './record-view.scss';

export const RECORD_VIEW_TYPE = 'atlas-conversation-record';

/**
 * A read-only view of one exact conversation record inside Obsidian. It is a DM surface: it
 * renders only in the main window, never in a popout such as the player window, and its
 * saved state is the record's identity alone, never its content.
 */
export class ConversationRecordView extends ItemView {
  private identity: RecordViewIdentity | null = null;
  private root: Root | null = null;
  /** A new generation remounts the content, so it reads again and drops any pending read. */
  private generation = 0;

  getViewType(): string {
    return RECORD_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.identity ? `${this.identity.seatCaption || 'Conversation'} · ${short(this.identity.conversationId)}` : 'Conversation record';
  }

  getIcon(): string {
    return 'scroll-text';
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass('atlas-vtt-plugin', 'atlas-record-view');
    this.root = createRoot(this.contentEl);
    this.register(this.contentEl.onWindowMigrated(() => this.render()));
    this.render();
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = null;
  }

  getState(): Record<string, unknown> {
    const identity = this.identity;
    return identity
      ? { sourceKey: identity.sourceKey, runtime: identity.runtime, conversationId: identity.conversationId, cwd: identity.cwd, seatCaption: identity.seatCaption }
      : {};
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    this.identity = recordViewIdentity(state);
    this.generation++;
    this.render();
    await super.setState(state, result);
  }

  /** Reads the record again, as *Reload* does. */
  reread(): void {
    this.generation++;
    this.render();
  }

  private render(): void {
    if (!this.root) return;
    const inMainWindow = this.leaf.getContainer() === this.app.workspace.rootSplit;
    this.root.render(!this.identity
      ? <p className="atlas-record-view__status">No conversation record is selected.</p>
      : !inMainWindow
        ? <p className="atlas-record-view__status">Conversation records open only in the main window.</p>
        : <RecordViewContent key={`${recordIdentityKey(this.identity)}:${this.generation}`} identity={this.identity} sources={NativeSources.forApp(this.app)} />);
  }
}
