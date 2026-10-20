import { useEffect, useState } from 'react';
import type { App } from 'obsidian';
import { NativeSources } from '../NativeSources';
import type { LoadedAccount } from '../reads';

export interface AccountState { loaded: LoadedAccount | null; error: string | null; reload: () => void }

/** Loads and validates the account behind a reference; a late result after the path changed is dropped. */
export function useAccount(app: App, accountPath: string): AccountState {
  const [loaded, setLoaded] = useState<LoadedAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoaded(null);
    setError(null);
    NativeSources.forApp(app).loadAccount(accountPath, { signal: controller.signal }).then((result) => {
      if (!controller.signal.aborted) setLoaded(result);
    }).catch((failure: unknown) => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'The account could not be read.');
    });
    return () => controller.abort();
  }, [app, accountPath, attempt]);
  return { loaded, error, reload: () => setAttempt((count) => count + 1) };
}
