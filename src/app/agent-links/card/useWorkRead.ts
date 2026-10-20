import { useEffect, useState } from 'react';
import type { Observation } from '../live/types';
import type { Work } from '../reads';
import { useCard } from './cardContext';

/** Full native records stay lazy, shared while expanded, and separately dated from custody. */
export function useWorkRead(sourceKey: string, qitemId: string): Observation<Work> | null {
  const registry = useCard().sources.live;
  const key = JSON.stringify([sourceKey, qitemId]);
  const [state, setState] = useState<{ key: string; fact: Observation<Work> } | null>(null);
  useEffect(() => {
    let handle;
    try { handle = registry.openRig(sourceKey).watchWork(qitemId); }
    catch (error) {
      setState({ key, fact: { sourceKey, epoch: 0, revision: 0, freshness: 'unavailable', value: null, observedAt: null,
        message: error instanceof Error ? error.message : 'Native work could not be opened.' } });
      return;
    }
    const update = (): void => setState({ key, fact: handle.getSnapshot() });
    const cleanup = handle.subscribe(update); update();
    return () => { cleanup(); handle.release(); };
  }, [registry, sourceKey, qitemId, key]);
  return state?.key === key ? state.fact : null;
}
