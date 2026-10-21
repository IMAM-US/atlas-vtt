import { describe, expect, it, vi } from 'vitest';
import { TFile } from 'obsidian';
import { accountLayout, textSha256, withAccountExclusion, writeAccount } from '../../src/app/agent-links/account/accountWriter';
import type { AccountDocument } from '../../src/app/agent-links/account/accountSchema';
import { createInMemoryApp } from '../mocks/inMemoryVault';
import { exampleAccount } from '../fixtures/exampleAccount';

const PATH = 'atlas-vtt/collections/Example/accounts/team.json';
const text = (account: AccountDocument = exampleAccount(), indent = 2, finalNewline = true): string =>
  `${JSON.stringify(account, null, indent)}${finalNewline ? '\n' : ''}`;

/** Adds one synthetic source, the kind of change Apply makes. */
const addSource = (account: AccountDocument): AccountDocument => ({
  ...account, sources: [...account.sources, { id: 'added', description: 'Added by a test', observedAt: '2026-01-01T11:00:00Z' }],
});

describe('guarded account writes', () => {
  it('confirms a write with the exact text now in the file, keeping its layout', async () => {
    const before = text(exampleAccount(), 4, false);
    const { app, files } = createInMemoryApp({ files: { [PATH]: before } });
    const outcome = await writeAccount(app, PATH, textSha256(before), addSource);
    expect(outcome.kind).toBe('confirmed');
    const after = files.get(PATH)!;
    expect(outcome).toMatchObject({ text: after, sha256: textSha256(after) });
    expect(after.startsWith('{\n    "format"')).toBe(true);
    expect(after.endsWith('\n')).toBe(false);
    expect((JSON.parse(after) as AccountDocument).sources.map((source) => source.id)).toEqual(['roster', 'added']);
  });

  it('refuses before writing when the file changed, the change is invalid, or it would exceed the limit', async () => {
    const before = text();
    const { app, files } = createInMemoryApp({ files: { [PATH]: before } });
    await expect(writeAccount(app, PATH, textSha256('something else'), addSource)).resolves.toMatchObject({ kind: 'refused', reason: expect.stringContaining('changed since it was read') });
    await expect(writeAccount(app, PATH, textSha256(before), (account) => ({ ...account, format: 'other' } as unknown as AccountDocument))).resolves.toMatchObject({ kind: 'refused' });
    await expect(writeAccount(app, PATH, textSha256(before), (account) => ({ ...account, title: 'x'.repeat(1024 * 1024) }))).resolves.toMatchObject({ kind: 'refused', reason: expect.stringContaining('1 MiB') });
    await expect(writeAccount(app, 'atlas-vtt/missing.json', textSha256(before), addSource)).resolves.toMatchObject({ kind: 'refused' });
    expect(files.get(PATH)).toBe(before);
  });

  it('never reports nothing written once the write may have happened', async () => {
    const before = text();
    const moved = createInMemoryApp({ files: { [PATH]: before } });
    const original = moved.app.vault.process;
    moved.app.vault.process = vi.fn(async (file: TFile, fn: (data: string) => string) => {
      await original(file, fn);
      moved.files.set('atlas-vtt/elsewhere.json', moved.files.get(PATH)!);
      moved.files.delete(PATH);
    });
    await expect(writeAccount(moved.app, PATH, textSha256(before), addSource)).resolves.toMatchObject({ kind: 'indeterminate' });

    const failed = createInMemoryApp({ files: { [PATH]: before } });
    const write = failed.app.vault.process;
    failed.app.vault.process = vi.fn(async (file: TFile, fn: (data: string) => string) => {
      await write(file, fn);
      throw new Error('disk reported an error after saving');
    });
    await expect(writeAccount(failed.app, PATH, textSha256(before), addSource)).resolves.toMatchObject({ kind: 'indeterminate', reason: 'disk reported an error after saving' });

    const changedAfter = createInMemoryApp({ files: { [PATH]: before } });
    const save = changedAfter.app.vault.process;
    changedAfter.app.vault.process = vi.fn(async (file: TFile, fn: (data: string) => string) => {
      await save(file, fn);
      changedAfter.files.set(PATH, `${changedAfter.files.get(PATH)!} `);
    });
    await expect(writeAccount(changedAfter.app, PATH, textSha256(before), addSource)).resolves.toMatchObject({ kind: 'indeterminate' });
  });

  it('says whether re-serialising an account gives back its exact text', () => {
    expect(accountLayout(text()).canonical).toBe(true);
    expect(accountLayout(text(exampleAccount(), 4, false))).toMatchObject({ indent: '    ', finalNewline: false, canonical: true });
    expect(accountLayout(text().replace('"title": "Example team"', '"title":   "Example team"')).canonical).toBe(false);
  });

  it('runs Atlas operations on one account one after another', async () => {
    const order: string[] = [];
    let release: () => void = () => undefined;
    const first = withAccountExclusion(PATH, () => new Promise<void>((resolve) => { order.push('first starts'); release = () => { order.push('first ends'); resolve(); }; }));
    const second = withAccountExclusion(PATH, async () => { order.push('second runs'); });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(order).toEqual(['first starts']);
    release();
    await Promise.all([first, second]);
    expect(order).toEqual(['first starts', 'first ends', 'second runs']);
  });
});
