// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { execFile } from 'child_process';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { readLocalFile, readLocalFilePrefix, readPreservedFile, sha256 } from '../../src/app/agent-links/native/localFiles';
import { readCheckoutFacts, readGitFile, readWorkingGitFile } from '../../src/app/agent-links/native/gitFiles';
import { locateProviderRecord } from '../../src/app/agent-links/native/providerRecord';

const execute = promisify(execFile);
const roots: string[] = [];

async function directory(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'atlas-file-proof-'));
  roots.push(root);
  return root;
}

async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await execute('git', ['-C', root, ...args], {
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' },
  });
  return stdout.trim();
}

async function repository(): Promise<string> {
  const root = await directory();
  await git(root, ['init', '-b', 'initial']);
  await git(root, ['config', 'user.name', 'Fixture']);
  await git(root, ['config', 'user.email', 'fixture@example.invalid']);
  await git(root, ['config', 'commit.gpgsign', 'false']);
  return root;
}

async function commit(root: string, message: string): Promise<string> {
  await git(root, ['add', '--all']);
  await git(root, ['commit', '-m', message]);
  return git(root, ['rev-parse', 'HEAD']);
}

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('configured local artifact reads', () => {
  it('returns exact bytes and hash, and distinguishes bounded prefixes', async () => {
    const root = await directory();
    await writeFile(join(root, 'brief.md'), 'actual bytes');
    const full = await readLocalFile(root, 'brief.md');
    expect(full.bytes.toString()).toBe('actual bytes');
    expect(full.sha256).toBe(sha256(Buffer.from('actual bytes')));
    expect(full.sizeBytes).toBe(12);
    const prefix = await readLocalFilePrefix(root, 'brief.md', { maxBytes: 4 });
    expect(prefix).toMatchObject({ fileSizeBytes: 12, complete: false });
    expect(prefix.bytes.toString()).toBe('actu');
    expect(prefix).not.toHaveProperty('sha256');
    await expect(readLocalFile(root, 'brief.md', { maxBytes: 4 })).rejects.toThrow('read limit');
  });

  it('rejects traversal, escaped symlinks, non-files and invalid bounds', async () => {
    const root = await directory();
    const outside = await directory();
    await writeFile(join(outside, 'private.md'), 'outside');
    await symlink(join(outside, 'private.md'), join(root, 'escape.md'));
    await symlink(outside, join(root, 'escape-directory'));
    await mkdir(join(root, 'folder'));
    await expect(readLocalFile(root, '../private.md')).rejects.toThrow('safe relative');
    await expect(readLocalFile(root, '/private.md')).rejects.toThrow('safe relative');
    await expect(readLocalFile(root, 'escape.md')).rejects.toThrow('escapes');
    await expect(readLocalFile(root, 'escape-directory/private.md')).rejects.toThrow('escapes');
    await expect(readLocalFile(root, 'folder')).rejects.toThrow('regular file');
    await expect(readLocalFile(root, 'folder', { maxBytes: Infinity })).rejects.toThrow('limit');
  });

  it('requires preserved bytes to match their supplied digest', async () => {
    const root = await directory();
    await writeFile(join(root, 'captured.md'), 'reviewed');
    const digest = sha256(Buffer.from('reviewed'));
    await expect(readPreservedFile(root, 'captured.md', digest)).resolves.toMatchObject({ sha256: digest });
    await writeFile(join(root, 'captured.md'), 'tampered');
    await expect(readPreservedFile(root, 'captured.md', digest)).rejects.toThrow('SHA-256 mismatch');
    await expect(readPreservedFile(root, 'captured.md', '')).rejects.toThrow('needs a SHA-256');
  });
});

