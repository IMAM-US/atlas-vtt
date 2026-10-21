import { useContext, useEffect, useSyncExternalStore } from 'react';
import { AtlasUIContext } from '../../react/root/AtlasUIContext';

const subscribeNone = (): (() => void) => (): void => {};

/** How many proposed seats share a pod with this group's members on the current map, from the Proposals diff. */
export function useGroupProposals(accountPath: string, groupId: string): { count: number; open: () => void } | null {
  // Cards can render outside a view (tests, previews); there is no map to propose for then.
  const session = useContext(AtlasUIContext)?.renderer?.getMapmaking() ?? null;
  useEffect(() => session?.retain(), [session]);
  const count = useSyncExternalStore(session?.subscribe ?? subscribeNone, () => session?.groupCount(accountPath, groupId) ?? 0);
  return session && count > 0 ? { count, open: session.open } : null;
}
