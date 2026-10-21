import React, { useCallback, useSyncExternalStore } from 'react';
import { useAtlasUI } from '../../react/root/AtlasUIContext';
import type { ChosenRow, ProposalsSnapshot } from './MapmakingSession';
import { ProposalsPanel } from './ProposalsPanel';

const subscribeNone = (): (() => void) => (): void => {};
const noSnapshot = (): ProposalsSnapshot | null => null;

/** Mounts the view's Proposals panel while it is open; `SourceOverlays` keeps it out of both player surfaces. */
export function ProposalsOverlay(): React.ReactElement | null {
  const { renderer } = useAtlasUI();
  const session = renderer?.getMapmaking() ?? null;
  const snapshot = useSyncExternalStore(session?.subscribe ?? subscribeNone, session?.getSnapshot ?? noSnapshot);
  const preview = useCallback((choice: readonly ChosenRow[]): void => session?.preview(choice), [session]);
  if (!session || !snapshot?.open) return null;
  return <div className="atlas-proposals-overlay">
    <ProposalsPanel snapshot={snapshot} onPreview={preview} onApply={(choice, consent) => void session.apply(choice, consent)}
      onDismiss={(key) => session.dismiss(key)} onChooseTarget={session.chooseTarget} onClose={session.close} />
  </div>;
}
