import { describe, expect, it, vi } from 'vitest';
import type { App, WorkspaceLeaf } from 'obsidian';
import { RECORD_VIEW_TYPE } from '../../src/app/agent-links/records/ConversationRecordView';
import { openRecordView } from '../../src/app/agent-links/records/openRecordView';
import type { RecordViewIdentity } from '../../src/app/agent-links/records/recordViewState';

const identity: RecordViewIdentity = { sourceKey: 'local', runtime: 'claude-code', conversationId: 'conversation-example-1', cwd: '/work/example', seatCaption: 'Build A' };

/** A workspace with a main window (`rootSplit`) and the leaves the test hands it. */
function workspace(leaves: WorkspaceLeaf[], next: WorkspaceLeaf): { app: App; setActiveLeaf: ReturnType<typeof vi.fn>; revealLeaf: ReturnType<typeof vi.fn> } {
  const setActiveLeaf = vi.fn();
  const revealLeaf = vi.fn(async () => undefined);
  const app = { workspace: { rootSplit, getLeavesOfType: () => leaves, getLeaf: () => next, setActiveLeaf, revealLeaf } } as unknown as App;
  return { app, setActiveLeaf, revealLeaf };
}
const rootSplit = {};
const leafIn = (container: object, state: unknown = {}): WorkspaceLeaf => ({
  getContainer: () => container, getViewState: () => ({ type: RECORD_VIEW_TYPE, state }), setViewState: vi.fn(async () => undefined), detach: vi.fn(), view: {},
}) as unknown as WorkspaceLeaf;

describe('opening a record view', () => {
  it('opens a new tab in the main window and makes it the active, focused leaf', async () => {
    const fresh = leafIn(rootSplit);
    const { app, setActiveLeaf } = workspace([], fresh);
    await openRecordView(app, identity);
    expect(fresh.setViewState).toHaveBeenCalledWith({ type: RECORD_VIEW_TYPE, state: identity, active: true });
    expect(setActiveLeaf).toHaveBeenCalledTimes(1);
    expect(setActiveLeaf).toHaveBeenCalledWith(fresh, { focus: true });
  });

  it('brings an open view of the same record forward and focuses it instead of opening another', async () => {
    const open = leafIn(rootSplit, { ...identity });
    const unused = leafIn(rootSplit);
    const { app, setActiveLeaf, revealLeaf } = workspace([open], unused);
    await openRecordView(app, identity);
    expect(revealLeaf).toHaveBeenCalledWith(open);
    expect(setActiveLeaf).toHaveBeenCalledWith(open, { focus: true });
    expect(unused.setViewState).not.toHaveBeenCalled();
  });

  it('never opens or focuses a record outside the main window', async () => {
    const popout = leafIn({ popout: true });
    const { app, setActiveLeaf } = workspace([], popout);
    await expect(openRecordView(app, identity)).rejects.toThrow('main window');
    expect(popout.detach).toHaveBeenCalled();
    expect(setActiveLeaf).not.toHaveBeenCalled();
  });
});
