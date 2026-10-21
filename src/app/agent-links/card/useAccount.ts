import { useEffect, useState } from 'react';
import type { App } from 'obsidian';
import { NativeSources } from '../NativeSources';
import type { LoadedAccount } from '../reads';

export interface AccountState { loaded: LoadedAccount | null; error: string | null; reload: () => void }

/**
 * Loads and validates the account behind a reference; a late result after the path changed is
 * dropped. It reads again whenever the vault reports the file modified, created, deleted or
 * renamed, so a seat map-making added, or an edit made outside Atlas, shows without reopening.
 */
export function useAccount(app: App, accountPath: string): AccountState {
  const [loaded, setLoaded] = useState<LoadedAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const reread = (path: string, oldPath?: string): void => {
      if (path === accountPath || oldPath === accountPath) setAttempt((count) => count + 1);
    };
    const refs = [
      app.vault.on('modify', (file) => reread(file.path)),
      app.vault.on('create', (file) => reread(file.path)),
      app.vault.on('delete', (file) => reread(file.path)),
      app.vault.on('rename', (file, oldPath) => reread(file.path, oldPath)),
    ];
    return () => { for (const ref of refs) app.vault.offref(ref); };
  }, [app, accountPath]);
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
