import { createHash } from 'crypto';
import { TFile, type App } from 'obsidian';
import type { AccountDocument } from './accountSchema';
import { validateAccount } from './accountValidation';

const ACCOUNT_BYTE_LIMIT = 1024 * 1024;

/**
 * What a guarded account write did. *Refused* happened before anything was written. *Confirmed*
 * carries the exact text now in the file. *Indeterminate* means the write may have happened,
 * possibly at another path: the caller reloads and publishes nothing that depends on it.
 */
export type AccountWriteOutcome =
  | { kind: 'refused'; reason: string }
  | { kind: 'confirmed'; text: string; sha256: string }
  | { kind: 'indeterminate'; reason: string };

/** How an account file is laid out, so a write keeps it; `canonical` says re-serialising it unchanged gives back its exact text. */
export interface AccountLayout { indent: string; finalNewline: boolean; canonical: boolean }

class AccountRefusal extends Error {}

export function textSha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function accountLayout(text: string): AccountLayout {
  const indent = /^\{\r?\n([ \t]+)"/.exec(text)?.[1] ?? '  ';
  const finalNewline = text.endsWith('\n');
  let canonical = false;
  try {
    // Validation sets the key order a write produces, so the comparison goes through it too.
    canonical = serialize(validateAccount(JSON.parse(text) as unknown), indent, finalNewline) === text;
  } catch {
    canonical = false;
  }
  return { indent, finalNewline, canonical };
}

function serialize(value: unknown, indent: string, finalNewline: boolean): string {
  return `${JSON.stringify(value, null, indent)}${finalNewline ? '\n' : ''}`;
}

/**
 * One guarded write of an account through Obsidian's atomic read-modify-save. The file must
 * still hold the text whose SHA-256 the caller read; the change gets the validated account and
 * its result is validated before it is written. Atomic only against other Obsidian writers on
 * this one file: not a two-file transaction, not a power-loss receipt, and no exclusion of sync
 * tools, git or other processes.
 */
export async function writeAccount(
  app: App, path: string, expectedSha256: string, change: (account: AccountDocument) => AccountDocument,
): Promise<AccountWriteOutcome> {
  const file = app.vault.getAbstractFileByPath(path);
  const name = path.split('/').pop() ?? path;
  if (!(file instanceof TFile)) return { kind: 'refused', reason: `${name} is no longer in the vault.` };
  let written: string | null = null;
  try {
    await app.vault.process(file, (current) => {
      if (file.path !== path) throw new AccountRefusal(`${name} was moved.`);
      if (textSha256(current) !== expectedSha256) throw new AccountRefusal(`${name} changed since it was read.`);
      const layout = accountLayout(current);
      let next: string;
      try {
        next = serialize(validateAccount(change(validateAccount(JSON.parse(current) as unknown))), layout.indent, layout.finalNewline);
      } catch (error) {
        throw new AccountRefusal(error instanceof Error ? error.message : 'The change does not make a valid account.');
      }
      if (new TextEncoder().encode(next).byteLength > ACCOUNT_BYTE_LIMIT) throw new AccountRefusal('The account would exceed its 1 MiB limit.');
      written = next;
      return next;
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'The account could not be written.';
    // Before the callback returned nothing was written; after it, the write may already be on disk.
    return written === null || error instanceof AccountRefusal ? { kind: 'refused', reason } : { kind: 'indeterminate', reason };
  }
  const text: string | null = written;
  if (text === null) return { kind: 'refused', reason: 'The account was not written.' };
  const now = app.vault.getAbstractFileByPath(path);
  // A replacement at the same path is caught by the text compare below; identical text is the same account.
  if (file.path !== path || !(now instanceof TFile)) return { kind: 'indeterminate', reason: `${name} was moved or replaced during the write.` };
  const current = await app.vault.read(now);
  if (current !== text) return { kind: 'indeterminate', reason: `${name} changed right after the write.` };
  return { kind: 'confirmed', text, sha256: textSha256(text) };
}

const exclusions = new Map<string, Promise<unknown>>();

/** Runs `operation` after every earlier one for the same account path; Atlas's own operations never interleave. */
export function withAccountExclusion<T>(path: string, operation: () => Promise<T>): Promise<T> {
  const previous = exclusions.get(path) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(operation);
  const settled = run.catch(() => undefined);
  exclusions.set(path, settled);
  void settled.then(() => {
    if (exclusions.get(path) === settled) exclusions.delete(path);
  });
  return run;
}