describe('exact Git artifacts', () => {
  it('keeps reviewed bytes separate from the same bytes on divergent history', async () => {
    const root = await repository();
    const name = "brief's $(never-executed).md";
    await writeFile(join(root, name), 'same bytes');
    const reviewed = await commit(root, 'original work');
    await git(root, ['checkout', '--orphan', 'other-work']);
    const current = await commit(root, 'unrelated work');
    expect(current).not.toBe(reviewed);
    const historical = await readGitFile(root, name, reviewed);
    const working = await readWorkingGitFile(root, name);
    expect(historical.sha256).toBe(working.sha256);
    expect(historical.revision).toBe(reviewed);
    expect(historical.checkout).toMatchObject({ headCommit: current, branch: 'other-work', comparedRevisionIsAncestor: false });
    await writeFile(join(root, name), 'changed working bytes');
    expect((await readWorkingGitFile(root, name)).sha256).not.toBe(historical.sha256);
    expect((await readGitFile(root, name, reviewed)).bytes.toString()).toBe('same bytes');
  });

  it('rejects absent/abbreviated revisions and never falls back to the worktree', async () => {
    const root = await repository();
    await writeFile(join(root, 'brief.md'), 'present working file');
    const revision = await commit(root, 'fixture');
    await expect(readGitFile(root, 'brief.md', revision.slice(0, 8))).rejects.toThrow('full hexadecimal');
    await expect(readGitFile(root, 'brief.md', 'f'.repeat(40))).rejects.toThrow();
    await expect(readGitFile(root, 'absent.md', revision)).rejects.toThrow('missing');
    await expect(readGitFile(root, 'brief.md', revision, { maxBytes: 3 })).rejects.toThrow('read limit');
  });

  it('rejects historical symlinks and a configured subdirectory posing as a repository', async () => {
    const root = await repository();
    await writeFile(join(root, 'brief.md'), 'bytes');
    await symlink('brief.md', join(root, 'link.md'));
    const revision = await commit(root, 'fixture');
    await expect(readGitFile(root, 'link.md', revision)).rejects.toThrow('regular file');
    const blob = await git(root, ['rev-parse', `${revision}:brief.md`]);
    await expect(readGitFile(root, 'brief.md', blob)).rejects.toThrow('not a commit');
    await mkdir(join(root, 'subdirectory'));
    await expect(readCheckoutFacts(join(root, 'subdirectory'))).rejects.toThrow('worktree root');
    await git(root, ['checkout', '--detach', revision]);
    expect((await readCheckoutFacts(root, revision)).branch).toBeNull();
  });

  it('ignores inherited Git variables that point at another repository', async () => {
    const root = await repository();
    await writeFile(join(root, 'brief.md'), 'configured repository');
    const revision = await commit(root, 'configured');
    const other = await repository();
    await writeFile(join(other, 'brief.md'), 'wrong repository');
    await commit(other, 'other');
    vi.stubEnv('GIT_DIR', join(other, '.git'));
    vi.stubEnv('GIT_WORK_TREE', root);
    vi.stubEnv('GIT_OBJECT_DIRECTORY', join(other, '.git/objects'));
    expect((await readGitFile(root, 'brief.md', revision)).bytes.toString()).toBe('configured repository');
  });
});

describe('explicit provider record identity', () => {
  it('validates the Codex header without searching neighboring records', async () => {
    const root = await directory();
    const header = `${JSON.stringify({ type: 'session_meta', payload: { id: 'thread-exact' } })}\n`;
    await writeFile(join(root, 'exact.jsonl'), `${header}${'x'.repeat(1000)}`);
    await writeFile(join(root, 'newer.jsonl'), JSON.stringify({ type: 'session_meta', payload: { id: 'other' } }));
    const record = await locateProviderRecord({ providerRoot: root, relativePath: 'exact.jsonl', runtime: 'codex', conversationId: 'thread-exact', maxBytes: header.length + 5 });
    expect(record).toMatchObject({ conversationId: 'thread-exact', validatedRecords: 1, complete: false });
    await expect(locateProviderRecord({ providerRoot: root, relativePath: 'newer.jsonl', runtime: 'codex', conversationId: 'thread-exact' })).rejects.toThrow('ID mismatch');
    await expect(locateProviderRecord({ providerRoot: root, relativePath: 'exact.jsonl', runtime: 'codex', conversationId: 'thread-exact', maxBytes: 5 })).rejects.toThrow('read limit');
    await expect(locateProviderRecord({ providerRoot: root, relativePath: 'missing.jsonl', runtime: 'codex', conversationId: 'thread-exact' })).rejects.toThrow();
  });

  it('validates Claude session records and rejects mixed identity or sidechains', async () => {
    const root = await directory();
    const request = { providerRoot: root, relativePath: 'conversation.jsonl', runtime: 'claude-code' as const, conversationId: 'conversation-exact' };
    await writeFile(join(root, request.relativePath), [
      { type: 'file-history-snapshot' },
      { type: 'user', sessionId: request.conversationId },
      { type: 'assistant', sessionId: request.conversationId },
    ].map((row) => JSON.stringify(row)).join('\n'));
    expect((await locateProviderRecord(request)).validatedRecords).toBe(2);
    await writeFile(join(root, request.relativePath), `${JSON.stringify({ sessionId: request.conversationId })}\n${JSON.stringify({ sessionId: 'other' })}\n`);
    await expect(locateProviderRecord(request)).rejects.toThrow('ID mismatch');
    await writeFile(join(root, request.relativePath), JSON.stringify({ sessionId: request.conversationId, isSidechain: true }));
    await expect(locateProviderRecord(request)).rejects.toThrow('sidechain');
    await writeFile(join(root, request.relativePath), '{broken');
    await expect(locateProviderRecord(request)).rejects.toThrow('invalid JSON');
  });
});
