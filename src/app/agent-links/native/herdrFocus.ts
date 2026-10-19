import { isHerdrFocused, readHerdrSnapshot } from './herdrRead';
import { requestJsonSocket, type SocketRequestOptions } from './jsonSocket';
import { readHerdrViewWitness, revalidateHerdrView, type HerdrViewWitness } from './herdrViews';
import type { TmuxConnection } from './tmuxRead';

export interface HerdrFocusResult {
  status: 'focused' | 'uncertain';
  previous: HerdrViewWitness | null;
  message: string;
}

/** One explicit focus request followed by read-back. It never launches, retries or injects input. */
export async function focusHerdrView(
  intended: HerdrViewWitness,
  tmux: readonly TmuxConnection[],
  revalidateParticipant: () => Promise<void>,
  options?: SocketRequestOptions,
): Promise<HerdrFocusResult> {
  const { snapshot } = await revalidateHerdrView(intended, tmux, options);
  await revalidateParticipant();
  const prior = snapshot.panes.find((pane) => isHerdrFocused(snapshot, pane));
  const previous = prior ? await readHerdrViewWitness(snapshot, prior, tmux, options) : null;
  let actionError: unknown;
  try {
    await requestJsonSocket(intended.socketPath, 'pane.focus', { pane_id: intended.pane.pane_id }, options);
  } catch (error) {
    actionError = error;
  }
  // Even after a timeout the action may have happened. Read back, never replay.
  try {
    const { snapshot: observed } = await revalidateHerdrView(intended, tmux, options);
    await revalidateParticipant();
    if (!isHerdrFocused(observed, intended.pane)) {
      return { status: 'uncertain', previous, message: 'Herdr is showing another view. Refresh before choosing again.' };
    }
    return { status: 'focused', previous, message: 'The existing view is selected. Switch to Herdr to see it.' };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'The current view could not be verified.';
    return { status: 'uncertain', previous, message: actionError ? `Focus result is unknown. ${reason}` : reason };
  }
}

/** Return revalidates the named previous view; it does not restore automatically or follow a reused label. */
export async function returnToHerdrView(
  previous: HerdrViewWitness, tmux: readonly TmuxConnection[], options?: SocketRequestOptions,
): Promise<HerdrFocusResult> {
  return focusHerdrView(previous, tmux, async (): Promise<void> => {
    const snapshot = await readHerdrSnapshot(previous.socketPath, options);
    if (snapshot.socketIdentity !== previous.socketIdentity) throw new Error('The previous Herdr server was replaced.');
  }, options);
}
