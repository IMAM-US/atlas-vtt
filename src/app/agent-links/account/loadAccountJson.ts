import { TFile, type App } from 'obsidian';
import { sha256 } from '../../services/collectionBundle/hashing';
import { isAccountPath } from './references';

const ACCOUNT_BYTE_LIMIT = 1024 * 1024;

export interface LoadedAccountJson {
  path: string;
  value: unknown;
  sha256: string;
  modifiedAt: number;
}

function checkCanceled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new Error('Account read canceled.');
}

/** Reads only the authored vault document. Schema/subject resolution never falls back to a caption. */
export async function loadAccountJson(app: App, path: string, signal?: AbortSignal): Promise<LoadedAccountJson> {
  checkCanceled(signal);
  if (!isAccountPath(path)) throw new Error('The account must be a visible vault-local JSON file.');
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) throw new Error('The linked account file is missing.');
  const before = { ...file.stat };
  if (before.size > ACCOUNT_BYTE_LIMIT) throw new Error('The account exceeds the 1 MiB read limit.');
  const text = await app.vault.read(file);
  checkCanceled(signal);
  if (app.vault.getAbstractFileByPath(path) !== file || file.path !== path
    || file.stat.mtime !== before.mtime || file.stat.ctime !== before.ctime || file.stat.size !== before.size) {
    throw new Error('The account changed during the read. Refresh it.');
  }
  const bytes = new TextEncoder().encode(text);
  if (bytes.byteLength > ACCOUNT_BYTE_LIMIT) throw new Error('The account exceeds the 1 MiB read limit.');
  let value: unknown;
  try { value = JSON.parse(text) as unknown; } catch { throw new Error('The linked account is not valid JSON.'); }
  const hash = await sha256(bytes);
  checkCanceled(signal);
  return { path, value, sha256: hash, modifiedAt: before.mtime };
}
