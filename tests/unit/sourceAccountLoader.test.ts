// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { TFile, type App } from 'obsidian';
import { loadAccountJson } from '../../src/app/agent-links/account/loadAccountJson';
import { createInMemoryApp } from '../mocks/inMemoryVault';

async function fixture(text: string): Promise<{ app: App; file: TFile }> {
  const { app } = createInMemoryApp();
  const path = 'accounts/team.json';
  await app.vault.create(path, text);
  const file = new TFile(path);
  file.stat.size = new TextEncoder().encode(text).byteLength;
  // Obsidian retains a TFile identity; the shared lightweight vault mock does not.
  app.vault.getAbstractFileByPath = vi.fn((requested) => requested === path ? file : null);
  return { app, file };
}

it('loads the exact authored document and fingerprints its original bytes', async () => {
  const { app } = await fixture('{"subjects":[]}');
  expect(await loadAccountJson(app, 'accounts/team.json')).toMatchObject({ path: 'accounts/team.json', value: { subjects: [] }, sha256: expect.stringMatching(/^[0-9a-f]{64}$/) });
  await expect(loadAccountJson(app, '../team.json')).rejects.toThrow('vault-local');
  await expect(loadAccountJson(app, 'accounts/missing.json')).rejects.toThrow('missing');
});

it('bounds actual bytes even if metadata understated size, and rejects malformed JSON', async () => {
  const { app, file } = await fixture('{');
  await expect(loadAccountJson(app, file.path)).rejects.toThrow('valid JSON');
  app.vault.read = vi.fn(async () => ' '.repeat(1024 * 1024 + 1));
  await expect(loadAccountJson(app, file.path)).rejects.toThrow('read limit');
});

it('rejects a late result after selection cancellation and a changed file during reading', async () => {
  const { app, file } = await fixture('{}');
  const controller = new AbortController();
  app.vault.read = vi.fn(async () => { controller.abort(); return '{}'; });
  await expect(loadAccountJson(app, file.path, controller.signal)).rejects.toThrow('canceled');
  app.vault.read = vi.fn(async () => { file.stat.mtime++; return '{}'; });
  await expect(loadAccountJson(app, file.path)).rejects.toThrow('changed during');
});
