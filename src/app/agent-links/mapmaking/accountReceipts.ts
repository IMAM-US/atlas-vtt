import type { App, TFile } from 'obsidian';
import { readAccountReceipt } from '../account/accountWriter';
import { fileName } from './applyReport';

/** An account an Apply depends on, with the SHA-256 of the text its proposals came from. */
export interface AccountBasis { path: string; sha256: string }
/** Why the receipts no longer hold, and for which account (null when they kept changing as a whole). */
export interface ReceiptLapse { path: string | null; reason: string }

/** Reading every account again after a vault event; a basis still moving after this many passes refuses. */
const PASSES = 3;

/**
 * Holds every account an Apply depends on to its basis. `qualify` reads them all, each the same
 * TFile before and after its read, and succeeds only on a pass no vault event for them
 * interrupted. `held` is the synchronous check between qualifications: same files, no event since.
 * Atlas sees what reaches it; this is no transaction against writers it never hears from.
 */
export class AccountReceipts {
  private readonly receipts = new Map<string, { file: TFile | null; sha256: string }>();
  private seen = new Map<string, number>();

  constructor(private readonly app: App, bases: readonly AccountBasis[], private readonly eventsOf: (path: string) => number) {
    for (const basis of bases) this.receipts.set(basis.path, { file: null, sha256: basis.sha256 });
  }

  async qualify(): Promise<ReceiptLapse | null> {
    for (let pass = 0; pass < PASSES; pass++) {
      const versions = new Map([...this.receipts.keys()].map((path) => [path, this.eventsOf(path)]));
      for (const [path, receipt] of this.receipts) {
        const read = await readAccountReceipt(this.app, path, receipt.sha256, receipt.file ?? undefined);
        if (typeof read === 'string') return { path, reason: read };
        receipt.file = read.file;
      }
      if ([...versions].every(([path, version]) => this.eventsOf(path) === version)) {
        this.seen = versions;
        return null;
      }
    }
    return { path: null, reason: 'The accounts this map uses kept changing during Apply.' };
  }

  held(): ReceiptLapse | null {
    for (const [path, receipt] of this.receipts) {
      if (!receipt.file || receipt.file.path !== path || this.app.vault.getAbstractFileByPath(path) !== receipt.file) return { path, reason: `${fileName(path)} was moved or replaced.` };
      if (this.eventsOf(path) !== this.seen.get(path)) return { path, reason: `${fileName(path)} changed during Apply.` };
    }
    return null;
  }

  /** After a confirmed write the account is held to the text written, which the next `qualify` reads back. */
  wrote(path: string, sha256: string): void {
    const receipt = this.receipts.get(path);
    if (receipt) receipt.sha256 = sha256;
  }
}
