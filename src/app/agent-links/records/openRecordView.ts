import type { App } from 'obsidian';
import { ConversationRecordView, RECORD_VIEW_TYPE } from './ConversationRecordView';
import { recordIdentityKey, recordViewIdentity, type RecordViewIdentity } from './recordViewState';

/**
 * Opens the record view of one exact conversation in a tab of the main window and makes it
 * the active, focused leaf. A view that already shows that record is brought forward, focused
 * and reads it again rather than duplicated. Only this explicit open moves focus; the view's
 * own reads, reloads and paging never do.
 */
export async function openRecordView(app: App, identity: RecordViewIdentity): Promise<void> {
  const { workspace } = app;
  const key = recordIdentityKey(identity);
  const existing = workspace.getLeavesOfType(RECORD_VIEW_TYPE).find((leaf) => {
    const shown = recordViewIdentity(leaf.getViewState().state);
    return shown !== null && recordIdentityKey(shown) === key && leaf.getContainer() === workspace.rootSplit;
  });
  if (existing) {
    await workspace.revealLeaf(existing);
    workspace.setActiveLeaf(existing, { focus: true });
    if (existing.view instanceof ConversationRecordView) existing.view.reread();
    return;
  }
  const leaf = workspace.getLeaf('tab');
  if (leaf.getContainer() !== workspace.rootSplit) {
    leaf.detach();
    throw new Error('Conversation records open only in the main window.');
  }
  await leaf.setViewState({ type: RECORD_VIEW_TYPE, state: { ...identity }, active: true });
  workspace.setActiveLeaf(leaf, { focus: true });
}
