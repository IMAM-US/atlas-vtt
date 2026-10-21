import React from 'react';
import { AgentLinkOverlay } from '../../agent-links/card/AgentLinkOverlay';
import { RecordedWorkspaceOverlay } from '../../agent-workspace/RecordedWorkspaceOverlay';
import { useAtlasStore } from '../ViewStoreContext';
import { LiveLayerHover } from '../../agent-links/overlay/LiveLayerHover';

/**
 * The DM's source overlays: the recorded workspace inspector and the account card. They are
 * mounted only in the DM's own view, never in player view or the DM's player preview (the
 * view that gets screen-shared), and outside loading. Switching to either player surface
 * unmounts them, which cancels their pending actions rather than hiding them.
 */
export function SourceOverlays({ isPlayerView }: { isPlayerView: boolean }): React.ReactElement | null {
  const isGMView = useAtlasStore((state) => state.isGMView);
  const isMapLoading = useAtlasStore((state) => state.isMapLoading);
  if (isPlayerView || !isGMView || isMapLoading) return null;
  return <>
    <LiveLayerHover />
    <RecordedWorkspaceOverlay />
    <AgentLinkOverlay />
  </>;
}
